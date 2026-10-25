import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {replaceRegistrySeam as replace} from './pilot2-registry-overlay.mjs'
const hash=value=>createHash('sha256').update(value).digest('hex')
export const PILOT2_PRIVATE_HTTP_ROUTES={jdg:'jdg',kys:'company-kys','jdg/kys':'jdg-kys','kys/pesel':'reveal','kys/pdf':'pdf','kys/krs':'krs','web-identity':'web'}
/** The last measured stage opens the original private operations without
 * changing the Staging report calculations, page layout or public admission. */
export function privatePilot2(repo,output,proof){
 if(proof.overlay?.stage!=='COLD_ACQUISITION')throw Error('Private operations require measured native acquisition')
 const previous=proof.overlay,known=new Map([...previous.changedFiles,...previous.addedFiles].map(f=>[f.path,f.sha256]))
 const write=(name,contents)=>{
  const file=path.join(output,name)
  if(fs.existsSync(file)){
   if(hash(fs.readFileSync(file))!==(known.get(name)??proof.originalFiles[name]))throw Error('Unreviewed private input: '+name)
   if(!proof.changedFiles.includes(name))proof.changedFiles.push(name)
  }else{fs.mkdirSync(path.dirname(file),{recursive:true});proof.addedFiles.push(name)}
  fs.writeFileSync(file,contents)
 }
 for(const[name,operation]of Object.entries(PILOT2_PRIVATE_HTTP_ROUTES)){
  const prefix='../'.repeat(name.split('/').length+3)
  write('apps/srm/app/api/xray/'+name+'/route.ts',`import {getPilot2ColdRuntime} from '${prefix}src/server/pilot2-cold-runtime';
import {withSupplierTelemetry} from '${prefix}src/server/supplier-telemetry';
import {supplierHttpFailure} from '${prefix}src/server/supplier-acquisition-http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const POST=(request:Request)=>withSupplierTelemetry('${operation}',async()=>{try{return await getPilot2ColdRuntime().private('${operation}',request)}catch(error){return supplierHttpFailure(error)}});\n`)
 }
 const transport='apps/srm/src/modules/xray/krs-session-transport.ts'
 write(transport,replace(fs.readFileSync(path.join(output,transport),'utf8'),'const paths=new Set([',
  'const paths=new Set(['+Object.keys(PILOT2_PRIVATE_HTTP_ROUTES).map(name=>JSON.stringify('/api/xray/'+name)).join(',')+','))
 const page='apps/srm/app/page.tsx';let source=fs.readFileSync(path.join(output,page),'utf8')
 for(const name of['kys/pesel','kys/pdf','kys/krs'])source=replace(source,'const response = await fetch("/api/xray/'+name+'"','const response = await transport("/api/xray/'+name+'"')
 write(page,source)
 const middleware='apps/srm/middleware.ts'
 write(middleware,replace(fs.readFileSync(path.join(output,middleware),'utf8'),"'/api/xray/report-data'",
  "'/api/xray/report-data',"+Object.keys(PILOT2_PRIVATE_HTTP_ROUTES).map(name=>JSON.stringify('/api/xray/'+name)).join(',')))
 proof.overlay={...previous,stage:'PRIVATE_OPERATIONS',previousStage:'COLD_ACQUISITION',
  adapterSha256:hash(fs.readFileSync(new URL('./pilot2-private-overlay.mjs',import.meta.url))),
  privateOperations:'EXISTING_CURRENT_HUMAN_REQUEST_WORK_SOURCE_AND_OUTPUT_FENCES',
  privateRoutes:Object.keys(PILOT2_PRIVATE_HTTP_ROUTES),companyAdmissionAuthorizesPrivateData:false,
  changedFiles:proof.changedFiles.map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(output,name)))})),
  addedFiles:proof.addedFiles.map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(output,name)))}))}
 return proof
}
