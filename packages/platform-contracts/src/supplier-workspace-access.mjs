/**
 * DEC-24 approved bounded E1-T02 scope; implementation candidate. Not adopted by the
 * SDK package, installed in SQL, enrolled or activated. These pure descriptions
 * and comparison checks do not authenticate, return ALLOW, grant permissions,
 * open a transaction, or turn request/GUC values into an authority proof.
 */
import {randomUUID} from 'node:crypto';
// Native scope failures use the Root's stable cross-module error transport brand.
// No Root import: access descriptions are required while Root itself initializes.
class OperationDenied extends Error {
 constructor(reasonCode){super('Operation unavailable');this.name='OperationDenied';this.reasonCode=reasonCode;this.decisionId=randomUUID();
  Object.defineProperty(this,Symbol.for('profitia.operation-context.denial.v1'),{value:true});}
}
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const rows=[
 ['supplier.catalog.read','supplier_catalog','READ',true],
 ['supplier.catalog.write','supplier_catalog','WRITE',true],
 ['supplier.category.read','supplier_category','READ',true],
 ['supplier.category.write','supplier_category','WRITE',true],
 ['supplier.pipeline.read','supplier_pipeline','READ',true],
 ['supplier.pipeline.write','supplier_pipeline','WRITE',true],
 ['supplier.assignment.read','supplier_assignment','READ',false],
 ['supplier.assignment.write','supplier_assignment','WRITE',false],
 ['supplier.adp-status.read','supplier_adp_status','READ',true],
];
export const SUPPLIER_WORKSPACE_ACCESS_PROPOSAL=freeze({
 id:'platform.supplier-workspace-access',version:'1.0.0',status:'PROPOSED_NOT_ADOPTED',
 initiativeId:'BSDC-20261117-SUPPLIER-CATEGORY-PIPELINES',
 baseline:'f75529c590c5dd4611223c949e5956e34d101e22',
 moduleId:'supplier_workspace',feature:'supplier_workspace',dataClass:'ORGANISATION_PRIVATE',
 operations:rows.map(([operation,resourceType,accessMode,newRootOperation])=>({
  operation,resourceType,accessMode,newRootOperation,
  nativeUnitId:accessMode==='READ'?'SUPPLIER_WORKSPACE_READ':'SUPPLIER_WORKSPACE_WRITE',
 })),
 actorBoundary:'CURRENT_VERIFIED_HUMAN_OR_EXPLICIT_FIRST_PARTY_ON_BEHALF',
 capabilities:'SAME_EXPLICIT_OPERATIONS_FOR_CURRENT_ELIGIBLE_ORGANISATION_MEMBERS',
 preserves:['current identity and membership','application product/feature admission','explicit denies',
  'expiry and revocation','canonical audit','final disclosure/COMMIT revalidation'],
 sqlBoundary:{
  scopeSignature:'profitia_supplier_workspace.scope_allows(uuid,text,uuid)',
  memberSignature:'profitia_supplier_workspace.member_allowed(uuid,uuid)',
  descriptorSignature:'profitia_supplier_workspace.descriptor()',
  runtimeRights:'EXECUTE_CLOSED_ENTRY_POINTS_ONLY_NO_NEW_GENERAL_TABLE_DML',
  scopeBinding:['ordinary session SQL login','physical database and application','native transaction',
   'original organisation and actor','current admitted operation and input digest','source/schema version',
   'unexpired revocable authority'],
  master:'REUSE_srm.suppliers_NO_SECOND_IDENTITY_MASTER',
  masterFenceChange:'ONLY_BOUND_WORKSPACE_ENTRY_POINT_WITH_ORIGINAL_SUPPLIER_REPORT_PATH_PRESERVED',
 },
 developmentBinding:{
  serviceId:'srv-db1vu6gm7kps73d0e3r0',projectId:'spring-bread-28217539',
  branchId:'br-sparkling-term-b99l107x',databaseName:'platform_private',schema:'srm',
  runtimeRole:'srm_private_development_runtime',
 },
 requiresOwnerDecision:[
  'Adopt seven new Root operations and the explicit workspace module; retain two assignment operations.',
  'Accept the bounded SQL bridge and exact master-fence extension, preserving existing X-Ray behaviour.',
  'Accept explicit membership/operation enrollment without wildcard, deny override or new commercial policy.',
  'Approve exact migration/installation source, recovery and window before product schema/grant changes.',
  'Accept exact source validation/adoption and exact-SHA Development release before LIVE acceptance.',
 ],
 exclusions:['supplier.report.refresh authority reuse','SRM_STORE_COMPANY authority reuse','provider acquisition',
  'document content','new infrastructure','Staging','Production','E2 user interface'],
});
export function describeSupplierWorkspaceOperation(operation){
 const found=SUPPLIER_WORKSPACE_ACCESS_PROPOSAL.operations.find(row=>row.operation===operation);
 if(!found)throw TypeError('Unsupported bounded Supplier Workspace operation');
 return found;
}
const descriptorKeys=['applicationId','environment','runtimeRole','databaseName','transactionId','organisationId',
 'actorAccountId','operation','nativeUnitId','accessMode','payloadDigest','schemaDigest','sourceRef',
 'policyVersion','expiresAt'];
/** Metadata consistency check only. A caller must first obtain this descriptor
 * through the accepted native SQL bridge on the exact, currently active client.
 * Passing matching JSON from a request is never an authorization mechanism. */
export function assertSupplierWorkspaceDescriptorMatches(actual,expected,{now=Date.now}={}){
 if(!actual||Object.getPrototypeOf(actual)!==Object.prototype||!expected||Object.getPrototypeOf(expected)!==Object.prototype
  ||Reflect.ownKeys(actual).length!==descriptorKeys.length||Reflect.ownKeys(expected).length!==descriptorKeys.length
  ||descriptorKeys.some(k=>!Object.hasOwn(actual,k)||!Object.hasOwn(expected,k))
  ||Object.values(Object.getOwnPropertyDescriptors(actual)).some(d=>!('value'in d)||!d.enumerable)
  ||descriptorKeys.some(k=>typeof actual[k]!=='string'||actual[k]!==expected[k])
  ||actual.applicationId!=='srm'||actual.environment!=='development'
  ||actual.runtimeRole!==SUPPLIER_WORKSPACE_ACCESS_PROPOSAL.developmentBinding.runtimeRole
  ||actual.databaseName!==SUPPLIER_WORKSPACE_ACCESS_PROPOSAL.developmentBinding.databaseName
  ||!/^[1-9][0-9]*$/.test(actual.transactionId)||!/^[1-9][0-9]*$/.test(actual.policyVersion)
  ||!['organisationId','actorAccountId'].every(k=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(actual[k]))
  ||!['payloadDigest','schemaDigest'].every(k=>/^[a-f0-9]{64}$/.test(actual[k]))
  ||!/^[a-f0-9]{40}$/.test(actual.sourceRef)
  ||!Number.isFinite(Date.parse(actual.expiresAt))||Date.parse(actual.expiresAt)<=now())
   throw TypeError('Supplier Workspace native descriptor mismatch');
 const selected=describeSupplierWorkspaceOperation(actual.operation);
 if(actual.accessMode!==selected.accessMode||actual.nativeUnitId!==selected.nativeUnitId)
  throw TypeError('Supplier Workspace native unit mismatch');
}

/** Explicit optional Root adoption. The proposal metadata above is not ALLOW. */
export const SUPPLIER_WORKSPACE_ROOT_IMPLEMENTATION='1.0.0-candidate.26';
export const SUPPLIER_WORKSPACE_OPERATIONS=Object.freeze(rows.map(r=>r[0]));
export const SUPPLIER_WORKSPACE_NEW_OPERATIONS=Object.freeze(rows.filter(r=>r[3]).map(r=>r[0]));
export const SUPPLIER_WORKSPACE_OPERATION_RULES=freeze(Object.fromEntries(rows.filter(r=>r[3]).map(([operation,resourceType,mode])=>[
 operation,{feature:'supplier_workspace',resourceType,dataClass:'ORGANISATION_PRIVATE',effect:mode,product:null,mode:'ORGANISATION'},
])));
const commands=freeze({
 SUPPLIER_CREATE:'supplier.catalog.write',SUPPLIER_UPDATE:'supplier.catalog.write',
 SUPPLIER_ARCHIVE:'supplier.catalog.write',SUPPLIER_RESTORE:'supplier.catalog.write',
 CATEGORY_CREATE:'supplier.category.write',CATEGORY_UPDATE:'supplier.category.write',
 CATEGORY_ARCHIVE:'supplier.category.write',CATEGORY_RESTORE:'supplier.category.write',
 SUPPLIER_CATEGORY_ADD:'supplier.category.write',SUPPLIER_CATEGORY_REMOVE:'supplier.category.write',
 PIPELINE_CREATE:'supplier.pipeline.write',PIPELINE_UPDATE:'supplier.pipeline.write',
 PIPELINE_ARCHIVE:'supplier.pipeline.write',PIPELINE_RESTORE:'supplier.pipeline.write',
 STAGE_ADD:'supplier.pipeline.write',STAGES_UPDATE:'supplier.pipeline.write',STAGE_REMOVE:'supplier.pipeline.write',
 MEMBERSHIP_ADD:'supplier.assignment.write',MEMBERSHIP_MOVE:'supplier.assignment.write',
 MEMBERSHIP_END:'supplier.assignment.write',SUPPLIER_TRANSFER:'supplier.assignment.write',
});
export function supplierWorkspaceOperationPolicy(operation){
 return SUPPLIER_WORKSPACE_ACCESS_PROPOSAL.operations.find(r=>r.operation===operation)??null;
}
export function validateSupplierWorkspaceAdoption(options){
 const selected=options.application?.operations??[],enabled=options.supplierWorkspaceSchemaDigest!==undefined;
 if(!enabled){
  if(selected.some(op=>SUPPLIER_WORKSPACE_NEW_OPERATIONS.includes(op)))throw TypeError('Supplier Workspace requires explicit schema adoption');
  return false;
 }
 if(!/^[a-f0-9]{64}$/.test(options.supplierWorkspaceSchemaDigest??'')
  ||options.application?.appId!=='srm'||options.application?.environment!=='development'
  ||!selected.length||selected.some(op=>!supplierWorkspaceOperationPolicy(op))
  ||new Set(selected).size!==selected.length||options.application?.features?.join(',')!=='supplier_workspace'
  ||['knowledgeSchemaDigest','recurringSchemaDigest','assistantSchemaDigest','requestQuotaSchemaDigest',
   'locationAdmissionSchemaDigest','reportAdmissionSchemaDigest','organisationBootstrapSchemaDigest',
   'organisationLifecycleSchemaDigest','requestBenchmarkQuotaSchemaDigest'].some(k=>options[k]!==undefined))
    throw TypeError('Isolated exact Development Supplier Workspace adoption required');
 return true;
}
/** Additional authority for composite domain effects; never inferred from roles. */
export function supplierWorkspaceRequiredPermissions(operation,payload){
 if(!supplierWorkspaceOperationPolicy(operation))throw TypeError('Unsupported Supplier Workspace operation');
 const required=new Set();
 if(operation.endsWith('.write'))required.add(operation.replace(/\.write$/,'.read'));
 if(payload?.command!==undefined){
  if(!Object.hasOwn(commands,payload.command)||commands[payload.command]!==operation)
    throw TypeError('Workspace command/operation mismatch');
  if(payload.command==='SUPPLIER_CREATE'&&Array.isArray(payload.data?.categoryIds)&&payload.data.categoryIds.length)
    required.add('supplier.category.write');
  if(['SUPPLIER_ARCHIVE','PIPELINE_ARCHIVE','STAGE_REMOVE'].includes(payload.command)
    &&Number.isSafeInteger(payload.data?.expectedCount)&&payload.data.expectedCount>0)
    required.add('supplier.assignment.write');
 }
 if(operation==='supplier.assignment.write'){required.add('supplier.catalog.read');required.add('supplier.pipeline.read');}
 if(payload?.command?.startsWith('SUPPLIER_CATEGORY_'))required.add('supplier.catalog.read');
 if(payload?.command==='PIPELINE_CREATE'&&payload.data?.kind==='CATEGORY')required.add('supplier.category.read');
 if(payload?.kind==='ADP_STATUS')required.add('supplier.catalog.read');
 if(payload?.kind==='SUPPLIER_CARD'){
  for(const op of ['supplier.category.read','supplier.pipeline.read','supplier.assignment.read','supplier.adp-status.read'])required.add(op);
 }
 if(payload?.kind==='SUPPLIERS'){
  required.add('supplier.category.read');required.add('supplier.adp-status.read');
 }
 if(payload?.kind==='PIPELINE'){
  required.add('supplier.catalog.read');required.add('supplier.assignment.read');
 }
 if(['SUPPLIER_ARCHIVE','PIPELINE_ARCHIVE','STAGE_REMOVE'].includes(payload?.command))required.add('supplier.assignment.read');
 if(payload?.command==='SUPPLIER_UPDATE'&&payload.data?.nip!==undefined)for(const op of ['supplier.assignment.read','supplier.category.read'])required.add(op);
 if(payload?.kind==='PIPELINES')required.add('supplier.assignment.read');
 if(payload?.kind==='HISTORY')for(const op of ['supplier.catalog.read','supplier.category.read','supplier.pipeline.read','supplier.assignment.read'])required.add(op);
 for(const op of [...required])if(op==='supplier.assignment.write'){required.add('supplier.catalog.read');required.add('supplier.pipeline.read');}
 for(const op of [...required])if(op.endsWith('.write'))required.add(op.replace(/\.write$/,'.read'));
 return Object.freeze([...required]);
}
export const supplierWorkspaceSchemaUrl=new URL('../migrations/access/supplier-workspace-v1.sql',import.meta.url).href;
const scopeKeys=['applicationId','environment','runtimeRole','databaseName','transactionId','organisationId',
 'actorAccountId','operation','nativeUnitId','accessMode','payloadDigest','schemaDigest','sourceRef','policyVersion',
 'accessPolicyVersion','expiresAt','decisionId','resourceId'];
const scopeFail=()=>{throw new OperationDenied('POLICY_UNAVAILABLE')};
/** SQL-sourced, transaction-bound leases. Caller JSON is never a lease. */
export function createSupplierWorkspaceScopeStore({schemaDigest,sourceRef,now=Date.now}){
 if(!/^[a-f0-9]{64}$/.test(schemaDigest??'')||!/^[a-f0-9]{40}$/.test(sourceRef??'')||typeof now!=='function')
   throw TypeError('Explicit accepted workspace source and schema required');
 const owned=new WeakSet();
 const read=async(query,sql,values=[])=>{
  try{const r=await query(sql,values);if(!Array.isArray(r?.rows)||r.rows.length!==1)scopeFail();return r.rows[0];}
  catch(e){if(e instanceof OperationDenied)throw e;scopeFail();}
 };
 const check=(d,context,tx)=>{
  const p=supplierWorkspaceOperationPolicy(context.operation);
  if(!d||Object.getPrototypeOf(d)!==Object.prototype||Reflect.ownKeys(d).length!==scopeKeys.length
   ||scopeKeys.some(k=>!Object.hasOwn(d,k)||typeof d[k]!=='string')
   ||Object.values(Object.getOwnPropertyDescriptors(d)).some(v=>!('value'in v)||!v.enumerable)
   ||!p||context.actorKind!=='HUMAN'||context.accessBasisType!=='MEMBERSHIP'||context.mode!=='ORGANISATION'
   ||context.implementationVersion!==SUPPLIER_WORKSPACE_ROOT_IMPLEMENTATION
   ||context.moduleEvidence?.moduleId!=='supplier_workspace'
   ||d.applicationId!=='srm'||d.environment!=='development'
   ||d.runtimeRole!=='srm_private_development_runtime'||d.databaseName!=='platform_private'
   ||d.schemaDigest!==schemaDigest||d.sourceRef!==sourceRef
   ||d.transactionId!==tx||d.transactionId!==context.moduleEvidence.transactionId
   ||d.organisationId!==context.organisationId||d.actorAccountId!==context.subjectUserId
   ||d.operation!==context.operation||d.nativeUnitId!==p.nativeUnitId||d.accessMode!==p.accessMode
   ||d.payloadDigest!==context.payloadDigest||d.accessPolicyVersion!==context.policyVersion
   ||d.decisionId!==context.decisionId||d.resourceId!==context.resourceId
   ||!/^[1-9][0-9]*$/.test(d.policyVersion)||!/^[1-9][0-9]*$/.test(d.transactionId)
   ||!Number.isFinite(Date.parse(d.expiresAt))||Date.parse(d.expiresAt)<=now()
   ||Date.parse(d.expiresAt)>now()+30000)scopeFail();
  return freeze(structuredClone(d));
 };
 const verify=async(query,lease,context)=>{
  if(!owned.has(lease))scopeFail();
  const r=await read(query,"SELECT txid_current()::text AS tx,profitia_supplier_workspace.descriptor() AS descriptor");
  const fresh=check(r.descriptor,context,r.tx);
  if(JSON.stringify(fresh)!==JSON.stringify(lease))scopeFail();
 };
 return Object.freeze({
  async bind(query,context){
   const row=await read(query,"SELECT current_database() AS db,current_user AS role,session_user AS login,txid_current()::text AS tx,profitia_supplier_workspace.bind_operation($1::uuid,$2,$3::jsonb) AS descriptor FROM pg_roles WHERE rolname=current_user AND NOT(rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication)",[context.decisionId,context.payloadDigest,JSON.stringify(context.payload)]);
   if(row.db!=='platform_private'||row.role!=='srm_private_development_runtime'||row.login!==row.role)scopeFail();
   const lease=check(row.descriptor,context,row.tx);owned.add(lease);return lease;
  },
  verify,
  async execute(query,lease,context){
   if(!owned.has(lease))scopeFail();
   await verify(query,lease,context);
   const r=await read(query,"SELECT srm.supplier_pipelines_execute($1::jsonb) AS value",[JSON.stringify(context.payload)]);
   await verify(query,lease,context);
   return r.value;
  },
 });
}
export async function supplierWorkspaceSourceDigest(){
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const h=createHash('sha256');
 for(const p of ['./supplier-workspace-access.mjs','./supplier-workspace-access.d.mts','../migrations/access/supplier-workspace-v1.sql'])
  h.update(fs.readFileSync(new URL(p,import.meta.url)));
 return h.digest('hex');
}
