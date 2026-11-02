import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {prepareOilResponsesCommand,oilReportSourceCandidate,validateOilTokenReceipt} from '../lib/insights/oil-report-source'
import type {OilEvidenceBundle} from '../lib/insights/oil-report-evidence'
const b=JSON.parse(fs.readFileSync(new URL('./fixtures/oil-d0-report-projection.json',import.meta.url),'utf8')) as OilEvidenceBundle
test('closed Responses preparation has exact model/schema/privacy and no tools, background or credential',()=>{
 const c=prepareOilResponsesCommand(b),v=JSON.parse(c.body)
 assert.equal(c.url,'https://api.openai.com/v1/responses');assert.equal(v.model,'gpt-6.1-sol');assert.equal(v.store,false)
 assert.equal(v.text.format.strict,true);assert.equal(v.max_output_tokens,8000);assert.equal(v.reasoning.effort,'medium')
 for(const k of ['tools','background','previous_response_id','api_key'])assert.equal(k in v,false)
 assert.equal(oilReportSourceCandidate().status,'PROPOSED_NOT_ADMITTED')
 assert.throws(()=>validateOilTokenReceipt(c,{verified:false,count:10,model:v.model,bodySha256:c.bodySha256}))
})
