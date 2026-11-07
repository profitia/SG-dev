import {createFirstPartySourceHost} from '@profitia/platform-current-e1-authority/first-party';
import {accessSchemaDigest} from '@profitia/platform-contracts/access-store';
import {createFirstPartyRepository} from './repository.mjs';
import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
export async function createConsumerAccess(configuration,database,{fetch=globalThis.fetch}={}){
 const binding={applicationId:configuration.applicationId,environment:configuration.environment,projectId:configuration.projectId,branchId:configuration.branchId,databaseName:configuration.databaseName,role:configuration.runtimeRole,schemaDigest:await accessSchemaDigest()};
 /** @type {import('@profitia/platform-contracts/operation-context').Application & {publicOrigin:string}} */
 const application={appId:configuration.applicationId,environment:configuration.environment,profileId:'SPENDGURU_SAAS',deploymentId:configuration.deploymentId,configurationVersion:configuration.configurationVersion,identityIssuer:configuration.identityIssuer,organisationId:null,features:['market'],operations:['knowledge.read'],publicOrigin:configuration.publicOrigin};
 const host=createFirstPartySourceHost({application,binding,independentQuery:database.query,transact:database.transact,fetch});
 const repository=createFirstPartyRepository(configuration,database);
 return Object.freeze({repository,async ready(){return await host.ready()&&await repository.ready();},
  execute(args,action){return host.execute(args,async(c,t,consumer)=>{
   await t.query('SAVEPOINT first_party_operation');
   try{const value=await action(c,t,consumer);await t.query('RELEASE SAVEPOINT first_party_operation');return {ok:true,value};}
   catch(error){if(!(error instanceof SourceHubError))throw error;await t.query('ROLLBACK TO SAVEPOINT first_party_operation');await t.query('RELEASE SAVEPOINT first_party_operation');return {ok:false,error:{code:error.code,status:error.status}};}
  }).then(answer=>{if(answer.error)throw new SourceHubError(answer.error.code,answer.error.status);return answer.value;});}
 });
}
