import { AzureFunction, Context } from '@azure/functions';
import { AdaptiveCards } from '@microsoft/adaptivecards-tools';
import { AxiosInstance, ConversationBot, TeamsBotInstallation } from '@microsoft/teamsfx';
import { GlobalQuote } from './cardModels';
import { bot } from './internal/initialize';
import template from './adaptiveCards/notification-default.json'
import { alphaVantageClient } from './apiConnections/alphaVantage';

const timerTrigger: AzureFunction = async function (context: Context, myTimer: any): Promise<void> {
  const timestamp = getTimestamp(new Date());

  getQuoteBySymbol(alphaVantageClient)('MSFT')
    .then(getResponseData)
    .then(extractGlobalQuote)
    .then(transformGlobalQuote)
    .then(quote => addTimestamp(quote)(timestamp))
    .then(quote => addCompanyName(quote)('Microsoft Corporation'))
    .then(quote =>
      getInstallations(bot)
        .then(targets => targets.map(target => sendCard(target)(AdaptiveCards)(template)(quote)))
    )
    .catch(err => handleError(err)(context));

}

const getTimestamp =
  (date: Date): string =>
    makeValidAdaptiveCardISOString(date.toISOString());

const makeValidAdaptiveCardISOString =
  (iso: string): string =>
    `${iso.split('.')[0]}Z`;

const getQuoteBySymbol =
  (apiClient: AxiosInstance) =>
    (symbol: string) =>
      apiClient.get(`/query?function=GLOBAL_QUOTE&symbol=${symbol}`)

const getResponseData =
  (res: any): object =>
    res.data;

const extractGlobalQuote =
  (data: object): GlobalQuote =>
    data['Global Quote'];

const transformGlobalQuote =
  (quote: GlobalQuote): GlobalQuote => ({
    symbol: Object.values(quote)[0],
    open: Number.parseFloat(Object.values(quote)[1]),
    high: Number.parseFloat(Object.values(quote)[2]),
    low: Number.parseFloat(Object.values(quote)[3]),
    price: Number.parseFloat(Object.values(quote)[4]),
    volume: Number.parseFloat(Object.values(quote)[5]),
    latestTradingDay: Object.values(quote)[6],
    previousClose: Number.parseFloat(Object.values(quote)[7]),
    change: Number.parseFloat(Object.values(quote)[8]),
    changePercent: Number.parseFloat(removePercent(Object.values(quote)[9]))
  });

const removePercent =
  (string: string): string =>
    string.replace('%', '');

const addTimestamp =
  (quote: GlobalQuote) =>
    (timestamp: string): GlobalQuote => { return { ...quote, timestamp } }

const addCompanyName =
  (quote: GlobalQuote) =>
    (name: string): GlobalQuote => { return { ...quote, name } }

const getInstallations =
  (bot: ConversationBot): Promise<TeamsBotInstallation[]> =>
    bot.notification.installations();

const sendCard =
  <T extends object>(target: TeamsBotInstallation) =>
    (ac: typeof AdaptiveCards) =>
      (template: object) =>
        (quote: GlobalQuote): Promise<any> =>
          target.sendAdaptiveCard(ac.declare<T>(template).render(quote as T));

const handleError =
  (err: Error) =>
    (context: Context) =>
      context.log({ err });

export default timerTrigger;
