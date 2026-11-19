/**
 * Owner-review proposal for BSDC E1-T02. Not imported by Root, exported by the
 * SDK package, installed in SQL, enrolled or activated. These pure descriptions
 * and comparison checks do not authenticate, return ALLOW, grant permissions,
 * open a transaction, or turn request/GUC values into an authority proof.
 */
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
