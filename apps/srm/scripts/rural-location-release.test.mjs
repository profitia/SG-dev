import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {releaseRuralLocations,ruralLocationFunctions} from './rural-location-release.mjs'
const old=['57578f92d59197e8b677813e9ac872a1','2de9ffe414a087d3af6bb671eaa1c8a6'],adopted=['0a6c57f8b287735493c80e88ed53abec','df1f69b58ee069758d85f80ee55a6e3b']
function fixture({dirty=false,fail=false,restore=false}={}){
 const calls=[],backup={target:'MAIN_SRM_DEVELOPMENT',functions:ruralLocationFunctions.map((signature,i)=>({signature,definition:'ORIGINAL '+i,body_md5:old[i]}))}
 let installed=restore
 const client={async query(sql,values){calls.push(sql)
  if(sql.startsWith('SELECT current_database'))return{rows:[{allowed:!dirty}]}
  if(sql.startsWith('SELECT pg_get_functiondef')){const i=ruralLocationFunctions.indexOf(values[0]);return{rows:[{definition:installed?'ADOPTED '+i:backup.functions[i].definition,body_md5:(installed?adopted:old)[i]}]}}
  if(sql.startsWith('-- Optional')){if(fail)throw Error('synthetic install failure');installed=true}
  if(sql==='ORIGINAL 1')installed=false
  if(sql.startsWith('SELECT NOT EXISTS'))return{rows:[{clean:true,retained_admin:'2'}]}
  return{rows:[]}
 }}
 return{client,backup,calls}
}
test('controlled install removes temporary membership before commit and retains original backup',async()=>{
 const f=fixture(),before=structuredClone(f.backup),result=await releaseRuralLocations(f.client,{backup:f.backup,apply:true})
 assert.equal(result.applied,true);assert.deepEqual(f.backup,before);assert.equal(f.calls.at(-1),'COMMIT')
 assert(f.calls.findIndex(x=>x.startsWith('REVOKE profitia_access_owner'))<f.calls.indexOf('COMMIT'))
 assert.equal(result.historyDeleted,false);assert.equal(result.paidPoliciesChanged,false)
})
test('dry-run and exact function rollback preserve the same controlled transaction',async()=>{
 const dry=fixture();await releaseRuralLocations(dry.client,{backup:dry.backup});assert.equal(dry.calls.at(-1),'ROLLBACK')
 const f=fixture({restore:true});await releaseRuralLocations(f.client,{backup:f.backup,restore:true,apply:true});assert.equal(f.calls.at(-1),'COMMIT');assert(f.calls.includes('ORIGINAL 0'));assert(f.calls.includes('ORIGINAL 1'))
})
test('wrong operator, invalid backup and failed migration cannot commit',async()=>{
 const invalid=fixture();await assert.rejects(releaseRuralLocations(invalid.client,{backup:{...invalid.backup,target:'OTHER'}}));assert.deepEqual(invalid.calls,[])
 for(const config of[{dirty:true},{fail:true}]){const f=fixture(config);await assert.rejects(releaseRuralLocations(f.client,{backup:f.backup,apply:true}));assert.equal(f.calls.at(-1),'ROLLBACK');assert(!f.calls.includes('COMMIT'))}
})
test('rural adoption pins exact current files and retains previous authority, provider quality and every historical receipt',()=>{
 const hash=v=>createHash('sha256').update(v).digest('hex'),receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.ruralLocationAddressRecovery
 assert.equal(a.targetServiceId,'srv-db1vu6gm7kps73d0e3r0');assert.equal(a.featureVersion,'srm-polish-rural-address-v1')
 const previous=execFileSync('git',['show',a.authorityBaseSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(previous)))assert.deepEqual(receipt[k],v,k)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(fs.readFileSync(new URL('../'+file,import.meta.url))),receipt.freshPerformanceRecovery.applicationSourceDigests[file]??receipt.appshellReadyPeerRecovery?.applicationSourceDigests[file]??digest,file)
 assert.equal(hash(fs.readFileSync(new URL('../db/private-store/'+a.migration,import.meta.url))),a.migrationDigest)
 for(const flag of ['providerAccuracyThresholdChanged','paidProviderPoliciesChanged','runtimeRolesOrGrantsExpanded','otherEnvironmentDeployment'])assert.equal(a[flag],false,flag)
 for(const file of ['src/server/google/geocoding.mjs','src/server/geocoding-command.mjs'])assert.deepEqual(fs.readFileSync(new URL('../../maps-runtime/'+file,import.meta.url)),execFileSync('git',['show',a.authorityBaseSha+':apps/maps-runtime/'+file]))
})
