import fs from 'node:fs'
import path from 'node:path'
import {projectFrozenOilD0} from '../lib/forecast/oil-d0-report-projection'
import {makeOilEvidenceBundle} from '../lib/insights/oil-report-evidence'
import {prepareOilReportOperation} from '../lib/insights/oil-report-operation'
const [input,output,asOf]=process.argv.slice(2)
if(!input||!output||!asOf)throw Error('Usage: oil-report-prepare <frozen-D0.json> <new-output-directory> <exact-asOf-UTC>')
if(fs.existsSync(output))throw Error('Immutable output directory already exists')
const forecast=projectFrozenOilD0(fs.readFileSync(input)),bundle=makeOilEvidenceBundle(forecast,[],asOf)
const preparation=prepareOilReportOperation(bundle)
fs.mkdirSync(output,{recursive:true})
for(const [name,value]of Object.entries({'OIL_D0_REPORT_PROJECTION.json':forecast,'OIL_REPORT_EVIDENCE_PREPARATION.json':bundle,'OIL_REPORT_OPERATION_PREPARATION.json':preparation})){
 fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o444})
}
console.log(JSON.stringify({status:preparation.status,bodyBytes:preparation.command.bodyBytes,comparisonCount:forecast.comparisonCount,modelCalls:0,marketEvidence:'NOT_COLLECTED_TECHNICAL_PREPARATION_ONLY',output}))
