import {resolveSrmPrivateIdentity} from './private-operation-host'
import type {SupplierLocationRuntimeOptions} from './supplier-locations'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
/** Canonical identity preparation first; the controlled administrative port is
 * limited by an owner-configured role/org scope and cannot return private data.
 * Its separate transaction finishes before the real operation reacquires E1. */
export function createSrmLocationAccessEnrollment(options:SupplierLocationRuntimeOptions,schemaDigest:string){
 return async(request:Request,organisationId:string,supplierId:string,locationId:string|null=null)=>{
  if(organisationId!==options.application.organisationId)throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  const prepared=await resolveSrmPrivateIdentity({...options,readResources:async()=>{throw Error('No business operation during identity preparation')},projectOutput:v=>v},request,organisationId)
  if(prepared.organisationId!==organisationId)throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  try{await options.pool.query('SELECT srm.enrol_searched_supplier_locations($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5)',
   [organisationId,prepared.actor.actorId,supplierId,locationId,schemaDigest])}
  catch(error){if((error as {code?:string})?.code==='42501')throw new OperationDenied('RESOURCE_SCOPE_MISMATCH');throw error}
 }
}
