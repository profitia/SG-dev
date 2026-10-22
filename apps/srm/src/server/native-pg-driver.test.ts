import test from 'node:test'
import assert from 'node:assert/strict'
import type pg from 'pg'
import {createSrmNativePgDriver} from './native-pg-driver'

test('native query diagnostics preserve the original failure without exposing parameters or error messages',async()=>{
 const secret='synthetic-private-credential'
 const failure=Object.assign(new Error(secret),{code:'42501'})
 const events:unknown[][]=[];const original=console.error
 console.error=(...args:unknown[])=>{events.push(args)}
 try{
  const audit={query:async()=>{throw failure}} as unknown as pg.Pool
  const driver=createSrmNativePgDriver({} as pg.Pool,audit)
  await assert.rejects(driver.independentQuery('SELECT arbitrary_private_data($1)',[secret]),error=>error===failure)
  assert.deepEqual(events,[['Native SQL query failed',{kind:'NATIVE_SQL',code:'42501'}]])
  assert.equal(JSON.stringify(events).includes(secret),false)
 }finally{console.error=original}
})

test('future service proof diagnostics neither rewrite the proof nor admit it',async()=>{
 const descriptor={expiresAt:new Date(Date.now()+60000).toISOString(),proofRef:'synthetic-proof'}
 const events:unknown[][]=[];const original=console.warn
 console.warn=(...args:unknown[])=>{events.push(args)}
 try{
  const audit={query:async()=>({rows:[{descriptor}]})} as unknown as pg.Pool
  const driver=createSrmNativePgDriver({} as pg.Pool,audit)
  const result=await driver.independentQuery('SELECT profitia_services.runtime_descriptor() AS descriptor')
  assert.equal(result.rows[0].descriptor,descriptor)
  assert.equal(events.length,1)
  assert.equal(events[0][0],'E1 service proof starts outside local clock window')
 }finally{console.warn=original}
})
