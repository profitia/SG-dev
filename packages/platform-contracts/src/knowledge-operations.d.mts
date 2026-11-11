import type {OperationState,BoundRequest,Actor,Application} from './operation-context.mjs';
export type KnowledgeOperation = `knowledge.private.${'document.import'|'document.read'|'document.query'|'document.delete'|'memory.read'|'memory.write'|'memory.forget'|'service.process'}` | `knowledge.shared.${'document.import'|'document.read'|'document.query'|'document.publish'|'document.withdraw'|'document.delete'|'service.process'}`;
export interface KnowledgeExecutionPolicy {
 provider:'openai';models:readonly ['gpt-6-luna','text-embedding-3-small'];store:false;maximumPaidAttempts:1;
 maximumInputTokens:16384;maximumOutputTokens:4096;maximumJobMinutes:30;maximumDocumentMicrousd:1000000;
 globalBudgetCeilingMicrousd:number;atomicPerBatch:true;uncertainRetainsReservation:true;
}
export interface KnowledgeOperationEvidence {
 contract:'profitia.knowledge-operations/1.0.0';schemaDigest:string;applicationId:string;environment:'development';resourceId:string;
 payloadDigest:string;scope:'ACCOUNT_PRIVATE'|'PROFITIA_SHARED';transactionId:string;ownerUserId:string|null;
 administrationAllowed:boolean;revocationVersion:string;expiresAt:string;executionPolicy?:Readonly<KnowledgeExecutionPolicy>;
 delegation?:Readonly<{id:string;resourceId:string;status:'ACTIVE';expiresAt:string;revocationVersion:string}>;
}
export interface KnowledgeOperationRule {feature:'platform_knowledge';resourceType:'knowledge_memory'|'knowledge_document';dataClass:'ACCOUNT_PRIVATE'|'SHARED_KNOWLEDGE';effect:'READ'|'WRITE';product:null;mode:'ACCOUNT'|'KNOWLEDGE_SERVICE';knowledge:true;scope:'private'|'shared';allowUnpublished?:boolean;boundedExecution:boolean}
export const KNOWLEDGE_OPERATION_CONTRACT:Readonly<{id:'profitia.knowledge-operations';version:'1.0.0'}>;
export const KNOWLEDGE_OPERATION_RULES:Readonly<Record<KnowledgeOperation,Readonly<KnowledgeOperationRule>>>;
export function knowledgeOperationPolicy(operation:string):Readonly<KnowledgeOperationRule>|null;
export function validateKnowledgeAdoption(options:{application:Application;knowledgeSchemaDigest?:string}):boolean;
export function knowledgeOperationEvidence(input:{state:OperationState;request:BoundRequest;actor:Actor;application:Application;schemaDigest:string;now:number}):Readonly<KnowledgeOperationEvidence>|null;
