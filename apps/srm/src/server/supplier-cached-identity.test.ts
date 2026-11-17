import test from 'node:test'
import assert from 'node:assert/strict'
import {projectCachedSupplierIdentity,type CachedSupplierIdentityRow} from './supplier-cached-identity'
const nip='8521021463',at=new Date('2026-11-17T20:00:00Z'),hash='a'.repeat(64)
const row=():CachedSupplierIdentityRow=>({general_json:{status:'SUCCESS',source:{provider:'MGBI',model:'pl-krs-wp-record'},data:{nip,legalName:'Przykładowy dostawca',krs:'0000020322',registryHistory:{version:'KRS_CONTINUITY_V1',currentKrs:'0000020322',members:[{krs:'0000020322'}]}}},general_sha256:hash,general_checked_at:'2026-11-17T12:00:00Z',general_source_snapshot_id:'6b4f7bee-a2e8-4b33-93ca-04404cdd26dd'})
test('cached identity returns only the source backed supplier selection and its persisted version',()=>{
 assert.deepEqual(projectCachedSupplierIdentity(row(),nip,at,{}),{nip,krs:'0000020322',name:'Przykładowy dostawca',locality:null,selectionRef:hash})
})
test('missing, stale, future and missing source references never become verified supplier identity',()=>{
 for(const changed of [undefined,{...row(),general_checked_at:'2026-10-01T00:00:00Z'},{...row(),general_checked_at:'2026-11-18T00:00:00Z'},{...row(),general_source_snapshot_id:null},{...row(),general_sha256:'not-a-source-version'}])assert.throws(()=>projectCachedSupplierIdentity(changed,nip,at,{}))
 assert.throws(()=>projectCachedSupplierIdentity(row(),nip,at,{SRM_MGBI_CACHE_TTL_HOURS:'1'}))
})
test('another provider, NIP, ambiguous KRS or incomplete identity cannot inherit catalog authority',()=>{
 const changed=[{source:{provider:'KRS_REGISTRY',model:'pl-krs-wp-record'}},{status:'EMPTY'},{data:{...row().general_json!.data,nip:'0000000000'}},{data:{...row().general_json!.data,legalName:' '}},{data:{...row().general_json!.data,registryHistory:{version:'KRS_CONTINUITY_V1',currentKrs:'0000020322',members:[{krs:'0000020322'},{krs:'0000020322'}]}}},{data:{...row().general_json!.data,registryHistory:{version:'KRS_CONTINUITY_V1',currentKrs:'0000000001',members:[{krs:'0000020322'}]}}}]
 for(const value of changed)assert.throws(()=>projectCachedSupplierIdentity({...row(),general_json:{...row().general_json,...value}},nip,at,{}))
})
