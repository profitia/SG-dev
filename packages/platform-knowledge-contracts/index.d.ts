export type KnowledgeScope = 'PROFITIA_SHARED' | 'ACCOUNT_PRIVATE';
export type QueryTask = 'ANSWER' | 'DOCUMENT_SUMMARY' | 'MEMORY_RECALL';
export interface KnowledgeQuery {
  version:'0.1.0'|'0.2.0'; requestId:string; task:QueryTask; query:string; language:string;
  scopes:KnowledgeScope[]; documentIds?:string[]; maxTokens:number; tokenizerId:string; targetModel:string;
}
export interface SourceRights {
  classification:'UNKNOWN'|'PUBLIC'|'INTERNAL'|'CONFIDENTIAL'|'RESTRICTED';
  purpose:'PRIVATE'|'PROFITIA_INTERNAL'|'CUSTOMER_SERVICE'; organisationConstraintId:string|null;
  externalAiAllowed:boolean; quotingAllowed:boolean; apiExcerptAllowed:boolean;
}
export interface Evidence {
  evidenceId:string; sourceId:string; documentId:string; generationId:string; sourceVersion:string;
  text:string; scope:KnowledgeScope; rights:SourceRights; coverage:'COMPLETE'|'PARTIAL';
  authority:'BINDING_STANDARD'|'REFERENCE'|'HISTORICAL'|'WITHDRAWN'|'UNKNOWN';
  locations:{unitId:string;kind:'PAGE'|'SLIDE'|'PARAGRAPH'|'TABLE'|'CHART';ordinal:number;start:number;end:number}[];
  rank:number; validUntil:string|null;
}
export interface KnowledgeContext {
  version:'0.1.0'|'0.2.0'; requestId:string;
  status:'READY'|'EMPTY'|'INSUFFICIENT_EVIDENCE'|'PARTIAL'|'DENIED'|'UNAVAILABLE'|'STALE';
  evidence:Evidence[]; usedTokens:number; tokenizerId:string; targetModel:string;
  omissions:('SOURCE_PARTIAL'|'BUDGET'|'RIGHTS'|'EXPIRED'|'NO_SUPPORT'|'SUMMARY_INCOMPLETE')[];
  continuation:string|null;
  /** Generated synthesis, never a literal quotation; all source units assessed. */
  summary?:{text:string;generated:true;expectedUnits:number;coveredUnitIds:string[];missingUnitIds:string[];evidenceIds:string[]};
}
export interface AccountDeletionCommand {
  version:'0.1.0'; commandId:string; environment:'development'|'staging'|'production';
  internalUserId:string; scope:'ACCOUNT_PRIVATE_ALL'; effectiveAt:string; reason:'ACCOUNT_DELETED';
}
export interface DeletionReceipt {
  version:'0.1.0'; commandId:string; state:'ACCEPTED'|'RETRIEVAL_REVOKED'|'PURGING'|'PURGED'|'RETAINED_BY_POLICY'|'FAILED_RETRYABLE';
  effectiveAt:string; backupPurgeBy:string|null; retainedCategories:('LEGAL_HOLD'|'MANDATORY_AUDIT')[];
}
export const CONTRACT:Readonly<{id:'profitia.platform-knowledge';version:'0.2.0'}>;
export const schemas:Record<string,unknown>;
export function assertQuery(q:unknown):KnowledgeQuery;
export function assertContextSemantics(q:KnowledgeQuery,result:KnowledgeContext,countTokens:(serialized:string)=>number):KnowledgeContext;

export interface SourceStatus {sourceId:string;event:'READY'|'PREPARED'|'PROCESSING'|'WITHDRAWN'|'DELETED'|'EXPIRED'|'UNAVAILABLE';available:boolean;revision:string|null;generationId:string|null;checkedAt:string}
export const httpContract:Readonly<Record<string,unknown>>;
