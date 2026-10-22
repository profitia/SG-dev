import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import type {SupplierLocationAdmissionOptions, SupplierLocationParent} from '@profitia/platform-contracts/supplier-location'

/** A server-only receiver adapter for the accepted producer. No grants or quota engine. */
export function createSrmLocationAdmission(input:{schemaDigest:string;parentSchemaDigest:string;proofKey:Uint8Array}):SupplierLocationAdmissionOptions{
 if(typeof window!=='undefined'||![input.schemaDigest,input.parentSchemaDigest].every(v=>/^[a-f0-9]{64}$/.test(v))
  ||!(input.proofKey instanceof Uint8Array)||input.proofKey.byteLength!==32)throw TypeError('Exact P1 receiver schemas and server key required')
 const parentSchemaDigest=input.parentSchemaDigest
 return {schemaDigest:input.schemaDigest,proofKey:Buffer.from(input.proofKey),async readParent({query,actor,request,resource}){
  const descriptor=(await query('SELECT srm.location_admission_installation_descriptor() AS value')).rows[0]?.value as {parentSchemaVersion?:string;parentSchemaDigest?:string}|undefined
  if(!descriptor||descriptor.parentSchemaVersion!=='1.0.0'||descriptor.parentSchemaDigest!==parentSchemaDigest)throw new OperationDenied('POLICY_UNAVAILABLE')
  const p=request.payload as {action?:string;supplierId?:string;locationId?:string|null}
  if(actor.kind!=='HUMAN'||actor.userId!==actor.actorId||resource.supplierLocation?.supplierId!==p.supplierId)throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  return (await query('SELECT srm.location_admission_parent($1::uuid,$2::uuid,$3,$4,$5::uuid) AS value',
   [request.organisationId,p.supplierId,request.operation,p.action,p.locationId])).rows[0]?.value as SupplierLocationParent|null
 }}
}

export function readSrmLocationAdmissionConfiguration(env:Readonly<Record<string,string|undefined>>,accepted:{configurationVersion:string;sql020Digest:string;parentSchemaDigest:string}){
 const key=env.PROFITIA_SUPPLIER_LOCATION_ADMISSION_KEY
 if(typeof window!=='undefined'||env.PROFITIA_SUPPLIER_LOCATION_ADMISSION_VERSION!==accepted.configurationVersion
  ||!key||!/^[A-Za-z0-9+/]{43}=$/.test(key)||Buffer.from(key,'base64').length!==32
  ||Buffer.from(key,'base64').toString('base64')!==key
  ||![accepted.sql020Digest,accepted.parentSchemaDigest].every(v=>/^[a-f0-9]{64}$/.test(v)))throw new OperationDenied('POLICY_UNAVAILABLE')
 return {schemaDigest:accepted.sql020Digest,parentSchemaDigest:accepted.parentSchemaDigest,proofKey:Buffer.from(key,'base64')}
}
