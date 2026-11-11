// SYNTHETIC_ONLY. Producer transport/selection; no model or provider request.
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createAssistantSourceAdapters} from '../lib/assistant/sources'
import {selectConversationContext,referenceIdentity,contextHistoryScopes,contextSatisfiesScope} from '../lib/assistant/context-selection'
import economicTargets from '../deployment/assistant-ecr-targets.json'
const org=randomUUID(),now=Date.parse('2026-11-11T12:34:56Z')
const reference={version:'2.1.0' as const,source:'ECONOMIC_CALENDAR' as const,from:'2026-11-01T00:00:00.000Z',to:'2026-11-30T23:59:59.999Z',targetType:null,targetId:null,asKnownAt:null,after:null}
const request=new Request('https://app.fixture.test/api/assistant/conversation',{headers:{authorization:'Bearer SYNTHETIC_ONLY',cookie:'PRIVATE_MUST_NOT_CROSS',origin:'https://untrusted.fixture.test','x-profitia-organisation-id':'claimed'}})
const raw=()=>({contract:{id:'profitia.economic-calendar',version:'1.1.0'},semanticContract:'profitia.economic-calendar-semantics/1.0.0',projection:'ECONOMIC_CONTEXT',
 interpretationOwner:'AUTHORISED_CONSUMER',missingValuesMeaning:'UNKNOWN_NOT_ZERO',order:'CANONICAL_EVENT_ID',causalityClaim:false,targetStatus:'GLOBAL',
 nextAfter:null,items:[],definitions:[],unresolvedSchedules:[],semanticVersions:[],coverage:{completeness:'UNKNOWN',numericHistory:'OBSERVED_BY_ECR_ONLY',publishedAtNotInferred:true,unmappedDefinitions:[]}})
const demand=(changes:any={})=>({reference,request,organisationId:org,observedAt:'2026-11-11T00:00:00Z',...changes})
const turn=(message:string)=>({message,locale:'pl' as const,module:'appshell' as const,reference:null})
test('ECR is a pinned native GET with only the real bearer and verified organisation, not SourceHub or browser claims',async()=>{
 let calls=0
 const adapter=createAssistantSourceAdapters({enabled:true,economicCalendarEnabled:true,organisationId:org,fetcher:async(input,init)=>{
  calls++;const url=new URL(String(input));assert.equal(url.origin,economicTargets.producer.origin)
  assert.equal(url.pathname,'/v1/organisations/'+org+'/calendar/context');assert.equal(url.searchParams.get('limit'),'8')
  assert.equal(url.searchParams.get('from'),reference.from);assert.equal(url.searchParams.get('to'),reference.to)
  assert.deepEqual([...new Headers(init?.headers)], [['authorization','Bearer SYNTHETIC_ONLY']])
  assert.equal(init?.method,'GET');assert.equal(init?.cache,'no-store');assert.equal(init?.credentials,'omit');assert.equal(init?.redirect,'error')
  return Response.json(raw(),{headers:{'cache-control':'no-store'}})
 }})[3]
 const result=await adapter.read(demand());assert.equal(result.status,'EMPTY');assert.equal(calls,1)
 assert.equal((result.data as any).coverage.completeness,'UNKNOWN')
})
test('disabled ECR, disabled M2, wrong organisation, missing bearer and cancellation make no ECR request',async()=>{
 let calls=0;const fetcher:typeof fetch=async()=>{calls++;return Response.json(raw(),{headers:{'cache-control':'no-store'}})}
 const adapter=(enabled=true,economicCalendarEnabled=true)=>createAssistantSourceAdapters({enabled,economicCalendarEnabled,organisationId:org,fetcher})[3]
 for(const [a,i]of [[adapter(false),demand()],[adapter(true,false),demand()],[adapter(),demand({organisationId:randomUUID()})],
  [adapter(),demand({request:new Request('https://app.fixture.test')})],[adapter(),demand({signal:AbortSignal.abort()})],
  [adapter(),demand({request:new Request('https://app.fixture.test',{signal:AbortSignal.abort()})})]]as const)await assert.rejects(()=>a.read(i))
 await assert.rejects(()=>adapter().read(demand({reference:{...reference,allow:true}})))
 assert.equal(calls,0)
})
test('ECR errors, unsafe headers/links, wrong projections and oversized responses fail closed without retry',async()=>{
 const faults=[()=>new Response(null,{status:401}),()=>new Response(null,{status:403}),()=>new Response(null,{status:404}),()=>new Response(null,{status:503}),
  ()=>Response.json(raw(),{headers:{'cache-control':'public'}}),()=>Response.json(raw(),{headers:{'cache-control':'no-store','set-cookie':'private=bad'}}),
  ()=>new Response(JSON.stringify(raw()),{headers:{'cache-control':'no-store','content-type':'text/html'}}),
  ()=>{const r=Response.json(raw(),{headers:{'cache-control':'no-store'}});Object.defineProperty(r,'redirected',{value:true});return r},
  ()=>{const r=Response.json(raw(),{headers:{'cache-control':'no-store'}});Object.defineProperty(r,'url',{value:'https://foreign.fixture.test/data'});return r},
  ()=>Response.json({...raw(),projection:'UNTRUSTED'},{headers:{'cache-control':'no-store'}}),
  ()=>new Response(' '.repeat(256*1024+1),{headers:{'cache-control':'no-store','content-type':'application/json'}})]
 for(const fault of faults){let calls=0;const a=createAssistantSourceAdapters({enabled:true,economicCalendarEnabled:true,organisationId:org,fetcher:async()=>{calls++;return fault()}})[3]
  await assert.rejects(()=>a.read(demand()));assert.equal(calls,1)}
})
test('server time selections preserve explicit dates, same-view continuation and invalid-date refusal without inventing a benchmark ID',()=>{
 for(const message of ['Kalendarz makro od 2026-11-01 do 2026-11-30','Kalendarz makro od 01.11.2026 do 30.11.2026']){
  const r=selectConversationContext(turn(message),null,org,now)
  assert.deepEqual(r.references,[reference]);assert.equal(r.policy.contextPlan[0].source,'ECONOMIC_CALENDAR')
 }
 const first=selectConversationContext(turn('Najbliższe wydarzenia makro'),null,org,now),r=first.references[0]
 assert.equal(r.source,'ECONOMIC_CALENDAR');if(r.source!=='ECONOMIC_CALENDAR')throw Error('Missing ECR')
 assert.equal(r.from,'2026-11-11T00:00:00.000Z');assert.equal(r.to,'2026-12-11T23:59:59.999Z');assert.equal(r.targetId,null)
 for(const [message,from,to]of [['Kalendarz makro jutro','2026-11-12','2026-11-12'],['Kalendarz makro w przyszłym tygodniu','2026-11-16','2026-11-22'],
  ['Kalendarz makro w tym tygodniu','2026-11-09','2026-11-15'],['Kalendarz makro w ciągu najbliższych 7 dni','2026-11-11','2026-11-17'],
  ['Kalendarz makro w przyszłym miesiącu','2026-12-01','2026-12-31']]){
  const selected=selectConversationContext(turn(message),null,org,now).references[0]
  assert.equal(selected.source,'ECONOMIC_CALENDAR');if(selected.source==='ECONOMIC_CALENDAR'){assert.equal(selected.from,from+'T00:00:00.000Z');assert.equal(selected.to,to+'T23:59:59.999Z')}
 }
 const entry:any={source:'ECONOMIC_CALENDAR',status:'PARTIAL',sourceVersion:'a'.repeat(64),data:{events:[],unresolvedSchedules:[]}}
 const scopes=contextHistoryScopes(first,[entry],org),stored:any={id:randomUUID(),revision:2,turns:[{status:'COMPLETE',scopes}]}
 const next=selectConversationContext(turn('Co to oznacza dla zakupów?'),stored,org,now+86400000)
 assert.equal(referenceIdentity(next.references[0]),referenceIdentity(r))
 assert.deepEqual(selectConversationContext(turn('Co to oznacza?'),stored,randomUUID(),now).references,[])
 assert.deepEqual(selectConversationContext(turn('Kalendarz makro 2026-02-30'),null,org,now).references,[])
 const latest=selectConversationContext(turn('Najnowsze odczyty EIA'),null,org,now).references[0]
 assert.equal(latest.source,'ECONOMIC_CALENDAR');if(latest.source==='ECONOMIC_CALENDAR')assert.equal(latest.to,'2026-11-11T23:59:59.999Z')
})
test('history requires the same currently readable ECR event, observation and unresolved publication',()=>{
 const eventId='ecr_evt_'+'a'.repeat(64),observationId='ecr_obs_'+'b'.repeat(64),publicationId='ecr_pub_'+'c'.repeat(64)
 const selection=selectConversationContext(turn('Kalendarz makro 2026-11-01 2026-11-30'),null,org,now)
 const entry:any={source:'ECONOMIC_CALENDAR',status:'PARTIAL',sourceVersion:'d'.repeat(64),data:{events:[{eventId,results:[{observationId}]}],unresolvedSchedules:[{publicationId}]}}
 const [scope]=contextHistoryScopes(selection,[entry],org)
 assert.deepEqual(scope.requiredRecordIds,['E:'+eventId,'N:'+observationId,'C:'+publicationId]);assert(contextSatisfiesScope(scope,entry))
 assert(!contextSatisfiesScope(scope,{...entry,status:'DENIED'}))
 assert(!contextSatisfiesScope(scope,{...entry,source:'NEWSFEED'}))
 assert(!contextSatisfiesScope(scope,{...entry,data:{...entry.data,events:[]}}))
 assert(!contextSatisfiesScope(scope,{...entry,data:{...entry.data,unresolvedSchedules:[]}}))
})
test('PI can request shared ECR without opening the private Newsfeed archive',()=>{
 const selected=selectConversationContext({...turn('Pokaż kalendarz makro'),module:'procurement_insights'},null,org,now)
 assert.deepEqual(selected.policy.contextPlan,[{source:'ECONOMIC_CALENDAR',selection:'ACTIVE_VIEW'}])
 assert.deepEqual(selectConversationContext({...turn('Sprawdź wiadomości z całego archiwum'),module:'procurement_insights'},null,org,now).policy.contextPlan,[])
})
