import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {replaceRegistrySeam as replace} from './pilot2-registry-overlay.mjs'
const hash=value=>createHash('sha256').update(value).digest('hex')
export const PILOT2_COLD_SOURCE_FILES=[
 "apps/srm/deployment/krs-live-pilot.json",
 "apps/srm/deployment/krs-name-pilot-targets.json",
 "apps/srm/deployment/krs-nip-development.json",
 "apps/srm/deployment/mgbi-unmetered-policy.json",
 "apps/srm/deployment/pilot2-human-targets.json",
 "apps/srm/deployment/pilot2-registry-targets.json",
 "apps/srm/deployment/private-runtime-targets.json",
 "apps/srm/deployment/supplier-location-targets.json",
 "apps/srm/deployment/supplier-native-targets.json",
 "apps/srm/operation-integration.json",
 "apps/srm/src/demo/fixture.ts",
 "apps/srm/src/server/company-activity.ts",
 "apps/srm/src/server/company-continuity.ts",
 "apps/srm/src/server/company-general-cache.ts",
 "apps/srm/src/server/company-pkd.ts",
 "apps/srm/src/server/corporate-knowledge.ts",
 "apps/srm/src/server/corporate-source-shape.json",
 "apps/srm/src/server/corporate-source-store.ts",
 "apps/srm/src/server/demo-auth.ts",
 "apps/srm/src/server/financial-documents.ts",
 "apps/srm/src/server/financial-excel-runtime.ts",
 "apps/srm/src/server/financial-excel.ts",
 "apps/srm/src/server/financial-indicators.ts",
 "apps/srm/src/server/financial-revisions.ts",
 "apps/srm/src/server/financial-schema-labels.json",
 "apps/srm/src/server/financial-schema-labels.ts",
 "apps/srm/src/server/financial-unit.ts",
 "apps/srm/src/server/identity-runtime.ts",
 "apps/srm/src/server/integrations/ceidg.ts",
 "apps/srm/src/server/jdg-lookup.ts",
 "apps/srm/src/server/krs-continuity.ts",
 "apps/srm/src/server/krs-financial.ts",
 "apps/srm/src/server/krs-general.ts",
 "apps/srm/src/server/krs-name-runtime.ts",
 "apps/srm/src/server/krs-name-search.ts",
 "apps/srm/src/server/krs-native-financial.ts",
 "apps/srm/src/server/krs-native-runtime.ts",
 "apps/srm/src/server/krs-nip-runtime.ts",
 "apps/srm/src/server/kys-cache.ts",
 "apps/srm/src/server/kys-pdf-access.ts",
 "apps/srm/src/server/kys-pdf.ts",
 "apps/srm/src/server/lookup-diagnostics.ts",
 "apps/srm/src/server/mgbi-archive.ts",
 "apps/srm/src/server/mgbi-financial.ts",
 "apps/srm/src/server/mgbi-general.ts",
 "apps/srm/src/server/msr-financial.ts",
 "apps/srm/src/server/msr-parser.ts",
 "apps/srm/src/server/msr-repository.ts",
 "apps/srm/src/server/msr-source.ts",
 "apps/srm/src/server/native-pg-driver.ts",
 "apps/srm/src/server/operation-report-data.ts",
 "apps/srm/src/server/pesel-reveal.ts",
 "apps/srm/src/server/pilot2-cold-runtime.ts",
 "apps/srm/src/server/pilot2-private-runtime.ts",
 "apps/srm/src/server/supplier-acquisition-http.ts",
 "apps/srm/src/server/pilot2-human-runtime.ts",
 "apps/srm/src/server/pilot2-public-catalog.ts",
 "apps/srm/src/server/pilot2-registry.ts",
 "apps/srm/src/server/pilot2-report-projection.ts",
 "apps/srm/src/server/private-operation-host.ts",
 "apps/srm/src/server/private-runtime.ts",
 "apps/srm/src/server/provider-source-transport.ts",
 "apps/srm/src/server/registry-search.ts",
 "apps/srm/src/server/report-admission-runtime.ts",
 "apps/srm/src/server/report-output.ts",
 "apps/srm/src/server/request-origin.ts",
 "apps/srm/src/server/safe-public-fetch.ts",
 "apps/srm/src/server/shared-catalog.ts",
 "apps/srm/src/server/shared-financial-read.ts",
 "apps/srm/src/server/supplier-api-composition.ts",
 "apps/srm/src/server/supplier-company-read.ts",
 "apps/srm/src/server/supplier-location-admission.ts",
 "apps/srm/src/server/supplier-location-source.ts",
 "apps/srm/src/server/supplier-location-store.ts",
 "apps/srm/src/server/supplier-location-sync.ts",
 "apps/srm/src/server/supplier-locations.ts",
 "apps/srm/src/server/supplier-native-company.ts",
 "apps/srm/src/server/supplier-native-runtime.ts",
 "apps/srm/src/server/supplier-native-sensitive-store.ts",
 "apps/srm/src/server/supplier-native-sensitive.ts",
 "apps/srm/src/server/supplier-native-web.ts",
 "apps/srm/src/server/supplier-native-work-store.ts",
 "apps/srm/src/server/supplier-request-continuation.ts",
 "apps/srm/src/server/supplier-request-host.ts",
 "apps/srm/src/server/supplier-request-operation.ts",
 "apps/srm/src/server/supplier-request-work.ts",
 "apps/srm/src/server/supplier-sensitive-operation.ts",
 "apps/srm/src/server/supplier-source-link.ts",
 "apps/srm/src/server/supplier-source-request.ts",
 "apps/srm/src/server/supplier-telemetry.ts",
 "apps/srm/src/server/supplier-web-operation.ts",
 "apps/srm/src/server/supplier-web-store.ts",
 "apps/srm/src/server/vercly-krs.ts",
 "apps/srm/src/server/vercly-kys.ts",
 "apps/srm/src/server/website-discovery.ts",
 "apps/srm/src/server/xray-lookup.ts",
 "apps/srm/src/server/xray-repository.ts"
]

/** Adopt the existing complete native acquisition closure after its measured
 * cached counterpart. Existing formulas, Scanner and page layout stay intact.
 * Private state is selected only by canonical E1; no clone's private login is
 * used by these entrances. No Maps route is opened or location sync enabled. */
export function coldPilot2(repo,output,proof){
 if(proof.overlay?.stage!=='SCANNER')throw Error('Cold acquisition requires the measured Scanner stage')
 const previous=proof.overlay,known=new Map([...previous.changedFiles,...previous.addedFiles].map(f=>[f.path,f.sha256]))
 const write=(name,contents)=>{
  const file=path.join(output,name)
  if(fs.existsSync(file)){
   if(hash(fs.readFileSync(file))!==(known.get(name)??proof.originalFiles[name]))throw Error('Unreviewed native acquisition input: '+name)
   if(!proof.changedFiles.includes(name))proof.changedFiles.push(name)
  }else{fs.mkdirSync(path.dirname(file),{recursive:true});proof.addedFiles.push(name)}
  fs.writeFileSync(file,contents)
 }
 for(const name of PILOT2_COLD_SOURCE_FILES)write(name,fs.readFileSync(path.join(repo,name)))
 // The existing HTTP controller owns KRS pending continuations and stable
 // idempotency keys. It contains no financial calculation or identity policy.
 write('apps/srm/src/modules/xray/report-controller.ts',fs.readFileSync(path.join(repo,'apps/srm/src/modules/xray/report-controller.ts')))
 const transport='apps/srm/src/modules/xray/krs-session-transport.ts'
 write(transport,replace(fs.readFileSync(path.join(output,transport),'utf8'),
  'const paths=new Set([',"const paths=new Set(['/api/xray/financial-excel',"))
 const page='apps/srm/app/page.tsx'
 write(page,replace(fs.readFileSync(path.join(output,page),'utf8'),
  'const response = await fetch("/api/xray/financial-excel"','const response = await transport("/api/xray/financial-excel"'))
 const report='apps/srm/src/server/report-data.ts',current=fs.readFileSync(path.join(repo,report),'utf8')
 const baseline=fs.readFileSync(path.join(output,report),'utf8')
 const start=baseline.indexOf('/** Same host boundary as the existing exports;'),sourceStart=current.indexOf('export type ReportDataOperationBoundary =')
 if(start<0||sourceStart<0)throw Error('Existing report HTTP boundary seam changed')
 write(report,baseline.slice(0,start)+current.slice(sourceStart))
 // These existing host-neutral types/functions are required by the imported
 // native composition's closed default types, but have no active Maps route.
 write('packages/srm-xray/src/supplier-locations.ts',fs.readFileSync(path.join(repo,'packages/srm-xray/src/supplier-locations.ts')))
 const index='packages/srm-xray/src/index.ts'
 write(index,fs.readFileSync(path.join(output,index),'utf8')+'\nexport * from "./supplier-locations";\n')
 const route=(name,method)=>{
  const file='apps/srm/app/api/xray/'+name+'/route.ts'
  write(file,`import {getPilot2ColdRuntime} from '../../../../src/server/pilot2-cold-runtime';
import {withSupplierTelemetry} from '../../../../src/server/supplier-telemetry';
import {isOperationDenied} from '@profitia/platform-contracts/operation-context';
import {validateXrayRequest} from '../../../../src/server/xray-lookup';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const POST=(request:Request)=>withSupplierTelemetry('${name==='report-data'?'report_data':name==='financial-excel'?'pdf':'search'}',async()=>{try{return await ${method}}catch(error){const reason=isOperationDenied(error)?error.reasonCode:'POLICY_UNAVAILABLE';return Response.json({error:'Operation unavailable'},{status:reason==='UNVERIFIED_IDENTITY'?401:reason==='CONTEXT_INVALID'?400:['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE'].includes(reason)?503:403,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}})}});\n`)
 }
 route('search',"getPilot2ColdRuntime().search(request,validateXrayRequest(await request.clone().json()).identifier.value)")
 route('report-data',"getPilot2ColdRuntime().report(request,await request.clone().json())")
 route('financial-excel','getPilot2ColdRuntime().excel(request)')
 write('apps/srm/app/api/xray/krs/lookup/route.ts',`import {getPilot2ColdRuntime} from '../../../../../src/server/pilot2-cold-runtime';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const POST=(request:Request)=>getPilot2ColdRuntime().lookup(request);\n`)
 const middleware='apps/srm/middleware.ts'
 write(middleware,replace(fs.readFileSync(path.join(output,middleware),'utf8'),
  "'/api/xray/report-data'","'/api/xray/report-data','/api/xray/krs/lookup','/api/xray/financial-excel'"))
 const health='apps/srm/app/api/health/route.ts'
 write(health,replace('import {getPilot2ColdRuntime} from "../../../src/server/pilot2-cold-runtime";\n'+fs.readFileSync(path.join(output,health),'utf8'),
  'getPilot2ScannerRuntime()}','getPilot2ScannerRuntime();getPilot2ColdRuntime()}'))
 proof.overlay={...previous,stage:'COLD_ACQUISITION',previousStage:'SCANNER',
  adapterSha256:hash(fs.readFileSync(new URL('./pilot2-cold-overlay.mjs',import.meta.url))),
  coldAcquisitionStage:'EXISTING_NATIVE_WORK_SOURCE_FINANCIAL_MSR_AND_KRS_IDENTITY',
  exportsStage:'EXISTING_CURRENT_HUMAN_ROOT_FINANCIAL_XLSX',
  privateDataAuthority:'EXISTING_E1_ORGANISATION_NO_CLONED_ARCHIVE',
  externalHttpInHumanTransaction:false,postClickClerkReads:false,paidAcquisitionWhileTyping:false,
  modifiedFinancialFormulaEngine:false,modifiedMapsRoutes:false,dependencyChanges:0,
  nativeSourceClosure:PILOT2_COLD_SOURCE_FILES.map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(repo,name)))})),
  changedFiles:proof.changedFiles.map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(output,name)))})),
  addedFiles:proof.addedFiles.map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(output,name)))}))}
 return proof
}
