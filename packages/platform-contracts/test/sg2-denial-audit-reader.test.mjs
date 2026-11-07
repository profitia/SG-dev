import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {CASES,createFiveCaseReader} from '../src/sg2-denial-audit-reader.mjs'

function fixture({count=1,change=v=>v,failStore,failBegin=false,failComplete=false,expiry=1800000}={}) {
 let clock=Date.parse('2026-11-03T08:00:00Z'),reads=0,completed,failed=false
 const query=store=>async(sql,params)=>{
  reads++;assert.equal(sql,`SELECT profitia_sg2_d1_${store}.read_case($1::text) AS result`);assert.equal(params.length,1)
  if(store===failStore)throw Error('private business payload must never escape')
  const c=CASES.find(c=>c.caseId===params[0]);assert(c)
  const row={caseId:c.caseId,store,recorded_at:c.start.replace('Z','.000000Z'),application_id:store==='private'?'spendguru':'spendguru-benchmark-source',deploymentId:c.deploymentId,operation:store==='private'?'benchmark.discovery.request':'knowledge.ingest',phase:'DECISION',decision:'DENY',reasonCode:'POLICY_UNAVAILABLE',event_count:1,firstCheckpoint:'NOT_RECORDED',correlationEvidence:'WINDOW_ONLY'}
  return {rows:[{result:change({caseId:c.caseId,store,rows:Array.from({length:count},()=>({...row})),invocationRef:randomUUID()})}]}
 }
 const audit={begin:async()=>{if(failBegin)throw Error('secret');return{durable:true,authorizationRef:randomUUID(),expiresAt:new Date(clock+expiry).toISOString()}},complete:async v=>{completed=v;return{durable:!failComplete,outputSha256:v.outputSha256}},failure:async()=>{failed=true}}
 const config={environment:'development',privateQuery:query('private'),sourceQuery:query('source'),audit,now:()=>clock}
 return{config,reader:()=>createFiveCaseReader(config),reads:()=>reads,completed:()=>completed,failed:()=>failed,tick:ms=>{clock+=ms}}
}
test('D1 all five cases, both stores, half-open fixed windows, minimal output and durable completion hash',async()=>{
 const f=fixture();const out=await f.reader().read();assert.equal(out.rows.length,10);assert.deepEqual(out.results.map(v=>v.caseId),['H1','H2','H3','H4','C1']);assert(out.results.every(v=>v.status==='WINDOW_ONLY'));assert.equal(f.reads(),10);assert.equal(f.completed().invocations.length,10);assert.match(f.completed().outputSha256,/^[a-f0-9]{64}$/)
 for(const c of CASES)assert.equal(Date.parse(c.end)-Date.parse(c.start),12000)
})
test('D1 exactly100 aggregate rows accepted;101+ across databases/cases rejected before release',async()=>{
 assert.equal((await fixture({count:10}).reader().read()).rows.length,100)
 const f=fixture({count:11});await assert.rejects(f.reader().read(),/D1_OVERFLOW/);assert.equal(f.completed(),undefined);assert(f.failed())
})
test('D1 empty history means NOT_RECORDED, never cause/checkpoint reconstructed',async()=>{
 const out=await fixture({count:0}).reader().read();assert(out.results.every(v=>v.status==='NOT_RECORDED'));assert.equal(out.rows.length,0)
})
test('D1 rejects unknown case and arbitrary filters/input; no SQL performed',async()=>{
 for(const arg of ['H5',{caseId:'H1',start:'2000-01-01'},undefined]){const f=fixture();await assert.rejects(f.reader().read(arg),/D1_INPUT_REJECTED/);assert.equal(f.reads(),0)}
})
test('D1 other environment/configuration rejected',()=>{const f=fixture();assert.throws(()=>createFiveCaseReader({...f.config,environment:'production'}),/D1_CONFIGURATION_REJECTED/);assert.throws(()=>createFiveCaseReader({...f.config,query:'SELECT *'}),/D1_CONFIGURATION_REJECTED/)})
test('D1 expiry and missing durable audit intent prevent all protected SQL',async()=>{
 for(const option of [{expiry:0},{expiry:1800001},{failBegin:true}]){const f=fixture(option);await assert.rejects(f.reader().read());assert.equal(f.reads(),0)}
})
test('D1 losing one database or completion ACK withholds all output and sanitizes errors',async()=>{
 for(const option of [{failStore:'private'},{failStore:'source'},{failComplete:true}]){const f=fixture(option);await assert.rejects(f.reader().read(),e=>e.message==='D1_READ_UNAVAILABLE');assert(f.failed())}
})
test('D1 any raw JSON, PII, extra field, bad scope, forged checkpoint or reason rejects entire projection',async()=>{
 const changes=[v=>({...v,event:{}}),v=>({...v,rows:[{...v.rows[0],actorId:'synthetic-person'}]}),v=>({...v,rows:[{...v.rows[0],reasonCode:'UNRECOGNIZED_PAYLOAD'}]}),v=>({...v,rows:[{...v.rows[0],deploymentId:'other'}]}),v=>({...v,rows:[{...v.rows[0],recorded_at:CASES[0].end.replace('Z','.000000Z')}]}),v=>({...v,rows:[{...v.rows[0],firstCheckpoint:'INFERRED'}]})]
 for(const change of changes){const f=fixture({change});await assert.rejects(f.reader().read(),/D1_READ_UNAVAILABLE/);assert.equal(f.completed(),undefined)}
})
test('D1 null unknown reason is retained as unavailable without echoing raw value',async()=>{const out=await fixture({change:v=>({...v,rows:v.rows.map(r=>({...r,reasonCode:null}))})}).reader().read();assert(out.rows.every(r=>r.reasonCode===null))})
