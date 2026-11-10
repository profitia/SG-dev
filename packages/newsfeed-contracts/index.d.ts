export {NEWS_DISCOVERY_CONTRACT_VERSION} from '../platform-source-hub-contracts/index.js';
export type {NewsCategory,Terms,DiscoveryQuery,PublisherQuery,NewsArticle,NewsPublisher,DiscoveryResult,PublisherResult,SearchCapabilities,DiscoveryCapabilities,NewsDiscoveryProvider,DiscoveryEvent} from '../platform-source-hub-contracts/index.js';
import type {HubRequest} from '../platform-source-hub-contracts/index.js';
export const NEWSFEED_API_CONTRACT_VERSION:'1.0.0';
export const SAVED_SEARCH_CONTRACT_VERSION:'1.2.0';
export interface ObservationInput {name:string;subjectKind:'company'|'product'|'investment'|'category'|'topic';subject:string;request:Extract<HubRequest,{family:'news-discovery';operation:'search'}>;}
export interface ObservationUpdate extends Partial<ObservationInput> {version:number;status?:'ACTIVE'|'PAUSED';}
export interface Observation extends ObservationInput {id:string;contractVersion:'1.0.0';applicationId:string;environment:'development'|'staging'|'production';organisationId:string;ownerUserId:string;createdByActorId:string;updatedByActorId:string;status:'ACTIVE'|'PAUSED';version:number;createdAt:string;updatedAt:string;}
export function parseObservation(value:unknown,options?:{partial:false}):ObservationInput;
export function parseObservation(value:unknown,options:{partial:true}):ObservationUpdate;
export interface ScheduleInput {frequency:'DAILY'|'WEEKLY'|'MONTHLY';timeZone:string;localTime:string;startDate:string;endDate:string|null;weekdays?:number[];monthDay?:number|null;}
export interface SavedSearchInput extends ObservationInput {contractVersion:'1.2.0';phrases:string[];schedule:ScheduleInput|null;notifications:boolean;}
export interface SavedSearchUpdate extends Partial<Omit<SavedSearchInput,'contractVersion'>> {contractVersion:'1.2.0';version:number;status?:'ACTIVE'|'PAUSED';}
export type SavedSearch=Omit<Observation,'contractVersion'>&SavedSearchInput&{readOnly:boolean;monitoringState:'MANUAL'|'WAITING_AUTHORIZATION'|'ACTIVE'|'PAUSED'|'ENDED'|'ERROR';nextDueAt:string|null};
export interface PublicationIndexItem {id:string;url:string;headline:string|null;publishedAt:string|null;detectedAt:string;provider:string;kind:'NEWS_ARTICLE'|'WEB_PAGE';sourceRecordRef:string;licenceRef:string;retrievedAt:string;excerpt:null;excerptStatus:'NOT_RETAINED';topics?:Array<{id:string;name:string}>;}
export interface SavedPage<T> {items:T[];nextCursor:string|null;}
export function parseSchedule(value:unknown): (ScheduleInput&{dstPolicy:'SKIP_NONEXISTENT_EARLIEST_REPEAT'})|null;
export function parseSavedSearch(value:unknown,options?:{partial:false}):SavedSearchInput;
export function parseSavedSearch(value:unknown,options:{partial:true}):SavedSearchUpdate;
