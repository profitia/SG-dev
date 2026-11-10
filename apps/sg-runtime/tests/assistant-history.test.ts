import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac, randomUUID} from 'node:crypto'
import {createAssistantHistory} from '../lib/assistant/history'

const user=randomUUID(),id=randomUUID(),key='1'.repeat(64),digest='a'.repeat(64)
const context:any={applicationId:'spendguru',environment:'development',actorId:user,actor:{kind:'HUMAN',actorId:user},organisationId:null,operation:'assistant.history.read'}
const binding={applicationId:'spendguru',environment:'development',projectId:'autumn-waterfall-65938876',branchId:'br-dry-hall-b294222f',databaseName:'neondb',runtimeRole:'sg2_assistant_history_runtime',userId:user,schemaDigest:digest}
test('question preview uses the existing signed LOAD and validates the original private-history binding',async()=>{
 const calls:any[]=[]
 const history=createAssistantHistory({commandKey:key,schemaDigest:digest,query:async(sql,params)=>{
  calls.push({sql,params})
  return{rows:[{binding,result:{id,revision:2,turns:[{id:randomUUID(),commandId:randomUUID(),assistantMessageId:randomUUID(),message:'SYNTHETIC first question',response:'',status:'COMPLETE',scopes:[],sources:[],createdAt:'2026-11-10T12:34:56.789Z'}]}}]} as any
 }})
 const result=await history.load(context,id,true)
 assert.equal(result.turns[0].message,'SYNTHETIC first question');assert.equal(result.turns[0].response,'')
 const {sql,params}=calls[0],body=JSON.parse(params[0])
 assert.match(sql,/^\s*SELECT\b/i,'the existing runtime query adapter reads SELECT statements')
 assert.match(sql,/WITH history_reply AS MATERIALIZED/);assert.match(sql,/result->'turns'->0/)
 assert.equal(body.action,'LOAD');assert.equal(body.userId,user);assert.equal(body.conversationId,id)
 assert.equal(params[1],createHmac('sha256',Buffer.from(key,'hex')).update(params[0]).digest('hex'))
 assert.doesNotMatch(sql,/FROM sg2_assistant_history\.(turns|conversations)|INSERT|UPDATE|DELETE|GRANT/i)
 await assert.rejects(()=>history.load({...context,actor:{kind:'HUMAN',actorId:randomUUID()}},id,true),(e:any)=>e.code==='DENIED')
 assert.equal(calls.length,1)
})
