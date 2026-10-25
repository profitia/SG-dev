import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {replaceRegistrySeam as replace} from './pilot2-registry-overlay.mjs'
import {instrumentPilot2Database} from './pilot2-instrumentation.mjs'
const hash=value=>createHash('sha256').update(value).digest('hex')

/** Keep the original financial projector and report controller. The only new
 * seam is an explicit public-data input; all private SQL remains bound to the
 * admitted HUMAN organisation in the authoritative E1 database. */
export function scannerPilot2(repo,output,proof){
 if(proof.overlay?.stage!=='FORM_ADMISSION')throw Error('Scanner requires the separately measured form stage')
 const previous=proof.overlay,known=new Map([...previous.changedFiles,...previous.addedFiles].map(f=>[f.path,f.sha256]))
 const write=(name,contents)=>{
  const file=path.join(output,name)
  if(fs.existsSync(file)){
   if(hash(fs.readFileSync(file))!==(known.get(name)??proof.originalFiles[name]))throw Error('Unreviewed Scanner input: '+name)
   if(!proof.changedFiles.includes(name))proof.changedFiles.push(name)
  }else{fs.mkdirSync(path.dirname(file),{recursive:true});proof.addedFiles.push(name)}
  fs.writeFileSync(file,contents)
 }
 const patch=(name,action)=>write(name,action(fs.readFileSync(path.join(output,name),'utf8')))
 for(const name of['pilot2-report-projection.ts','report-output.ts'])write('apps/srm/src/server/'+name,fs.readFileSync(path.join(repo,'apps/srm/src/server/'+name)))
 write('apps/srm/src/server/db.ts',instrumentPilot2Database(fs.readFileSync(path.join(repo,'apps/srm/src/server/db.ts'),'utf8')))
 const source=fs.readFileSync(path.join(repo,'apps/srm/src/server/report-data.ts'),'utf8')
 const originalSignature='export async function readReportData(organizationId: string, selection: ReportSelection, now = new Date(), pool?: DatabasePool): Promise<SupplierReportData> {'
 const newSignature=originalSignature.replace('pool?: DatabasePool)', 'pool?: DatabasePool, sharedFinancial?: SharedFinancialReportPort)')
 const definitions=source.slice(source.indexOf('/** The same private source selection,'),source.indexOf(newSignature))
 const newQuery=source.slice(source.indexOf('    const parameters = [selection.nip,'),source.indexOf('    const report = projectReportData(selection, { ...row, scannerTenantScope:'))
 if(!definitions.startsWith('/** The same private source selection,')||!newQuery.startsWith('    const parameters = [selection.nip,')||newQuery.length>2000)throw Error('Reviewed report source seam changed')
 patch('apps/srm/src/server/report-data.ts',value=>{
  value=replace(value,originalSignature,definitions+newSignature)
  return replace(value,'    const result = await client.query<ReportReadRow>(REPORT_DATA_SQL, [selection.nip, organizationId, selection.entityType, FINANCIAL_INDICATOR_FORMULA_VERSION]);\n    const row = result.rows[0];\n',newQuery)
 })
 patch('apps/srm/app/api/xray/report-data/route.ts',value=>replace(
  replace(value,"from '../../../../src/server/pilot2-human-runtime'","from '../../../../src/server/pilot2-report-projection'"),
  'import {getPilot2HumanRuntime}', 'import {getPilot2ScannerRuntime}').replace('getPilot2HumanRuntime().report','getPilot2ScannerRuntime().report'))
 patch('apps/srm/app/api/health/route.ts',value=>replace(
  'import {getPilot2ScannerRuntime} from "../../../src/server/pilot2-report-projection";\n'+value,
  'getPilot2HumanRuntime()}','getPilot2HumanRuntime();getPilot2ScannerRuntime()}'))
 proof.overlay={...previous,stage:'SCANNER',previousStage:'FORM_ADMISSION',
  adapterSha256:hash(fs.readFileSync(new URL('./pilot2-scanner-overlay.mjs',import.meta.url))),
  privateReportEffectsStage:'COMMON_ADMITTED_HUMAN_ROOT_EXISTING_REPORT_ENGINE',
  privateDocumentsAuthority:'EXISTING_E1_ORGANISATION_NO_CLONED_ARCHIVE',
  transactionAdapter:'EXISTING_CANONICAL_NATIVE_BINDING_NO_NEW_AUTHORITY',
  coldAcquisitionStage:'NOT_YET_ADOPTED_FAIL_CLOSED',postClickClerkReads:false,
  changedFiles:proof.changedFiles.map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(output,name)))})),
  addedFiles:proof.addedFiles.map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(output,name)))}))}
 return proof
}
