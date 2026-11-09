import type {CommonMetadata,SourceCoverage,HubResponse} from './index.mjs'
export const COMMODITY_CONTRACT_VERSION:'1.1.0'
export const PUBLICATION_SCHEDULE_CONTRACT_VERSION:'1.2.0'
export type CommodityFamily='data-catalog'|'series-observations'|'positioning-observations'|'publication-calendar'
export type CommodityProvider='eia'|'cftc'|'commodities-sh'
export const COMMODITY_FAMILIES:readonly CommodityFamily[]
export const COMMODITY_PROVIDERS:Readonly<Record<CommodityProvider,readonly CommodityFamily[]>>
type Page={limit?:number;offset?:number}
type Request<P,F,O,C>={contractVersion:'1.1.0';provider:P;family:F;operation:O;criteria:C}
export type CommodityRequest=PublicationScheduleRequest|LegacyCommodityRequest
export type LegacyCommodityRequest=
 |Request<'eia','data-catalog','catalog'|'metadata',Page&{path?:string;facet?:string}>
 |Request<'eia','series-observations','observations',Page&{path:string;frequency:string;data:string[];facets?:Record<string,string[]>;start?:string;end?:string;sort?:Array<{column:string;direction:'asc'|'desc'}>}>
 |Request<'cftc','data-catalog','catalog',Page>
 |Request<'cftc','data-catalog','metadata',Page&{datasetId:string}>
 |Request<'cftc','positioning-observations','observations',Page&{datasetId:string;columns?:string[];filters?:Array<{field:string;op:'eq'|'gte'|'lte';value:string|number|boolean}>;orderBy?:string;direction?:'asc'|'desc'}>
 |Request<'commodities-sh','data-catalog','catalog'|'metadata',Page&{endpoint?:'catalog'|'openapi'}>
 |Request<'commodities-sh','publication-calendar','calendar',{limit?:number}>
export type Json=null|string|number|boolean|Json[]|{[name:string]:Json}
export interface DatasetMetadata {
 kind:'DATASET_METADATA'|'FACET_METADATA'|'OPERATION_METADATA'|'INSTRUMENT_METADATA'
 datasetId:string;name:string;description:string|null
 fields:Array<{name:string;type:string|null;description:string|null;unit:string|null}>
 children:Array<{id:string;name:string|null;description:string|null}>
 frequencies:Array<{id:string;description?:string|null;format?:string|null;query?:string|null}>
 facets:Array<{id:string;description?:string|null}>
 periodRange:{start:string|null;end:string|null}
 [additionalProviderMetadata:string]:unknown
}
export interface SeriesObservation {
 datasetId:string;referencePeriod:string;frequency:string
 dimensions:Record<string,string|number|boolean|null>
 measures:Array<{field:string;value:string|number|boolean|null;unit:string|null;currency:null}>
 observedAt:null;publishedAt:null;revisionStatus:'PROVIDER_CURRENT_SNAPSHOT_NOT_VINTAGE';upstreamApiVersion:string|null
}
export interface PositioningObservation {
 datasetId:string;reportDate:string;contractCode:string;contractName:string|null;reportVariant:string|null;providerRowId:string|null
 columns:Record<string,string|number|boolean|null>;uniqueness:'NOT_ASSERTED';unitBasis:'PROVIDER_COLUMN_DEFINITION_REQUIRED';publicationAt:null
 revisionStatus:'PROVIDER_CURRENT_REPORT_SNAPSHOT'
}
export interface PublicationSchedule {
 kind:'PUBLICATION_SCHEDULE';scheduleId:string;title:string;scheduledAt:string|null;dateOnly:string|null;recurrence:string|null;timeZone:string|null
 releaseStatus:'PROVIDER_SCHEDULE_ONLY';sourceName:string|null;sourceUrl:string|null;providerSchedule:Json;actual:null;forecast:null;previous:null
}
export type CommodityMetadata=Omit<CommonMetadata,'contractFamily'|'contractVersion'|'providerId'|'consumerStorage'>&{
 contractFamily:CommodityFamily;contractVersion:'1.1.0'|'1.2.0';providerId:CommodityProvider
 consumerStorage?:{mode:'CATALOG_METADATA_ONLY';basisRef:string;licenceVersion:string}
}
export type CommodityResponse<T=DatasetMetadata|SeriesObservation|PositioningObservation|PublicationSchedule|PublicationScheduleV12>=Omit<HubResponse,'contractVersion'|'family'|'provider'|'items'|'coverage'>&{
 contractVersion:'1.1.0'|'1.2.0';family:CommodityFamily;provider:CommodityProvider;items:Array<{metadata:CommodityMetadata;payload:T}>;coverage:SourceCoverage|PublicationScheduleCoverage
}
export function parseCommodityRequest(value:unknown):CommodityRequest
export function assertCommodityResponse(value:unknown,expected:CommodityRequest):CommodityResponse

export type PublicationScheduleRequest={contractVersion:'1.2.0';family:'publication-calendar';operation:'calendar'}&({provider:'eia';criteria:{publication:'wpsr'|'steo';from:string;to:string;limit?:number}}|{provider:'commodities-sh';criteria:{limit?:number}})
export interface PublicationScheduleV12 {
 kind:'PUBLICATION_SCHEDULE';scheduleId:string|null;title:string;publicationRef:string;correlationKey:string
 identityStatus:'PROVIDER_ID'|'CORRELATION_ONLY'|'OFFICIAL_PUBLICATION_DEFINITION'
 scheduledAt:string|null;scheduledUntil:string|null;dateOnly:string|null;localDateTime:string|null;timeZone:string|null
 timePrecision:'INSTANT'|'DATE'|'TIME_WINDOW'|'RECURRENCE_ONLY'|'UNKNOWN';recurrence:string|null;referencePeriod:string|null
 releaseStatus:'PROVIDER_SCHEDULE_ONLY';scheduleStatus:'OFFICIAL_EXCEPTION'|'OFFICIAL_DATED'|'RULE_DERIVED_UNCONFIRMED'|'PROVIDER_REPORTED'|'UNDATED'
 sourceName:string|null;sourceUrl:string|null;officialSource:boolean;sourceUpdatedAt:null;lastVerifiedAt:'metadata.retrievedAt'
 standardSchedule:{weekday:number;localTime:string;timeZone:string}|null;exception:{reason:string;standardDate:string}|null
 sourceTiming:{rawDate:string|null;typicalTime:string|null;nextHint:string|null}
 qualityFlags:string[];actual:null;previous:null;forecast:null;publishedAt:null
}
export function parsePublicationScheduleRequest(value:unknown):PublicationScheduleRequest

export interface PublicationScheduleCoverage {scope:'SOURCE_SCHEDULE_PROJECTION';completeness:'UNKNOWN'|'INCOMPLETE';providerRows:number|null;projected:number;ruleDerived:number;returned:number;nativeFilters:string[];localFilters:string[]}
