import assert from 'node:assert/strict'
import test from 'node:test'
import {channel} from 'node:diagnostics_channel'
import {withLocationTelemetry,measureLocation} from './supplier-location-telemetry'
test('location telemetry observes only existing Google transport and separates local stages without content',async()=>{
 const messages:unknown[]=[]
 await withLocationTelemetry(async()=>{
  await measureLocation('databaseRead',async()=>undefined)
  const unrelated={origin:'https://api.mgbi.pl',path:'/sensitive?key=NEVER_LOG'}
  channel('undici:request:create').publish({request:unrelated});channel('undici:request:trailers').publish({request:unrelated})
  const request={origin:'https://maps.googleapis.com',path:'/maps/api/geocode/json?key=NEVER_LOG&address=NEVER_LOG'}
  channel('undici:request:create').publish({request});channel('undici:request:trailers').publish({request});channel('undici:request:trailers').publish({request})
 },value=>messages.push(value))
 assert.equal(messages.length,1)
 const result=messages[0] as {stages:Record<string,{count:number;durationMs:number}>}
 assert.deepEqual(Object.keys(result.stages).sort(),['databaseRead','googleHttp']);assert.equal(result.stages.googleHttp.count,1)
 assert(Object.values(result.stages).every(v=>v.durationMs>=0));assert.doesNotMatch(JSON.stringify(messages),/NEVER_LOG|address|maps.googleapis|position/)
})
test('location telemetry contexts are request local and logging failures cannot alter business results',async()=>{
 const events:unknown[]=[]
 await Promise.all([withLocationTelemetry(()=>measureLocation('cacheStore',async()=>3),v=>events.push(v)),withLocationTelemetry(()=>measureLocation('databaseRead',async()=>4),v=>events.push(v))])
 assert.deepEqual(events.map(v=>Object.keys((v as {stages:object}).stages)).sort(),[['cacheStore'],['databaseRead']])
 assert.equal(await withLocationTelemetry(async()=>7,()=>{throw Error('unavailable')}),7)
 await assert.rejects(withLocationTelemetry(async()=>{throw Error('original')},()=>{throw Error('unavailable')}),/original/)
})
