import test from 'node:test'
import {nativeReadTests,nativePublicationTests} from './native.test.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import {performance} from 'node:perf_hooks'
import {Pool} from 'pg'
import {canonical} from '@profitia/krs-registry-contracts'
import {Catalog,storeSnapshot,SEARCH_SQL} from '../dist/catalog.js'
import {transaction,enqueueBulletin,claim,finishItem,markFailed,replayFailed,createSynchronizer} from '../dist/sync.js'
import {createKrsClient,buildRequest} from '../dist/client.js'
import {isolatedDatabaseUrl} from '../dist/config.js'
import {normalizeExtract} from '../dist/normalizer.js'
import {snapshot,bytes,extract,NOW,KRS,fixtureSource} from './fixtures.mjs'
test('isolated PostgreSQL catalog, roles, transactional sync and 100k search',async t=>{
 const url=isolatedDatabaseUrl(process.env.KRS_FIXTURE_OWNER_URL,'krs_test_owner'),owner=new Pool({connectionString:url,max:4})
 let reader,ingest
 const proof={syntheticOnly:true,cloudConnections:0,networkProviderCalls:0,node:process.version,platform:process.platform,arch:process.arch,cpus:os.cpus().length,cpu:os.cpus()[0]?.model,totalMemoryBytes:os.totalmem(),postgres:null,performance:null,plans:{}}
 try{
  const identity=(await owner.query('SELECT current_database() AS db,current_user AS role,version()')).rows[0];assert.equal(identity.db,'krs_registry_test');assert.equal(identity.role,'krs_test_owner');proof.postgres=identity.version
  assert.equal((await owner.query("SELECT to_regnamespace('krs_registry') AS schema")).rows[0].schema,null)
  await owner.query("CREATE ROLE krs_migrator NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;CREATE ROLE krs_reader LOGIN PASSWORD 'isolated_ci_only' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;CREATE ROLE krs_ingest LOGIN PASSWORD 'isolated_ci_only' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;GRANT CREATE ON DATABASE krs_registry_test TO krs_migrator;REVOKE CREATE ON SCHEMA public FROM PUBLIC")
  const up=await fs.readFile(new URL('../migrations/001.up.sql',import.meta.url),'utf8'),down=await fs.readFile(new URL('../migrations/001.down.sql',import.meta.url),'utf8')
  const migrate=sql=>transaction(owner,async tx=>{await tx.query('SET LOCAL ROLE krs_migrator');return tx.query(sql)})
  await t.test('migrator transaction rollback leaves no partial schema',async()=>{await assert.rejects(transaction(owner,async tx=>{await tx.query('SET LOCAL ROLE krs_migrator');await tx.query(up);throw Error('interrupt')}));assert.equal((await owner.query("SELECT to_regnamespace('krs_registry') AS schema")).rows[0].schema,null)})
  await migrate(up)
  const roleUrl=role=>{const u=new URL(url);u.username=role;u.password='isolated_ci_only';return isolatedDatabaseUrl(u.href,role)}
  reader=new Pool({connectionString:roleUrl('krs_reader'),max:4});ingest=new Pool({connectionString:roleUrl('krs_ingest'),max:4})
  const catalog=new Catalog(reader),s=await snapshot()
  await t.test('ordinary roles have no owner, DDL, inheritance or bypass privilege',async()=>{
   for(const [pool,role]of [[reader,'krs_reader'],[ingest,'krs_ingest']]){const r=(await pool.query('SELECT current_user AS role,r.rolsuper,r.rolbypassrls,r.rolinherit FROM pg_roles r WHERE rolname=current_user')).rows[0];assert.deepEqual(r,{role,rolsuper:false,rolbypassrls:false,rolinherit:false});await assert.rejects(pool.query('CREATE TABLE krs_registry.forbidden(id int)'),e=>e.code==='42501');await assert.rejects(pool.query('SET ROLE krs_migrator'),e=>e.code==='42501')}
   await assert.rejects(reader.query("INSERT INTO krs_registry.companies(krs,entity_key,state) VALUES('0000000001','PL:KRS:0000000001','UNKNOWN')"),e=>e.code==='42501')
   await assert.rejects(reader.query('UPDATE krs_registry.metadata SET generation=0'),e=>e.code==='42501');await assert.rejects(ingest.query('DELETE FROM krs_registry.snapshots'),e=>e.code==='42501')
  })
  await t.test('atomic snapshot rollback, content-addressed replay, changed same intent denied',async()=>{
   await assert.rejects(transaction(ingest,async tx=>{await storeSnapshot(tx,s,'fixture:1');throw Error('audit failure')}));assert.equal(await catalog.read(KRS),null)
   assert.equal(await transaction(ingest,tx=>storeSnapshot(tx,s,'fixture:1')),s.evidenceRef)
   assert.equal(await transaction(ingest,tx=>storeSnapshot(tx,s,'fixture:1')),s.evidenceRef)
   assert.equal((await owner.query('SELECT count(*)::int AS n FROM krs_registry.snapshots')).rows[0].n,1)
   await assert.rejects(transaction(ingest,async tx=>storeSnapshot(tx,await snapshot({name:'different'}),'fixture:1')),/INTENT_CONTENT_CONFLICT/)
   assert.equal(canonical(await catalog.read(KRS)),canonical(s))
  })
  await t.test('Unicode, aliases, literal wildcards, incomplete coverage, identifiers',async()=>{
   for(const q of ['ŁÓDŹ','lodz','Ło\u0301dz\u0301']){const r=await catalog.search({query:q});assert.equal(r.candidates[0].krs,KRS);assert.equal(r.candidates[0].financiallyVerified,false);assert.equal(r.coverage.scope,'PROGRESSIVE');assert.equal(r.coverage.totalCompanies,null)}
   for(const q of ['%','_',"'; DROP SCHEMA krs_registry CASCADE;--"]){const r=await catalog.search({query:q});assert.equal(r.status,'NOT_IN_CATALOG');assert.equal(r.candidates.length,0)}
   assert.deepEqual(await catalog.byNip(s.nip),[KRS]);assert.equal((await catalog.search({query:'unseeded-company'})).status,'NOT_IN_CATALOG')
  })
  await t.test('daily queue transaction, dedup, crash before enqueue commit and lease concurrency',async()=>{
   await assert.rejects(transaction(ingest,async tx=>{await enqueueBulletin(tx,'2026-10-20',bytes(['28860','28860']),new Date(NOW).toISOString());throw Error('crash')}));assert.equal((await owner.query('SELECT count(*)::int AS n FROM krs_registry.checkpoints')).rows[0].n,0)
   const result=await transaction(ingest,tx=>enqueueBulletin(tx,'2026-10-20',bytes(['28860',KRS,'30897']),new Date(NOW).toISOString()));assert.equal(result.count,2)
   const results=await Promise.all([claim(ingest,['2026-10-20']),claim(ingest,['2026-10-20'])]);assert.equal(new Set(results.map(r=>r.krs)).size,2);assert.equal(await claim(ingest,['2026-10-20']),null)
   const expired=results[0];await owner.query("UPDATE krs_registry.items SET lease_until=clock_timestamp()-interval '1 second' WHERE lease_token=$1",[expired.lease_token]);const recovered=await claim(ingest,['2026-10-20']);assert.equal(recovered.krs,expired.krs);assert.notEqual(recovered.lease_token,expired.lease_token)
   await assert.rejects(transaction(ingest,tx=>finishItem(tx,expired,[s],'expired')),/LEASE_LOST/)
   await markFailed(ingest,recovered,false,'KRS_UNAVAILABLE');await markFailed(ingest,results[1],true,'private payload must not leak')
   assert.equal(await replayFailed(ingest,'2026-10-20',result.revision,10),1)
   assert.equal((await owner.query("SELECT diagnostic FROM krs_registry.items WHERE state='UNCERTAIN'")).rows[0].diagnostic,'SOURCE_UNAVAILABLE')
  })
  await t.test('publication and checkpoint are atomic, crash/replay retains one accepted snapshot',async()=>{
   await transaction(ingest,tx=>enqueueBulletin(tx,'2026-10-19',bytes(['40000']),new Date(NOW).toISOString()))
   const item=await claim(ingest,['2026-10-19']),company=await snapshot({id:'0000040000'})
   await assert.rejects(transaction(ingest,async tx=>{await finishItem(tx,item,[company],'atomic');throw Error('audit failure before commit')}))
   assert.equal(await catalog.read(item.krs),null);assert.equal((await owner.query("SELECT state FROM krs_registry.checkpoints WHERE day='2026-10-19'")).rows[0].state,'PENDING')
   await transaction(ingest,tx=>finishItem(tx,item,[company],'atomic'))
   assert.equal((await owner.query("SELECT state FROM krs_registry.checkpoints WHERE day='2026-10-19'")).rows[0].state,'COMPLETE');assert.equal(await claim(ingest,['2026-10-19']),null)
   await transaction(ingest,tx=>enqueueBulletin(tx,'2026-10-19',bytes(['40000','40000']),new Date(NOW+1).toISOString()));assert.equal(await claim(ingest,['2026-10-19']),null)
   assert.equal((await owner.query("SELECT count(*)::int AS n FROM krs_registry.snapshots WHERE krs='0000040000'")).rows[0].n,1)
  })
  await t.test('late corrected bulletin creates retained revision and bounded missing-day backlog',async()=>{
   const old=(await owner.query("SELECT revision FROM krs_registry.checkpoints WHERE day='2026-10-19'")).rows[0].revision
   const next=await transaction(ingest,tx=>enqueueBulletin(tx,'2026-10-19',bytes(['40000','40001']),new Date(NOW+1).toISOString()));assert.notEqual(next.revision,old)
   assert.equal((await owner.query("SELECT count(DISTINCT revision)::int AS n FROM krs_registry.items WHERE day='2026-10-19'")).rows[0].n,2)
   const acquired=await claim(ingest,['2026-10-19']);assert.ok(acquired);assert.equal(acquired.revision,next.revision)
  })
  await t.test('two concurrent publications complete one checkpoint without lost completion',async()=>{
   await transaction(ingest,tx=>enqueueBulletin(tx,'2026-10-17',bytes(['60000','60001']),new Date(NOW).toISOString()))
   const items=await Promise.all([claim(ingest,['2026-10-17']),claim(ingest,['2026-10-17'])])
   await Promise.all(items.map(async item=>{const company=await snapshot({id:item.krs});await transaction(ingest,tx=>finishItem(tx,item,[company],'concurrent:'+item.krs))}))
   assert.equal((await owner.query("SELECT state FROM krs_registry.checkpoints WHERE day='2026-10-17'")).rows[0].state,'COMPLETE')
  })
  await t.test('approved same-list revisit detects corrected source and retains both snapshots',async()=>{
   await transaction(ingest,tx=>enqueueBulletin(tx,'2026-10-16',bytes(['70000']),new Date(NOW).toISOString()))
   const item=await claim(ingest,['2026-10-16']),original=await snapshot({id:item.krs,name:'Pierwotna nazwa'})
   await transaction(ingest,tx=>finishItem(tx,item,[original],'correction:first'))
   await transaction(ingest,tx=>enqueueBulletin(tx,'2026-10-16',bytes(['70000']),new Date(NOW+1000).toISOString(),'APPROVED_OVERLAP_FIXTURE_2'))
   const revisit=await claim(ingest,['2026-10-16']);assert.notEqual(revisit.revision,item.revision)
   const corrected=await normalizeExtract(bytes(extract({id:item.krs,name:'Skorygowana nazwa'})),{krs:item.krs,register:'P',extract:'CURRENT',retrievedAt:new Date(NOW+1000).toISOString()})
   await transaction(ingest,tx=>finishItem(tx,revisit,[corrected],'correction:second'))
   assert.equal((await catalog.read(item.krs)).officialName,'Skorygowana nazwa')
   assert.ok(await catalog.accepted(original.evidenceRef));assert.equal((await catalog.search({query:'Pierwotna'})).candidates[0].historicalNameMatch,true)
   await assert.rejects(transaction(ingest,tx=>storeSnapshot(tx,original,'correction:late-old')),/OUT_OF_ORDER/)
  })
  await t.test('FULL history cannot replace CURRENT pointer or current alias rank',async()=>{
   const f=await snapshot({full:true});await transaction(ingest,tx=>storeSnapshot(tx,f,'full-history'))
   assert.equal((await catalog.read(KRS)).source.extract,'CURRENT')
   assert.equal((await catalog.search({query:'Łódź Test'})).candidates[0].historicalNameMatch,false)
   assert.equal((await catalog.search({query:'DAWNA NAZWA'})).candidates[0].historicalNameMatch,true)
   assert.ok(await catalog.accepted(f.evidenceRef))
  })
  await t.test('finite synchronizer uses explicit offline Source and injected publication fixture; normal API never runs it',async()=>{
   let hits=0
   const source=fixtureSource(async({command})=>{hits++;const body=command.operation==='DAILY'?['50000']:command.register==='P'?extract({id:'0000050000'}):{};return {status:command.register==='S'?404:200,url:buildRequest(command).url,headers:{},bytes:bytes(body)}})
   const client=createKrsClient({source,externalEnabled:true,maximumCalls:10,now:()=>NOW})
   // Explicit offline transaction adapter, not an accepted live E1 receipt.
   const publication={publish:async(input,write)=>transaction(ingest,tx=>write(tx,'synthetic:'+input.intentKey))}
   const runner=createSynchronizer({pool:ingest,client,publication,enabled:true,now:()=>NOW})
   const result=await runner.run({approvalRef:'OFFLINE-SYNTHETIC',days:['2026-10-18'],maximumItems:1,maximumCalls:10,maximumMilliseconds:1000})
   assert.equal(result.completed,1);assert.equal(hits,3);assert.equal((await catalog.read('0000050000')).canonicalKrs,'0000050000')
  })
  await t.test('uncertain Source is durable and never automatically replayed',async()=>{
   let sourceCalls=0
   const client=createKrsClient({externalEnabled:true,now:()=>NOW,source:fixtureSource(async({command})=>{sourceCalls++;if(command.operation==='DAILY')return {status:200,url:buildRequest(command).url,headers:{},bytes:bytes(['80000'])};const e=Error('uncertain fixture');e.certainty='UNVERIFIED';throw e})})
   const publication={publish:async(input,write)=>transaction(ingest,tx=>write(tx,'synthetic:'+input.intentKey))}
   const runner=createSynchronizer({pool:ingest,client,publication,enabled:true,now:()=>NOW})
   const result=await runner.run({approvalRef:'OFFLINE_UNCERTAIN',days:['2026-10-15'],maximumItems:1,maximumCalls:10,maximumMilliseconds:1000});assert.equal(result.completed,0);assert.equal(sourceCalls,2)
   const row=(await owner.query("SELECT state,revision FROM krs_registry.items WHERE day='2026-10-15'")).rows[0];assert.equal(row.state,'UNCERTAIN');assert.equal(await replayFailed(ingest,'2026-10-15',row.revision,10),0);assert.equal(await claim(ingest,['2026-10-15']),null)
  })
  await t.test('100000 synthetic names, planner indexes and representative p95 with 4 concurrent readers',async()=>{
   // Migrator-seeded benchmark rows are synthetic search metadata, not verified identity evidence.
   await owner.query("INSERT INTO krs_registry.companies(krs,entity_key,official_name,state) SELECT lpad(i::text,10,'0'),'PL:KRS:'||lpad(i::text,10,'0'),'Firma '||md5(i::text)||' Engineering '||i,'UNKNOWN' FROM generate_series(100000,199999) i")
   await owner.query("INSERT INTO krs_registry.snapshots(evidence_ref,krs,register,extract,source_version,raw_digest,content_digest,retrieved_at,effect_ref,payload) SELECT 'synthetic:'||krs,krs,'P','CURRENT','synthetic-only',repeat('a',64),repeat('b',64),$1,'synthetic:'||krs,'{}'::jsonb FROM krs_registry.companies WHERE latest_ref IS NULL AND krs BETWEEN '0000100000' AND '0000199999'",[new Date(NOW).toISOString()])
   await owner.query("UPDATE krs_registry.companies SET latest_ref='synthetic:'||krs WHERE latest_ref IS NULL AND krs BETWEEN '0000100000' AND '0000199999'")
   await owner.query("INSERT INTO krs_registry.names SELECT krs,official_name,lower(official_name),false,latest_ref FROM krs_registry.companies WHERE krs BETWEEN '0000100000' AND '0000199999';ANALYZE krs_registry.names;ANALYZE krs_registry.companies;ANALYZE krs_registry.snapshots")
   const count=(await reader.query('SELECT count(*)::int AS n FROM krs_registry.names')).rows[0].n;assert.ok(count>=100000)
   const indexes=plan=>{const result=[];const walk=x=>{if(x&&typeof x==='object'){if(x['Index Name'])result.push(x['Index Name']);for(const value of Object.values(x))walk(value)}};walk(plan);return result}
   for(const [label,query,fragment]of [['prefix','firma abc',false],['fragment','engineering 12345',true]]){
    const parameters=[query,query,query+'%',fragment,'%'+query+'%',-1,'',21]
    const plan=(await reader.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+SEARCH_SQL,parameters)).rows[0]['QUERY PLAN'];proof.plans[label]=plan
    assert.ok(indexes(plan).some(i=>label==='prefix'?['names_prefix','names_fragment'].includes(i):i==='names_fragment'),JSON.stringify(plan))
   }
   const samples={},concurrency=4,queries=['firma abc','engineering 12345','firma']
   for(const query of queries){const times=[];for(let batch=0;batch<10;batch++)await Promise.all(Array.from({length:concurrency},async()=>{const start=performance.now();await catalog.search({query,limit:20});times.push(performance.now()-start)}));times.sort((a,b)=>a-b);samples[query]={samples:times.length,p50:times[Math.floor(times.length*.5)],p95:times[Math.ceil(times.length*.95)-1],maximum:times.at(-1)};assert.ok(samples[query].p95<3000)}
   proof.performance={nameRows:count,concurrency,samples,scope:'SYNTHETIC_LOCAL_ONLY',targetP95Ms:3000}
   const first=await catalog.search({query:'firma',limit:3}),second=await catalog.search({query:'firma',limit:3,cursor:first.nextCursor})
   assert.equal(first.candidates.length,3);assert.equal(second.candidates.length,3);assert.equal(new Set([...first.candidates,...second.candidates].map(c=>c.krs)).size,6)
   assert.deepEqual((await catalog.search({query:'firma',limit:3})).candidates,first.candidates)
   await owner.query('UPDATE krs_registry.metadata SET generation=generation+1');await assert.rejects(catalog.search({query:'firma',limit:3,cursor:first.nextCursor}),/CATALOG_CHANGED/)
  })
  await nativeReadTests(t,{owner,reader,catalog,url,Pool})
  await t.test('rollback discards isolated schema, migration reapplies cleanly',async()=>{await migrate(down);assert.equal((await owner.query("SELECT to_regnamespace('krs_registry') AS schema")).rows[0].schema,null);await migrate(up);assert.equal((await catalog.coverage()).observedCompanies,0);await migrate(down)})
  await nativePublicationTests(t,{owner,ingest,url,Pool})
  await fs.mkdir(new URL('../dist/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../dist/postgres-evidence.json',import.meta.url),JSON.stringify(proof,null,2)+'\n')
 }finally{await reader?.end();await ingest?.end();await owner.query('DROP SCHEMA IF EXISTS krs_registry CASCADE');await owner.query('DROP OWNED BY krs_reader,krs_ingest,krs_migrator;DROP ROLE krs_reader,krs_ingest,krs_migrator');await owner.end()}
})
