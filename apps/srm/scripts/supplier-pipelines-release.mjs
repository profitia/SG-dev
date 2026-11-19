import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
export const supplierWorkspaceRuntimeFunctions=Object.freeze([
 'profitia_supplier_workspace.bind_operation(uuid,text,jsonb)',
 'profitia_supplier_workspace.descriptor()',
 'srm.supplier_pipelines_execute(jsonb)',
]);
/** Pure inspection of exact source. This plan never connects to a database,
 * grants authority, installs SQL or deploys a service. Existing controlled
 * operator/release workflows must consume the separately approved sources. */
export function supplierPipelinesReleasePlan({repositoryRoot=root,producerRoot=repositoryRoot}={}){
 const targets=JSON.parse(fs.readFileSync(path.join(repositoryRoot,'apps/srm/deployment/supplier-pipelines-targets.json'),'utf8'));
 const required={serviceId:'srv-db1vu6gm7kps73d0e3r0',projectId:'spring-bread-28217539',branchId:'br-sparkling-term-b99l107x',databaseName:'platform_private',schema:'srm',runtimeRole:'srm_private_development_runtime'};
 if(targets.targetEnvironment!=='development'||Object.entries(required).some(([k,v])=>targets.binding[k]!==v))throw Error('EXACT_EXISTING_SRM_DEVELOPMENT_BINDING_REQUIRED');
 const ordered=[
  {owner:'ARCHITECTURE',base:producerRoot,source:targets.accessSchemaSource},
  {owner:'SRM',base:repositoryRoot,source:targets.schemaSource},
  {owner:'SRM',base:repositoryRoot,source:targets.commandsSource},
 ].map(({owner,base,source})=>{
  if(!source||typeof source.path!=='string'||!/^[a-f0-9]{64}$/.test(source.sha256??''))throw Error('EXACT_SOURCE_DIGEST_REQUIRED');
  const expected=owner==='ARCHITECTURE'?'packages/platform-contracts/migrations/access/supplier-workspace-v1.sql':
   source===targets.schemaSource?'apps/srm/db/private-store/supplier-pipelines-v1.sql':'apps/srm/db/private-store/supplier-pipelines-commands-v1.sql';
  if(source.path!==expected||hash(fs.readFileSync(path.join(base,source.path)))!==source.sha256)throw Error('SOURCE_DIGEST_MISMATCH');
  return {owner,path:source.path,sha256:source.sha256};
 });
 return Object.freeze({
  contractId:targets.contractId,contractVersion:targets.contractVersion,environment:'development',binding:required,
  status:'PLAN_ONLY_NOT_AUTHORITY',orderedMigrations:ordered,
  transaction:'ONE_CONTROLLED_OWNER_TRANSACTION_WITH_VERIFIED_PREIMAGE_AND_ROLLBACK',
  runtimeRights:{role:required.runtimeRole,newSchemaUsage:['profitia_supplier_workspace'],execute:[...supplierWorkspaceRuntimeFunctions],newTableDml:[],newOwnerMembership:[]},
  controlledEnrollment:{moduleId:'supplier_workspace',organisation:'EXACT_PORR_ORGANISATION_FROM_EXISTING_SERVER_CONFIGURATION',members:'CURRENT_ELIGIBLE_MEMBERS_ONLY',operations:9,explicitDenies:'PRESERVED_OPERATION_WIDE_IN_V1',expiry:'EXPLICIT_BOUNDED_OWNER_DECISION_REQUIRED'},
  installPreconditions:['EXACT_PRODUCER_AND_CONSUMER_SOURCE_ADMISSION','CURRENT_NATIVE_PREIMAGE_READBACK','CURRENT_BACKUP_AND_VERIFIED_RECOVERY','EXACT_SQL_OWNER_APPROVAL','EXACT_RUNTIME_FUNCTION_GRANTS_AND_MODULE_ORGANISATION_ENROLLMENT_APPROVAL','CLEAN_TEMPORARY_OPERATOR_ADMINISTRATION'],
  releasePreconditions:['MANDATORY_CONTROLLED_CI_EXACT_SHA','RESULTING_MAIN_READBACK','SEPARATE_EXACT_SHA_DEVELOPMENT_GO','DEPLOYED_SHA_AND_INSTALLATION_RECEIPT_READBACK'],
  recovery:{beforeCommit:'ROLLBACK_THE_SAME_TRANSACTION',afterCommit:'DISABLE_NEW_WORKSPACE_CONFIGURATION_AND_POLICY_WITH_HISTORY_RETAINED',reportLanes:'PRESERVE_EXISTING_ROUTING_BINDINGS_ACLS_AND_HISTORY',destructiveSchemaRemoval:false},
  acceptance:['REAL_SRM_DEVELOPMENT_API','TWO_REAL_CURRENT_MEMBERS_NEW_SESSION','FOREIGN_ORGANISATION_DIRECT_API_REFUSAL','NIP_RACES_AND_IDENTIFIER_EDITS','ONE_ACTIVE_SUPPLIER_AND_INDEPENDENT_CATEGORY_PROCESSES','ATOMIC_TRANSFER_ARCHIVE_OCCUPIED_STAGE_REMOVAL','CURRENT_AUTHORIZATION_ON_IDEMPOTENT_REPLAY_AND_UNKNOWN_COMMIT_RETRY'],
  changedDataOrRoles:false,installed:false,deployed:false,e2Started:false,
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args[0]!=='--plan'||![1,3].includes(args.length)||args.length===3&&(args[1]!=='--producer-root'||!path.isAbsolute(args[2])))throw Error('PLAN_ONLY_USE_EXISTING_APPROVED_OPERATOR_AND_RELEASE_WORKFLOWS');
 console.log(JSON.stringify(supplierPipelinesReleasePlan(args.length===3?{producerRoot:args[2]}:{}),null,2));
}
