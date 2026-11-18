import {assertQuery,assertContextSemantics} from '../../platform-knowledge-contracts/index.mjs';
/** Separate query family: ACTIVE_VIEW and its four-producer byte limits retain
 * their original behavior. The host supplies the trusted request; payload JSON
 * never supplies user identity, organisation membership or an ALLOW flag. */
export const KNOWLEDGE_ADAPTER_CONTRACT=Object.freeze({id:'profitia.acg.knowledge-query',version:'1.0.0'});
export function createKnowledgeContextAdapter({query:read,countTokens,validateSchema,now=Date.now}){
 if([read,countTokens,validateSchema,now].some(f=>typeof f!=='function'))throw TypeError('Knowledge consumer contract ports required');
 return Object.freeze({contract:KNOWLEDGE_ADAPTER_CONTRACT,async resolve({plan,request,signal}){
  if(!plan||Object.keys(plan).sort().join(',')!=='query,selection,source'||plan.source!=='PLATFORM_KNOWLEDGE'||plan.selection!=='KNOWLEDGE_QUERY')throw TypeError('Invalid knowledge plan');
  const q=structuredClone(assertQuery(plan.query));
  if(!(request instanceof Request))throw TypeError('Trusted host request required');
  signal?.throwIfAborted();
  const result=await read({query:q,request,signal});signal?.throwIfAborted();
  if(!validateSchema('Context',result))throw TypeError('Invalid knowledge context schema');
  const serialized=JSON.stringify(result),measured=await countTokens(serialized,q);
  assertContextSemantics(q,result,text=>{if(text!==serialized)throw TypeError('Context changed during validation');return measured;});
  if(result.evidence.some(e=>e.validUntil!==null&&Date.parse(e.validUntil)<=now()))throw TypeError('Expired knowledge context');
  return structuredClone(result);
 }});
}
