import test from 'node:test'
import assert from 'node:assert/strict'
import {boundedDatabaseLease} from '../src/database-lease.mjs'
const time=Date.parse('2026-10-30T01:00:00Z'),d=ms=>({expiresAt:new Date(ms).toISOString(),proofRef:'unchanged-current-proof'})
test('database 1ms ahead is accepted with a strictly shorter local lifetime',()=>{
 const raw=d(time+30001),r=boundedDatabaseLease(raw,time+1,time,time+1)
 assert(r);assert.equal(Date.parse(r.expiresAt),time+30000);assert.equal(raw.expiresAt,d(time+30001).expiresAt)
 assert.equal(r.proofRef,raw.proofRef)
})
test('full SQL round trip consumes the local lease instead of extending it',()=>{
 const r=boundedDatabaseLease(d(time+30000),time,time-20,time+10)
 assert.equal(Date.parse(r.expiresAt),time+29980)
})
for(const [name,descriptor,observed,started,received] of [
 ['expiry beyond database 30s',d(time+30001),time,time,time],
 ['expired database lease',d(time),time,time,time],
 ['expired local absolute lease',d(time+5),time,time,time+5],
 ['query consumed lease',d(time+100),time,time-200,time],
 ['missing database time',d(time+30000),undefined,time,time],
 ['untrusted database time',d(time+30000),'Infinity',time,time],
 ['clock divergence above bound',d(time+31001),time+1001,time,time],
 ['backwards local clock',d(time+30000),time,time+1,time],
 ['invalid descriptor',null,time,time,time],
 ['invalid local time',d(time+30000),time,NaN,time]
])test(name+' fails closed',()=>assert.equal(boundedDatabaseLease(descriptor,observed,started,received),null))
test('a shorter original binding expiry is preserved',()=>{
 const r=boundedDatabaseLease(d(time+5000),String(time),time-4,time+2)
 assert.equal(Date.parse(r.expiresAt),time+4996)
})
