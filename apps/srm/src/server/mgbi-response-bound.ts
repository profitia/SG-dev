import type {Application} from '@profitia/platform-contracts/operation-context'
import type {AccessStoreBinding} from '@profitia/platform-contracts/access-store'
import target from '../../deployment/mgbi-record-response-bound-2026-10-30.json'
/** Technical response size only. This selects no identity, authority or quota;
 * the unchanged Source host must still match the installed ordinary-role policy. */
export function mainMgbiRecordResponseBound(application:Pick<Application,'appId'|'environment'|'deploymentId'>,
 binding:Pick<AccessStoreBinding,'environment'|'projectId'|'branchId'|'databaseName'|'role'>,providerRole:string,sourcePolicy:unknown):number|undefined {
 if(application.appId!=='srm'||application.environment!==target.environment||sourcePolicy!=='MGBI_ONLY'
  ||!new RegExp('^'+target.serviceId+':[a-f0-9]{40}$').test(application.deploymentId)
  ||binding.environment!==target.environment||binding.projectId!==target.projectId||binding.branchId!==target.branchId||binding.databaseName!==target.databaseName
  ||binding.role!==target.humanRole||providerRole!==target.providerRole)return undefined
 return target.maximumResponseBytes
}
