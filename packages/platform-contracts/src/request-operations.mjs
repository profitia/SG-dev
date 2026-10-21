import {createHash} from 'node:crypto'
import {supplierLocationSchemaDigest} from './supplier-location.mjs'

// Closed metadata for the existing admission/delegation engine. This is not a
// policy interpreter: current SQL, explicit grants and the executor still decide.
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
const supplierProfiles=['PORR_SUITE','SPENDGURU_SAAS','SUPPLIER_INTELLIGENCE_STANDALONE']
const spendProfiles=['PORR_SUITE','SPENDGURU_SAAS']
const operations=freeze({
 'forecast.request':{feature:'forecast',module:'benchmark',product:'SPENDGURU',resourceType:'forecast_request',projectionVersion:'request-v1',profiles:spendProfiles,external:false,additional:false,nativeWork:false},
 'supplier.report.refresh':{feature:'supplier_report',module:'supplier_report',product:'SUPPLIER_INTELLIGENCE',resourceType:'supplier_report_request',projectionVersion:'external-request-v1',profiles:supplierProfiles,external:true,additional:false,nativeWork:true},
 'supplier.private.refresh':{feature:'supplier_report',module:'supplier_report',product:'SUPPLIER_INTELLIGENCE',resourceType:'supplier_private_request',projectionVersion:'private-request-v1',profiles:supplierProfiles,external:true,additional:true,nativeWork:true},
 'benchmark.discovery.request':{feature:'benchmark',module:'benchmark',product:'SPENDGURU',resourceType:'benchmark_discovery_request',projectionVersion:'discovery-request-v1',profiles:spendProfiles,external:true,additional:true,nativeWork:true},
 'supplier.location.write':{feature:'supplier_report',module:'supplier_report',product:'SUPPLIER_INTELLIGENCE',resourceType:'supplier_location',projectionVersion:'location-write-v1',profiles:supplierProfiles,external:false,additional:true,location:true,nativeWork:false,delegated:false},
 'supplier.location.sync':{feature:'supplier_report',module:'supplier_report',product:'SUPPLIER_INTELLIGENCE',resourceType:'supplier_location_sync_request',projectionVersion:'location-sync-v1',profiles:supplierProfiles,external:false,additional:true,location:true,nativeWork:true},
 'supplier.location.geocode':{feature:'supplier_report',module:'supplier_report',product:'SUPPLIER_INTELLIGENCE',resourceType:'supplier_location_geocode_request',projectionVersion:'location-geocode-v1',profiles:supplierProfiles,external:true,additional:true,location:true,nativeWork:true},
})
export const REQUEST_OPERATIONS=Object.freeze(Object.keys(operations))
export function requestOperationPolicy(operation){return typeof operation==='string'&&Object.hasOwn(operations,operation)?operations[operation]:null}
export const additionalRequestSchemaUrl=new URL('../migrations/access/017-additional-request-operations.sql',import.meta.url).href
export async function additionalRequestSchemaDigest(){const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL(additionalRequestSchemaUrl))).digest('hex')}
export async function requestOperationsSourceDigest(){const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL('./request-operations.mjs',import.meta.url))).update(fs.readFileSync(new URL('./request-operations.d.mts',import.meta.url))).update(await additionalRequestSchemaDigest()).update(await supplierLocationSchemaDigest()).digest('hex')}
