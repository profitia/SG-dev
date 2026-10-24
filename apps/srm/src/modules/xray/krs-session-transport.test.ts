import test from 'node:test'
import assert from 'node:assert/strict'
import {createKrsSessionTransport,prepareReport} from './krs-session-transport'
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
