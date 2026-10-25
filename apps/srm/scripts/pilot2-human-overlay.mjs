import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {replaceRegistrySeam as replace} from './pilot2-registry-overlay.mjs'

const hash=v=>createHash('sha256').update(v).digest('hex')
const clerkPackages={'@clerk/backend':'3.25.0','@clerk/react':'6.17.8','@clerk/localizations':'4.23.0'}
const closure=['@clerk/backend','@clerk/localizations','@clerk/react','@clerk/shared','@stablelib/base64','@tanstack/query-core','dequal','fast-sha256','glob-to-regexp','js-cookie','standardwebhooks'].map(name=>'node_modules/'+name)
export function verifyHumanPackage(registryPackage,humanPackage,registryLock,humanLock){
 const expected=structuredClone(registryPackage);Object.assign(expected.dependencies,clerkPackages)
 if(JSON.stringify(expected)!==JSON.stringify(humanPackage))throw Error('Only the accepted official Clerk dependencies may extend Registry')
 for(const[name,entry]of Object.entries(registryLock.packages)){
  if(name&&JSON.stringify(entry)!==JSON.stringify(humanLock.packages[name]))throw Error('Staging/Registry dependency changed: '+name)
 }
 const added=Object.keys(humanLock.packages).filter(name=>!registryLock.packages[name]).sort()
 if(JSON.stringify(added)!==JSON.stringify([...closure].sort()))throw Error('Unexpected Clerk dependency closure')
 for(const name of added){const value=humanLock.packages[name]
  if(value.link||value.hasInstallScript||!value.resolved?.startsWith('https://registry.npmjs.org/')||!value.integrity?.startsWith('sha512-'))throw Error('Pinned registry dependency without lifecycle required: '+name)
 }
 const ordered=value=>Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
 if(JSON.stringify(ordered(humanLock.packages[''].dependencies))!==JSON.stringify(ordered(humanPackage.dependencies)))throw Error('Human dependency lock root differs')
}
export function humanPilot2(repo,output,proof){
 if(proof.overlay?.stage!=='REGISTRY')throw Error('Form admission requires the separately measured Registry stage')
 const previous=proof.overlay
 const known=new Map([...previous.changedFiles,...previous.addedFiles].map(f=>[f.path,f.sha256]))
 const write=(name,contents)=>{
  const file=path.join(output,name)
  if(fs.existsSync(file)){
   if(hash(fs.readFileSync(file))!==(known.get(name)??proof.originalFiles[name]))throw Error('Unreviewed form admission input: '+name)
   if(!proof.changedFiles.includes(name))proof.changedFiles.push(name)
  }else{fs.mkdirSync(path.dirname(file),{recursive:true});proof.addedFiles.push(name)}
  fs.writeFileSync(file,contents)
 }
 const patch=(name,action)=>write(name,action(fs.readFileSync(path.join(output,name),'utf8')))
 const copy=name=>write(name,fs.readFileSync(path.join(repo,name)))
 copy('apps/srm/operation-integration.json')
 for(const file of['pilot2-human-runtime.ts','pilot2-public-catalog.ts','report-admission-runtime.ts','supplier-request-host.ts',
  'supplier-request-operation.ts','private-operation-host.ts','identity-runtime.ts','request-origin.ts','corporate-knowledge.ts','shared-financial-read.ts'])copy('apps/srm/src/server/'+file)
 for(const file of['pilot2-human-targets.json','private-runtime-targets.json','supplier-native-targets.json'])copy('apps/srm/deployment/'+file)
 // Expose the unchanged shared SELECT prefix already used by current SRM.
 // Interpolation reconstructs the original Staging private SQL byte for byte;
 // the new reader uses only the public prefix and the existing projector.
 patch('apps/srm/src/server/report-data.ts',source=>{
  source=replace(source,'export const REPORT_DATA_SQL = `SELECT requested.nip,','export const REPORT_SHARED_FINANCIAL_SELECT = `SELECT requested.nip,')
  const boundary=",\n  COALESCE((SELECT jsonb_agg(d.document_json ORDER BY d.record_id)"
  return replace(source,boundary,"`;\nexport const REPORT_DATA_SQL = `${REPORT_SHARED_FINANCIAL_SELECT}"+boundary)
 })
 for(const file of['app/session-boundary.tsx','app/login/clerk-sign-in.tsx','src/modules/xray/krs-session-transport.ts',
  'src/modules/xray/supplier-search-gateway.ts','src/modules/xray/use-supplier-report.ts'])copy('apps/srm/'+file)
 for(const file of['supplier-search.tsx','supplier-search.css','shared-financial-summary.ts'])copy('packages/srm-xray/src/'+file)
 patch('packages/srm-xray/src/index.ts',source=>source+"\nexport {SupplierSearch} from './supplier-search';\nexport type {SupplierSearchGateway,SupplierCandidate,SupplierSelection} from './supplier-search';\n")
 patch('packages/srm-xray/package.json',source=>{
  const pkg=JSON.parse(source);pkg.exports['./supplier-search.css']='./src/supplier-search.css'
  pkg.exports['./shared-financial-summary']={types:'./src/shared-financial-summary.ts',default:'./src/shared-financial-summary.ts'}
  return JSON.stringify(pkg,null,2)+'\n'
 })
 patch('apps/srm/app/layout.tsx',source=>{
  source='import {readSrmIdentityRuntime} from "../src/server/identity-runtime";\nimport {SrmIdentityProvider} from "./session-boundary";\n'+source
  source=replace(source,'  return (','  const identity=readSrmIdentityRuntime();\n  return (')
  return replace(source,'<body>{children}</body>','<body><SrmIdentityProvider mode={identity.provider} publishableKey={identity.provider==="clerk"?identity.publishableKey:undefined}>{children}</SrmIdentityProvider></body>')
 })
 patch('apps/srm/app/login/page.tsx',source=>{
  source='import {ClerkSignIn} from "./clerk-sign-in";\n'+source
  const start=source.indexOf('          <form action="/api/auth/login"'),end=source.indexOf('          </form>',start)
  if(start<0||end<start)throw Error('Original login form seam changed')
  return source.slice(0,start)+'          <ClerkSignIn />'+source.slice(end+'          </form>'.length)
 })
 patch('apps/srm/app/page.tsx',source=>{
  source=replace(source,"CanonInput, CanonButton, SupplierHeader", "CanonInput, CanonButton, SupplierHeader, SupplierSearch")
  source=replace(source,'import "@profitia/srm-xray/financial-scanner.css";',
   'import "@profitia/srm-xray/financial-scanner.css";\nimport "@profitia/srm-xray/supplier-search.css";\nimport {SrmAuthenticatedView,SrmLogout,useSrmSessionTransport} from "./session-boundary";\nimport {createSupplierSearchGateway} from "../src/modules/xray/supplier-search-gateway";')
  source=replace(source,'export default function Home() {\n  const { state, controller } = useSupplierReport();',
   'export default function Home(){return <SrmAuthenticatedView><ReportHome/></SrmAuthenticatedView>;}\nfunction ReportHome() {\n  const transport=useSrmSessionTransport();\n  const [gateway]=useState(()=>createSupplierSearchGateway(transport));\n  const { state, controller } = useSupplierReport(transport);')
  const begin=source.indexOf('  const searchForm = <form id="supplier-search"'),end=source.indexOf('      </form>;',begin)
  if(begin<0||end<begin)throw Error('Original NIP form seam changed')
  source=source.slice(0,begin)+'  const searchForm=<SupplierSearch nip={identifier} onNipChange={setIdentifier} busy={state.busy} inputRef={inputRef} gateway={gateway} requireAdmission={true} onNipSearch={()=>{void controller.search(identifier)}} onNameSearch={()=>{}}/>;'+source.slice(end+'      </form>;'.length)
  source=replace(source,'{entry && <section className="srm-ui srm-entry-main" aria-label="Wyszukiwanie dostawcy">{searchForm}</section>}','{entry && searchForm}')
  source=replace(source,'{!inactive && <form action="/api/auth/logout" method="post"><CanonButton canonId="SRM-C02" usage="page:05" type="submit" className="appshield-new-report">Wyloguj się</CanonButton></form>}',
   '{!inactive && <SrmLogout><CanonButton canonId="SRM-C02" usage="page:05" type="button" className="appshield-new-report">Wyloguj się</CanonButton></SrmLogout>}')
  return source
 })
 // Neutral pages and feature status disclose no company data. All legacy
 // acquisition/export entrances remain closed during this measured stage.
 write('apps/srm/middleware.ts',`import {NextResponse,type NextRequest} from 'next/server';
export function middleware(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(['/','/login','/api/health','/api/xray/krs/status','/api/xray/admission','/api/xray/search','/api/xray/report-data'].includes(path))return NextResponse.next({headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
 return path.startsWith('/api/')?NextResponse.json({error:'Operation unavailable'},{status:401,headers:{'Cache-Control':'private, no-store'}}):NextResponse.redirect(new URL('/login',request.url));
}
export const config={matcher:['/((?!_next/|favicon.ico|porr-demo/|.*\\\\..*).*)']};\n`)
 const prelude=`import {getPilot2HumanRuntime} from '../../../../src/server/pilot2-human-runtime';
import {withSupplierTelemetry} from '../../../../src/server/supplier-telemetry';
import {isOperationDenied} from '@profitia/platform-contracts/operation-context';
export const runtime='nodejs';export const dynamic='force-dynamic';
const unavailable=(error:unknown)=>{const reason=isOperationDenied(error)?error.reasonCode:'POLICY_UNAVAILABLE';const status=reason==='UNVERIFIED_IDENTITY'?401:reason==='CONTEXT_INVALID'?400:['AUDIT_UNAVAILABLE','POLICY_UNAVAILABLE'].includes(reason)?503:403;return Response.json({error:'Operation unavailable'},{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}})};\n`
 write('apps/srm/app/api/xray/admission/route.ts',prelude+`export const POST=(request:Request)=>withSupplierTelemetry('form_admission',async()=>{try{return await getPilot2HumanRuntime().prepare(request)}catch(error){return unavailable(error)}});\n`)
 write('apps/srm/app/api/xray/search/route.ts',prelude+`import {validateXrayRequest} from '../../../../src/server/xray-lookup';
export const POST=(request:Request)=>withSupplierTelemetry('search',async()=>{try{const input=validateXrayRequest(await request.json());return await getPilot2HumanRuntime().search(request,input.identifier.value)}catch(error){return unavailable(error)}});\n`)
 write('apps/srm/app/api/xray/report-data/route.ts',prelude+`export const POST=(request:Request)=>withSupplierTelemetry('report_data',async()=>{try{return await getPilot2HumanRuntime().report(request,await request.json())}catch(error){return unavailable(error)}});\n`)
 write('apps/srm/app/api/xray/krs/status/route.ts',`export const dynamic='force-dynamic';export function GET(){return Response.json({enabled:false},{headers:{'Cache-Control':'private, no-store'}})}\n`)
 patch('apps/srm/app/api/health/route.ts',source=>replace('import {getPilot2HumanRuntime} from "../../../src/server/pilot2-human-runtime";\n'+source,
  'try{await getPilot2Registry()}','try{await getPilot2Registry();getPilot2HumanRuntime()}'))
 // The original dependencies retain their exact locked entries. Only the
 // already accepted official Clerk packages and their closure are added.
 const load=name=>JSON.parse(fs.readFileSync(path.join(repo,'apps/srm/deployment/pilot2-'+name),'utf8'))
 verifyHumanPackage(load('registry-package.json'),load('human-package.json'),load('registry-package-lock.json'),load('human-package-lock.json'))
 for(const name of['package.json','package-lock.json'])copyVariant(name)
 function copyVariant(name){write('apps/srm/'+name,fs.readFileSync(path.join(repo,'apps/srm/deployment/pilot2-human-'+name)))}
 proof.overlay={...previous,stage:'FORM_ADMISSION',previousStage:'REGISTRY',
  adapterSha256:hash(fs.readFileSync(new URL('./pilot2-human-overlay.mjs',import.meta.url))),
  humanAuthorizationStage:'COMMON_CLERK_ROOT_AND_SQL025_FORM_ADMISSION',
  coldAcquisitionStage:'NOT_YET_ADOPTED_FAIL_CLOSED',privateReportEffectsStage:'NOT_YET_ADOPTED',
  clonedPrivateDataDisclosed:false,postClickClerkReads:false,
  changedFiles:proof.changedFiles.map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(output,name)))})),
  addedFiles:proof.addedFiles.map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(output,name)))}))}
 return proof
}
