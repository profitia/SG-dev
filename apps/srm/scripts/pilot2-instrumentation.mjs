import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'

const sha=value=>createHash('sha256').update(value).digest('hex')
function replaceOnce(source,from,to){
 if(source.split(from).length!==2)throw Error('Accepted Staging instrumentation seam changed')
 return source.replace(from,to)
}
/** Reuse the canonical request-local collector. SQL text, arguments, tenant
 * identities, report values and credentials are never passed to the collector. */
export function instrumentPilot2(repo,output,proof){
 const patch=(name,change)=>{
  const file=path.join(output,name),source=fs.readFileSync(file,'utf8')
  if(sha(source)!==proof.originalFiles[name])throw Error('Instrumentation requires unchanged historical source')
  fs.writeFileSync(file,change(source));proof.changedFiles.push(name)
 }
 patch('apps/srm/src/server/lookup-diagnostics.ts',source=>{
  source='import { measureSupplierStage, type SupplierTelemetryStage } from "./supplier-telemetry";\n'+source
  return replaceOnce(source,'try { return await action(); } finally {','try { return await measureSupplierStage(stage.toUpperCase() as SupplierTelemetryStage, action); } finally {')
 })
 patch('apps/srm/src/server/db.ts',source=>{
  source='import { measureSupplierStage } from "./supplier-telemetry";\n'+source
  return replaceOnce(source,'const client = await pool.connect();',`const originalClient = await measureSupplierStage('POOL_WAIT', () => pool.connect());
  const client: pg.PoolClient = new Proxy(originalClient, {
    get(target, key, receiver) {
      const member = Reflect.get(target, key, receiver);
      if (key === 'query' && typeof member === 'function')
        return (...args: unknown[]) => measureSupplierStage('DOMAIN_SQL', () => Reflect.apply(member, target, args));
      return typeof member === 'function' ? member.bind(target) : member;
    },
  });`)
 })
 patch('apps/srm/app/api/xray/search/route.ts',source=>{
  source='import { withSupplierTelemetry } from "../../../../src/server/supplier-telemetry";\n'+source
  return replaceOnce(source,'export async function POST(request: Request)', 'async function originalPost(request: Request)')
   +'\nexport const POST = (request: Request) => withSupplierTelemetry("search", () => originalPost(request));\n'
 })
 patch('apps/srm/app/api/xray/report-data/route.ts',source=>{
  source='import { withSupplierTelemetry } from "../../../../src/server/supplier-telemetry";\n'+source
  return replaceOnce(source,'export const POST = reportDataHandler();','const originalPost = reportDataHandler();\nexport const POST = (request: Request) => withSupplierTelemetry("report_data", () => originalPost(request));')
 })
 const collector='apps/srm/src/server/supplier-telemetry.ts'
 if(fs.existsSync(path.join(output,collector)))throw Error('Historical source unexpectedly contains the collector')
 fs.copyFileSync(path.join(repo,collector),path.join(output,collector))
 proof.addedFiles=[collector]
 proof.overlay={stage:'TELEMETRY',collectorSha256:sha(fs.readFileSync(path.join(output,collector))),
  adapterSha256:sha(fs.readFileSync(new URL('./pilot2-instrumentation.mjs',import.meta.url))),changesBusinessLogic:false,
  changedFiles:proof.changedFiles.map(name=>({path:name,sha256:sha(fs.readFileSync(path.join(output,name)))}))}
 proof.exactBusinessSource=true
 return proof
}
