import type {HubRequest,HubResponse,CalendarPayload,ExternalForecastPayload} from '../../../packages/platform-source-hub-contracts/index.js';
const calendar:HubRequest={contractVersion:'1.0.0',provider:'trading-economics',family:'economic-calendar',operation:'search',criteria:{countries:['Poland'],importance:3}};
// @ts-expect-error A forecast is not a News Discovery consumer request.
const invalid:HubRequest={contractVersion:'1.0.0',provider:'trading-economics',family:'news-discovery',operation:'search',criteria:{horizons:['q1']}};
const commentary:HubRequest={contractVersion:'1.0.0',provider:'trading-economics',family:'news-discovery',operation:'search',criteria:{newsType:'markets'}};
const market:HubRequest={contractVersion:'1.0.0',provider:'trading-economics',family:'external-forecasts',operation:'search',criteria:{forecastType:'markets',marketCategory:'commodity',symbols:['CO1:COM']}};
// @ts-expect-error No source key travels in the public request contract.
const key:HubRequest={contractVersion:'1.0.0',provider:'brave',family:'news-discovery',operation:'search',criteria:{text:'news',apiKey:'secret'}};
declare const c:HubResponse<CalendarPayload>,f:HubResponse<ExternalForecastPayload>;
const distinct:Array<string|number|null>=[c.items[0].payload.actual,c.items[0].payload.consensusForecast,c.items[0].payload.vendorForecast];
const external:false=f.items[0].payload.forecastCorePrediction;
void calendar;void invalid;void key;void distinct;void external;void commentary;void market;
import {createFirstPartySourceHubClient} from '@profitia/platform-source-hub-contracts/client';
import type {SourceExecution} from '@profitia/platform-current-e1-authority/first-party';
const service:SourceExecution={kind:'SERVICE',organisationId:'synthetic-org',grantId:'synthetic-grant'};
// @ts-expect-error SERVICE uses a canonical grant, never a made-up human owner.
const fakeHuman:SourceExecution={kind:'SERVICE',organisationId:'synthetic-org',userId:'forged'};
void service;void fakeHuman;void createFirstPartySourceHubClient;

const observations:HubRequest={contractVersion:'1.0.0',provider:'trading-economics',family:'market-observations',operation:'search',criteria:{mode:'historical',symbols:['SYNTHETIC:COM'],from:'2026-11-01',to:'2026-11-06'}};void observations;
