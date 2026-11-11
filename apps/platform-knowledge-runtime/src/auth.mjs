import {createKnowledgeOperationHost} from '@profitia/platform-current-e1-authority/knowledge';
import {Fault,transaction} from './store.mjs';
export function createAuthority({config,pool,env}){
 const native=createKnowledgeOperationHost({independentQuery:(sql,values)=>pool.query(sql,values),
  transact:run=>transaction(pool,run),
  application:{applicationId:'platform-knowledge-development-'+config.role,environment:'development',deploymentId:config.release},
  workerCredential:config.role==='worker'?{keyId:env.PK_E1_WORKER_KEY_ID,privateKey:env.PK_E1_WORKER_PRIVATE_KEY}:null});
 return {...native,async execute(request,command,action){
  let businessError;
  const run=async scope=>{try{return await action(scope);}catch(e){if(e instanceof Fault&&e.status>=400&&e.status<500)businessError=e;throw e;}};
  try{return await native.execute(request,command,run);}
  catch(e){if(businessError&&e.reasonCode==='POLICY_UNAVAILABLE')throw businessError;
   if(e.reasonCode){const denied=['ACCESS_BASIS_INVALID','PERMISSION_DENIED','RESOURCE_SCOPE_MISMATCH','DELEGATION_INVALID','APPLICATION_FEATURE_UNAVAILABLE','UNVERIFIED_IDENTITY'].includes(e.reasonCode);throw new Fault(denied?403:503,denied?'OPERATION_DENIED':'IDENTITY_E1_UNAVAILABLE');}throw e;}
 }};
}
