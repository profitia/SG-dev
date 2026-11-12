// SYNTHETIC_ONLY HTML/schema fixtures, not provider observations.
import test from 'node:test'
import assert from 'node:assert/strict'
import {parseHubRequest,assertHubResponse} from '../../../packages/platform-source-hub-contracts/index.mjs'
import {parseEiaSchedule,prepareEiaSchedule,acquireEiaSchedule} from '../src/providers/eia-schedules.mjs'
import {sourceDefinition} from '../src/admission.mjs'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {firstPartyFixture} from '../../../packages/platform-contracts/test/fixtures/first-party-source-postgres.mjs'
const request=(publication,from='2026-11-01',to='2026-11-30')=>({contractVersion:'1.5.0',provider:'eia',family:'publication-calendar',operation:'calendar',criteria:{publication,from,to,limit:1000}})
const gas='<html><!-- SYNTHETIC_ONLY --><h1>Gasoline and Diesel Fuel Update</h1><p>The prices are published around 10:00 a.m. Tuesday eastern time, except on holidays, but still represent Monday\'s price.</p><table><tr><th>Data for:</th><th>Alternate release date</th><th>Release day</th><th>Holiday</th></tr><tr><td>January 19, 2026</td><td>January 21, 2026</td><td>Wednesday</td><td>SYNTHETIC_ONLY holiday</td></tr></table></html>'
const heating='<html><!-- SYNTHETIC_ONLY --><h1>Heating Oil and Propane Update Schedule</h1><p>The season is October through March. Standard release time is 1:00 p.m. eastern time on Wednesdays.</p><table><tr><th>Data for</th><th>Alternate release date</th><th>Release day</th><th>Release time</th><th>Holiday</th></tr><tr><td>December 30, 2024</td><td>January 2, 2025</td><td>Thursday</td><td>1:00 p.m.</td><td>SYNTHETIC_ONLY holiday</td></tr></table></html>'
test('expanded calendar is versioned, EIA-only, closed, and old source paths stay unchanged until activation',()=>{
 for(const pub of ['gasdiesel','heatingoilpropane']){assert.deepEqual(parseHubRequest(request(pub)),request(pub));assert.throws(()=>parseHubRequest({...request(pub),contractVersion:'1.3.0'}));assert(prepareEiaSchedule(request(pub)).url.startsWith('https://www.eia.gov/petroleum/'))}
 assert.throws(()=>parseHubRequest({...request('gasdiesel'),provider:'commodities-sh',criteria:{limit:10}}))
 assert.throws(()=>parseHubRequest({...request('gasdiesel'),criteria:{...request('gasdiesel').criteria,url:'https://untrusted.test'}}))
 assert.equal(sourceDefinition('eia','publication-calendar').pathRules.length,2)
 const active=sourceDefinition('eia','publication-calendar',{includeExpandedSchedules:true})
 assert.equal(active.pathRules.length,4);assert(!active.nativePathRules.some(p=>'prefix'in p))
})
test('fuel-price dates preserve the Monday reference, holidays, DST, and explicitly uncertain usual times',()=>{
 const jan=parseEiaSchedule(gas,request('gasdiesel','2026-01-19','2026-01-22'))
 assert.equal(jan.length,1);assert.equal(jan[0].referencePeriod,'2026-01-19');assert.equal(jan[0].dateOnly,'2026-01-21');assert.equal(jan[0].scheduleStatus,'RULE_DERIVED_UNCONFIRMED');assert(jan[0].qualityFlags.includes('USUAL_RELEASE_TIME_NOT_GUARANTEED'))
 const nov=parseEiaSchedule(gas,request('gasdiesel'));assert.equal(nov.length,4);assert.equal(nov[0].referencePeriod,'2026-11-02');assert.equal(nov[0].scheduledAt,'2026-11-03T15:00:00.000Z');assert(nov.every(p=>p.actual===null&&p.publishedAt===null))
 for(const bad of [gas.replace('Monday\'s','Friday\'s'),gas.replace('Wednesday</td>','Friday</td>'),gas.replace('Data for:','Other field')])assert.throws(()=>parseEiaSchedule(bad,request('gasdiesel')),{code:'PROVIDER_SCHEMA_CHANGED'})
})
test('winter fuel publication does not create weekly summer releases or pretend a schedule is a result',()=>{
 assert.equal(parseEiaSchedule(heating,request('heatingoilpropane','2026-07-01','2026-07-31')).length,0)
 const nov=parseEiaSchedule(heating,request('heatingoilpropane'));assert.equal(nov.length,4);assert(nov.every(p=>new Date(p.referencePeriod).getUTCDay()===1&&p.releaseStatus==='PROVIDER_SCHEDULE_ONLY'))
})
test('expanded response requires exact consumer retention admission and refuses extra source fields',async()=>{
 const r=await acquireEiaSchedule(request('gasdiesel'),{fetchImpl:async()=>new Response(gas,{headers:{'content-type':'text/html'}})})
 const receipt='00000000-0000-4000-8000-000000000001';r.provenance.licenceRef='SYNTHETIC_ONLY';r.usage.receiptRef=receipt
 for(const i of r.items)Object.assign(i.metadata,{licenceRef:'SYNTHETIC_ONLY',usageReceiptRef:receipt,redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY',retentionUntil:null,consumerStorage:{mode:'DURABLE_OWNER_ENTITLEMENT',basisRef:'SYNTHETIC_ONLY',licenceVersion:'1',rightsVersion:'1',consumerApplicationId:'profitia-economic-calendar-runtime-development',retentionMode:'DURABLE_NO_FIXED_EXPIRY',redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY'}})
 assert.equal(assertHubResponse(r,request('gasdiesel')),r)
 const wrong=structuredClone(r);wrong.items[0].metadata.consumerStorage.consumerApplicationId='other-consumer';assert.throws(()=>assertHubResponse(wrong,request('gasdiesel')))
 const injected=structuredClone(r);injected.items[0].payload.actual=42;assert.throws(()=>assertHubResponse(injected,request('gasdiesel')))
})
test('recipient-specific SQL expansion preserves old rights and rejects cross-dataset series and ordinary writes',async()=>{
 const f=await firstPartyFixture(),owner='source_hub_development_owner',load=v=>readFileSync(new URL('../migrations/'+v+'.sql',import.meta.url),'utf8')
 try{
  await f.asOwner(1,async q=>{for(const v of ['006-commodity-providers','007-publication-schedules','008-calendar-consumer-storage','009-ecr-results-storage']){const sql=load(v);await q.query(sql);await q.query('INSERT INTO source_hub.migrations(version,digest) VALUES($1,$2)',[v,createHash('sha256').update(sql).digest('hex')])}},owner)
  const insert=(q,path,series)=>q.query("INSERT INTO source_hub.result_consumer_storage(consumer_application_id,provider_id,family,dataset_id,series_ids,fields,frequency,geography,version,status,basis_ref,retention_mode,redistribution) VALUES('profitia-economic-calendar-runtime-development','eia','series-observations',$1,$2,ARRAY['value'],'weekly','NUS',1,'ACTIVE','SYNTHETIC_ONLY','DURABLE_NO_FIXED_EXPIRY','PRIVATE_AUTHORISED_CONSUMER_ONLY')",[path,series])
  await f.asOwner(1,q=>insert(q,'petroleum/stoc/wstk',['WCESTUS1','WGTSTUS1']),owner)
  const before=await f.asOwner(1,q=>q.query('SELECT to_jsonb(r) AS value FROM source_hub.result_consumer_storage r'),owner)
  await f.asOwner(1,q=>q.query(load('011-expanded-ecr-results')),owner)
  const after=await f.asOwner(1,q=>q.query('SELECT to_jsonb(r) AS value FROM source_hub.result_consumer_storage r'),owner);assert.deepEqual(after.rows,before.rows)
  await assert.rejects(f.asOwner(1,q=>insert(q,'petroleum/pri/gnd',['WCESTUS1']),owner),{code:'23514'})
  await assert.rejects(f.asOwner(1,q=>insert(q,'unadmitted/path',['EMD_EPD2D_PTE_NUS_DPG']),owner),{code:'23514'})
  await f.asOwner(1,q=>insert(q,'petroleum/pri/gnd',['EMD_EPD2D_PTE_NUS_DPG']),owner)
  await assert.rejects(insert(f.db(1),'petroleum/pri/wfr',['W_EPD2F_PRS_NUS_DPG']),{code:'42501'})
  const h=await f.asOwner(1,q=>q.query('SELECT count(*)::integer AS count FROM source_hub.result_consumer_storage_history'),owner);assert.equal(h.rows[0].count,2)
 }finally{await f.close()}
})
