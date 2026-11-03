import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {executeOilReportLive,reviewOilRawApiResponse,executeOilOwnerEvaluation,validateOilEvaluationGo} from '../lib/insights/oil-report-operation'
import type {OilEvaluationSource} from '../lib/insights/oil-report-source'
import type {OilEvidenceBundle} from '../lib/insights/oil-report-evidence'
import type {OilTrace} from '../lib/insights/oil-report-observability'
test('the unadmitted operation cannot execute a provider request even if a caller supplies credentials or GO-like data',()=>{
 assert.throws(()=>executeOilReportLive(),/LIVE_EXECUTION_NOT_ADMITTED/)
})
test('B1 acceptance, serialized GO-like fields and a forged transport never become Source authority',async()=>{
 let sends=0
 const fake={execute:async()=>{sends++;throw Error('must never execute')}} as unknown as OilEvaluationSource
 const bytes=Buffer.from(JSON.stringify({decision:'GO_ONE_ATTEMPT',admissionSha256:'170f41c2d3b14ae87a8c97b2c7268eb8d2fab3817cc3fdae9050e73670c45f8e'}))
 assert.throws(()=>validateOilEvaluationGo(bytes,'0'.repeat(64),fake),/SOURCE_NOT_BOUND/)
 await assert.rejects(executeOilOwnerEvaluation(fake,bytes,'0'.repeat(64),'/private/tmp/oil-b1-must-not-be-created'),/SOURCE_NOT_BOUND/)
 assert.equal(sends,0);assert.equal(fs.existsSync('/private/tmp/oil-b1-must-not-be-created'),false)
})
test('raw processing preserves original synthetic output; incomplete, refused or wrong-model output never becomes a report',async()=>{
 const bundle=JSON.parse(fs.readFileSync(new URL('./fixtures/oil-d0-report-projection.json',import.meta.url),'utf8')) as OilEvidenceBundle
 const stages:string[]=[],trace:OilTrace=async(phase,work)=>{stages.push(phase);return work()}
 const narrative=Object.fromEntries(['statistical','calendar','economy','procurement'].map(k=>[k,[{text:'Zakupy zależą od warunków kontraktu.',evidenceRefs:['D0']}]]))
 const response={id:'resp_SYNTHETIC',model:'gpt-6.1-sol',status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(narrative)}]}],usage:{input_tokens:10,output_tokens:20}}
 const raw=JSON.stringify(response),ok=await reviewOilRawApiResponse(raw,bundle,'req_SYNTHETIC',trace)
 assert.equal(ok.raw.body,raw);assert.equal(ok.status,'COMPLETED');assert(ok.report);assert(stages.includes('validation'));assert(stages.includes('review'))
 const httpError=await reviewOilRawApiResponse(raw,bundle,null,trace,429)
 assert.equal(httpError.status,'FAILED');assert.equal(httpError.report,null);assert.equal(httpError.raw.body,raw)
 for(const patch of [{status:'incomplete'},{status:'failed'},{model:'gpt-5.6-luna'},{output:[{type:'message',content:[{type:'refusal',refusal:'SYNTHETIC'}]}]}]){
  const r=await reviewOilRawApiResponse(JSON.stringify({...response,...patch}),bundle,null,trace);assert.equal(r.report,null);assert.equal(r.reportedCostUSD,'UNKNOWN')
 }
 const altered=structuredClone(response);altered.output[0].content[0].text='{"invented":999}'
 const rejected=await reviewOilRawApiResponse(JSON.stringify(altered),bundle,null,trace);assert.equal(rejected.status,'OUTPUT_REJECTED');assert.equal(rejected.report,null)
})
