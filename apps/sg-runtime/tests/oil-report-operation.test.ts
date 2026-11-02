import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {executeOilReportLive,reviewOilRawApiResponse} from '../lib/insights/oil-report-operation'
import type {OilEvidenceBundle} from '../lib/insights/oil-report-evidence'
import type {OilTrace} from '../lib/insights/oil-report-observability'
test('the unadmitted operation cannot execute a provider request even if a caller supplies credentials or GO-like data',()=>{
 assert.throws(()=>executeOilReportLive(),/LIVE_EXECUTION_NOT_ADMITTED/)
})
test('raw processing preserves original synthetic output; incomplete, refused or wrong-model output never becomes a report',async()=>{
 const bundle=JSON.parse(fs.readFileSync(new URL('./fixtures/oil-d0-report-projection.json',import.meta.url),'utf8')) as OilEvidenceBundle
 const stages:string[]=[],trace:OilTrace=async(phase,work)=>{stages.push(phase);return work()}
 const narrative=Object.fromEntries(['statistical','calendar','economy','procurement'].map(k=>[k,[{text:'Zakupy zależą od warunków kontraktu.',evidenceRefs:['D0']}]]))
 const response={id:'resp_SYNTHETIC',model:'gpt-6.1-sol',status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(narrative)}]}],usage:{input_tokens:10,output_tokens:20}}
 const raw=JSON.stringify(response),ok=await reviewOilRawApiResponse(raw,bundle,'req_SYNTHETIC',trace)
 assert.equal(ok.raw.body,raw);assert.equal(ok.status,'COMPLETED');assert(ok.report);assert(stages.includes('validation'));assert(stages.includes('review'))
 for(const patch of [{status:'incomplete'},{status:'failed'},{model:'gpt-5.6-luna'},{output:[{type:'message',content:[{type:'refusal',refusal:'SYNTHETIC'}]}]}]){
  const r=await reviewOilRawApiResponse(JSON.stringify({...response,...patch}),bundle,null,trace);assert.equal(r.report,null);assert.equal(r.reportedCostUSD,'UNKNOWN')
 }
 const altered=structuredClone(response);altered.output[0].content[0].text='{"invented":999}'
 const rejected=await reviewOilRawApiResponse(JSON.stringify(altered),bundle,null,trace);assert.equal(rejected.status,'OUTPUT_REJECTED');assert.equal(rejected.report,null)
})
