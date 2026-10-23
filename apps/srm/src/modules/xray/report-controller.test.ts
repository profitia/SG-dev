import assert from 'node:assert/strict'
import {test} from 'node:test'
import {SupplierReportController} from './report-controller'
import {sampleCard} from '../../demo/fixture'
import {projectReportData} from '../../server/report-data'
import {createSupplierWebRequest} from './supplier-web-request'
import {createKrsSessionTransport} from './krs-session-transport'
const nip='8650004194',other='5272443955',now=new Date('2026-10-20T00:00:00Z'),retrievedAt='2026-10-19T23:00:00Z'
const privateRef={snapshotId:'11111111-1111-4111-8111-111111111111',nip,entityType:'COMPANY',retentionUntil:'2026-10-21T00:00:00Z',exportRef:'b'.repeat(64)}
const metadata=(selected=nip)=>projectReportData({nip:selected,entityType:'COMPANY'},{nip:selected,financial_json:null,financial_sha256:null,financial_checked_at:null,facts:[],indicators:[],kys:null},now,{})

test('KRS and NIP requests refresh the session without forwarding tokens to other destinations',async()=>{
 let tokens=0;const seen:{path:string;authorization:string|null}[]=[]
 const transport=createKrsSessionTransport(async options=>{assert.deepEqual(options,{skipCache:true});return 'synthetic-session-'+ ++tokens},async(path,init)=>{
  seen.push({path:String(path),authorization:new Headers(init?.headers).get('authorization')});return Response.json({})
 })
 await transport('/api/xray/krs/status');await transport('/api/xray/krs/lookup',{method:'POST'});
 await transport('/api/xray/search');await transport('https://foreign.example/api/xray/krs/lookup');
 assert.equal(tokens,3);assert.deepEqual(seen.map(x=>x.authorization),['Bearer synthetic-session-1','Bearer synthetic-session-2','Bearer synthetic-session-3',null])
 let calls=0;await assert.rejects(createKrsSessionTransport(async()=>null,async()=>{calls++;return Response.json({})})('/api/xray/krs/lookup'),/Sesja wygasła/);assert.equal(calls,0)
})

test('website client keeps one logical key across uncertain delivery and pending work, then rotates after success',async()=>{
 let call=0,keys=0
 const seen:{key:string|null;body:unknown}[]=[]
 const load=createSupplierWebRequest(nip,'COMPANY',{newKey:()=>`synthetic-web-request-${++keys}`,fetcher:async(url,init)=>{
  assert.equal(url,'/api/xray/web-identity');assert.equal(init?.method,'POST')
  seen.push({key:new Headers(init?.headers).get('Idempotency-Key'),body:JSON.parse(String(init?.body))});call++
  if(call===1)throw Error('Synthetic uncertain delivery')
  return Response.json({status:call===2?'PENDING':'NOT_FOUND',websiteUrl:null,logoDataUrl:null,evidenceUrl:null,logoSourceUrl:null,method:null,checkedAt:null},
   {status:call===2?202:200})
 }})
 await assert.rejects(load(new AbortController().signal),/Synthetic uncertain/)
 assert.equal((await load(new AbortController().signal)).status,'PENDING')
 assert.equal((await load(new AbortController().signal)).status,'NOT_FOUND')
 await load(new AbortController().signal)
 assert.deepEqual(seen.map(x=>x.key),['synthetic-web-request-1','synthetic-web-request-1','synthetic-web-request-1','synthetic-web-request-2'])
 for(const request of seen)assert.deepEqual(request.body,{identifier:nip,entityType:'COMPANY'})
})
test('website client does not issue an aborted request and never invents actor or organization headers',async()=>{
 let calls=0
 const load=createSupplierWebRequest(nip,'JDG',{newKey:()=> 'synthetic-web-request-key',fetcher:async(_url,init)=>{
  calls++;assert.deepEqual([...new Headers(init?.headers).keys()],['content-type','idempotency-key'])
  assert.deepEqual(JSON.parse(String(init?.body)),{identifier:nip,entityType:'JDG'})
  return Response.json({error:'Operation unavailable'},{status:403})
 }})
 const aborted=new AbortController();aborted.abort()
 await assert.rejects(load(aborted.signal));assert.equal(calls,0)
 await assert.rejects(load(new AbortController().signal),/WEBSITE_UNAVAILABLE/);assert.equal(calls,1)
})
function setup(){
 let fail=false,ref:unknown=privateRef,selected=nip,sequence=0
 const keys:string[]=[]
 const transport:typeof fetch=async(path,init)=>{
  if(String(path).endsWith('/search')){
   selected=JSON.parse(String(init?.body)).identifier
   return Response.json({entityType:'COMPANY',card:{...sampleCard,identity:{...sampleCard.identity,nip:selected}}})
  }
  if(String(path).endsWith('/report-data'))return Response.json(metadata(selected))
  keys.push(new Headers(init?.headers).get('Idempotency-Key')??'')
  if(fail)throw new TypeError('Synthetic interrupted transport')
  return Response.json({section:{...sampleCard.kys,retrievedAt},privateReport:ref})
 }
 const controller=new SupplierReportController(transport,()=>now,()=> 'synthetic-ui-logical-key-'+(++sequence))
 return {controller,keys,setFail:(v:boolean)=>{fail=v},setRef:(v:unknown)=>{ref=v}}
}
test('browser retries an interrupted logical request with the same key; a completed next action has a new key',async()=>{
 const f=setup();await f.controller.search(nip);f.setFail(true);await f.controller.fetchKys();f.setFail(false);await f.controller.fetchKys()
 assert.equal(f.keys.length,2);assert.equal(f.keys[0],f.keys[1]);assert(f.keys[0])
 await f.controller.fetchKys();assert.notEqual(f.keys[2],f.keys[1])
})
test('private read PDF reference survives financial metadata refresh and cannot carry across suppliers or reset',async()=>{
 const f=setup();await f.controller.search(nip);await f.controller.fetchKys()
 assert.equal(f.controller.getSnapshot().metadata?.kys.exportRef,privateRef.exportRef)
 assert.equal(f.controller.getSnapshot().metadata?.kys.freshness.retrievedAt,retrievedAt.replace('Z','.000Z'))
 await f.controller.refreshMetadata();assert.equal(f.controller.getSnapshot().metadata?.kys.exportRef,privateRef.exportRef)
 await f.controller.search(other);assert.equal(f.controller.getSnapshot().metadata?.kys.exportRef??null,null)
 f.controller.reset();assert.equal(f.controller.getSnapshot().metadata,null)
})
test('invalid or foreign private references are refused and an unavailable private report clears older PDF authority',async()=>{
 for(const bad of[{...privateRef,nip:other},{...privateRef,entityType:'JDG'},{...privateRef,exportRef:'bad'},{...privateRef,retentionUntil:'2026-10-19T00:00:00Z'}]){
  const f=setup();await f.controller.search(nip);f.setRef(bad);await f.controller.fetchKys()
  assert(f.controller.getSnapshot().kysError);assert.equal(f.controller.getSnapshot().metadata?.kys.exportRef,null)
 }
 const f=setup();await f.controller.search(nip);await f.controller.fetchKys();assert.equal(f.controller.getSnapshot().metadata?.kys.exportRef,privateRef.exportRef)
 f.setFail(true);await f.controller.fetchKys();assert.equal(f.controller.getSnapshot().metadata?.kys.exportRef,null)
})

const selection={krs:'0000028860',nip,name:'Synthetic selected company',locality:'Synthetic locality',selectionRef:'KRS:0000028860:'+ 'a'.repeat(64)};
function nameResult(){return {result:{entityType:'COMPANY',card:{...sampleCard,identity:{...sampleCard.identity,nip,krs:selection.krs},
 general:{...sampleCard.general,data:{...sampleCard.general.data,nip,krs:selection.krs}}}},metadata:metadata()}}
test('selected-company retries preserve the logical Financial key and never invoke legacy NIP search or metadata acquisition',async()=>{
 let calls=0,sequence=0;const keys:string[]=[],paths:string[]=[];
 const transport:typeof fetch=async(path,init)=>{
  paths.push(String(path));assert.equal(path,'/api/xray/krs/lookup');assert.deepEqual(JSON.parse(String(init?.body)),{selectionRef:selection.selectionRef});
  keys.push(new Headers(init?.headers).get('Idempotency-Key')!);if(++calls===1)throw TypeError('Synthetic delivery uncertainty');
  return Response.json(nameResult());
 };
 const c=new SupplierReportController(transport,()=>now,()=>`synthetic-selected-key-${++sequence}`);
 await c.searchKrs(selection);assert(c.getSnapshot().error);await c.searchKrs(selection);
 assert(c.getSnapshot().result);assert.equal(c.getSnapshot().error,null);assert.equal(keys[0],keys[1]);
 await c.refreshMetadata();assert.equal(paths.length,2);
 await c.searchKrs(selection);assert.notEqual(keys[2],keys[1]);
});
test('selected-company mismatch cannot attach a report and a reset discards a late response',async()=>{
 for(const location of ['identity','general','metadata']){
  const payload=nameResult();if(location==='identity')payload.result.card.identity.krs='0000000001';
  if(location==='general')payload.result.card.general.data.nip=other;
  if(location==='metadata')payload.metadata.nip=other;
  const c=new SupplierReportController(async()=>Response.json(payload),()=>now,()=> 'synthetic-key-forged-result');
  await c.searchKrs(selection);assert.equal(c.getSnapshot().result,null);assert(c.getSnapshot().error);
 }
 let complete!:(r:Response)=>void;
 const c=new SupplierReportController(async()=>new Promise(resolve=>{complete=resolve}),()=>now,()=> 'synthetic-key-stale-result');
 const pending=c.searchKrs(selection);c.reset();complete(Response.json(nameResult()));await pending;
 assert.equal(c.getSnapshot().result,null);assert.equal(c.getSnapshot().busy,false);
});
test('name report keeps eligible Financial metadata while applying only its current private KYS PDF reference',async()=>{
 const calls:string[]=[];
 const c=new SupplierReportController(async(path)=>{
  calls.push(String(path));return String(path).endsWith('/lookup')?Response.json(nameResult()):Response.json({section:{...sampleCard.kys,retrievedAt},privateReport:privateRef});
 },()=>now,()=> 'synthetic-private-reference-key');
 await c.searchKrs(selection);const financial=c.getSnapshot().metadata?.financial;
 await c.fetchKys();assert.deepEqual(calls,['/api/xray/krs/lookup','/api/xray/kys']);
 assert.equal(c.getSnapshot().metadata?.kys.exportRef,privateRef.exportRef);assert.deepEqual(c.getSnapshot().metadata?.financial,financial);
});

test('bounded KRS document continuation keeps the same logical key and publishes only the completed Financial metadata',async()=>{
 let calls=0;const keys:string[]=[],states:boolean[]=[]
 const c=new SupplierReportController(async(path,init)=>{
  assert.equal(path,'/api/xray/krs/lookup');keys.push(new Headers(init?.headers).get('Idempotency-Key')!);calls++
  const payload=nameResult()
  if(calls===1)return Response.json({...payload,pending:true,metadata:null},{status:202})
  return Response.json(payload)
 })
 c.subscribe(()=>states.push(c.getSnapshot().busy));await c.searchKrs(selection)
 assert.equal(calls,2);assert.equal(new Set(keys).size,1);assert.equal(c.getSnapshot().busy,false)
 assert.equal(c.getSnapshot().error,null);assert(c.getSnapshot().metadata);assert(states.includes(true))
})

test('NIP KRS selection continues only through the existing Financial BFF and retains source status',async()=>{
 const paths:string[]=[],krs='0000028860',selection={nip,krs,name:'SYNTHETIC',locality:null,selectionRef:'KRS:'+krs+':'+'a'.repeat(64)}
 const result={entityType:'COMPANY',card:{...sampleCard,identity:{...sampleCard.identity,nip,krs},general:{...sampleCard.general,data:{...sampleCard.general.data,nip,krs}}}}
 const transport:typeof fetch=async(path,init)=>{
  paths.push(String(path))
  if(String(path).endsWith('/search'))return Response.json({...result,krsSelection:selection,registryRoute:{provider:'KRS'}})
  assert.equal(path,'/api/xray/krs/lookup');assert.deepEqual(JSON.parse(String(init?.body)),{selectionRef:selection.selectionRef})
  return Response.json({result,metadata:null})
 }
 const controller=new SupplierReportController(transport,()=>now,()=> 'synthetic-ui-nip-krs-key')
 await controller.search(nip)
 assert.deepEqual(paths,['/api/xray/search','/api/xray/krs/lookup']);assert.equal(controller.getSnapshot().registryRoute?.provider,'KRS');assert.equal(controller.getSnapshot().result?.entityType,'COMPANY');assert.equal(controller.getSnapshot().error,null)
})
