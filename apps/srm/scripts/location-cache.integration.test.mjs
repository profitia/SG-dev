import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import pg from 'pg'
import {readSrmPersistedLocationCoordinates,createSrmLocationGeocodingRequest} from '../src/server/supplier-location-geocoding.ts'
import {createSupplierLocationRuntime} from '../src/server/supplier-locations.ts'
import {runLocationCacheMaintenance,LOCATION_CACHE_MAINTENANCE_ROLE} from './location-cache-maintenance.mjs'
const hash=s=>createHash('sha256').update(s).digest('hex')
/** Runs inside the existing isolated E1/Clerk/Source/RLS fixture. No Google,
 * MGBI, network source, cloud database, or persisted production data is used. */
export async function exerciseLocationCacheFixture(t,f){
 const{root,owner,controlled,own,url,options,WORKER,ROLE,A,B,U,V,S,input,location,cached,geo,page,call,manual,command,ORIGIN,p1}=f
 const migration=own('033-location-geocoding-cache.sql'),digest=hash(migration),role=LOCATION_CACHE_MAINTENANCE_ROLE
 await t.test('bounded cache installation refuses a normal login and rolls back interrupted installation',async()=>{
  await assert.rejects(owner.query(migration),e=>e.code==='42501')
  await assert.rejects(controlled(async()=>{await owner.query(migration);throw Error('synthetic interruption')}))
  assert.equal((await owner.query("SELECT to_regclass('srm.location_cache_installation') value")).rows[0].value,null)
  await controlled(async()=>{
   await owner.query(migration)
   await owner.query("INSERT INTO srm.location_cache_installation VALUES(true,'1.0.0',$1,$2)",[digest,'a'.repeat(40)])
   await owner.query(`GRANT EXECUTE ON FUNCTION srm.location_cache_descriptor() TO ${ROLE},${WORKER}`)
   await owner.query(`GRANT EXECUTE ON FUNCTION srm.location_cache_read(uuid,uuid,uuid),srm.location_sync_matches(uuid,uuid,jsonb) TO ${ROLE}`)
  })
 })
 if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)
  await root.query(`CREATE ROLE ${role} LOGIN PASSWORD 'isolated_ci_only' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 1`)
 await root.query(`GRANT CONNECT ON DATABASE ${url.pathname.slice(1)} TO ${role}`)
 await controlled(()=>owner.query(`GRANT USAGE ON SCHEMA srm TO ${role};GRANT EXECUTE ON FUNCTION srm.location_cache_maintain() TO ${role}`))
 const maintenanceUrl=new URL(url);maintenanceUrl.username=role;maintenanceUrl.password='isolated_ci_only'
 const maintenance=new pg.Client({connectionString:maintenanceUrl.toString()});await maintenance.connect()
 const purge=async()=>{
  // The CLI checks the fixed cloud database separately. This isolated fixture
  // retains the real SQL/transaction logic, supplying only its local DB name.
  const client={query:async s=>s.startsWith('SELECT session_user')?{rows:[{role,database_name:'platform_private'}]}:maintenance.query(s)}
  return runLocationCacheMaintenance(client)
 }
 const configured={...options,locationCacheSchemaDigest:digest}
 const read=(user=U,organisationId=A)=>readSrmPersistedLocationCoordinates(configured,{...input,organisationId,
  request:new Request(ORIGIN+'/api/supplier-locations',{method:'POST',headers:{Origin:ORIGIN,Authorization:'Bearer external-'+user}})})
 try{
  await t.test('ordinary retention login has no table/owner access; initial sweep stores no Google content in audit',async()=>{
   await assert.rejects(maintenance.query('SELECT * FROM srm.supplier_locations'),e=>e.code==='42501')
   await assert.rejects(maintenance.query('SET ROLE profitia_access_owner'),e=>e.code==='42501')
   assert.deepEqual(await purge(),{completed:true,expiredCoordinates:0})
   assert.doesNotMatch(JSON.stringify((await controlled(()=>owner.query('SELECT * FROM srm.location_cache_maintenance_runs'))).rows),/52\.1|21\.1|synthetic-only/)
  })
  await t.test('committed Google result survives new runtime instances and reads by another authorised member without Geocoding',async()=>{
   assert.deepEqual((await read()).coordinates,cached.coordinates)
   assert.deepEqual((await read(V)).coordinates,cached.coordinates)
   for(let i=0;i<3;i++){
    const runtime=createSupplierLocationRuntime(configured)
    const result=await runtime.page(input,'USER_LOCATIONS',0,50)
    assert.deepEqual(result.items.find(v=>v.id===location.id).coordinates,cached.coordinates)
    assert.deepEqual(await geo.request(input),{status:'RESOLVED',paidCalls:0})
   }
   await assert.rejects(read(U,B))
  })
  await t.test('unchanged accepted source sync performs no new write cycle or request reservation',async()=>{
   const runtime=createSupplierLocationRuntime({...configured,sourceScope:'HEADQUARTERS_MANUAL'})
   await runtime.sync(input)
   const before=(await owner.query("SELECT count(*)::int n FROM profitia_requests.intents WHERE operation='supplier.location.sync'")).rows[0].n
   const next=await runtime.sync(input)
   assert.equal(next.status,'CURRENT');assert.deepEqual(next.receipts,[])
   assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_requests.intents WHERE operation='supplier.location.sync'")).rows[0].n,before)
  })
  await t.test('editing a description preserves Google provenance; copied Google coordinates cannot become USER_INPUT',async()=>{
   let current=(await(await page()).json()).items.find(v=>v.id===location.id)
   const edit={...manual,label:'Geo target edited',position:cached.coordinates.position}
   const r=await call({action:'UPDATE',supplierId:S,locationId:location.id,expectedVersion:current.version,command:edit},U,'cache-edit-'+randomUUID())
   assert.equal(r.status,202,await r.clone().text())
   current=(await(await page()).json()).items.find(v=>v.id===location.id)
   assert.equal(current.coordinates.origin,'GOOGLE_GEOCODING');assert.equal(current.createdByUserId,U)
   assert.deepEqual(current.coordinates,cached.coordinates)
  })
  await t.test('physical expiry removes Google data on an unopened collection while preserving manual USER_INPUT and addresses',async()=>{
   const before=(await(await page()).json()).items.filter(v=>v.coordinates?.origin==='USER_INPUT')
   await controlled(()=>owner.query("UPDATE srm.supplier_locations SET body=jsonb_set(body,'{coordinates}',jsonb_build_object('origin','GOOGLE_GEOCODING','position',body->'coordinates'->'position','placeId','expired-synthetic','fetchedAt',clock_timestamp()-interval '30 days','expiresAt',clock_timestamp()-interval '1 day')) WHERE organization_id=$1 AND supplier_id=$2 AND location_id=$3",[A,S,location.id]))
   assert.deepEqual(await purge(),{completed:true,expiredCoordinates:1})
   const stored=(await controlled(()=>owner.query('SELECT body FROM srm.supplier_locations WHERE organization_id=$1 AND supplier_id=$2 AND location_id=$3',[A,S,location.id]))).rows[0].body
   assert.equal(stored.coordinates,null);assert.equal(stored.geocodingStatus,'EXPIRED');assert(stored.address);assert.doesNotMatch(JSON.stringify(stored),/expired-synthetic/)
   assert.equal(await read(),null)
   assert.deepEqual((await(await page()).json()).items.filter(v=>v.coordinates?.origin==='USER_INPUT'),before)
   assert.deepEqual(await purge(),{completed:true,expiredCoordinates:0})
  })
 }finally{await maintenance.end()}
}
