import assert from 'node:assert/strict'
import test from 'node:test'
import {mapMgbiGeneralRecord} from './mgbi-general'
import {projectCompanyGeneralArchive} from './company-general-cache'
import {mgbiStructuredLocationAddress,projectSupplierHeadquarters,projectRelatedCompanyLocations,sourceAddressVersion,sourceSyncIdentity,sourceIsNewer,type AcceptedCompanyAddress} from './supplier-location-sync'
import {parseManualLocation,currentLocationCoordinates,supplierLocationsMapProjection,type SupplierLocation,type LocationSource} from '@profitia/srm-xray'
import {canonicalLocationJson,assignedLocationId,locationCommandDigest} from './supplier-location-store'
const time='2026-10-21T10:00:00.000Z',now=Date.parse(time),supplierId='11111111-1111-4111-8111-111111111111'
const record={id:'company-record',identifiers:{pl_nip:'1234567890',pl_krs:'0000123456'},content:{current_excerpt:{dane:{dzial1:{danePodmiotu:{nazwa:'Firma sp. z o.o.'},siedzibaIAdres:{adres:{ulica:'Prosta',nrDomu:'1',nrLokalu:'2',kodPocztowy:'00-001',miejscowosc:'Warszawa',kraj:'POLSKA'}}}}}}}
const company=():AcceptedCompanyAddress=>({supplierId,nip:record.identifiers.pl_nip,krs:record.identifiers.pl_krs,section:mapMgbiGeneralRecord(record,time).section,structuredAddress:mgbiStructuredLocationAddress(record),source:{kind:'MGBI',reportId:'MGBI:1234567890:'+'a'.repeat(64),version:'a'.repeat(64),retrievedAt:time,effectiveAt:null,retentionUntil:null}})
const kys:LocationSource={kind:'KYS',reportId:'22222222-2222-4222-8222-222222222222',version:'22222222-2222-4222-8222-222222222222',retrievedAt:time,effectiveAt:null,retentionUntil:'2026-10-22T10:00:00.000Z'}
const entity={name:'Firma',krs:'0000123456',nip:'1234567890',regon:null,role:'SUBSIDIARY',relationshipStart:'2020-01-01',relationshipEnd:null,stakeDescription:null,sanctionsMatch:null}
test('fresh and checksum-verified archived HQ use the same structured address without acquiring a report',()=>{
 const fresh=company(),archived=projectCompanyGeneralArchive({record_count:1,retrieved_at:time,valid_checksum:true,records:[record]},fresh.nip)
 assert.deepEqual(projectSupplierHeadquarters(fresh,now),projectSupplierHeadquarters({...fresh,section:archived.section,structuredAddress:mgbiStructuredLocationAddress(archived.rawRecord)},now))
 assert.equal(projectSupplierHeadquarters(fresh,now)?.address?.line1,'Prosta 1/2')
 assert.equal(projectSupplierHeadquarters(fresh,now)?.verification,'VERIFIED_SOURCE')
})
test('partial address remains visible but unresolved; missing source cannot invent HQ or branches',()=>{
 const c={...company(),structuredAddress:null}
 assert.equal(projectSupplierHeadquarters(c,now)?.verification,'INCOMPLETE')
 assert.equal(projectSupplierHeadquarters({...c,section:{...c.section,status:'EMPTY',data:null}},now),null)
 assert.equal(projectSupplierHeadquarters(c,now)?.kind,'HEADQUARTERS')
 assert.throws(()=>projectSupplierHeadquarters({...c,nip:'9999999999'},now),/identity/)
 assert.equal(projectSupplierHeadquarters({...c,section:{...c.section,data:{...c.section.data!,registrationStatus:'DEREGISTERED'}}},now),null)
})
test('KYS legal entities stay separate, preserve unlocated rows, and require exact legal identifiers for enrichment',()=>{
 const input={supplierId,source:kys,entities:[entity,{...entity,krs:'0000999999',nip:null},{...entity,krs:null,nip:null,name:'Jan Kowalski'}],complete:true}
 const rows=projectRelatedCompanyLocations(input,[company()],now)
 assert.equal(rows.length,2);assert.equal(rows[0].group,'RELATED_ENTITIES');assert.equal(rows[0].address?.line1,'Prosta 1/2');assert.equal(rows[1].address,null)
 assert.equal(rows[1].verification,'UNRESOLVED');assert.equal(rows[0].sources.length,2)
 assert.equal(projectRelatedCompanyLocations({...input,entities:[{...entity,krs:null}]},[],now).length,0)
 assert.equal(projectRelatedCompanyLocations({...input,entities:[{...entity,krs:null}]},[company()],now)[0].relationship?.identity,'VERIFIED_MGBI_MATCH')
 assert.throws(()=>projectRelatedCompanyLocations({...input,entities:[{...entity,nip:'9999999999'}]},[company()],now),/conflict/)
 assert.throws(()=>projectRelatedCompanyLocations({...input,source:{...kys,retentionUntil:time}},[],now),/accepted/)
})
test('relationship end/future/ambiguous dates do not become silently active current markers',()=>{
 for(const change of[{relationshipEnd:'2025-01-01'},{relationshipStart:'2027-01-01'}])assert.equal(projectRelatedCompanyLocations({supplierId,source:kys,entities:[{...entity,...change}],complete:true},[],now)[0].lifecycle,'INACTIVE')
 assert.equal(projectRelatedCompanyLocations({supplierId,source:kys,entities:[{...entity,relationshipEnd:'31.02.2026'}],complete:true},[],now)[0].verification,'INCOMPLETE')
})
test('stable entity/address keys, monotonic source versions and Root-compatible digest',()=>{
 const c=company(),h=projectSupplierHeadquarters(c,now)!
 assert.equal(sourceAddressVersion(h),sourceAddressVersion({...h,address:h.address}))
 assert.equal(sourceSyncIdentity('org',supplierId,[c.source,kys]),sourceSyncIdentity('org',supplierId,[kys,c.source]))
 assert.equal(sourceIsNewer(c.source,{...c.source,retrievedAt:'2026-10-20T10:00:00.000Z'}),false)
 assert.throws(()=>sourceIsNewer(c.source,{...c.source,version:'b'.repeat(64)}),/Conflicting/)
 assert.equal(canonicalLocationJson({z:[2,1],a:null}),'{"a":null,"z":[2,1]}')
 assert.equal(locationCommandDigest({z:[2,1],a:null}),locationCommandDigest({a:null,z:[2,1]}))
 assert.equal(assignedLocationId('A',supplierId,'key'),assignedLocationId('A',supplierId,'key'))
 assert.notEqual(assignedLocationId('A',supplierId,'key'),assignedLocationId('B',supplierId,'key'))
})
test('manual input rejects client authority, provider provenance and invalid positions',()=>{
 const input={label:'Budowa',description:'',address:{line1:'Prosta 1',postalCode:'00-001',locality:'Warszawa',country:'Polska'},position:null}
 assert.equal(parseManualLocation(input).label,'Budowa')
 for(const patch of[{organisationId:'A'},{createdByUserId:'U'},{sources:[kys]},{coordinates:{origin:'GOOGLE_GEOCODING'}}])assert.throws(()=>parseManualLocation({...input,...patch}))
 for(const position of[{lat:91,lng:0},{lat:0,lng:NaN},{lat:0,lng:1,origin:'USER_INPUT'}])assert.throws(()=>parseManualLocation({...input,position}))
 assert.throws(()=>parseManualLocation({...input,address:{...input.address,locality:''}}))
})
test('map allowlist omits actors, source payload and expired coordinates while retaining postal data',()=>{
 const location={id:'opaque',label:'Company',address:company().structuredAddress,kind:'HEADQUARTERS',lifecycle:'ACTIVE',coordinates:{position:{lat:52,lng:21},origin:'GOOGLE_GEOCODING',fetchedAt:'2026-09-20T10:00:00.000Z',expiresAt:'2026-10-20T10:00:00.000Z'},createdByUserId:'PRIVATE-ACTOR',sources:[kys]} as unknown as SupplierLocation
 assert.equal(currentLocationCoordinates(location,now),null)
 const output=supplierLocationsMapProjection([location],now)
 assert.deepEqual(Object.keys(output[0]).sort(),['address','id','kind','label']);assert.match(output[0].address!,/Prosta/)
 assert.doesNotMatch(JSON.stringify(output),/PRIVATE-ACTOR|retentionUntil|GOOGLE_GEOCODING/)
 assert.equal(currentLocationCoordinates({...location,coordinates:{...location.coordinates!,fetchedAt:time,expiresAt:'2027-10-22T10:00:00.000Z'}},now),null)
 assert.throws(()=>supplierLocationsMapProjection(Array(501).fill(location),now))
})
