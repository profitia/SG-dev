import test from 'node:test'
import assert from 'node:assert/strict'
import {createKrsSessionTransport,prepareReport} from './krs-session-transport'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import receipt from '../../../operation-integration.json'
test('company session repair preserves prior acceptance and pins every changed consumer',()=>{
 const a=receipt.mgbiDevelopmentSessionFreshnessRepair,hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex')
 const before=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(before),a.previousReceiptDigest)
 for(const[key,value]of Object.entries(JSON.parse(before.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests)){
  const next:{previousReceiptSourceSha:string;applicationSourceDigests:Record<string,string>}=receipt.supplierMapStartupRepair
  const bytes=next?.applicationSourceDigests[file]?execFileSync('git',['show',next.previousReceiptSourceSha+':apps/srm/'+file]):readFileSync(new URL('../../../'+file,import.meta.url))
  assert.equal(hash(bytes),digest,file)
 }
 assert.equal(a.serverAuthorityChecksChanged,false);assert.equal(a.tokenLifetimeChanged,false);assert.equal(a.providerRetriesAdded,false)
})
test('ordinary MGBI search, lookup and report read start with a fresh SDK bearer instead of a nearly expired cached token',async()=>{
 for(const path of ['/api/xray/search','/api/xray/lookup','/api/xray/report-data']){
  let clock=0,calls=0
  const key='same-logical-command',body=JSON.stringify({identifier:'9511855233'})
  const transport=createKrsSessionTransport(async options=>options?.skipCache?'fresh-60-second-token':'cached-1-second-token',async(actual,init)=>{
   calls++;clock+=20000
   const h=new Headers(init?.headers)
   assert.equal(actual,path);assert.equal(h.get('Idempotency-Key'),key);assert.equal(init?.body,body)
   assert.equal(h.get('X-SRM-Report-Admission'),null)
   return Response.json({}, {status:clock<(h.get('Authorization')==='Bearer fresh-60-second-token'?60000:1000)?200:401})
  })
  assert.equal((await transport(path,{method:'POST',headers:{'Idempotency-Key':key},body})).status,200)
  assert.equal(calls,1,'Token refresh must not introduce a provider retry')
 }
})
test('form diagnostic fragment is correlation only and cannot replace the existing admission or bearer',async()=>{
 const fragment='11111111-1111-4111-8111-111111111111',execution='22222222-2222-4222-8222-222222222222',nip='7772776017'
 const token='fr1.33333333-3333-4333-8333-333333333333.'+'a'.repeat(64),seen:Headers[]=[]
 const transport=createKrsSessionTransport(async()=> 'synthetic-bearer',async(path,init)=>{
  seen.push(new Headers(init?.headers))
  return path==='/api/xray/admission'?Response.json({token,nip,readyUntil:new Date(Date.now()+60000).toISOString(),expiresAt:new Date(Date.now()+120000).toISOString()},
   {headers:{'X-SRM-Diagnostic-Execution':execution,'X-SRM-Diagnostic-Fragment':fragment}}):Response.json({})
 })
 await prepareReport(transport,nip,new AbortController().signal)
 await transport('/api/xray/search',{method:'POST',body:JSON.stringify({identifier:nip})})
 await transport('https://synthetic.invalid/api/xray/search')
 assert.equal(seen[1].get('X-SRM-Diagnostic-Admission'),fragment);assert.equal(seen[1].get('X-SRM-Report-Admission'),token)
 assert.equal(seen[1].get('Authorization'),'Bearer synthetic-bearer');assert.equal(seen[2].get('X-SRM-Diagnostic-Admission'),null)
 assert.equal(seen[2].get('X-SRM-Report-Admission'),null)
})
test('form admission performs the only token refresh; the accepted search and Financial reuse the same bounded command',async()=>{
 let tokenReads=0;const seen:{path:string;grant:string|null;bearer:string|null}[]=[]
 const token='fr1.11111111-1111-4111-8111-111111111111.'+'a'.repeat(64),nip='7772776017'
 const transport=createKrsSessionTransport(async options=>{tokenReads++;assert.deepEqual(options,{skipCache:true});return 'synthetic-session'},async(path,init)=>{
  const h=new Headers(init?.headers);seen.push({path:String(path),grant:h.get('X-SRM-Report-Admission'),bearer:h.get('Authorization')})
  if(path==='/api/xray/admission'){
   assert.deepEqual(JSON.parse(String(init?.body)),{nip});assert.ok(h.get('Idempotency-Key'))
   return Response.json({token,nip,readyUntil:new Date(Date.now()+120000).toISOString(),expiresAt:new Date(Date.now()+180000).toISOString()})
  }
  return Response.json({})
 })
 await prepareReport(transport,nip,new AbortController().signal)
 await transport('/api/xray/search',{method:'POST',body:JSON.stringify({identifier:nip})})
 await transport('/api/xray/krs/lookup',{method:'POST',body:JSON.stringify({selectionRef:'KRS:0000210637:fixture'})})
 await transport('https://foreign.example/api/xray/krs/lookup')
 assert.equal(tokenReads,1);assert.deepEqual(seen.map(v=>v.grant),[null,token,token,null]);assert.equal(seen[3].bearer,null)
})
test('a cancelled form preparation cannot release a capability for later requests',async()=>{
 const controller=new AbortController();let reads=0
 const transport=createKrsSessionTransport(async()=>{reads++;controller.abort();return 'synthetic'},async()=>assert.fail('No HTTP after cancellation'))
 await assert.rejects(prepareReport(transport,'7772776017',controller.signal));assert.equal(reads,1)
})
test('a long private KYS action refreshes an expired bearer once with the exact same intent and no company grant',async()=>{
 let reads=0;const seen:{authorization:string|null;key:string|null;grant:string|null;body:unknown}[]=[];
 const transport=createKrsSessionTransport(async options=>{assert.deepEqual(options,{skipCache:true});return 'session-'+ ++reads},async(_path,init)=>{
  const h=new Headers(init?.headers);seen.push({authorization:h.get('Authorization'),key:h.get('Idempotency-Key'),grant:h.get('X-SRM-Report-Admission'),body:init?.body});
  return Response.json({}, {status:seen.length===1?401:200});
 });
 const response=await transport('/api/xray/kys',{method:'POST',headers:{'Idempotency-Key':'same-private-intent'},body:JSON.stringify({identifier:'7772776017'})});
 assert.equal(response.status,200);assert.equal(reads,2);assert.equal(seen.length,2);
 assert.deepEqual(seen.map(s=>s.authorization),['Bearer session-1','Bearer session-2']);
 assert.equal(seen[0].key,seen[1].key);assert.equal(seen[0].body,seen[1].body);assert(seen.every(s=>s.grant===null));
});
test('private retry is bounded and never retries revoked access, provider failure, cancellation or a missing logical key',async()=>{
 for(const status of [401,403,503]){
  let calls=0;const transport=createKrsSessionTransport(async()=> 'session',async()=>{calls++;return Response.json({}, {status})});
  assert.equal((await transport('/api/xray/kys',{method:'POST',headers:{'Idempotency-Key':'same-intent'}})).status,status);
  assert.equal(calls,status===401?2:1);
 }
 let calls=0;const controller=new AbortController();
 const transport=createKrsSessionTransport(async()=> 'session',async()=>{calls++;controller.abort();return Response.json({}, {status:401})});
 await assert.rejects(transport('/api/xray/kys',{method:'POST',headers:{'Idempotency-Key':'same-intent'},signal:controller.signal}));assert.equal(calls,1);
 calls=0;const missing=createKrsSessionTransport(async()=> 'session',async()=>{calls++;return Response.json({}, {status:401})});
 await missing('/api/xray/kys',{method:'POST'});assert.equal(calls,1);
});
