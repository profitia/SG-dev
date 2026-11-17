import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {preferences, marketCalendarSelection} from '../../../packages/economic-calendar-contracts/index.mjs'
import {fixture, A, B, U} from './fixtures.mjs'

const id = 'ecr_pub_' + 'a'.repeat(64)
const calendar = {q:'ropa',targetId:'all',region:'all',status:'all',period:'next',view:'month'}
const selection = () => ({publicationFavourites:[id],publicationWatches:[{publicationId:id,approaching:true,results:true,changes:false}],savedFilters:[{name:'Mój rynek paliw',filter:{},calendar}]})

test('optional private publication choices preserve legacy preferences and do not activate delivery', () => {
 assert.deepEqual(preferences({}),{watchedCountries:[],watchedIndicators:[],watchedTopics:[],savedFilters:[],display:{}})
 const p=preferences(selection())
 assert.deepEqual(p.publicationFavourites,[id]);assert.deepEqual(p.savedFilters[0].calendar,calendar)
 assert.equal('delivery' in p,false);assert.equal('userId' in p,false)
 assert.deepEqual(marketCalendarSelection(calendar),calendar)
 for(const patch of [{userId:'foreign'},{publicationFavourites:[id,id]},{publicationFavourites:['ecr_evt_'+'b'.repeat(64)]},
  {publicationWatches:[{publicationId:id,approaching:false,results:false,changes:false}]},
  {publicationWatches:[...selection().publicationWatches,...selection().publicationWatches]},
  {publicationWatches:[{...selection().publicationWatches[0],sendEmail:true}]},
  {savedFilters:[{name:'A',filter:{},calendar:{...calendar,events:[]}}]}])assert.throws(()=>preferences(patch))
})

test('publication favourites, watches and named selections restore through existing E1/RLS and optimistic writes', async () => {
 const f=await fixture({seed:false})
 try {
  let r=await f.api('preferences',{method:'PUT',body:{expectedVersion:0,preferences:selection()}})
  assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.version,1)
  const read=await f.api('preferences',{organisation:B,token:'SYNTHETIC_NEW_SESSION_A'})
  assert.equal(read.status,200);assert.deepEqual(read.body.preferences.publicationFavourites,[id])
  assert.equal(read.body.preferences.savedFilters[0].name,'Mój rynek paliw')
  assert.equal((await f.api('preferences',{method:'PUT',body:{expectedVersion:0,preferences:{}}})).status,409)
  const foreign=await f.api('preferences',{token:'SYNTHETIC_B'})
  assert.deepEqual(foreign.body.preferences.savedFilters,[]);assert.equal(foreign.body.preferences.publicationWatches,undefined)
  const p=read.body.preferences;p.savedFilters[0].name='Paliwa';p.publicationWatches=[];p.publicationFavourites=[]
  r=await f.api('preferences',{method:'PUT',body:{expectedVersion:read.body.version,preferences:p}})
  assert.equal(r.status,200);assert.deepEqual(r.body.preferences.publicationWatches,[])
  assert.equal((await f.api('preferences')).body.preferences.savedFilters[0].name,'Paliwa')
  f.e1.clerkState.sessionActive=false
  assert.equal((await f.api('preferences')).status,403)
 } finally {await f.close()}
})

test('prepared private-access SQL equals the complete owner plan and changes only two feature arrays and two exact grants',async()=>{
 const plan=JSON.parse(fs.readFileSync(new URL('../operations/market-calendar-owner-plan.json',import.meta.url),'utf8'))
 const source=fs.readFileSync(new URL('../operations/market-calendar-private-access.sql',import.meta.url),'utf8'),match=/expected jsonb:=\$plan\$(.*?)\$plan\$::jsonb;/s.exec(source)
 assert(match);assert.deepEqual(JSON.parse(match[1]),plan,'entire operational profile, not a string-presence check')
 const f=await fixture({seed:false})
 try{
  const central=f.e1.bindings[0],testPlan={...plan,organisationId:A,acceptanceUserId:U,identity:{...plan.identity,projectId:central.projectId,branchId:central.branchId,databaseName:central.databaseName}}
  // Only installation identity is substituted for this disposable local fixture.
  const sql=source.replace(match[1],JSON.stringify(testPlan)).replace("current_database()<>'platform_private'","current_database()<>'"+central.databaseName+"'")
   .replace("project_id='spring-bread-28217539'","project_id='"+central.projectId+"'").replace("branch_id='br-sparkling-term-b99l107x'","branch_id='"+central.branchId+"'")
  await f.e1.asOwner(0,async q=>{
   await q.query("UPDATE profitia_access.product_grants SET features=CASE WHEN application_id='spendguru' THEN ARRAY['benchmark','category','market','forecast'] ELSE ARRAY['market'] END WHERE application_id IN('spendguru','profitia-economic-calendar-runtime-development') AND organisation_id=$1",[A])
   await q.query("DELETE FROM profitia_access.permission_grants WHERE application_id='profitia-economic-calendar-runtime-development' AND organisation_id=$1 AND user_id=$2 AND operation IN('personal.list.read','personal.list.write')",[A,U])
  })
  const install=p=>f.e1.asOwner(0,async q=>{await q.query("SELECT set_config('profitia.market_calendar_owner_plan',$1,true),set_config('profitia.owner_decision_ref',$2,true)",[JSON.stringify(p),'owner-decision:sha256:'+'a'.repeat(64)]);return q.query(sql)})
  await assert.rejects(install({...testPlan,acceptanceUserId:B}),/EXACT_OWNER_PLAN_AND_IDENTITY_DEVELOPMENT_REQUIRED/)
  assert.equal((await f.api('preferences')).status,403)
  const before=await f.e1.asOwner(0,q=>q.query("SELECT application_id,expires_at FROM profitia_access.product_grants WHERE organisation_id=$1 ORDER BY application_id",[A]))
  await install(testPlan)
  const rows=await f.e1.asOwner(0,q=>q.query("SELECT grant_id,operation,resource_id FROM profitia_access.permission_grants WHERE grant_id=ANY($1::uuid[]) ORDER BY operation",[plan.permissionGrants.map(g=>g.grantId)]))
  assert.equal(rows.rowCount,2);assert.deepEqual(rows.rows.map(r=>r.operation),['personal.list.read','personal.list.write']);assert(rows.rows.every(r=>r.resource_id==='economic-calendar-preferences'))
  const after=await f.e1.asOwner(0,q=>q.query("SELECT application_id,expires_at FROM profitia_access.product_grants WHERE organisation_id=$1 ORDER BY application_id",[A]));assert.deepEqual(after.rows,before.rows)
  assert.equal((await f.api('preferences')).status,200)
  await assert.rejects(install(testPlan),/CURRENT_PRODUCT_FEATURES_CHANGED_RECONCILE/)
 }finally{await f.close()}
})
