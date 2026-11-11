import {createKnowledgeOperationHost} from '@profitia/platform-current-e1-authority/knowledge';
import {Fault,transaction} from './store.mjs';
export function createAuthority({config,pool,env}){
 const native=createKnowledgeOperationHost({independentQuery:(sql,values)=>pool.query(sql,values),
  transact:run=>transaction(pool,run),
  application:{applicationId:'platform-knowledge-development-'+config.role,environment:'development',deploymentId:config.release},
  workerCredential:config.role==='worker'?{keyId:env.PK_E1_WORKER_KEY_ID,privateKey:env.PK_E1_WORKER_PRIVATE_KEY}:null});
 return {...native,async execute(request,command,action){
  try{return await native.execute(request,command,action);}
  catch(e){if(e.reasonCode)throw new Fault(e.reasonCode==='ACCESS_BASIS_INVALID'?403:503,e.reasonCode==='ACCESS_BASIS_INVALID'?'OPERATION_DENIED':'IDENTITY_E1_UNAVAILABLE');throw e;}
 }};
}
