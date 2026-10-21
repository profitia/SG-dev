import assert from 'node:assert/strict'
import test from 'node:test'
import {googleCoordinates,supplierGeocodingSelection} from './supplier-location-geocoding'
import type {SupplierLocation} from '@profitia/srm-xray'
test('shared Google coordinates expire before 30 days and private source expiry only shortens them',()=>{
 const now=Date.parse('2026-10-21T10:00:00.000Z'),result={status:'resolved',position:{lat:52,lng:21},formatted_address:'must not retain',placeId:'opaque'}
 const c=googleCoordinates(result,null,now)!;assert.equal(Date.parse(c.expiresAt!)-now,29*86400000);assert.doesNotMatch(JSON.stringify(c),/formatted_address/)
 assert.equal(googleCoordinates(result,'2026-10-22T10:00:00.000Z',now)?.expiresAt,'2026-10-22T10:00:00.000Z')
 for(const status of['unresolved','unavailable'])assert.equal(googleCoordinates({...result,status},null,now),null)
 assert.equal(googleCoordinates(result,'invalid',now),null);assert.equal(googleCoordinates(result,'2026-10-20T10:00:00.000Z',now),null)
})
test('only complete current stored addresses select exact location and address versions',()=>{
 const location={id:'L',supplierId:'S',version:'2',addressVersion:'v2',lifecycle:'ACTIVE',address:{line1:'Prosta 1',locality:'Warszawa',postalCode:'00-001',country:'Polska'}} as SupplierLocation
 assert.equal(supplierGeocodingSelection(location)?.expectedVersion,'2')
 assert.equal(supplierGeocodingSelection({...location,lifecycle:'INACTIVE'}),null)
 assert.equal(supplierGeocodingSelection({...location,address:{...location.address!,country:null}}),null)
})
