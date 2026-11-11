import test from 'node:test'
import assert from 'node:assert/strict'
import {AssistantConversationSession,type AssistantConversationTransport,type AssistantStreamEvent} from '../components/appshell/assistant-conversation-session'

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r});return{promise,resolve}}
const transport=(send:AssistantConversationTransport['send']):AssistantConversationTransport=>({
 list:async()=>[{id:'saved',title:'Private conversation',updatedAt:'2026-11-09T12:00:00Z'}],
 load:async id=>({id,messages:[{id:'saved-message',role:'user',content:'Saved question',status:'complete',sources:[]}]}),send,
})
const ids=()=>{let id=0;return()=>`command-${++id}`}

test('draft survives view remount subscribers and is cleared with account or contextual denial',async()=>{
 const session=new AssistantConversationSession(transport(async function*(){yield{type:'error',code:'CONTEXT_CHANGED'}}),ids())
 session.activate('a');const unsubscribe=session.subscribe(()=>{});session.setDraft('Unsent draft');unsubscribe()
 const second=session.subscribe(()=>{});assert.equal(session.getSnapshot().draft,'Unsent draft');second()
 session.changeView();assert.equal(session.getSnapshot().draft,'Unsent draft')
 await session.send('Question');assert.equal(session.getSnapshot().error,'CONTEXT_CHANGED');assert.equal(session.getSnapshot().active,true)
 assert.deepEqual(session.getSnapshot().messages,[]);assert.equal(session.getSnapshot().draft,'')
 session.setDraft('New draft');session.activate(null);assert.equal(session.getSnapshot().draft,'')
})
test('own delete clears the current saved conversation after server acknowledgement',async()=>{
 const removed:string[]=[],t=transport(async function*(){});t.remove=async id=>{removed.push(id)}
 const session=new AssistantConversationSession(t,ids());session.activate('a');await session.refreshHistory();await session.open('saved')
 session.setDraft('Unsent');await session.deleteConversation('saved')
 assert.deepEqual(removed,['saved']);assert.equal(session.getSnapshot().conversationId,null)
 assert.deepEqual(session.getSnapshot().history,[]);assert.deepEqual(session.getSnapshot().messages,[]);assert.equal(session.getSnapshot().draft,'')
})

test('a limit refusal before a stream starts keeps the question without inventing an incomplete response or retrying',async()=>{
 let sends=0
 const session=new AssistantConversationSession(transport(async function*(){sends++;throw Object.assign(Error('Limit'),{code:'LIMIT_EXCEEDED'});yield {type:'error',code:'UNAVAILABLE'}}),ids())
 session.activate('owner');await session.send('Question about last week')
 const state=session.getSnapshot()
 assert.equal(sends,1);assert.equal(state.error,'LIMIT_EXCEEDED');assert.equal(state.busy,false)
 assert.equal(state.messages.length,1);assert.equal(state.messages[0].role,'user');assert.equal(state.messages[0].content,'Question about last week')
})
test('streams before completion and supports six explicitly sent turns without automatic calls',async()=>{
 const started=deferred(),finish=deferred(),commands:string[]=[]
 const session=new AssistantConversationSession(transport(async function*(input){
  commands.push(input.commandId);yield{type:'started',conversationId:'one',turnId:input.commandId}
  yield{type:'delta',text:'Answer '};started.resolve();await finish.promise
  yield{type:'delta',text:'continued'};yield{type:'completed',sources:[]}
 }),ids())
 session.activate('user-a:org-a:view-1')
 const first=session.send('Question 1');await started.promise
 assert.equal(session.getSnapshot().messages[1].content,'Answer ')
 assert.equal(session.getSnapshot().busy,true)
 assert.equal(await session.send('duplicate while busy'),false)
 finish.resolve();await first
 for(let i=2;i<=6;i++)await session.send(`Question ${i}`)
 assert.equal(session.getSnapshot().messages.length,12)
 assert.equal(session.getSnapshot().messages[11].content,'Answer continued')
 assert.equal(new Set(commands).size,6);assert.equal(session.getSnapshot().busy,false)
})
test('scope changes clear transcript/history synchronously and discard late data from a transport ignoring abort',async()=>{
 const started=deferred(),finish=deferred();let signal:AbortSignal|undefined
 const session=new AssistantConversationSession(transport(async function*(_,s){
  signal=s;yield{type:'started',conversationId:'private-a',turnId:'one'}
  yield{type:'delta',text:'secret-a'};started.resolve();await finish.promise
  yield{type:'delta',text:'late-secret-a'};yield{type:'completed',sources:[]}
 }),ids())
 session.activate('a');await session.refreshHistory();const send=session.send('A');await started.promise
 session.activate('b');assert.equal(signal?.aborted,true)
 assert.deepEqual(session.getSnapshot().messages,[]);assert.deepEqual(session.getSnapshot().history,[])
 assert.equal(session.getSnapshot().conversationId,null)
 finish.resolve();await send;assert.deepEqual(session.getSnapshot().messages,[])
})
test('late history/load cannot repopulate after logout or a new conversation',async()=>{
 const finish=deferred(),entered=deferred()
 const t=transport(async function*(){})
 t.list=async()=>{entered.resolve();await finish.promise;return[{id:'a',title:'secret',updatedAt:''}]}
 const session=new AssistantConversationSession(t,ids());session.activate('a')
 const read=session.refreshHistory();await entered.promise;session.activate(null);finish.resolve();await read
 assert.deepEqual(session.getSnapshot().history,[]);assert.equal(await session.send('No session'),false)
 const opened=deferred(),loaded=deferred()
 t.load=async id=>{opened.resolve();await loaded.promise;return{id,messages:[{id:'x',role:'user',content:'stale',status:'complete',sources:[]}]}}
 session.activate('b');const load=session.open('old');await opened.promise;session.newConversation();loaded.resolve();await load
 assert.deepEqual(session.getSnapshot().messages,[])
})
test('cancel retires the request even if provider continues; it never automatically retries',async()=>{
 const started=deferred(),finish=deferred();let calls=0
 const session=new AssistantConversationSession(transport(async function*(){
  calls++;yield{type:'started',conversationId:'one',turnId:'one'};yield{type:'delta',text:'partial'}
  started.resolve();await finish.promise;yield{type:'delta',text:' unwanted'};yield{type:'completed',sources:[]}
 }),ids());session.activate('a')
 const send=session.send('Hello');await started.promise;session.cancel()
 assert.equal(session.getSnapshot().messages[1].status,'interrupted')
 finish.resolve();await send;assert.equal(session.getSnapshot().messages[1].content,'partial');assert.equal(calls,1)
})
test('revocation clears all loaded content and disables further sends',async()=>{
 const session=new AssistantConversationSession(transport(async function*(){yield{type:'error',code:'DENIED'}}),ids())
 session.activate('a');await session.refreshHistory();await session.open('saved');await session.send('Question')
 assert.equal(session.getSnapshot().error,'DENIED');assert.equal(session.getSnapshot().active,false)
 assert.equal(await session.send('After revocation'),false)
 assert.deepEqual(session.getSnapshot().messages,[]);assert.deepEqual(session.getSnapshot().history,[])
 // A denied session is re-enabled only by a newly established owner scope.
 session.activate(null);assert.equal(await session.send('No auth'),false)
})
test('missing completion keeps a visibly interrupted answer and does not report success or retry',async()=>{
 let calls=0
 const session=new AssistantConversationSession(transport(async function*(){calls++;yield{type:'started',conversationId:'one',turnId:'one'};yield{type:'delta',text:'partial'}}),ids())
 session.activate('a');await session.send('Question')
 assert.equal(session.getSnapshot().error,'INTERRUPTED');assert.equal(session.getSnapshot().messages[1].status,'interrupted')
 assert.equal(session.getSnapshot().busy,false);assert.equal(calls,1)
})
test('wrong conversation, malformed event ordering and oversized output fail closed',async()=>{
 for(const events of [
  [{type:'delta',text:'unbound'}],
  [{type:'started',conversationId:'one',turnId:'one'},{type:'delta',text:'x'.repeat(64001)}],
  [{type:'started',conversationId:'one',turnId:'one'},{type:'completed',sources:[]},{type:'delta',text:'after complete'}],
 ] as AssistantStreamEvent[][]){
  const session=new AssistantConversationSession(transport(async function*(){yield*events}),ids());session.activate('a');await session.send('Question')
  assert.equal(session.getSnapshot().error,'UNAVAILABLE');assert.equal(session.getSnapshot().busy,false)
 }
 const t=transport(async function*(){});t.load=async()=>({id:'other',messages:[]})
 const session=new AssistantConversationSession(t,ids());session.activate('a');await session.open('expected')
 assert.equal(session.getSnapshot().error,'UNAVAILABLE');assert.deepEqual(session.getSnapshot().messages,[])
})
