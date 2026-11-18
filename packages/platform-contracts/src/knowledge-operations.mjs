// Optional, closed Platform Knowledge operation catalogue. It is consumed by
// the SAME createOperationExecutor; it never authenticates or grants access.
export const KNOWLEDGE_OPERATION_CONTRACT=Object.freeze({id:'profitia.knowledge-operations',version:'1.0.0'});
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const operations={};
for(const scope of ['private','shared']){
 const dataClass=scope==='private'?'ACCOUNT_PRIVATE':'SHARED_KNOWLEDGE';
 for(const operation of ['document.import','document.read','document.query','document.delete',...(scope==='shared'?['document.publish','document.withdraw']:['memory.read','memory.write','memory.forget'])]){
  operations['knowledge.'+scope+'.'+operation]={feature:'platform_knowledge',resourceType:operation.startsWith('memory.')?'knowledge_memory':'knowledge_document',dataClass,
   effect:/\.(read|query)$/.test(operation)?'READ':'WRITE',product:null,mode:'ACCOUNT',knowledge:true,scope,
   allowUnpublished:scope==='shared'&&operation!=='document.query',boundedExecution:['document.import','document.query'].includes(operation)};
 }
 operations['knowledge.'+scope+'.service.process']={feature:'platform_knowledge',resourceType:'knowledge_document',dataClass,
  effect:'WRITE',product:null,mode:'KNOWLEDGE_SERVICE',knowledge:true,scope,allowUnpublished:true,boundedExecution:true};
}
export const KNOWLEDGE_OPERATION_RULES=freeze(operations);
export const knowledgeOperationPolicy=operation=>Object.hasOwn(operations,operation)?operations[operation]:null;
export function validateKnowledgeAdoption(options){
 const selected=options.application?.operations??[],enabled=options.knowledgeSchemaDigest!==undefined;
 if(!enabled){if(selected.some(knowledgeOperationPolicy))throw TypeError('Knowledge operations require exact schema adoption');return false;}
 if(!/^[a-f0-9]{64}$/.test(options.knowledgeSchemaDigest)||options.application?.environment!=='development'
  ||!['platform-knowledge-development-api','platform-knowledge-development-worker'].includes(options.application?.appId)
  ||!['SPENDGURU_SAAS','PLATFORM_INTERNAL'].includes(options.application?.profileId)
  ||!selected.length||selected.some(op=>!knowledgeOperationPolicy(op))
  ||options.application?.features?.join(',')!=='platform_knowledge'
  ||['assistantSchemaDigest','requestQuotaSchemaDigest','locationAdmissionSchemaDigest','reportAdmissionSchemaDigest','recurringSchemaDigest'].some(k=>options[k]!==undefined))throw TypeError('Isolated exact Development knowledge adoption required');
 const worker=options.application.appId.endsWith('-worker');
 if(options.application.profileId!==(worker?'PLATFORM_INTERNAL':'SPENDGURU_SAAS')||selected.some(op=>(knowledgeOperationPolicy(op).mode==='KNOWLEDGE_SERVICE')!==worker))throw TypeError('Knowledge actor/application boundary mismatch');
 return true;
}
export function knowledgeOperationEvidence({state,request,actor,application,schemaDigest,now}){
 const rule=knowledgeOperationPolicy(request.operation),e=state?.knowledge;
 if(!rule)return null;
 if(!e||e.contract!=='profitia.knowledge-operations/1.0.0'||e.schemaDigest!==schemaDigest
  ||e.applicationId!==application.appId||e.environment!==application.environment||e.resourceId!==request.resourceId
  ||e.payloadDigest!==request.payloadDigest||e.scope!==(rule.scope==='private'?'ACCOUNT_PRIVATE':'PROFITIA_SHARED')
  ||e.transactionId!==state.transactionId||!/^[0-9]{1,20}$/.test(e.transactionId??'')
  ||typeof e.administrationAllowed!=='boolean'||typeof e.revocationVersion!=='string'||!e.revocationVersion
  ||!Number.isFinite(Date.parse(e.expiresAt))||Date.parse(e.expiresAt)<=now)throw TypeError('Current native knowledge evidence required');
 const service=rule.mode==='KNOWLEDGE_SERVICE';
 if(service){
  if(actor.kind!=='SERVICE'||!e.delegation||e.delegation.status!=='ACTIVE'||e.delegation.resourceId!==request.resourceId
   ||typeof e.delegation.id!=='string'||!e.delegation.id||!Number.isFinite(Date.parse(e.delegation.expiresAt))||Date.parse(e.delegation.expiresAt)<=now
   ||e.delegation.revocationVersion!==e.revocationVersion)throw TypeError('Current bounded knowledge service delegation required');
 }else if(actor.kind!=='HUMAN')throw TypeError('Knowledge account actor required');
 if(rule.scope==='private'&&(typeof e.ownerUserId!=='string'||!e.ownerUserId||!service&&e.ownerUserId!==actor.userId)
  ||rule.scope==='shared'&&e.ownerUserId!==null)throw TypeError('Knowledge owner scope mismatch');
 if(rule.scope==='shared'&&state.resource?.approvedSharedProjection!==true&&(!rule.allowUnpublished||!e.administrationAllowed))throw TypeError('Unpublished knowledge requires exact administration authority');
 if(rule.boundedExecution){
  const p=e.executionPolicy;
  if(!p||p.provider!=='openai'||p.models?.join(',')!=='gpt-6-luna,text-embedding-3-small'||p.store!==false||p.maximumPaidAttempts!==1
   ||p.maximumInputTokens!==16384||p.maximumOutputTokens!==4096||p.maximumJobMinutes!==30
   ||p.maximumDocumentMicrousd!==1000000||!Number.isSafeInteger(p.globalBudgetCeilingMicrousd)||p.globalBudgetCeilingMicrousd<1||p.globalBudgetCeilingMicrousd>10000000
   ||p.atomicPerBatch!==true||p.uncertainRetainsReservation!==true)throw TypeError('Bounded native knowledge execution policy required');
 }
 return freeze(structuredClone(e));
}
