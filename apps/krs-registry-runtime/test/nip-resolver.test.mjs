import test from 'node:test'
import assert from 'node:assert/strict'
import {createNipResolver} from '../dist/nip-resolver.js'
import {GusError} from '../dist/gus-bir.js'
const nip='5213415549',key='a'.repeat(64),mapping={status:'MATCH',nip,regon:'140790901',krs:'0000271457',register:'P',registerSymbol:'138',checkedAt:new Date().toISOString()}
const active=()=>new AbortController().signal
const make=(patch={})=>{const telemetry=[];return {telemetry,resolver:createNipResolver({gus:async()=>mapping,krs:async()=>({nip,krs:mapping.krs}),telemetry:e=>telemetry.push(e),...patch})}}
test('verified GUS->KRS supplies General once and performs no Financial or fallback call',async()=>{
 const {resolver,telemetry}=make();assert.equal((await resolver.resolve(nip,key,active())).status,'PRIMARY');assert.equal(telemetry[0].reason,'VERIFIED')
})
test('no mapping and explicit provider failures yield typed fallback reasons',async()=>{
 for(const gus of [async()=>({status:'NO_DATA',reason:'GUS_NO_RECORD'}),async()=>{throw new GusError('GUS_HTTP_503')}]){
  const {resolver}=make({gus,krs:async()=>{throw Error('must not fetch KRS')}});assert.equal((await resolver.resolve(nip,key,active())).status,'FALLBACK')
 }
})
test('combined deadline aborts primary and late results cannot become accepted output',async()=>{
 let signal;const {resolver,telemetry}=make({timeoutMs:100,gus:async(_n,_k,s)=>{signal=s;await new Promise(r=>setTimeout(r,150));return mapping},krs:async()=>{throw Error('late KRS must not run')}})
 const result=await resolver.resolve(nip,key,active());assert.deepEqual(result,{status:'FALLBACK',reason:'PRIMARY_DEADLINE'});assert(signal.aborted)
 await new Promise(r=>setTimeout(r,70));assert.equal(telemetry.length,1)
})
test('authority, identity, budgets and unknown failures never authorize paid fallback',async()=>{
 for(const error of [new GusError('BAD_NIP','IDENTITY'),new GusError('SOURCE_DENIED','AUTHORITY'),new Error('LIMIT_EXCEEDED')]){
  const {resolver}=make({gus:async()=>{throw error}});await assert.rejects(resolver.resolve(nip,key,active()),e=>e===error)
 }
 const {resolver}=make({gus:async()=>({...mapping,nip:'7740001454'})});await assert.rejects(resolver.resolve(nip,key,active()),/GUS_NIP_MISMATCH/)
})
test('caller cancellation and invalid NIP stop before provider acquisition',async()=>{
 const {resolver}=make({gus:async()=>{throw Error('no provider')}}),c=new AbortController();c.abort()
 await assert.rejects(resolver.resolve(nip,key,c.signal));await assert.rejects(resolver.resolve('0000000000',key,active()))
})
