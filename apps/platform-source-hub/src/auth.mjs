import {createCurrentE1OperationHost} from '@profitia/platform-current-e1-authority';
import {createPrivateOperationHost} from '@profitia/platform-contracts/private-operation-host';
import {createClerkIdentityAuthenticator} from '@profitia/platform-contracts/identity-provider';
import {accessSchemaDigest} from '@profitia/platform-contracts/access-store';
import {peerOperationIdentityRequest} from '@profitia/platform-contracts/peer-operation';
import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function organisationSelector(value){if(typeof value!=='string'||!uuid.test(value))throw new SourceHubError('ORGANISATION_SELECTION_REQUIRED',400);return value;}
export async function bindScope(query,scope){
 if(!scope||!uuid.test(scope.userId??'')||!uuid.test(scope.organisationId??''))throw new SourceHubError('VERIFIED_SCOPE_REQUIRED',403);
 await query("SELECT set_config('profitia.environment',$1,true),set_config('profitia.application_id',$2,true),set_config('profitia.organisation_id',$3,true),set_config('profitia.user_id',$4,true)",[scope.environment,scope.applicationId,scope.organisationId,scope.userId]);
}
export async function createAuthorizer(configuration,database,{clerkClient,currentAuthority=false}){
 const schemaDigest=await accessSchemaDigest();
 /** @type {import('@profitia/platform-contracts/operation-context').Application} */
 const application={appId:configuration.applicationId,profileId:'SPENDGURU_SAAS',deploymentId:configuration.deploymentId,configurationVersion:configuration.configurationVersion,
  environment:configuration.environment,identityIssuer:configuration.identityIssuer,organisationId:null,features:['personal_workspace'],operations:['personal.list.read','personal.list.write']};
 const binding={applicationId:configuration.applicationId,environment:configuration.environment,projectId:configuration.projectId,branchId:configuration.branchId,databaseName:configuration.databaseName,role:configuration.runtimeRole,schemaDigest};
 const host=(currentAuthority?createCurrentE1OperationHost:createPrivateOperationHost)({application,binding,independentQuery:database.query,transact:database.transact,
  createAuthenticator:({resolveBinding})=>{
   const authenticate=createClerkIdentityAuthenticator({client:clerkClient,application:{appId:configuration.applicationId,environment:configuration.environment,issuer:configuration.identityIssuer,authorizedParties:configuration.authorizedParties},resolveBinding});
   return request=>authenticate(request instanceof Request?(peerOperationIdentityRequest(request)??request):request);
  },
  async readResources({scope,request,query}){
   await bindScope(query,scope);
   return {resource:{id:request.resourceId,type:'personal_list',dataClass:'USER_IN_ORGANISATION_PRIVATE',environment:scope.environment,ownerOrganisationId:scope.organisationId,ownerUserId:scope.userId,version:'1',projectionVersion:'source-hub-private-v1',contentRequirements:[{product:configuration.requiredProduct,feature:'personal_workspace'}]}};
  },
  projectOutput:value=>structuredClone(value)
 });
 return Object.freeze({binding,async ready(){try{await database.verifyLogin();if(currentAuthority)return 'ready' in host&&await host.ready();const r=await database.query('SELECT profitia_access.runtime_descriptor() AS descriptor'),d=r.rows[0]?.descriptor;return !!d&&Object.entries(binding).every(([k,v])=>d[k]===v);}catch{return false;}},async execute({request,organisationId,resourceId,write=false,payload=null},action){
  const answer=await host.execute({contractId:host.contract.id,contractVersion:host.contract.version,operation:write?'personal.list.write':'personal.list.read',organisationId:organisationSelector(organisationId),resourceId,payload,request:currentAuthority?(peerOperationIdentityRequest(request)??request):request},async(context,transaction)=>{
   await transaction.query('SAVEPOINT business_operation');
   try{const value=await action(context,transaction);await transaction.query('RELEASE SAVEPOINT business_operation');return {ok:true,value};}
   catch(error){if(!(error instanceof SourceHubError))throw error;await transaction.query('ROLLBACK TO SAVEPOINT business_operation');await transaction.query('RELEASE SAVEPOINT business_operation');return {ok:false,error:{code:error.code,status:error.status}};}
  });
  if('error' in answer.value&&answer.value.error)throw new SourceHubError(answer.value.error.code,answer.value.error.status);return answer.value.value;
 }});
}
