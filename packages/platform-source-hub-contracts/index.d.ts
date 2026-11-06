export const SOURCE_HUB_CONTRACT_VERSION:'1.0.0';
export type ContractFamily='news-discovery'|'economic-calendar'|'indicators'|'external-forecasts'|'market-observations';
export const CONTRACT_FAMILIES:readonly ContractFamily[];
export type ImplementationState='IMPLEMENTED_AND_LIVE_VERIFIED'|'IMPLEMENTED_OFFLINE_VERIFIED'|'UNAVAILABLE_OR_NOT_ENTITLED'|'NOT_IMPLEMENTED';
export const IMPLEMENTATION_STATES:readonly ImplementationState[];
export type ProviderId='newsapi'|'brave'|'trading-economics';
export interface BraveCriteria {
  text:string;resultType?:'web'|'news';country?:string;language?:string;uiLanguage?:string;
  freshness?:'pd'|'pw'|'pm'|'py'|`${string}to${string}`;count?:number;offset?:number;
  safeSearch?:'off'|'moderate'|'strict';spellcheck?:boolean;extraSnippets?:boolean;
  domains?:string[];excludedDomains?:string[];
}
export interface CalendarCriteria {countries?:string[];indicators?:string[];eventIds?:string[];tickers?:string[];from?:string;to?:string;importance?:1|2|3;eventText?:string;limit?:number;}
export interface IndicatorCriteria {countries?:string[];indicators?:string[];tickers?:string[];limit?:number;}
export interface ForecastCriteria extends IndicatorCriteria {horizons?:Array<'q1'|'q2'|'q3'|'q4'|'YearEnd'|'YearEnd2'|'YearEnd3'>;}
export interface TradingEconomicsNewsCriteria {countries?:string[];indicators?:string[];tickers?:string[];newsType?:'markets'|'economy';from?:string;to?:string;text?:string;limit?:number;}
export type MarketObservationCriteria={mode:'snapshot';symbols?:string[];instrumentUrls?:string[];limit?:number}|{mode:'historical';symbols:string[];from:string;to:string;limit?:number};
export interface MarketObservationPayload {mode:'SNAPSHOT'|'HISTORICAL';vendorSymbol:string;name:string|null;marketType:string|null;instrumentType:string|null;underlyingMappingRef:null;mappingStatus:'NOT_ADOPTED_BY_MARKET_DATA';observationAt:string|null;temporalPrecision:'DAY'|'INSTANT'|'UNKNOWN';price:number|string|null;quoteBasis:'VENDOR_LAST'|'VENDOR_CLOSE'|'VENDOR_VALUE';unit:string|null;currency:string|null;contractExpiry:string|null;rolloverRef:null;session:string|null;lastUpdate:string|null;sourceUrl:string|null;ohlc:{open:number|string|null;high:number|string|null;low:number|string|null;close:number|string|null};changes:Record<string,number|string|null>;native:Record<string,unknown>;}
export interface MarketForecastCriteria {forecastType:'markets';marketCategory:'index'|'currency'|'crypto'|'commodity'|'bond';symbols?:string[];limit?:number;}
type Base<F extends ContractFamily,P extends ProviderId,O extends string,C>={contractVersion:'1.0.0';family:F;provider:P;operation:O;criteria:C};
export type HubRequest=Base<'news-discovery','newsapi','search',DiscoveryQuery>|Base<'news-discovery','newsapi','publishers',PublisherQuery>
 |Base<'news-discovery','brave','search',BraveCriteria>|Base<'economic-calendar','trading-economics','search',CalendarCriteria>
 |Base<'indicators','trading-economics','search',IndicatorCriteria>|Base<'external-forecasts','trading-economics','search',ForecastCriteria|MarketForecastCriteria>
 |Base<'news-discovery','trading-economics','search',TradingEconomicsNewsCriteria>
 |Base<'market-observations','trading-economics','search',MarketObservationCriteria>;
export interface CommonMetadata {
 consumerStorage?:{mode:'DURABLE_OWNER_ENTITLEMENT';basisRef:string;licenceVersion:string};
 contractFamily:ContractFamily;contractVersion:'1.0.0';providerId:ProviderId;apiFamily:string;endpointVersion:string;
 vendorRecordId:string|null;sourceRecordRef:string;sourceUrl:string|null;retrievedAt:string;availableAt:string|null;
 asOf:string|null;licenceRef:string;qualityStatus:'PROVIDER_REPORTED'|'UNKNOWN';contentFingerprint:string;usageReceiptRef:string;retentionUntil:string|null;redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY';
}
export interface DiscoveryPayload {kind:'NEWS_ARTICLE'|'WEB_PAGE'|'PUBLISHER';title:string|null;description:string|null;url:string|null;
 publisher:{id:string|null;name:string|null}|null;publishedAt:string|null;modifiedAt:string|null;indexedAt:string|null;
 language:string|null;publisherCountry:string|null;eventGeography:null;providerDateMetadata:Record<string,unknown>;legacy?:unknown;
 commentary?:{country:string|null;category:string|null;symbol:string|null;importance:number|null;type:string|null};native?:Record<string,unknown>;}
export interface CalendarPayload {eventId:string;eventAt:string|null;eventTimezone:string|null;country:string|null;indicator:string|null;event:string|null;
 actual:string|number|null;consensusForecast:string|number|null;vendorForecast:string|number|null;previous:string|number|null;revised:string|number|null;
 dateSpan:number|null;importance:number|null;lastUpdate:string|null;referencePeriod:string|null;unit:string|null;currency:string|null;
 releaseStatus:'REPORTED'|'SCHEDULED'|'UNKNOWN';temporalPosition:'PAST'|'FUTURE'|'UNKNOWN';source:string|null;sourceUrl:string|null;native:Record<string,unknown>;}
export interface IndicatorPayload {indicatorId:string;country:string|null;indicator:string|null;value:number|string|null;referencePeriod:string|null;
 frequency:string|null;unit:string|null;lastUpdate:string|null;source:string|null;sourceUrl:string|null;native:Record<string,unknown>;}
export interface ExternalForecastPayload {indicatorId:string;country:string|null;indicator:string|null;vendorModel:'Trading Economics';
 historical:{value:number|string|null;referencePeriod:string|null};points:ReadonlyArray<{horizon:string;value:number|string|null;targetDate:string|null}>;
 unit:string|null;frequency:string|null;lastUpdate:string|null;forecastCorePrediction:false;native:Record<string,unknown>;
 forecastType?:'markets';symbol?:string;marketType?:string|null;instrumentMappingStatus?:'NOT_ADOPTED_BY_MARKET_DATA';}
export interface SourceCoverage {scope:'PROVIDER_RETURNED_SUBSET';completeness:'UNKNOWN'|'INCOMPLETE';providerReturned:number;matchedLocally:number;returned:number;
 nativeFilters:string[];localFilters:string[];operatorSemantics?:'EXPERIMENTAL_UNVERIFIED';providerQueryAltered?:boolean|null;}
export type SourceRecord<T>={metadata:CommonMetadata;payload:T};
export interface HubResponse<T=DiscoveryPayload|CalendarPayload|IndicatorPayload|ExternalForecastPayload> {
 contractVersion:'1.0.0';family:ContractFamily;provider:ProviderId;status:'ok'|'empty';items:Array<SourceRecord<T>>;
 page:{page:number|null;pageSize:number|null;more:boolean|null;total:number|null;truncated:boolean};
 provenance:{retrievedAt:string;licenceRef:string;qualityStatus:'PROVIDER_REPORTED'|'UNKNOWN'};
 usage:{receiptRef:string;upstreamAttempts:0|1;cacheHit:boolean};
 coverage?:SourceCoverage;
}
export interface CapabilityFilter {name:string;support:'NATIVE'|'TEXT_OPERATOR'|'LOCAL_PROJECTION'|'UNSUPPORTED';evidence:'DOCUMENTED'|'OBSERVED'|'UNVERIFIED';semantics:string;}
export interface ProviderCapability {id:ProviderId;family:ContractFamily;contractVersion:'1.0.0';implementation:ImplementationState;activation:'SOURCE_ADMISSION_AND_LICENCE_REQUIRED';filters:readonly CapabilityFilter[];legacy?:DiscoveryCapabilities;
 requestSupport:readonly CapabilityFilter[];resultMetadataSupport:readonly string[];evidenceKind:'DOCUMENTATION_AND_OFFLINE_TESTS'|'LIVE_VERIFIED';limitations:readonly string[];entitlementRefOrUnknown:string;}
export class SourceHubError extends Error {code:string;status:number;retryAfterSeconds:number|null;constructor(code:string,status?:number,retryAfterSeconds?:number|null);toJSON():{code:string;retryAfterSeconds:number|null};}
export function closed(value:unknown,keys:readonly string[]):boolean;
export function parseHubRequest(value:unknown):HubRequest;
export function assertHubResponse<T=DiscoveryPayload|CalendarPayload|IndicatorPayload|ExternalForecastPayload>(value:unknown,expected:Pick<HubRequest,'family'|'provider'|'operation'>):HubResponse<T>;

// Preserved public NewsDiscovery0.1.0 compatibility contract.
export const NEWS_DISCOVERY_CONTRACT_VERSION: '0.1.0';
export type NewsCategory = 'business' | 'entertainment' | 'general' | 'health' | 'science' | 'sports' | 'technology';
export interface Terms { all?: string[]; any?: string[]; phrases?: string[]; excluded?: string[] }
export interface DiscoveryQuery {
  mode: 'articles' | 'headlines';
  /** Optional advanced text expression; provider capability determines grammar support. */
  text?: string;
  terms?: Terms;
  fields?: ('headline' | 'summary' | 'body')[];
  category?: NewsCategory;
  /** Headline edition, NEVER the location of the event. */
  editionCountry?: string;
  /** IDs belong to the selected provider, not to a shared global publisher registry. */
  publisherIds?: string[];
  domains?: string[];
  excludedDomains?: string[];
  language?: string;
  publishedAfter?: string;
  publishedBefore?: string;
  order?: 'newest' | 'relevance' | 'publisherPopularity';
  page?: number;
  pageSize?: number;
  /** Recognized as a criterion; rejected when a provider cannot support it. */
  eventLocation?: { country?: string; region?: string; city?: string; latitude?: number; longitude?: number };
}
export interface PublisherQuery { category?: NewsCategory; language?: string; publisherCountry?: string }
export interface NewsArticle {
  url: string;
  headline: string | null;
  summary: string | null;
  bodyPreview: string | null;
  imageUrl: string | null;
  byline: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  publisher: { id: string | null; name: string | null };
  language: string | null;
  category: NewsCategory | null;
  eventLocation: null;
  provenance: { provider: string; mode: 'articles' | 'headlines'; fullTextAvailable: boolean };
}
export interface NewsPublisher {
  id: string; name: string; description: string | null; url: string;
  category: string | null; language: string | null; publisherCountry: string | null;
}
export interface DiscoveryResult {
  contractVersion: typeof NEWS_DISCOVERY_CONTRACT_VERSION;
  provider: string; status: 'ok' | 'empty'; mode: 'articles' | 'headlines';
  totalAvailable: number; items: NewsArticle[]; page: number; pageSize: number;
  /** Pagination is plan-dependent; this does not promise every counted item is retrievable. */
  moreResultsReported: boolean;
  observedAt: string;
}
export interface PublisherResult {
  contractVersion: typeof NEWS_DISCOVERY_CONTRACT_VERSION;
  provider: string; status: 'ok' | 'empty'; items: NewsPublisher[]; observedAt: string;
}
export interface SearchCapabilities {
  text?: boolean; advancedText?: boolean; terms?: boolean; fields?: string[];
  publisherIds?: boolean | {maximum?: number; maximumInAdapter?: number; providerMaximum?: string};
  domains?: boolean; excludedDomains?: boolean; language?: string[];
  category?: string[]; editionCountry?: string[];
  publishedAfter?: boolean; publishedBefore?: boolean; order?: string[];
  pageSize?: {min:number;max:number;default:number};
  defaultOrder?: string; maxQueryCharacters?: number; constraints?: string[];
}
export interface DiscoveryCapabilities {
  provider: string; documentedAt: string; evidence: string;
  articles: SearchCapabilities; headlines: SearchCapabilities;
  publishers: {category?:string[];language?:string[];publisherCountry?:string[];catalogueScope:string};
  unsupported: Record<string,boolean|string[]>;
  limits: {history:string;delay:string;retrievableResults:string;fullArticleContent:boolean};
}
export interface NewsDiscoveryProvider {
  search(query: DiscoveryQuery): Promise<DiscoveryResult>;
  listPublishers(query?: PublisherQuery): Promise<PublisherResult>;
  getCapabilities(): DiscoveryCapabilities;
}
export interface DiscoveryEvent {
  provider: string; operation: 'articles' | 'headlines' | 'publishers';
  outcome: string; durationMs: number; httpStatus: number | null; count: number | null;
}
