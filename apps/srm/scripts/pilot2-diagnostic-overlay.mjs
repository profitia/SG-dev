import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
const hash=value=>createHash('sha256').update(value).digest('hex')
export const PILOT2_DIAGNOSTIC_ROUTES={admission:'form_admission',search:'search','report-data':'report_data','krs/lookup':'krs_lookup'}
/** Applied after every existing historical overlay. No old authorization or
 * financial implementation is replaced;only the outer observer gains Request. */
export function diagnosticPilot2(repo,output,proof){
 if(proof.overlay?.stage!=='PRIVATE_OPERATIONS')throw Error('Diagnostics require the complete accepted private runtime')
 if(proof.overlay.diagnosticTelemetry)throw Error('Diagnostic overlay already installed')
 const previous=proof.overlay,known=new Map([...previous.changedFiles,...previous.addedFiles].map(f=>[f.path,f.sha256]))
 const write=(name,contents)=>{
  const file=path.join(output,name)
  if(fs.existsSync(file)){
   if(hash(fs.readFileSync(file))!==(known.get(name)??proof.originalFiles[name]))throw Error('Unreviewed diagnostic overlay input: '+name)
   if(!proof.changedFiles.includes(name))proof.changedFiles.push(name)
  }else{fs.mkdirSync(path.dirname(file),{recursive:true});proof.addedFiles.push(name)}
  fs.writeFileSync(file,contents)
  known.set(name,hash(contents))
 }
 for(const[name,route]of Object.entries(PILOT2_DIAGNOSTIC_ROUTES)){
  const file='apps/srm/app/api/xray/'+name+'/route.ts',prefix='../'.repeat(name.split('/').length+3)
  const source=fs.readFileSync(path.join(output,file),'utf8'),seam='export const POST='
  if(source.split(seam).length!==2)throw Error('Exact POST observer seam changed: '+file)
  write(file,`import {withDiagnosticRequest} from '${prefix}src/server/diagnostic-trace';\n`+source.replace(seam,'const originalDiagnosticPost=')+`\nexport const POST=(request:Request)=>withDiagnosticRequest('${route}',request,()=>originalDiagnosticPost(request));\n`)
 }
 // Observe actual serializer calls in the built SRM closure. The original
 // serializer receives the identical receiver/arguments and owns its errors.
 for(const name of ['krs-name-runtime.ts','pilot2-human-runtime.ts','pilot2-cold-runtime.ts','report-data.ts','report-admission-runtime.ts']){
  const file='apps/srm/src/server/'+name,source=fs.readFileSync(path.join(output,file),'utf8')
  if(source.includes('Response.json('))write(file,"import {diagnosticResponseJson} from './diagnostic-trace';\n"+source.replaceAll('Response.json(','diagnosticResponseJson('))
 }
 const reportFile='apps/srm/src/server/report-data.ts',report=fs.readFileSync(path.join(output,reportFile),'utf8')
 const projectSeam='export function projectReportData('
 if(report.split(projectSeam).length!==2)throw Error('Original report projector observer seam changed')
 write(reportFile,"import {diagnosticRun} from './diagnostic-trace';\n"+report.replace(projectSeam,'function projectReportDataObserved(')+"\nexport const projectReportData:typeof projectReportDataObserved=(...args)=>diagnosticRun('REPORT_PROJECTION',()=>projectReportDataObserved(...args));\n")
 const health='apps/srm/app/api/health/route.ts',healthSource=fs.readFileSync(path.join(output,health),'utf8')
 const healthSeam='environment: process.env.TARGET_ENVIRONMENT ?? "development"'
 if(healthSource.split(healthSeam).length!==2)throw Error('Original health observer seam changed')
 write(health,"import {diagnosticHealth} from '../../../src/server/diagnostic-trace';\nimport {diagnosticAsync,diagnosticSync,diagnosticPhaseSourceDigest} from '@profitia/platform-contracts/diagnostic-phase';\n"+healthSource.replace(healthSeam,healthSeam+", diagnosticTelemetry: await diagnosticHealth(async()=>{await diagnosticAsync('SOURCE_PREPARE',async()=>diagnosticSync('SOURCE_DIGEST',()=>true));return {sourceDigest:await diagnosticPhaseSourceDigest()}})"))
 const sourceFiles=['apps/srm/src/server/diagnostic-trace.ts','apps/srm/src/server/diagnostic-pg.ts']
 proof.overlay={...previous,diagnosticTelemetry:{schema:'srm.diagnostic-trace/1.0',taskId:'SRM-PILOT2-COMPLETE-DIAGNOSTIC-TELEMETRY-20261026',
  intendedServiceId:'srv-dbeh6srrjlhs73fmikrg',defaultEnabledOnlyForExactDevelopmentService:true,disableEnvironmentVariable:'SRM_DIAGNOSTIC_TELEMETRY=off',
  observerOnly:true,changedSecurityOrBusinessContract:false,adapterSha256:hash(fs.readFileSync(new URL('./pilot2-diagnostic-overlay.mjs',import.meta.url))),
  sourceFiles:sourceFiles.map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(repo,name)))}))},
  changedFiles:proof.changedFiles.map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(output,name)))})),
  addedFiles:proof.addedFiles.map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(output,name)))}))}
 return proof
}
