// Optional, operation-scoped provider execution policy. This is never E1 authority.
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'

export const MODEL_EXECUTION_CONTRACT=Object.freeze({id:'profitia.model-execution',version:'1.0.0',currency:'USD'})
export const modelExecutionSchemaUrl=new URL('../migrations/access/028-model-execution.sql',import.meta.url).href
export function modelExecutionSchemaDigest(){return createHash('sha256').update(readFileSync(new URL(modelExecutionSchemaUrl)))
 .update(readFileSync(new URL('../migrations/access/029-model-execution-long-report.sql',import.meta.url))).digest('hex')}
const invalid=()=>{throw new TypeError('Explicit operation-scoped model policy required')}
const keys='maximumBodyBytes,maximumInputTokens,maximumOutputTokens,model,profileId,reservationMicroUsd,schemaDigest,timeoutMs'
export function captureModelExecution(value){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join(',')!==keys
  ||Reflect.ownKeys(value).length!==Object.keys(value).length||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!('value'in d))
  ||!/^[-a-zA-Z0-9._:]{1,128}$/.test(value.profileId??'')||value.model!=='gpt-6.1-sol'
  ||!/^[a-f0-9]{64}$/.test(value.schemaDigest??'')
  ||!Number.isSafeInteger(value.maximumInputTokens)||value.maximumInputTokens<1||value.maximumInputTokens>15000
  ||!Number.isSafeInteger(value.maximumOutputTokens)||value.maximumOutputTokens<1||value.maximumOutputTokens>32000
  ||!Number.isSafeInteger(value.maximumBodyBytes)||value.maximumBodyBytes<1||value.maximumBodyBytes>65536
  ||!Number.isSafeInteger(value.reservationMicroUsd)||value.reservationMicroUsd<1||value.reservationMicroUsd>5000000
  ||![120000,600000].includes(value.timeoutMs))invalid()
 return Object.freeze({...value})
}
export function assertModelDescriptor(policy,descriptor){
 if(descriptor?.modelSchemaVersion!=='1.0.0'||descriptor.modelSchemaDigest!==policy.schemaDigest
  ||!/^\d+$/.test(descriptor.modelPolicyVersion??'')||Number(descriptor.modelPolicyVersion)<1
  ||descriptor.modelProfileId!==policy.profileId||descriptor.model!==policy.model
  ||descriptor.modelMaximumInputTokens!==policy.maximumInputTokens||descriptor.modelMaximumOutputTokens!==policy.maximumOutputTokens
  ||descriptor.modelMaximumBodyBytes!==policy.maximumBodyBytes||descriptor.modelReservationMicroUsd!==policy.reservationMicroUsd
  ||descriptor.timeoutMs!==policy.timeoutMs||descriptor.modelMaximumAttempts!==1
  ||!Number.isFinite(Date.parse(descriptor.modelExpiresAt))
  ||descriptor.modelRequestIdHeader!=='x-request-id'||descriptor.modelClientRequestIdHeader!=='x-client-request-id')invalid()
}
export function assertModelRequest(policy,body){
 if(typeof body!=='string'||Buffer.byteLength(body)>policy.maximumBodyBytes)invalid()
 let v;try{v=JSON.parse(body)}catch{invalid()}
 if(!v||Object.getPrototypeOf(v)!==Object.prototype
  ||Object.keys(v).sort().join(',')!=='input,max_output_tokens,model,reasoning,service_tier,store,text'
  ||v.model!==policy.model||v.store!==false||v.max_output_tokens!==policy.maximumOutputTokens||v.service_tier!=='default'
  ||!['medium','high'].some(effort=>JSON.stringify(v.reasoning)===JSON.stringify({effort}))
  ||!Array.isArray(v.input)||!v.input.length||v.input.length>2
  ||v.input.some(m=>!m||Object.keys(m).sort().join(',')!=='content,role'||!['developer','user'].includes(m.role)||typeof m.content!=='string')
  ||!v.text||Object.keys(v.text).join(',')!=='format'||v.text.format?.type!=='json_schema'||v.text.format.strict!==true)invalid()
 return v
}
/** Conservative standard USD cost: unknown cache input is costed at cache-write
 * rate, not assumed free. Integer arithmetic in tenths of a micro-dollar. */
export function standardModelCostMicroUsd(usage){
 if(!usage||!['input_tokens','output_tokens'].every(k=>Number.isSafeInteger(usage[k])&&usage[k]>=0))return null
 const cached=usage.input_tokens_details?.cached_tokens??0
 if(!Number.isSafeInteger(cached)||cached<0||cached>usage.input_tokens)return null
 const units=(usage.input_tokens-cached)*25+cached+usage.output_tokens*100
 return Number.isSafeInteger(units)?Math.ceil(units/10):null
}
export function modelResponseObservation(response){
 if(!response||Object.getPrototypeOf(response)!==Object.prototype)return Object.freeze({status:'UNVERIFIED',usage:null,costMicroUsd:null})
 const refused=Array.isArray(response.output)&&response.output.some(o=>o?.type==='message'&&Array.isArray(o.content)&&o.content.some(c=>c?.type==='refusal'))
 const status=refused?'REFUSED':({completed:'COMPLETED',incomplete:'INCOMPLETE',failed:'FAILED'})[response.status]??'UNVERIFIED'
 const cost=standardModelCostMicroUsd(response.usage)
 return Object.freeze({status,responseId:typeof response.id==='string'?response.id:null,model:typeof response.model==='string'?response.model:null,
  usage:cost===null?null:structuredClone(response.usage),costMicroUsd:cost})
}
