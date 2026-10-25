import test from 'node:test'
import assert from 'node:assert/strict'
import {buildRequest,parseCommand,createKrsClient,bulletinIds} from '../dist/client.js'
import {normalizeExtract,normalizeSearch,addressVersion,nameTokens} from '../dist/normalizer.js'
import {createAdmittedKrsSource,unavailablePublication} from '../dist/e1.js'
import {loadConfig,isolatedDatabaseUrl} from '../dist/config.js'
import {validatePlan,warsawDay,createSynchronizer} from '../dist/sync.js'
import {bytes,extract,snapshot,fixtureSource,NOW,KRS} from './fixtures.mjs'
test('four official operations, closed parameters and fixed credential-free origin',()=>{
 for(const command of [{operation:'CURRENT',krs:KRS,register:'P'},{operation:'FULL',krs:KRS,register:'S'},{operation:'DAILY',day:'2026-10-21'},{operation:'HOURLY',day:'2026-10-21',from:0,to:23}]){const req=buildRequest(command);assert.equal(new URL(req.url).origin,'https://api-krs.ms.gov.pl');assert.equal(req.method,'GET');assert.equal(req.body,null)}
 for(const command of [{operation:'CURRENT',krs:'1',register:'P'},{operation:'CURRENT',krs:KRS,register:'P',url:'https://evil.invalid'},{operation:'DAILY',day:'2026-02-30'},{operation:'DAILY',day:'2021-12-08'},{operation:'HOURLY',day:'2026-10-21',from:23,to:24},{operation:'HOURLY',day:'2026-10-21',from:3,to:3}])assert.throws(()=>parseCommand(command))
})
test('current and actual observed full-array families normalize separately',async()=>{
 const c=await snapshot(),f=await snapshot({full:true});assert.equal(f.nip,c.nip);assert.equal(f.officialName,c.officialName);assert.deepEqual(f.address,c.address);assert.equal(f.names.length,2);assert.equal(f.identifiers.length,3);assert.notEqual(c.source.sourceVersion,f.source.sourceVersion)
 assert.equal(f.identifiers.find(i=>i.removedEntry!==null).introducedEntry,1)
 await assert.rejects(normalizeExtract(bytes(extract()),{krs:KRS,register:'P',extract:'FULL',retrievedAt:new Date(NOW).toISOString()}),/IDENTIFIER_CONFLICT/)
 const raw=extract();raw.odpis.naglowekA.rejestr='RejS';await assert.rejects(normalizeExtract(bytes(raw),{krs:KRS,register:'P',extract:'CURRENT',retrievedAt:new Date(NOW).toISOString()}))
})
test('explicit legal-field object wrappers and full retained history',async()=>{
 const raw=extract();const c=raw.odpis.dane.dzial1.danePodmiotu;c.nazwa={nazwa:c.nazwa};c.formaPrawna={formaPrawna:c.formaPrawna}
 const s=await normalizeExtract(bytes(raw),{krs:KRS,register:'P',extract:'CURRENT',retrievedAt:new Date(NOW).toISOString()});assert.equal(s.legalForm,'SPÓŁKA AKCYJNA');assert.equal(s.officialName,'Łódź Test SPÓŁKA AKCYJNA')
 const full=await snapshot({full:true});assert.equal(full.history.entries.length,2);assert.equal(full.history.addresses.length,1);assert.equal(full.history.legalForms.length,1)
})
for(const form of ['SPÓŁKA AKCYJNA','SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ','SPÓŁKA JAWNA','SPÓŁKA KOMANDYTOWA','SPÓŁKA KOMANDYTOWO-AKCYJNA','SPÓŁKA PARTNERSKA','SPÓŁDZIELNIA','FUNDACJA','STOWARZYSZENIE','ZWIĄZEK ZAWODOWY','IZBA GOSPODARCZA','PRZEDSIĘBIORSTWO PAŃSTWOWE'])test('legal form fixture: '+form,async()=>{assert.equal((await snapshot({form})).legalForm,form)})
test('partial, unknown and explicit removal states never guess absent fields',async()=>{
 const s=await snapshot({status:3,nip:null,regon:null,form:'NOWA NIEZNANA FORMA'});assert.equal(s.state,'UNKNOWN');assert.ok(s.missingFields.includes('nip'));assert.ok(s.warnings.includes('UNSUPPORTED_LEGAL_FORM'))
 const raw=extract({status:9});raw.odpis.dane.dzial6.informacjaOWykresleniu={czyWykreslony:true,dataWykresleniaZRejestru:'21.10.2026'}
 assert.equal((await normalizeExtract(bytes(raw),{krs:KRS,register:'P',extract:'CURRENT',retrievedAt:new Date(NOW).toISOString()})).state,'REMOVED')
 raw.odpis.dane.dzial6.informacjaOWykresleniu.dataWykresleniaZRejestru='31.02.2026';assert.equal((await normalizeExtract(bytes(raw),{krs:KRS,register:'P',extract:'CURRENT',retrievedAt:new Date(NOW).toISOString()})).state,'UNKNOWN')
})
test('volatile generation/retrieval leaves business, source and address versions unchanged',async()=>{
 const raw=extract(),one=await snapshot();raw.odpis.naglowekA.dataCzasOdpisu='different clock'
 const two=await normalizeExtract(bytes(raw),{krs:KRS,register:'P',extract:'CURRENT',retrievedAt:new Date(NOW+1000).toISOString()})
 for(const field of ['contentDigest','sourceVersion'])assert.equal(one.source[field],two.source[field]);assert.equal(one.addressVersion,two.addressVersion);assert.notEqual(one.source.rawDigest,two.source.rawDigest)
 assert.equal(await addressVersion({...one.address,city:'łódź',street:' DŁUGA  '}),one.addressVersion)
 raw.odpis.dane.dzial1.danePodmiotu.nazwa='Correction';const three=await normalizeExtract(bytes(raw),{krs:KRS,register:'P',extract:'CURRENT',retrievedAt:new Date(NOW).toISOString()});assert.notEqual(one.source.contentDigest,three.source.contentDigest)
})
test('name normalization handles Ł/Unicode, original wildcard literals and legal tokens',()=>{
 assert.equal(normalizeSearch('ŁÓDŹ'),'lodz');assert.equal(normalizeSearch('Ło\u0301dz\u0301'),'lodz')
 assert.ok(nameTokens('Alfa sp. z o.o.').includes('alfa spolka z ograniczona odpowiedzialnoscia'));assert.equal(normalizeSearch("O'BRIEN %_\\"),"o'brien %_\\")
})
test('provider failures never fall back or repeat uncertain effects',async t=>{
 for(const status of [400,404,429,500,503])await t.test('HTTP '+status,async()=>{let hits=0;const command={operation:'CURRENT',krs:KRS,register:'P'},client=createKrsClient({externalEnabled:true,now:()=>NOW,source:fixtureSource(async()=>{hits++;return {status,url:buildRequest(command).url,headers:{'retry-after':'60'},bytes:bytes('{}')}})});await assert.rejects(client.get(command,'intent'),e=>e.code==='KRS_HTTP_'+status&&e.certainty==='RESPONSE');assert.equal(hits,1)})
 for(const [name,body,url]of [['JSON','{',null],['oversize','x'.repeat(4097),null],['redirect','{}','https://evil.invalid/']])await t.test(name,async()=>{const command={operation:'CURRENT',krs:KRS,register:'P'},client=createKrsClient({externalEnabled:true,maximumBytes:4096,source:fixtureSource(async()=>({status:200,url:url??buildRequest(command).url,headers:{},bytes:bytes(body)}))});await assert.rejects(client.get(command,'intent'))})
 const client=createKrsClient({externalEnabled:true,timeoutMs:1,source:fixtureSource(async()=>{await new Promise(r=>setTimeout(r,5));return {status:200,url:buildRequest({operation:'DAILY',day:'2026-10-21'}).url,headers:{},bytes:bytes('[]')}})});await assert.rejects(client.get({operation:'DAILY',day:'2026-10-21'},'intent'),e=>e.code==='SOURCE_TIMEOUT'&&e.certainty==='UNVERIFIED')
})
test('disabled defaults and unconfigured E1 deny before network or SQL',async()=>{
 let calls=0;const client=createKrsClient({source:fixtureSource(()=>{calls++;throw Error()})});await assert.rejects(client.get({operation:'DAILY',day:'2026-10-21'},'i'),/SOURCE_ADMISSION_UNAVAILABLE/);assert.equal(calls,0)
 assert.deepEqual(loadConfig({}),{port:3501,externalEnabled:false,syncEnabled:false,consumerEnabled:false,scheduled:false,environment:'development',binding:'UNCONFIGURED'})
 for(const env of [{KRS_EXTERNAL_ENABLED:'true'},{KRS_SYNC_ENABLED:'true'},{KRS_CONSUMER_ENABLED:'true'},{KRS_DATABASE_URL:'postgres://cloud.invalid/db'}])assert.throws(()=>loadConfig(env))
 await assert.rejects(unavailablePublication().publish({},()=>{calls++}));await assert.rejects(createSynchronizer({pool:{},client,publication:unavailablePublication()}).run({}));assert.equal(calls,0)
 await assert.rejects(createAdmittedKrsSource({binding:{origin:'http://127.0.0.1',transport:'LOCAL_SYNTHETIC_HTTP'}}),/SOURCE_BINDING_DENIED/)
 for(const transportProfile of [null,'ALL','',[],{}])await assert.rejects(createAdmittedKrsSource({transportProfile,binding:{origin:'https://api-krs.ms.gov.pl',transport:'HTTPS'}}),/SOURCE_BINDING_DENIED/)
})
test('timeout retains in-flight lock until the existing Source settles; circuit is bounded',async()=>{
 let settle,hits=0
 const command={operation:'DAILY',day:'2026-10-21'},source=fixtureSource(()=>{hits++;return new Promise(resolve=>{settle=resolve})}),client=createKrsClient({source,externalEnabled:true,timeoutMs:5})
 const keepAlive=setTimeout(()=>{},100)
 await assert.rejects(client.get(command,'one'),e=>e.code==='SOURCE_TIMEOUT')
 await assert.rejects(client.get(command,'two'),e=>e.code==='SOURCE_BUDGET_OR_CIRCUIT_DENIED');assert.equal(hits,1)
 settle({status:200,url:buildRequest(command).url,headers:{},bytes:bytes([])});clearTimeout(keepAlive)
 let time=NOW
 const failures=createKrsClient({externalEnabled:true,now:()=>time,source:fixtureSource(async()=>{throw Error('not sent')})})
 for(let n=0;n<3;n++)await assert.rejects(failures.get(command,'attempt'+n))
 assert.equal(failures.diagnostics().circuitOpen,true);await assert.rejects(failures.get(command,'blocked'),e=>e.code==='SOURCE_BUDGET_OR_CIRCUIT_DENIED');time+=60001;assert.equal(failures.diagnostics().circuitOpen,false)
})
test('bulletin padding, dedup, literal empty, Warsaw cutoff/DST, finite plan only',()=>{
 assert.deepEqual(bulletinIds(bytes(['28860',KRS,'30897','28860'])),[KRS,'0000030897']);assert.deepEqual(bulletinIds(bytes([])),[])
 for(const v of [['0'],[0],['../1'],['10000000000'],{}])assert.throws(()=>bulletinIds(bytes(v)))
 assert.equal(warsawDay(Date.parse('2026-03-29T22:30:00.000Z')),'2026-03-30');assert.equal(warsawDay(Date.parse('2026-10-25T23:30:00.000Z')),'2026-10-26')
 const plan={approvalRef:'synthetic-only',days:['2026-10-21'],maximumCalls:20,maximumItems:10,maximumMilliseconds:1000};validatePlan(plan,NOW)
 for(const copy of [{...plan,days:['2026-10-22']},{...plan,days:['2026-10-21','2026-10-21']},{...plan,range:'all'},{...plan,maximumCalls:Infinity}])assert.throws(()=>validatePlan(copy,NOW))
 assert.throws(()=>isolatedDatabaseUrl('postgres://krs_reader@ep-x.neon.tech/krs_registry_test','krs_reader'));assert.throws(()=>isolatedDatabaseUrl('postgres://krs_reader@localhost/architecture_pmos','krs_reader'))
})

test('logical retry keys cross native Source as stable opaque 256-bit intents',async()=>{
 const seen=[],command={operation:'DAILY',day:'2026-10-21'};
 const client=createKrsClient({externalEnabled:true,source:fixtureSource(async input=>{seen.push(input.intentKey);assert.match(input.intentKey,/^[a-f0-9]{64}$/);return {status:200,url:buildRequest(command).url,headers:{},bytes:bytes([])}})});
 await client.get(command,'logical-retry-key');await client.get(command,'logical-retry-key');await client.get(command,'changed-logical-key');
 assert.equal(seen[0],seen[1]);assert.notEqual(seen[0],seen[2]);
})

test('explicit unmetered on-demand KRS client keeps Source admission beyond twenty calls',async()=>{
 let hits=0;const command={operation:'DAILY',day:'2026-10-21'}
 const client=createKrsClient({externalEnabled:true,maximumCalls:null,source:fixtureSource(async()=>{hits++;return {status:200,url:buildRequest(command).url,headers:{},bytes:bytes([])}})})
 for(let i=0;i<25;i++)await client.get(command,'unique-unmetered-'+i)
 assert.equal(hits,25);assert.deepEqual(client.diagnostics(),{attempts:25,remaining:null,circuitOpen:false})
})
