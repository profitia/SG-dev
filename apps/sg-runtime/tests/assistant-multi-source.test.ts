import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {buildSync} from 'esbuild'
import {selectConversationContext,contextHistoryScopes,contextSatisfiesScope} from '../lib/assistant/context-selection'
const app=path.resolve(fileURLToPath(new URL('..',import.meta.url))),require=createRequire(path.join(app,'package.json'))
const compiled=buildSync({entryPoints:[path.join(app,'lib/assistant/conversation.ts')],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',alias:{'@':app},external:['@/lib/platform/private-runtime']})
const mod={exports:{}} as {exports:any}
new Function('require','module','exports',compiled.outputFiles[0].text)((id:string)=>id==='@sentry/nextjs'?{startSpan:(_o:unknown,run:()=>unknown)=>run(),withScope:(run:any)=>run({setTag(){}}),captureException(){}}:require(id),mod,mod.exports)
const {createAssistantHandlers}=mod.exports
const org=randomUUID(),owner=randomUUID(),conversationId=randomUUID(),observationId=randomUUID(),publicationId=randomUUID()
const chart={version:'1.1.0' as const,source:'BENCHMARK_CHART' as const,seriesId:'synthetic-oil',from:'2026-01-01',to:'2026-11-01',range:'1Y' as const,fingerprint:'a'.repeat(64)}
const supplier={version:'2.0.0' as const,source:'SRM_XRAY' as const,nip:'8650004194',entityType:'COMPANY' as const,krs:null,year:2025,comparisonYear:2024,statementScope:'standalone' as const,sourceVersion:null}
function fixture(){
 let revokeKys=false,removePublication=false,denyNews=false,changeOnAdmission=false,providerPosts=0
 const plans:any[]=[],prompts:any[]=[],stored:any={id:conversationId,revision:0,turns:[]}
 let begun:any
 const runtime:any={organisationId:org,
  async run(_request:Request,operation:string,payload:any,action:any){if(payload.kind==='GENERATE'&&changeOnAdmission)revokeKys=true
   return action({actorId:owner,assistantReservation:{status:'RESERVED'}})},
  history:{list:async()=>[],load:async()=>stored,begin:async(_c:any,input:any)=>{begun=structuredClone(input);return {conversationId,turnId:randomUUID(),status:'NEW'}},
   check:async()=>null,complete:async(_c:any,value:any)=>{stored.turns.push({id:randomUUID(),commandId:begun.commandId,assistantMessageId:randomUUID(),message:begun.message,response:value.response,
    status:'COMPLETE',scopes:begun.scopes,sources:value.sources,createdAt:new Date().toISOString()});stored.revision++},interrupt:async()=>null,delete:async()=>null},
  gateway:{async resolve(demand:any){
   plans.push(demand.plan.map((p:any)=>p.source))
   const refs=demand.reference?.source==='CONTEXT_SELECTION'?demand.reference.references:demand.reference?[demand.reference]:[]
   return {contexts:demand.plan.map((p:any)=>{
    const reference=refs.find((r:any)=>r.source===p.source)
    if(p.source==='NEWSFEED'&&denyNews)return {source:p.source,status:'DENIED'}
    if(!reference)return {source:p.source,status:'EMPTY'}
    const data=p.source==='SRM_XRAY'?{identity:{nip:reference.nip},financial:{year:2025,amount:'123.456',unit:'PLN'},kys:{status:revokeKys?'DENIED':'OK',riskLevel:revokeKys?null:'SYNTHETIC_PRIVATE_RISK',retentionUntil:'2030-01-01T00:00:00.000Z'}}
     :p.source==='NEWSFEED'?{observations:[{id:observationId,name:'SYNTHETIC_PRIVATE_OBSERVATION',publications:removePublication?[]:[{id:publicationId,headline:'SYNTHETIC_PRIVATE_HEADLINE'}]}]}
      :p.source==='FORECAST_CORE'?{models:reference.modelIds.map((modelId:string)=>({modelId,horizon:'1M',unit:'USD/barrel',value:70}))}
       :{unit:'USD/barrel',historical:[{date:'2026-11-01',value:65}]}
    return {source:p.source,status:p.source==='SRM_XRAY'&&revokeKys?'PARTIAL':'OK',sourceVersion:p.source==='BENCHMARK_CHART'?chart.fingerprint:createHash('sha256').update(JSON.stringify(data)).digest('hex'),
     selection:reference,id:p.source,label:p.source,asOf:'2026-11-01',data}
   })}
  }},
  usage:{release:async()=>null},
  model:{validateInput:async(input:any)=>{prompts.push(input)},generate:async(input:any)=>{await input.beforeDispatch();providerPosts++;await input.publish('SYNTHETIC_ANSWER_PRIVATE');return 'SYNTHETIC_ANSWER_PRIVATE'}},
 }
 const handlers=createAssistantHandlers(async()=>runtime)
 const send=async(message='Przeanalizuj finanse dostawcy NIP: 8650004194, wiadomości Newsfeed, benchmark i prognozy ARIMA oraz ETS',reference:any=chart,module='benchmark_finder')=>{
  const response=await handlers.conversation(new Request('https://example.test/api/assistant/conversation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
   conversationId:stored.turns.length?conversationId:null,commandId:randomUUID(),message,locale:'pl',module,reference})}))
  const text=await response.text();return {response,text}
 }
 return {runtime,stored,plans,prompts,send,handlers,get begun(){return begun},get providerPosts(){return providerPosts},
  revokeKys(){revokeKys=true},removePublication(){removePublication=true},denyNews(){denyNews=true},changeOnAdmission(){changeOnAdmission=true}}
}
test('PI retrieves only an explicitly selected observation through the existing gateway and clears implicit archive access',async()=>{
 const reference={version:'2.0.0' as const,source:'NEWSFEED' as const,observationId,supplierNip:null}
 const selection=selectConversationContext({message:'Wyjaśnij wybraną obserwację',locale:'pl',module:'procurement_insights',reference},null,org)
 assert.deepEqual(selection.policy.contextPlan,[{source:'NEWSFEED',selection:'ACTIVE_VIEW'}]);assert.deepEqual(selection.references,[reference])
 const empty=selectConversationContext({message:'Sprawdź wiadomości z całego archiwum',locale:'pl',module:'procurement_insights',reference:null},null,org);assert.deepEqual(empty.policy.contextPlan,[]);assert.equal(empty.reference,null)
 const f=fixture(),r=await f.send('Wyjaśnij wybraną obserwację',reference,'procurement_insights');assert.equal(r.response.status,200);assert.deepEqual(f.plans[0],['NEWSFEED']);assert(f.begun.scopes[0].requiredRecordIds.includes('O:'+observationId))
 f.denyNews();const history=await f.handlers.load(new Request('https://example.test/api/assistant/history/'+conversationId),conversationId);assert(!JSON.stringify(await history.json()).includes('SYNTHETIC_ANSWER_PRIVATE'))
})
test('M2 BFF requests four producers and preserves their scoped continuity for a follow-up without reselection',async()=>{
 const f=fixture(),first=await f.send()
 assert.equal(first.response.status,200);assert(first.text.includes('"type":"completed"'))
 assert.deepEqual(new Set(f.plans[0]),new Set(['SRM_XRAY','NEWSFEED','BENCHMARK_CHART','FORECAST_CORE']))
 assert.equal(f.begun.scopes.length,4);assert(f.begun.scopes.find((s:any)=>s.source==='SRM_XRAY').privateKys)
 assert(f.begun.scopes.find((s:any)=>s.source==='NEWSFEED').requiredRecordIds.includes('P:'+publicationId))
 const second=await f.send('Co to oznacza dla negocjacji?')
 assert(second.text.includes('"type":"completed"'));assert.equal(f.providerPosts,2)
 assert.equal(f.plans.at(-1).length,4)
 assert(f.prompts[1].some((m:any)=>m.role==='assistant'&&m.content==='SYNTHETIC_ANSWER_PRIVATE'))
 assert(JSON.stringify(f.prompts[1]).includes('USD/barrel'))
})
test('KYS revocation redacts the whole historical turn even when public SRM financials remain readable',async()=>{
 const f=fixture();await f.send();f.revokeKys()
 const response=await f.handlers.load(new Request('https://example.test'),conversationId),text=await response.text()
 assert.equal(response.status,200);assert(!text.includes('SYNTHETIC_ANSWER_PRIVATE'));assert(!text.includes('8650004194'));assert(text.includes('niedostępna'))
 await f.send('Co to oznacza dla negocjacji?')
 assert(!f.prompts[1].some((m:any)=>m.role==='assistant'))
})
test('private publication retention/removal and producer denial cannot leak an older answer through history',async()=>{
 for(const change of ['removePublication','denyNews'] as const){const f=fixture();await f.send();f[change]()
  const response=await f.handlers.load(new Request('https://example.test'),conversationId),text=await response.text()
  assert(!text.includes('SYNTHETIC_ANSWER_PRIVATE'));assert(!text.includes('SYNTHETIC_PRIVATE_HEADLINE'));assert(text.includes('niedostępna'))
 }
})
test('a newly retained KYS report cannot resurrect a historical turn whose original source retention expired',async()=>{
 const f=fixture();await f.send()
 f.stored.turns[0].scopes.find((s:any)=>s.source==='SRM_XRAY').privateKysUntil='2020-01-01T00:00:00Z'
 const response=await f.handlers.load(new Request('https://example.test'),conversationId),text=await response.text()
 assert(!text.includes('SYNTHETIC_ANSWER_PRIVATE'));assert(text.includes('niedostępna'))
 await f.send('Co to oznacza dla negocjacji?')
 assert(!f.prompts[1].some((m:any)=>m.role==='assistant'))
})
test('a source changes after admission: no provider dispatch, no successful completion and no automatic retry',async()=>{
 const f=fixture();f.changeOnAdmission();const result=await f.send()
 assert(result.text.includes('CONTEXT_CHANGED'));assert(!result.text.includes('"type":"completed"'));assert.equal(f.providerPosts,0)
})
test('switching the active supplier clears continuity even for an identical name and never carries a previous organisation',()=>{
 const turn={message:'Wiadomości o tym dostawcy',locale:'pl' as const,module:'xray' as const,reference:supplier}
 const first=selectConversationContext(turn,null,org),contexts:any=[{source:'SRM_XRAY',status:'OK',sourceVersion:'b'.repeat(64),data:{kys:{status:'OK',retentionUntil:'2030-01-01T00:00:00.000Z'}}}]
 const scopes=contextHistoryScopes(first,contexts,org)
 const stored:any={id:conversationId,revision:1,turns:[{status:'COMPLETE',message:'Private previous supplier',response:'Private answer',scopes}]}
 const next=selectConversationContext({...turn,reference:{...supplier,nip:'5250001009'}},stored,org)
 assert.notEqual(next.viewIdentity,first.viewIdentity);assert.equal(next.references.find(r=>r.source==='NEWSFEED')?.source,'NEWSFEED')
 assert(!JSON.stringify(next.reference).includes('8650004194'))
 const foreign=selectConversationContext({...turn,message:'Co to oznacza?'},stored,randomUUID())
 assert(!foreign.references.some(r=>r.source==='NEWSFEED'))
 assert.equal(contextSatisfiesScope({...scopes[0],privateKys:true},{source:'SRM_XRAY',status:'PARTIAL',data:{kys:{status:'DENIED'}}}),false)
})
test('an explicit NIP matching the active sole trader retains the native entity type and selected period',()=>{
 const selection=selectConversationContext({message:'Przeanalizuj finanse NIP: 8650004194',locale:'pl',module:'xray',reference:{...supplier,entityType:'JDG'}},null,org)
 const selected=selection.references.find(r=>r.source==='SRM_XRAY')
 assert.equal(selected?.entityType,'JDG');assert.equal(selected?.year,2025);assert.equal(selected?.comparisonYear,2024)
})
