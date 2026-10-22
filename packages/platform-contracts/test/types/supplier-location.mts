import {createRequestLedger} from '../../src/request-ledger.mjs'
import {createDelegatedJobStore} from '../../src/delegated-job.mjs'
import {createDelegatedNativeWorkHost,type DelegatedJobHostOptions} from '../../src/private-operation-host.mjs'
import type {AccessStoreBinding} from '../../src/access-store.mjs'
import type {OperationId} from '../../src/operation-context.mjs'
declare const binding:AccessStoreBinding
const op:OperationId='supplier.location.read';void op
createRequestLedger({binding,operation:'supplier.location.write',schemaDigest:'base',externalSchemaDigest:'external',operationSchemaDigest:'operations',locationSchemaDigest:'location'})
// @ts-expect-error The new installation cannot be omitted.
createRequestLedger({binding,operation:'supplier.location.geocode',schemaDigest:'base',externalSchemaDigest:'external',operationSchemaDigest:'operations'})
// @ts-expect-error A manual write is never a delegated request.
createDelegatedJobStore({binding,targetOperation:'supplier.location.write',schemaDigest:'base',supplierSchemaDigest:'supplier',operationSchemaDigest:'operations',locationSchemaDigest:'location'})
createDelegatedJobStore({binding,targetOperation:'supplier.location.sync',schemaDigest:'base',supplierSchemaDigest:'supplier',operationSchemaDigest:'operations',locationSchemaDigest:'location'})
declare const options:DelegatedJobHostOptions<object>&{job:{schemaDigest:string;targetOperation:'supplier.location.geocode';supplierSchemaDigest:string;operationSchemaDigest:string;locationSchemaDigest:string};privateWork:{schemaDigest:string}}
void createDelegatedNativeWorkHost(options)

import {createSupplierLocationAdmission,type SupplierLocationAdmissionOptions} from '../../src/supplier-location.mjs'
declare const admission:SupplierLocationAdmissionOptions
const port=createSupplierLocationAdmission({binding,...admission})
const id:string=port.locationId({organisationId:'a',userId:'u',supplierId:'s',idempotencyKey:'key'});void id
createRequestLedger({binding,operation:'supplier.location.write',schemaDigest:'base',externalSchemaDigest:'external',operationSchemaDigest:'operations',locationSchemaDigest:'location',locationAdmission:admission})
// @ts-expect-error Current parent selection is a required server adapter.
createSupplierLocationAdmission({binding,schemaDigest:'base',proofKey:new Uint8Array(32)})
