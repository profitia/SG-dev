/** AppShell presentation boundary. The admitted server owns identity, context,
 * persistence and billing; this controller never treats a browser scope as authority. */
export type AssistantSource = Readonly<{id:string;label:string;asOf:string|null;status:'OK'|'EMPTY'|'PARTIAL'|'DENIED'|'UNAVAILABLE'|'STALE'}>
export type AssistantMessage = Readonly<{id:string;role:'user'|'assistant';content:string;status:'complete'|'streaming'|'interrupted'|'failed';sources:readonly AssistantSource[]}>
export type AssistantHistoryEntry = Readonly<{id:string;title:string;updatedAt:string}>
export type AssistantConversationError = 'AUTH_REQUIRED'|'DENIED'|'LIMIT_EXCEEDED'|'UNAVAILABLE'|'INTERRUPTED'|'CONTEXT_CHANGED'
export type AssistantConversationSnapshot = Readonly<{
 active:boolean;scopeRevision:number;
 conversationId:string|null;messages:readonly AssistantMessage[];history:readonly AssistantHistoryEntry[];
 busy:boolean;loadingHistory:boolean;error:AssistantConversationError|null;draft:string
}>
export type AssistantStreamEvent =
 |{type:'started';conversationId:string;turnId:string}
 |{type:'delta';text:string}
 |{type:'completed';sources:readonly AssistantSource[]}
 |{type:'error';code:AssistantConversationError}
export interface AssistantConversationTransport {
 list(signal:AbortSignal):Promise<readonly AssistantHistoryEntry[]>
 load(id:string,signal:AbortSignal):Promise<{id:string;messages:readonly AssistantMessage[]}>
 remove?(id:string,signal:AbortSignal):Promise<void>
 send(input:{conversationId:string|null;commandId:string;message:string},signal:AbortSignal):AsyncIterable<AssistantStreamEvent>
}
const initial=():AssistantConversationSnapshot=>({active:false,scopeRevision:0,conversationId:null,messages:[],history:[],busy:false,loadingHistory:false,error:null,draft:''})
const failures=new Set<AssistantConversationError>(['AUTH_REQUIRED','DENIED','LIMIT_EXCEEDED','UNAVAILABLE','INTERRUPTED','CONTEXT_CHANGED'])
function errorCode(error:unknown):AssistantConversationError {
 const code=error&&typeof error==='object'&&'code'in error?error.code:null
 return failures.has(code as AssistantConversationError)?code as AssistantConversationError:'UNAVAILABLE'
}

/** No automatic paid retry. Every explicit send has one stable command ID. */
export class AssistantConversationSession {
 private snapshot=initial()
 private readonly listeners=new Set<()=>void>()
 private scope:string|null=null
 private generation=0
 private scopeRevision=0
 private operation:AbortController|null=null
 private historyOperation:AbortController|null=null
 constructor(private readonly transport:AssistantConversationTransport,private readonly newId=()=>crypto.randomUUID()){}
 getSnapshot=()=>this.snapshot
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}}
 private publish(patch:Partial<AssistantConversationSnapshot>){this.snapshot={...this.snapshot,...patch};this.listeners.forEach(fn=>fn())}
 setDraft=(draft:string)=>{if(this.snapshot.active&&draft.length<=8000)this.publish({draft})}
 /** A view change retires old streaming work while keeping account history. */
 changeView=()=>{this.cancel()}
 /** The owner calls this synchronously when account/session/org/view changes. */
 activate(scope:string|null){
  if(this.scope===scope)return
  this.generation++;this.operation?.abort();this.historyOperation?.abort()
  this.operation=null;this.historyOperation=null;this.scope=scope
  this.snapshot={...initial(),active:scope!==null,scopeRevision:++this.scopeRevision};this.listeners.forEach(fn=>fn())
 }
 private fail(code:AssistantConversationError){
  if(code==='CONTEXT_CHANGED'){
   this.generation++;this.operation?.abort();this.historyOperation?.abort()
   this.publish({...initial(),active:!!this.scope,scopeRevision:++this.scopeRevision,error:code});return
  }
  if(code==='AUTH_REQUIRED'||code==='DENIED'){
   this.generation++;this.operation?.abort();this.historyOperation?.abort()
   this.publish({...initial(),scopeRevision:++this.scopeRevision,error:code})
  }else this.publish({busy:false,error:code})
 }
 cancel=()=>{
  this.generation++;this.operation?.abort();this.operation=null
  this.publish({busy:false,messages:this.snapshot.messages.map(m=>m.status==='streaming'?{...m,status:'interrupted'}:m),error:null})
 }
 newConversation=()=>{this.cancel();this.publish({conversationId:null,messages:[],error:null,draft:''})}
 refreshHistory=async()=>{
  if(!this.scope||!this.snapshot.active)return
  this.historyOperation?.abort();const operation=new AbortController(),scope=this.scope
  this.historyOperation=operation;this.publish({loadingHistory:true})
  try{
   const history=await this.transport.list(operation.signal)
   if(!operation.signal.aborted&&this.scope===scope)this.publish({history,loadingHistory:false})
  }catch(error){if(!operation.signal.aborted&&this.scope===scope){this.publish({loadingHistory:false});this.fail(errorCode(error))}}
 }
 deleteConversation=async(id:string)=>{
  if(!this.scope||!this.snapshot.active||this.snapshot.busy||!this.transport.remove)return
  const generation=++this.generation,operation=new AbortController()
  this.operation?.abort();this.operation=operation;this.publish({busy:true,error:null})
  try{
   await this.transport.remove(id,operation.signal)
   if(operation.signal.aborted||generation!==this.generation)return
   this.publish({busy:false,history:this.snapshot.history.filter(entry=>entry.id!==id),
    ...(this.snapshot.conversationId===id?{conversationId:null,messages:[],draft:''}:{})})
  }catch(error){if(!operation.signal.aborted&&generation===this.generation)this.fail(errorCode(error))}
 }
 open=async(id:string)=>{
  if(!this.scope||!this.snapshot.active||this.snapshot.busy)return
  const generation=++this.generation,operation=new AbortController()
  this.operation?.abort();this.operation=operation;this.publish({busy:true,error:null,messages:[],conversationId:null,draft:''})
  try{
   const conversation=await this.transport.load(id,operation.signal)
   if(operation.signal.aborted||generation!==this.generation)return
   if(conversation.id!==id)throw Error('Invalid conversation')
   this.publish({conversationId:id,messages:conversation.messages,busy:false})
  }catch(error){if(!operation.signal.aborted&&generation===this.generation)this.fail(errorCode(error))}
 }
 send=async(message:string)=>{
  message=message.trim()
  if(!this.scope||!this.snapshot.active||this.snapshot.busy||!message||message.length>8000)return false
  const generation=++this.generation,operation=new AbortController(),commandId=this.newId()
  this.operation?.abort();this.operation=operation
  const conversationId=this.snapshot.conversationId,assistantId=this.newId()
  this.publish({busy:true,error:null,draft:'',messages:[...this.snapshot.messages,
   {id:commandId,role:'user',content:message,status:'complete',sources:[]},
   {id:assistantId,role:'assistant',content:'',status:'streaming',sources:[]}]})
  let started=false,completed=false
  const update=(patch:Partial<AssistantMessage>)=>this.publish({messages:this.snapshot.messages.map(m=>m.id===assistantId?{...m,...patch}:m)})
  try{
   for await(const event of this.transport.send({conversationId,commandId,message},operation.signal)){
    if(operation.signal.aborted||generation!==this.generation)return true
    if(completed)throw Error('Event after completion')
    if(event.type==='error'){update({status:'failed'});this.fail(event.code);return true}
    if(event.type==='started'){
     if(started||!event.turnId||!event.conversationId||conversationId&&event.conversationId!==conversationId)throw Error('Invalid stream')
     started=true;this.publish({conversationId:event.conversationId})
    }else if(!started)throw Error('Missing stream start')
    else if(event.type==='delta'){
     const current=this.snapshot.messages.find(m=>m.id===assistantId)!.content
     if(current.length+event.text.length>64000)throw Error('Response too large')
     update({content:current+event.text})
    }else if(event.type==='completed'){
     update({status:'complete',sources:event.sources});completed=true
    }
   }
   if(operation.signal.aborted||generation!==this.generation)return true
   if(!completed){update({status:'interrupted'});this.fail('INTERRUPTED')}
   else this.publish({busy:false})
  }catch(error){
   if(!operation.signal.aborted&&generation===this.generation){
    const code=errorCode(error)
    if(!started&&code==='LIMIT_EXCEEDED')this.publish({messages:this.snapshot.messages.filter(m=>m.id!==assistantId)})
    else update({status:'failed'})
    this.fail(code)
   }
  }finally{
   if(generation===this.generation){this.operation=null;if(!completed)operation.abort()}
  }
  return true
 }
}
