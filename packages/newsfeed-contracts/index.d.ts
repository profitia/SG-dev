export {NEWS_DISCOVERY_CONTRACT_VERSION} from '../platform-source-hub-contracts/index.js';
export type {NewsCategory,Terms,DiscoveryQuery,PublisherQuery,NewsArticle,NewsPublisher,DiscoveryResult,PublisherResult,SearchCapabilities,DiscoveryCapabilities,NewsDiscoveryProvider,DiscoveryEvent} from '../platform-source-hub-contracts/index.js';
import type {HubRequest} from '../platform-source-hub-contracts/index.js';
export const NEWSFEED_API_CONTRACT_VERSION:'1.0.0';
export interface ObservationInput {name:string;subjectKind:'company'|'product'|'investment'|'category'|'topic';subject:string;request:Extract<HubRequest,{family:'news-discovery';operation:'search'}>;}
export interface ObservationUpdate extends Partial<ObservationInput> {version:number;status?:'ACTIVE'|'PAUSED';}
export interface Observation extends ObservationInput {id:string;contractVersion:'1.0.0';applicationId:string;environment:'development'|'staging'|'production';organisationId:string;ownerUserId:string;createdByActorId:string;updatedByActorId:string;status:'ACTIVE'|'PAUSED';version:number;createdAt:string;updatedAt:string;}
export function parseObservation(value:unknown,options?:{partial:false}):ObservationInput;
export function parseObservation(value:unknown,options:{partial:true}):ObservationUpdate;
