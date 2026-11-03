import fs from 'node:fs'
import path from 'node:path'
import {projectFrozenOilD0} from '../lib/forecast/oil-d0-report-projection'
import {makeOilEvidenceBundle} from '../lib/insights/oil-report-evidence'
import {prepareOilReportOperation} from '../lib/insights/oil-report-operation'
import {renderOilReport} from '../lib/insights/oil-report-renderer'
import type {OilNarrative} from '../lib/insights/oil-report-contract'
import type {OilMarketEvidence} from '../lib/insights/oil-report-evidence'
const [input,output,asOf,marketFile,lastCaseFile]=process.argv.slice(2)
if(!input||!output||!asOf)throw Error('Usage: oil-report-prepare <frozen-D0.json> <new-output-directory> <exact-asOf-UTC>')
if(fs.existsSync(output))throw Error('Immutable output directory already exists')
const market=marketFile?JSON.parse(fs.readFileSync(marketFile,'utf8')) as OilMarketEvidence[]:[]
if(!Array.isArray(market))throw Error('Market evidence must be a verified entry array')
const forecast=projectFrozenOilD0(fs.readFileSync(input),lastCaseFile?fs.readFileSync(lastCaseFile):undefined),bundle=makeOilEvidenceBundle(forecast,market,asOf)
const preparation=prepareOilReportOperation(bundle,marketFile?'B1':'PRODUCT')
// A structural probe only: never save these placeholders as an API report.
const text='Oczekiwanie na wynik.'
const narrative=Object.fromEntries(['statistical','calendar','economy','procurement'].map(k=>[k,[{text,evidenceRefs:[['calendar','economy'].includes(k)?market.find(e=>e.verification==='INDEPENDENTLY_VERIFIED')?.id??'D0':'D0']}]])) as OilNarrative
const rendered=renderOilReport(narrative,bundle)
const fixedCharacters=rendered.characterCount-4*Array.from(text).length
fs.mkdirSync(output,{mode:0o700})
for(const [name,value]of Object.entries({'OIL_D0_REPORT_PROJECTION.json':forecast,'OIL_REPORT_EVIDENCE_PREPARATION.json':bundle,'OIL_REPORT_OPERATION_PREPARATION.json':preparation})){
 fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o444})
}
for(const [name,value]of Object.entries({'OPENAI_RESPONSES_REQUEST_EXACT.json':preparation.command.body,'VISIBLE_LAYOUT_BUDGET.json':JSON.stringify({status:'LAYOUT_PROBE_ONLY_NO_API_REPORT',fixedCharacters,remainingNarrativeCharacters:4000-fixedCharacters,limit:4000,chartCount:rendered.charts.length,nineElements:rendered.metadata.nineElements,originalApiOutputExists:false,inputTokens:'UNVERIFIED'},null,2)+'\n'}))fs.writeFileSync(path.join(output,name),value,{flag:'wx',mode:0o400})
for(const chart of rendered.charts)fs.writeFileSync(path.join(output,chart.name),chart.svg,{flag:'wx',mode:0o400})
console.log(JSON.stringify({status:preparation.status,bodyBytes:preparation.command.bodyBytes,comparisonCount:forecast.comparisonCount,modelCalls:0,marketEvidence:marketFile?'VERIFIED_PUBLIC_EVIDENCE_SUPPLIED':'NOT_COLLECTED_TECHNICAL_PREPARATION_ONLY',output}))
