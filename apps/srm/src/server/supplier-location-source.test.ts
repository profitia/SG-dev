import test from 'node:test'
import assert from 'node:assert/strict'
import {acceptedKysLocations} from './supplier-location-source'
const nip='1234567890',now=Date.parse('2026-10-21T10:00:00.000Z')
const value={section:{status:'SUCCESS',retrievedAt:'2026-10-21T09:00:00.000Z',effectiveAt:null,data:{relatedEntities:[{name:'Company',krs:'0000123456',nip,regon:null,role:'SUBSIDIARY',relationshipStart:null,relationshipEnd:null,stakeDescription:'PRIVATE',sanctionsMatch:true}],beneficialOwners:[{pesel:'PRIVATE'}]}},privateReport:{snapshotId:'11111111-1111-4111-8111-111111111111',entityType:'COMPANY',nip,retentionUntil:'2026-10-22T09:00:00.000Z'}}
test('only accepted current COMPANY related-entity fields cross the KYS location boundary',()=>{
 const result=acceptedKysLocations(value,nip,now);assert.equal(result?.entities.length,1);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|beneficialOwners|pesel/)
 assert.equal(acceptedKysLocations({...value,privateReport:{...value.privateReport,entityType:'JDG'}},nip,now),null)
 assert.equal(acceptedKysLocations({...value,privateReport:{...value.privateReport,retentionUntil:'2026-10-20T09:00:00.000Z'}},nip,now),null)
 assert.equal(acceptedKysLocations(value,'9999999999',now),null)
})
