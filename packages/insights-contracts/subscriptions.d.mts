export const SUBSCRIPTION_CONTRACT:'procurement-insights.subscription/1.0.0';
export const PUBLISHED_EDITION_CONTRACT:'procurement-insights.published-edition/1.0.0';
export interface ReportProfile {definitionId:string;profileVersion:string;label:string;description:string;availability:'AVAILABLE';subjectMode:'NONE'|'REFERENCE';subjectKinds?:string[];cadences:('ONCE'|'WEEKLY')[];timeZones:string[];deliveryChannels:('ASSISTANT'|'EMAIL')[];sections:string[];}
export interface SubscriptionInput {contractVersion:typeof SUBSCRIPTION_CONTRACT;name:string;definitionId:string;profileVersion:string;subjectRef:{kind:string;key:string}|null;schedule:{frequency:'WEEKLY';weekday:number;localTime:string;timeZone:string;startDate:string;endDate:string|null}|null;notifications:{assistant:boolean;email:boolean};}
export interface SubscriptionUpdate extends SubscriptionInput {version:number;status:'ACTIVE'|'PAUSED'|'ENDED';}
export interface SubscriptionStatusUpdate {contractVersion:typeof SUBSCRIPTION_CONTRACT;version:number;status:'ACTIVE'|'PAUSED'|'ENDED';}
export interface PublishedEdition {contractVersion:typeof PUBLISHED_EDITION_CONTRACT;producerJobId:string;editionId:string;definitionId:string;profileVersion:string;title:string;period:{fromDate:string;throughDate:string};asOf:string;publishedAt:string;pdfSha256:string;markdownSha256:string;status:'PUBLISHED';readOnly:boolean;markdown?:string;}
export interface PublicationShareCommand {contractVersion:'procurement-insights.publication-sharing/1.0.0';mode:'ORG'|'USER_LINK';}
export interface PublicationShares {grants:Array<{id:string;mode:'ORG'|'USER';createdAt:string}>;invitations:Array<{id:string;expiresAt:string;claimedAt:string|null}>;}
export interface Subscription extends SubscriptionInput {id:string;ownerUserId:string;organisationId:string;version:number;status:'ACTIVE'|'PAUSED'|'ENDED';executionState:'WAITING_AUTHORIZATION'|'READY'|'QUEUED'|'ENDED';nextDueAt:string|null;createdAt:string;updatedAt:string;}
export function parseSubscription(value:unknown,profile:ReportProfile,options?:{partial:false}):SubscriptionInput;
export function parseSubscription(value:unknown,profile:ReportProfile,options:{partial:true}):SubscriptionUpdate;
