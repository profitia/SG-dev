import type {Application,AccessBasis,ProductGrant} from './operation-context.mjs';
export declare const RECURRING_JOB_CONTRACT:Readonly<{id:'profitia.private-recurring-job';version:'1.0.0'}>;
export type RecurringJobOperation='newsfeed.monitor.execute'|'insights.subscription.execute';
export declare const RECURRING_JOB_OPERATIONS:readonly RecurringJobOperation[];
export interface RecurringDelegation {
 contract:'profitia.private-recurring-job/1.0.0';schemaDigest:string;delegationId:string;delegationVersion:string;
 jobId:string;leaseId:string;executorApplicationId:string;serviceActorId:string;organisationId:string;ownerUserId:string;
 resourceType:'newsfeed_observation'|'report_subscription';resourceId:string;resourceVersion:string;scheduleSlot:string;
 payloadDigest:string;policyResourceId:string;claimedAt:string;expiresAt:string;policyVersion:string;
 ownerApplication:Application;ownerAccess:AccessBasis;ownerProducts:ProductGrant[];
 identityObservation:{status:'ACTIVE';issuer:string;subject:string;observedAt:string;expiresAt:string};
}
export declare function recurringOperationPolicy(operation:string):Readonly<{resourceType:RecurringDelegation['resourceType'];ownerOperation:string;ownerFeature:string}>|null;
export declare function validateRecurringDelegation(value:unknown,scope:{operation:string;jobId:string;applicationId:string;organisationId:string;actorId:string;payloadDigest:string;schemaDigest:string;now:number}):Readonly<RecurringDelegation>;
