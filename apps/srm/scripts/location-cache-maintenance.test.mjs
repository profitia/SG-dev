import test from 'node:test'
import assert from 'node:assert/strict'
import {LOCATION_CACHE_MAINTENANCE_ROLE as role,locationCacheMaintenanceConfiguration,runLocationCacheMaintenance} from './location-cache-maintenance.mjs'
const base=()=>({TARGET_ENVIRONMENT:'development',SRM_LOCATION_CACHE_MAINTENANCE_VERSION:'srm-location-cache-maintenance-v1',
 SRM_LOCATION_CACHE_MAINTENANCE_URL:'postgresql://'+role+':synthetic-only@ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech/platform_private?sslmode=require&channel_binding=require'})
test('cache maintenance configuration admits only its fixed ordinary main Development connection',()=>{
 assert.equal(locationCacheMaintenanceConfiguration(base()).connectionTimeoutMillis,5000)
 for(const change of [{TARGET_ENVIRONMENT:'staging'},{TARGET_ENVIRONMENT:'production'},{SRM_LOCATION_CACHE_MAINTENANCE_VERSION:'unaccepted'},
  {SRM_LOCATION_CACHE_MAINTENANCE_URL:base().SRM_LOCATION_CACHE_MAINTENANCE_URL.replace(role,'neondb_owner')},
  {SRM_LOCATION_CACHE_MAINTENANCE_URL:base().SRM_LOCATION_CACHE_MAINTENANCE_URL.replace('ep-late-heart-b9mxo8oi','ep-other')},
  {SRM_LOCATION_CACHE_MAINTENANCE_URL:base().SRM_LOCATION_CACHE_MAINTENANCE_URL.replace('/platform_private','/another')},
  {SRM_LOCATION_CACHE_MAINTENANCE_URL:base().SRM_LOCATION_CACHE_MAINTENANCE_URL.replace('sslmode=require','sslmode=disable')}])assert.throws(()=>locationCacheMaintenanceConfiguration({...base(),...change}))
})
const fixture=(patch={})=>{
 const calls=[]
 const client={query:async sql=>{calls.push(sql)
  if(sql.startsWith('SELECT session_user'))return{rows:[{role,database_name:'platform_private',...patch.identity}]}
  if(sql.includes('location_cache_maintain')){if(patch.fail)throw Error('synthetic');return{rows:[{result:patch.receipt??{completed:true,expiredCoordinates:2}}]}}
  return{rows:[]}
 }}
 return{client,calls}
}
test('scheduled cache purge commits its bounded receipt without fetching or returning coordinates',async()=>{
 const f=fixture();assert.deepEqual(await runLocationCacheMaintenance(f.client),{completed:true,expiredCoordinates:2})
 assert.equal(f.calls.at(-1),'COMMIT');assert.equal(f.calls.filter(s=>s.includes('location_cache_maintain')).length,1)
 assert(f.calls.includes("SET LOCAL statement_timeout='8s'"));assert(!f.calls.some(s=>/supplier_locations|\bGRANT\b|\bSET(?: LOCAL)? ROLE\b|https?:|\blat\b|\blng\b/i.test(s)))
})
test('wrong identity, malformed receipts and failed SQL roll back without retrying the purge',async()=>{
 for(const patch of [{identity:{role:'neondb_owner'}},{identity:{database_name:'pilot'}},{fail:true},{receipt:{completed:true,expiredCoordinates:-1}},{receipt:{completed:true,expiredCoordinates:1,coordinates:[52,21]}}]){
  const f=fixture(patch);await assert.rejects(runLocationCacheMaintenance(f.client));assert.equal(f.calls.at(-1),'ROLLBACK');assert(!f.calls.includes('COMMIT'))
  assert(f.calls.filter(s=>s.includes('location_cache_maintain')).length<=1)
 }
})

