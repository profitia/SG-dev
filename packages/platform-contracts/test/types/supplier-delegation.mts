import {createDelegatedJobStore,type DelegatedJobTargetOptions} from '../../src/delegated-job.mjs'
const ordinary:DelegatedJobTargetOptions={}
const forecast:DelegatedJobTargetOptions={targetOperation:'forecast.request'}
const supplier:DelegatedJobTargetOptions={targetOperation:'supplier.report.refresh',supplierSchemaDigest:'a'.repeat(64)}
// @ts-expect-error Supplier cannot omit its explicit installed extension.
const missing:DelegatedJobTargetOptions={targetOperation:'supplier.report.refresh'}
// @ts-expect-error No wildcard or arbitrary target interpreter.
const unknown:DelegatedJobTargetOptions={targetOperation:'category.write',supplierSchemaDigest:'a'.repeat(64)}
// @ts-expect-error Default Forecast cannot receive a Supplier extension.
const mixed:DelegatedJobTargetOptions={supplierSchemaDigest:'a'.repeat(64)}
const binding={applicationId:'srm',environment:'development' as const,projectId:'synthetic-project',branchId:'synthetic-branch',databaseName:'synthetic_db',role:'ordinary_role',schemaDigest:'a'.repeat(64)}
createDelegatedJobStore({binding,schemaDigest:'b'.repeat(64),...ordinary})
createDelegatedJobStore({binding,schemaDigest:'b'.repeat(64),...forecast})
createDelegatedJobStore({binding,schemaDigest:'b'.repeat(64),...supplier})
void missing;void unknown;void mixed
