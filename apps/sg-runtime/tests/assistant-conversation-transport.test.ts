import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createAssistantConversationTransport} from '../components/appshell/assistant-conversation-transport'
const signal=()=>new AbortController().signal
const view=()=>({locale:'pl' as const,module:'appshell' as const,reference:null})
const input=()=>({conversationId:null,commandId:randomUUID(),message:'SYNTHETIC question'})
const stream=(lines:unknown[])=>new Response(lines.map(v=>JSON.stringify(v)+'\n').join(''),{headers:{'Content-Type':'application/x-ndjson'}})
test('same-origin transport uses only the current bearer and explicit view, with no automatic retry',async()=>{
 const calls:any[]=[],id=randomUUID(),events=[{type:'started',conversationId:id,turnId:randomUUID()},{type:'delta',text:'Answer'},{type:'completed',sources:[]}]
 let token='SYNTHETIC_CURRENT_TOKEN'
 const transport=createAssistantConversationTransport({view,getToken:async()=>token,fetch:async(url,options)=>{calls.push({url,options});return stream(events)}})
 assert.deepEqual(await Array.fromAsync(transport.send(input(),signal())),events)
 const c=calls[0];assert.equal(c.url,'/api/assistant/conversation');assert.equal(c.options.credentials,'omit');assert.equal(c.options.cache,'no-store');assert.equal(c.options.redirect,'error')
 assert.equal(c.options.headers.Authorization,'Bearer '+token)
 assert.deepEqual(Object.keys(JSON.parse(c.options.body)).sort(),['commandId','conversationId','locale','message','module','reference'])
 token='';await assert.rejects(()=>Array.fromAsync(transport.send(input(),signal())),(e:any)=>e.code==='AUTH_REQUIRED');assert.equal(calls.length,1)
})
test('HTTP refusals, malformed and incomplete NDJSON cannot become a successful answer',async()=>{
 for(const status of [401,403,409,429,503]){
  let calls=0
  const t=createAssistantConversationTransport({view,getToken:async()=>'SYNTHETIC',fetch:async()=>{calls++;return new Response('',{status})}})
  await assert.rejects(()=>Array.fromAsync(t.send(input(),signal())));assert.equal(calls,1)
 }
 for(const body of ['{"type":"delta","text":"incomplete"}',JSON.stringify({type:'started',conversationId:'forged',turnId:randomUUID()})+'\n',JSON.stringify({type:'delta',text:'x'.repeat(70001)})+'\n']){
  const t=createAssistantConversationTransport({view,getToken:async()=>'SYNTHETIC',fetch:async()=>new Response(body,{headers:{'Content-Type':'application/x-ndjson'}})})
  await assert.rejects(()=>Array.fromAsync(t.send(input(),signal())))
 }
})
test('history delete validates the conversation identifier before its only request',async()=>{
 const calls:any[]=[],id=randomUUID(),t=createAssistantConversationTransport({view,getToken:async()=>'SYNTHETIC',fetch:async(url,options)=>{calls.push({url,options});return Response.json({deleted:true})}})
 await assert.rejects(()=>t.remove!('../other',signal()));assert.equal(calls.length,0)
 await t.remove!(id,signal());assert.equal(calls[0].url,'/api/assistant/history/'+id);assert.equal(calls[0].options.method,'DELETE')
})
