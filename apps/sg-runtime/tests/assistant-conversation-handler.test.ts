import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {buildSync} from 'esbuild'
// In-memory protocol isolation only. Native E1, SQL and paid-provider acceptance
// are separate checks. Telemetry is the sole substituted module in this bundle.
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(path.join(app,'package.json'))
const compiled=buildSync({entryPoints:[path.join(app,'lib/assistant/conversation.ts')],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',alias:{'@':app},external:['@/lib/platform/private-runtime']})
const compiledModule={exports:{}} as {exports:any}
new Function('require','module','exports',compiled.outputFiles[0].text)((id:string)=>id==='@sentry/nextjs'?{
 startSpan:(_options:unknown,run:()=>unknown)=>run(),withScope:(run:(s:any)=>void)=>run({setTag(){}}),captureException(){}
}:require(id),compiledModule,compiledModule.exports)
const {createAssistantHandlers}=compiledModule.exports
const user=randomUUID(),org=randomUUID(),foreign=randomUUID(),id=randomUUID()
const reference={version:'1.1.0',source:'BENCHMARK_CHART',seriesId:'synthetic',from:'2026-01-01',to:'2026-02-01',range:'1Y',fingerprint:'a'.repeat(64)}
const unavailable=(code:string)=>Object.assign(Error('Synthetic refusal'),{code})
function fixture(){
 const calls:any[]=[],inputs:any[]=[],events:any[]=[],stored:any={id,revision:8,turns:[]}
 let revoked=false,changed=false,generated=0,replay=false
 const runtime:any={organisationId:org,
  run:async(_request:Request,operation:string,payload:any,action:(context:any)=>unknown)=>{
   calls.push({operation,payload});if(revoked)throw unavailable('DENIED')
   return action({actorId:user,assistantReservation:{status:'RESERVED'}})
  },
  history:{list:async()=>[],load:async()=>stored,begin:async(_c:any,payload:any)=>{calls.push({begin:payload});return{conversationId:id,turnId:randomUUID(),status:replay?'REPLAY':'NEW'}},
   check:async()=>{events.push('check')},complete:async(_c:any,payload:any)=>{events.push({complete:payload})},interrupt:async()=>{events.push('interrupt')},delete:async()=>{events.push('delete')}},
  gateway:{resolve:async(demand:any)=>{events.push({plan:demand.plan});return{contexts:demand.plan.length?[{source:'BENCHMARK_CHART',status:changed?'STALE':'OK',sourceVersion:reference.fingerprint,selection:reference,id:'synthetic-source',label:'Synthetic',asOf:'2026-02-01',data:{unit:'EUR',points:[[1,2]]}}]:[]}}},
  usage:{release:async()=>{events.push('release')}},
  model:{validateInput:async(input:any)=>{inputs.push(input)},generate:async(options:any)=>{generated++;await options.beforeDispatch();await options.publish('Synthetic answer');return 'Synthetic answer'}}}
 const handlers=createAssistantHandlers(async()=>runtime)
 const request=(body:Record<string,unknown>={})=>new Request('https://example.test/api/assistant/conversation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:null,commandId:randomUUID(),message:'Co pokazuje ten wykres?',locale:'pl',module:'benchmark_finder',reference,...body})})
 const execute=async(body:Record<string,unknown>={})=>{const response=await handlers.conversation(request(body));const text=await response.text();return{response,events:text.trim().split('\n').filter(Boolean).map(v=>JSON.parse(v))}}
 return{runtime,handlers,stored,calls,inputs,events,request,execute,revoked:()=>{revoked=true},changed:()=>{changed=true},replay:()=>{replay=true},generated:()=>generated}
}
test('isolated BFF makes CIC demand, then authorises, persists and completes one stream',async()=>{
 const f=fixture(),r=await f.execute()
 assert.equal(r.response.status,200);assert.equal(r.response.headers.get('cache-control'),'private, no-store')
 assert.deepEqual(r.events.map((v:any)=>v.type),['started','delta','completed']);assert.equal(f.generated(),1)
 assert.equal(f.calls[0].payload.kind,'AUTHORIZE');assert.equal(f.calls.filter(c=>c.payload?.kind==='GENERATE').length,1)
 assert(f.events.some(e=>e.complete?.response==='Synthetic answer'));assert(f.events.filter(e=>e==='check').length>=3)
 assert(f.inputs[0][0].role==='developer');assert(f.events.some(e=>e.plan?.[0]?.source==='BENCHMARK_CHART'))
})
test('history reuse requires current organisation and exact canonical reference; general turns remain usable',async()=>{
 const f=fixture(),saved=(message:string,scopes:any[])=>({status:'COMPLETE',message,response:message+' answer',scopes})
 const jsonbReference=Object.fromEntries(Object.entries(reference).sort(([a],[b])=>a.localeCompare(b)))
 f.stored.turns=[saved('GENERAL',[]),saved('CURRENT',[{organisationId:org,reference:jsonbReference}]),saved('FOREIGN_SECRET',[{organisationId:foreign,reference}]),saved('STALE_SECRET',[{organisationId:org,reference:{...reference,fingerprint:'b'.repeat(64)}}])]
 await f.execute({conversationId:id})
 const prompt=JSON.stringify(f.inputs[0]);assert(prompt.includes('GENERAL'));assert(prompt.includes('CURRENT'))
 assert(!prompt.includes('FOREIGN_SECRET'));assert(!prompt.includes('STALE_SECRET'))
 assert.equal(f.calls.find(c=>c.begin).begin.expectedRevision,8)
})
test('history display redacts foreign and revoked context without sending foreign data to a producer',async()=>{
 const f=fixture();f.stored.turns=[{commandId:randomUUID(),assistantMessageId:randomUUID(),status:'COMPLETE',message:'FOREIGN_SECRET',response:'FOREIGN_ANSWER',sources:[],scopes:[{organisationId:foreign,reference}]}]
 const response=await f.handlers.load(new Request('https://example.test'),id),body=await response.text()
 assert.equal(response.status,200);assert(!body.includes('FOREIGN_SECRET'));assert(!body.includes('FOREIGN_ANSWER'))
 assert.equal(f.events.filter(e=>e.plan).length,0);assert.equal(f.calls.at(-1).payload.action,'PUBLISH')
})
test('in-flight source change or revocation withholds completion and does not retry generation',async()=>{
 for(const kind of ['context','access']){
  const f=fixture();f.runtime.model.generate=async(options:any)=>{await options.beforeDispatch();kind==='context'?f.changed():f.revoked();await options.publish('MUST_NOT_PUBLISH');return 'MUST_NOT_PERSIST'}
  const r=await f.execute();assert.equal(r.events.some((e:any)=>e.type==='delta'||e.type==='completed'),false)
  assert.equal(r.events.at(-1).code,kind==='context'?'CONTEXT_CHANGED':'DENIED');assert(!f.events.some(e=>e.complete))
 }
})
test('malformed authority fields and replay commands cannot create a provider stream',async()=>{
 const f=fixture(),invalid=await f.execute({actorId:foreign});assert.equal(invalid.response.status,400);assert.equal(f.calls.length,0)
 f.replay();const replay=await f.execute();assert.equal(replay.response.status,409);assert.equal(f.generated(),0)
 assert.equal(f.calls.some(c=>c.payload?.kind==='GENERATE'),false)
})
test('history identifies conversations by a bounded first question without invoking the model',async()=>{
 const f=fixture(),stamp='2026-11-10T12:34:56.789Z'
 f.runtime.history.list=async()=>[{id,title:'Rozmowa 2026-11-10',updatedAt:stamp}]
 f.runtime.history.load=async(_context:any,loadedId:string,previewOnly:boolean)=>{
  assert.equal(loadedId,id);assert.equal(previewOnly,true)
  return{id,revision:2,turns:[{commandId:randomUUID(),assistantMessageId:randomUUID(),status:'COMPLETE',message:'  SYNTHETIC pytanie\n o zakupach '+ '🙂'.repeat(180),response:'',sources:[],scopes:[]}]}
 }
 const response=await f.handlers.history(new Request('https://example.test')),body=await response.json()
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store')
 assert.match(body.items[0].title,/^SYNTHETIC pytanie o zakupach /);assert(body.items[0].title.endsWith('…'))
 assert(body.items[0].title.length<=161);assert.doesNotMatch(body.items[0].title,/\p{Surrogate}/u);assert.equal(body.items[0].updatedAt,stamp)
 assert.equal(f.generated(),0);assert.equal(f.calls.at(-1).payload.action,'PUBLISH')
})
test('history question previews retain current context redaction and final identity revocation',async()=>{
 const f=fixture(),title='Rozmowa 2026-11-10'
 f.runtime.history.list=async()=>[{id,title,updatedAt:'2026-11-10T12:34:56Z'}]
 f.stored.turns=[{commandId:randomUUID(),assistantMessageId:randomUUID(),status:'COMPLETE',message:'FOREIGN_PREVIEW_SECRET',response:'',sources:[],scopes:[{organisationId:foreign,reference}]}]
 let response=await f.handlers.history(new Request('https://example.test')),body=await response.text()
 assert.equal(response.status,200);assert(!body.includes('FOREIGN_PREVIEW_SECRET'));assert(body.includes(title))
 assert.equal(f.events.filter(e=>e.plan).length,0)
 f.runtime.history.load=async()=>{f.revoked();return f.stored}
 response=await f.handlers.history(new Request('https://example.test'));body=await response.text()
 assert.equal(response.status,403);assert(!body.includes('FOREIGN_PREVIEW_SECRET'));assert(!body.includes(title))
 assert.equal(f.generated(),0)
})
