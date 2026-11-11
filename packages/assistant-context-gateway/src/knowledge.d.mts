import type {KnowledgeQuery,KnowledgeContext} from '../../platform-knowledge-contracts/index.js';
export const KNOWLEDGE_ADAPTER_CONTRACT:Readonly<{id:'profitia.acg.knowledge-query';version:'1.0.0'}>;
export interface KnowledgePlan{source:'PLATFORM_KNOWLEDGE';selection:'KNOWLEDGE_QUERY';query:KnowledgeQuery}
export function createKnowledgeContextAdapter(ports:{
 query(input:{query:KnowledgeQuery;request:Request;signal?:AbortSignal}):Promise<KnowledgeContext>;
 countTokens(text:string,query:KnowledgeQuery):number|Promise<number>;
 validateSchema(name:'Context',context:unknown):boolean;now?:()=>number;
}):{readonly contract:typeof KNOWLEDGE_ADAPTER_CONTRACT;resolve(input:{plan:KnowledgePlan;request:Request;signal?:AbortSignal}):Promise<KnowledgeContext>};
