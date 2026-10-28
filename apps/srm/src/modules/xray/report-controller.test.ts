import assert from 'node:assert/strict'
import {test} from 'node:test'
import {SupplierReportController} from './report-controller'
import {sampleCard} from '../../demo/fixture'
import {projectReportData} from '../../server/report-data'
import {createSupplierWebRequest} from './supplier-web-request'
import {createKrsSessionTransport} from './krs-session-transport'
import {kysOverview} from '@profitia/srm-xray'
const nip='8650004194',other='5272443955',now=new Date('2026-10-20T00:00:00Z'),retrievedAt='2026-10-19T23:00:00Z'
const privateRef={snapshotId:'11111111-1111-4111-8111-111111111111',nip,entityType:'COMPANY',retentionUntil:'2026-10-21T00:00:00Z',exportRef:'b'.repeat(64)}
const metadata=(selected=nip)=>projectReportData({nip:selected,entityType:'COMPANY'},{nip:selected,financial_json:null,financial_sha256:null,financial_checked_at:null,facts:[],indicators:[],kys:null},now,{})
test('diagnostic correlation joins search and protected read without becoming an authority or changing logical keys',async()=>{
 const execution='11111111-1111-4111-8111-111111111111',first='22222222-2222-4222-8222-222222222222',second='33333333-3333-4333-8333-333333333333'
 const headers:Headers[]=[],logs:string[]=[];let keys=0
 const transport:typeof fetch=async(path,init)=>{
  headers.push(new Headers(init?.headers))
  return Response.json(String(path).endsWith('/search')?{entityType:'COMPANY',card:{...sampleCard,identity:{...sampleCard.identity,nip}}}:metadata(),
   {headers:{'X-SRM-Diagnostic-Execution':execution,'X-SRM-Diagnostic-Fragment':headers.length===1?first:second}})
 }
 const controller=new SupplierReportController(transport,()=>now,()=> 'synthetic-original-key-'+(++keys)),original=console.info
 console.info=value=>{logs.push(String(value))}
 try{await controller.search(nip)}finally{console.info=original}
 assert.equal(controller.getSnapshot().error,null);assert.equal(keys,2);assert.equal(headers.length,2)
 assert.equal(headers[0].get('X-SRM-Diagnostic-Execution'),null);assert.equal(headers[1].get('X-SRM-Diagnostic-Execution'),execution)
 assert.equal(headers[1].get('X-SRM-Diagnostic-Parent'),first)
 const events=logs.map(line=>JSON.parse(line));assert.equal(events.filter(e=>e.event==='srm_diagnostic_client_request').length,2)
 const completed=events.filter(e=>e.event==='srm_diagnostic_client_complete');assert.equal(completed.length,1)
 assert.equal(completed[0].traceId,execution);assert.equal(completed[0].lastFragmentId,second)
 assert.equal(completed[0].clock,'BROWSER_PERFORMANCE_NOW_NOT_SERVER_CLOCK');assert(completed[0].endMs>=completed[0].startMs)
 assert(!logs.join('').includes(nip));assert(!logs.join('').includes('synthetic-original-key'))
})

test('unprepared KRS keeps ordinary token reuse while NIP starts fresh, without forwarding credentials to other destinations',async()=>{
 let tokens=0;const reads:unknown[]=[],seen:{path:string;authorization:string|null}[]=[]
 const transport=createKrsSessionTransport(async options=>{reads.push(options);return 'synthetic-session-'+ ++tokens},async(path,init)=>{
  seen.push({path:String(path),authorization:new Headers(init?.headers).get('authorization')});return Response.json({})
 })
 await transport('/api/xray/krs/status');await transport('/api/xray/krs/lookup',{method:'POST'});
 await transport('/api/xray/search');await transport('https://foreign.example/api/xray/krs/lookup');
 assert.equal(tokens,3);assert.deepEqual(seen.map(x=>x.authorization),['Bearer synthetic-session-1','Bearer synthetic-session-2','Bearer synthetic-session-3',null])
 assert.deepEqual(reads,[undefined,undefined,{skipCache:true}])
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
test('selected report uses validity from its current private read without fetching private metadata through company admission',async()=>{
 const calls:string[]=[];
 const c=new SupplierReportController(async(path)=>{
  calls.push(String(path));
  if(String(path).endsWith('/lookup'))return Response.json(nameResult());
  assert.equal(path,'/api/xray/kys');
  return Response.json({section:{...sampleCard.kys,retrievedAt,data:{...sampleCard.kys.data,company:{nip}}},privateReport:privateRef});
 },()=>now,()=> 'synthetic-private-reference-key');
 await c.searchKrs(selection);const financial=c.getSnapshot().metadata?.financial;
 await c.fetchKys();assert.deepEqual(calls,['/api/xray/krs/lookup','/api/xray/kys']);
 assert.equal(c.getSnapshot().metadata?.kys.exportRef,privateRef.exportRef);assert.deepEqual(c.getSnapshot().metadata?.financial,financial);
 assert.equal(c.getSnapshot().metadata?.kys.reportAvailable,true);
 assert.equal(c.getSnapshot().metadata?.kys.freshness.cacheExpiresAt,privateRef.retentionUntil);
 assert.equal(c.getSnapshot().metadata?.kys.freshness.freshness,'FRESH');
 assert.equal(kysOverview({nip,entityType:'COMPANY',section:c.getSnapshot().kys,metadata:c.getSnapshot().metadata},now.getTime()).available,true);
});
test('selected private availability and export cannot survive expiry or an unavailable new private action',async()=>{
 let clock=now,fail=false;
 const c=new SupplierReportController(async path=>{
  if(String(path).endsWith('/lookup'))return Response.json(nameResult());
  if(fail)return Response.json({error:'Operation unavailable'},{status:401});
  return Response.json({section:{...sampleCard.kys,retrievedAt,data:{...sampleCard.kys.data,company:{nip}}},privateReport:privateRef});
 },()=>clock,()=> 'synthetic-current-private-read');
 await c.searchKrs(selection);await c.fetchKys();assert.equal(c.getSnapshot().metadata?.kys.reportAvailable,true);
 clock=new Date(privateRef.retentionUntil);await c.refreshMetadata();
 assert.equal(c.getSnapshot().metadata?.kys.reportAvailable,false);assert.equal(c.getSnapshot().metadata?.kys.exportRef,null);
 clock=now;await c.fetchKys();assert.equal(c.getSnapshot().metadata?.kys.reportAvailable,true);
 fail=true;await c.fetchKys();assert.equal(c.getSnapshot().metadata?.kys.reportAvailable,false);assert.equal(c.getSnapshot().metadata?.kys.exportRef,null);
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


test('complete inline READY metadata removes the second request without changing the displayed card or radar',async()=>{
 const report=metadata(),calls:string[]=[]
 assert(report.financial.scanner)
 const card={...sampleCard,identity:{...sampleCard.identity,nip}}
 const controller=new SupplierReportController(async(path)=>{calls.push(String(path));return Response.json({entityType:'COMPANY',card,metadata:report})},()=>now)
 await controller.search(nip)
 assert.deepEqual(calls,['/api/xray/search']);assert.equal(controller.getSnapshot().error,null)
 assert.deepEqual(controller.getSnapshot().metadata,report)
 const result=controller.getSnapshot().result;assert.equal(result?.entityType,'COMPANY');assert.deepEqual(result?.entityType==='COMPANY'&&result.card,card)
})
for(const mode of ['wrong nip','missing radar','private KYS'] as const)test('inline READY refuses '+mode+' instead of presenting a complete report',async()=>{
 const report=metadata();if(mode==='wrong nip')report.nip=other
 if(mode==='missing radar')delete report.financial.scanner
 if(mode==='private KYS')report.kys.reportAvailable=true
 let calls=0
 const controller=new SupplierReportController(async()=>{calls++;return Response.json({entityType:'COMPANY',card:{...sampleCard,identity:{...sampleCard.identity,nip}},metadata:report})},()=>now)
 await controller.search(nip);assert(controller.getSnapshot().error);assert.equal(controller.getSnapshot().metadata,null);assert.equal(calls,1)
})
test('public NIP retry preserves uncertain intent, and a new explicit search remains a new action',async()=>{
 let sequence=0,fail=true;const keys:string[]=[];
 const c=new SupplierReportController(async(path,init)=>{
  if(String(path).endsWith('/report-data'))return Response.json(metadata());
  keys.push(new Headers(init?.headers).get('idempotency-key')!);if(fail){fail=false;throw Error('uncertain');}
  return Response.json({entityType:'COMPANY',card:{...sampleCard,identity:{...sampleCard.identity,nip}}});
 },()=>now,()=>`synthetic-public-key-${++sequence}`);
 await c.search(nip);await c.retrySearch();assert.equal(keys[0],keys[1]);await c.search(nip);assert.notEqual(keys[2],keys[1]);
});
test('inactivation rejects a late response while keeping the retry intent',async()=>{
 let complete!:(r:Response)=>void,calls=0;
 const c=new SupplierReportController(async()=>{calls++;return new Promise(resolve=>{complete=resolve;});},()=>now);
 const pending=c.search(nip);c.suspend();complete(Response.json({entityType:'COMPANY',card:{...sampleCard,identity:{...sampleCard.identity,nip}}}));await pending;
 assert.equal(c.getSnapshot().result,null);assert.equal(c.getSnapshot().error,'XRAY_INTERRUPTED');assert.equal(calls,1);
});


test('a current 401/403 removes all previously displayed supplier and private KYS data before another operation can complete',async()=>{
 let status=200;
 const c=new SupplierReportController(async(path)=>{
  if(status!==200)return Response.json({error:'XRAY_ACCESS_DENIED'},{status});
  if(String(path).endsWith('/search'))return Response.json({entityType:'COMPANY',card:{...sampleCard,identity:{...sampleCard.identity,nip}}});
  return Response.json(metadata());
 },()=>now);
 await c.search(nip);assert(c.getSnapshot().result);status=403;await c.refreshMetadata();
 assert.equal(c.getSnapshot().result,null);assert.equal(c.getSnapshot().metadata,null);assert.equal(c.getSnapshot().kys.data,null);assert.equal(c.getSnapshot().error,'XRAY_ACCESS_DENIED');
});


test('a pending KYS response keeps the logical request key and a completed report starts a new next action',async()=>{
 let attempt=0;const keys:string[]=[];
 const c=new SupplierReportController(async(path,init)=>{
  if(String(path).endsWith('/search'))return Response.json({entityType:'COMPANY',card:{...sampleCard,identity:{...sampleCard.identity,nip}}});
  if(String(path).endsWith('/report-data'))return Response.json(metadata());
  keys.push(new Headers(init?.headers).get('idempotency-key')!);attempt++;
  return Response.json({section:attempt===1?{...sampleCard.kys,status:'PENDING',data:null}:{...sampleCard.kys,retrievedAt},privateReport:attempt===1?null:privateRef},{status:attempt===1?202:200});
 },()=>now);
 await c.search(nip);await c.fetchKys();assert.equal(c.getSnapshot().kys.status,'PENDING');await c.fetchKys();assert.equal(keys[0],keys[1]);await c.fetchKys();assert.notEqual(keys[2],keys[1]);
});
test('private KYS expiry hides its data and availability locally without any backend/provider request',async()=>{
 let clock=now,calls=0;
 const c=new SupplierReportController(async(path)=>{calls++;
  if(String(path).endsWith('/search'))return Response.json({entityType:'COMPANY',card:{...sampleCard,identity:{...sampleCard.identity,nip}}});
  if(String(path).endsWith('/report-data'))return Response.json(metadata());
  return Response.json({section:{...sampleCard.kys,retrievedAt},privateReport:privateRef});
 },()=>clock);
 await c.search(nip);await c.fetchKys();assert(c.getSnapshot().kys.data);const before=calls;clock=new Date(privateRef.retentionUntil);c.expirePrivate();
 assert.equal(c.getSnapshot().kys.data,null);assert.equal(c.getSnapshot().metadata?.kys.reportAvailable,false);assert.equal(c.getSnapshot().metadata?.kys.freshness.freshness,'EXPIRED');assert.equal(calls,before);
});
