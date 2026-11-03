import test from 'node:test'
import assert from 'node:assert/strict'
import * as Sentry from '@sentry/nextjs'
import {traceOilReport} from '../lib/insights/oil-report-observability'
import {sanitizeSpan} from '../lib/observability/sanitize'
test('existing sanitizer preserves static stage op while dropping private payload, cost and URL data',()=>{
 const v=sanitizeSpan({span_id:'0000000000000001',trace_id:'0'.repeat(32),start_timestamp:0,timestamp:1,op:'sg.oil_report.author',description:'private prompt',data:{prompt:'SECRET',url:'https://private.example',cost:99}})
 assert.equal(v.op,'sg.oil_report.author');assert.equal(v.description,'sg.oil_report.author');assert.deepEqual(v.data,{})
})
test('controlled local telemetry sees all phases; the business action runs exactly once and exceptions remain intact',async()=>{
 const sent:unknown[]=[]
 Sentry.init({dsn:'https://public@example.invalid/1',tracesSampleRate:1,defaultIntegrations:false,transport:()=>({send:async envelope=>{sent.push(envelope);return{statusCode:200}},flush:async()=>true})})
 let calls=0
 await traceOilReport('run',()=>traceOilReport('source',()=>traceOilReport('author',async()=>{calls++;return 1})))
 const error=new Error('private business error')
 await assert.rejects(traceOilReport('validation',async()=>{calls++;throw error}),e=>e===error)
 await traceOilReport('review',async()=>{calls++;return 1});await Sentry.flush(1000)
 assert.equal(calls,3);assert(sent.length>0)
 await Sentry.close(1000)
})
