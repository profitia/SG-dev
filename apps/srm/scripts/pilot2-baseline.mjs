import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {gunzipSync} from 'node:zlib'
import {instrumentPilot2} from './pilot2-instrumentation.mjs'
import {registryPilot2} from './pilot2-registry-overlay.mjs'
import {humanPilot2} from './pilot2-human-overlay.mjs'
import {scannerPilot2} from './pilot2-scanner-overlay.mjs'
import {coldPilot2} from './pilot2-cold-overlay.mjs'
import {privatePilot2} from './pilot2-private-overlay.mjs'
import {diagnosticPilot2} from './pilot2-diagnostic-overlay.mjs'

export const BUSINESS_BASELINE='6eede5cd19fd3a4519d66298effe9ef94633757a'
const HASH=/^[a-f0-9]{40}$/
const originalBranch='br-dark-surf-b1vrhda9'
const originalHost='ep-red-smoke-b16ih64d.c-5.eu-central-1.aws.neon.tech'
const stagingHost='ep-autumn-wildflower-b1mv0vda.c-5.eu-central-1.aws.neon.tech'
const sha=value=>createHash('sha256').update(value).digest('hex')
const deny=message=>{throw new Error(message)}
const SOURCE_TAR_SHA256='7c58f6d5275a5d0c63a291b86f8a8053c99469f9a8012ae2adc9c2ab5950e067'
export function validateTarget(t){
 if(!t||t.schemaVersion!=='1.0'||t.projectKey!=='SRM'||t.targetEnvironment!=='development'
  ||t.purpose!=='STAGED_PERFORMANCE_EXPERIMENT_ONLY'||t.source?.businessBaselineSha!==BUSINESS_BASELINE||t.source.nodeVersion!=='24.21.0'
  ||t.render?.serviceId!=='srv-dbeh6srrjlhs73fmikrg'||t.render.environmentId!=='evm-dapbd70ae00c73cgrup0'
  ||t.render.plan!=='0.5c-512mb'||t.render.instances!==1||t.render.autoDeploy!==false
  ||t.neon?.projectId!=='snowy-breeze-40315151'||t.neon.parentBranchId!=='br-broad-butterfly-b11t4v01'
  ||t.neon.branchId!=='br-summer-rain-b1nwbcbr'||t.neon.endpointId!=='ep-fragrant-cloud-b1y6i4v8'
  ||t.neon.host!=='ep-fragrant-cloud-b1y6i4v8.c-5.eu-central-1.aws.neon.tech'
  ||t.neon.databaseName!=='srm_app'||t.neon.runtimeRole!=='srm_app_runtime'
  ||t.approval?.renderMonthlyUsd!==7||t.approval.neonAdditionalExperimentUsd!==10
  ||!t.approval.noOtherEnvironmentMutation)deny('Exact owner-approved PILOT2 resource binding required')
 return t
}
export function rebindEnvironment(source,t){
 validateTarget(t)
 if(source.split(originalBranch).length!==2||source.split(originalHost).length!==2||!source.includes(stagingHost))
  deny('Historical environment guard differs from the accepted baseline')
 const result=source.replace(originalBranch,t.neon.branchId).replace(originalHost,t.neon.host)
 if(!result.includes('host !== expected.host')||!result.includes('url.username !== "srm_app_runtime"')
  ||!result.includes('env.TARGET_ENVIRONMENT === "development"')||!result.includes(stagingHost))
  deny('PILOT2 cannot remove source environment or ordinary-role validation')
 return result
}
/** Render provides a shallow checkout. Carry the reviewed historical source as
 * a bounded immutable archive, verified against Git in full-history CI. No
 * additional repository credentials or mutable remote download are required. */
export function verifyBaselineArchive(repo){
 const manifest=JSON.parse(fs.readFileSync(path.join(repo,'apps/srm/deployment/pilot2-staging-source.json'),'utf8'))
 if(manifest.schemaVersion!=='1.0'||manifest.businessSourceSha!==BUSINESS_BASELINE
  ||manifest.archive!=='apps/srm/deployment/pilot2-staging-source.tar.gz'||manifest.tarSha256!==SOURCE_TAR_SHA256)deny('Accepted historical archive manifest required')
 const compressed=fs.readFileSync(path.join(repo,manifest.archive))
 if(compressed.length!==manifest.archiveBytes||compressed.length>4*1024*1024||sha(compressed)!==manifest.archiveSha256)deny('Historical archive integrity mismatch')
 const archive=gunzipSync(compressed,{maxOutputLength:16*1024*1024})
 if(sha(archive)!==SOURCE_TAR_SHA256)deny('Historical source bytes differ from the accepted Staging source')
 const git=args=>execFileSync('git',args,{cwd:repo,maxBuffer:32*1024*1024,stdio:['pipe','pipe','pipe']})
 let historicalObject=false
 try{git(['cat-file','-e',BUSINESS_BASELINE+'^{commit}']);historicalObject=true}catch{}
 if(historicalObject){
  git(['merge-base','--is-ancestor',BUSINESS_BASELINE,'HEAD'])
  if(sha(git(['archive','--format=tar',BUSINESS_BASELINE,'apps/srm','packages/srm-xray']))!==SOURCE_TAR_SHA256)deny('Historical Git source provenance mismatch')
 }else if(git(['rev-parse','--is-shallow-repository']).toString().trim()!=='true')deny('Full history must contain the accepted Staging source')
 const names=execFileSync('tar',['-tf','-'],{input:archive}).toString().trim().split('\n')
 for(const name of names)if(name.startsWith('/')||name.split('/').includes('..')
  ||!['apps/','packages/'].includes(name)&&!name.startsWith('apps/srm/')&&!name.startsWith('packages/srm-xray/'))deny('Historical archive path rejected')
 const expected=Object.keys(manifest.files??{}).sort()
 if(expected.length!==257||JSON.stringify(names.filter(n=>!n.endsWith('/')).sort())!==JSON.stringify(expected)
  ||expected.some(name=>!/^[a-f0-9]{64}$/.test(manifest.files[name])))deny('Exact historical file manifest required')
 return {archive,original:manifest.files,historicalGitVerified:historicalObject,tarSha256:SOURCE_TAR_SHA256}
}
export function prepareBaseline(repo,t,output,stage='BASELINE'){
 validateTarget(t)
 if(!['BASELINE','TELEMETRY','REGISTRY','FORM_ADMISSION','SCANNER','COLD_ACQUISITION','PRIVATE_OPERATIONS'].includes(stage))deny('Only explicitly accepted experimental stages may be built')
 if(!HASH.test(BUSINESS_BASELINE))deny('Exact baseline required')
 const {archive,original,historicalGitVerified,tarSha256}=verifyBaselineArchive(repo)
 output=path.resolve(output)
 if(fs.existsSync(output))deny('Refusing to overwrite an existing baseline checkout')
 fs.mkdirSync(output,{recursive:true})
 execFileSync('tar',['-xf','-','-C',output],{input:archive})
 const sourceFiles=Object.keys(original)
 for(const name of sourceFiles)if(!fs.lstatSync(path.join(output,name)).isFile()||sha(fs.readFileSync(path.join(output,name)))!==original[name])deny('Extracted historical file integrity mismatch')
 const guard='apps/srm/src/server/runtime-environment.ts'
 fs.writeFileSync(path.join(output,guard),rebindEnvironment(fs.readFileSync(path.join(output,guard),'utf8'),t))
 const changed=sourceFiles.filter(name=>sha(fs.readFileSync(path.join(output,name)))!==original[name])
 if(changed.length!==1||changed[0]!==guard)deny('Only the explicit environment binding may differ')
 const proof={schemaVersion:'1.0',stage,businessSourceSha:BUSINESS_BASELINE,exactBusinessSource:true,byteIdenticalToStaging:false,
  environment:'development',serviceId:t.render.serviceId,branchId:t.neon.branchId,
  originalFiles:original,changedFiles:changed,sourceArchive:{tarSha256,historicalGitVerified},nodeVersion:process.version,adapter:{path:guard,originalSha256:original[guard],adaptedSha256:sha(fs.readFileSync(path.join(output,guard)))},
  installedDependencies:false,built:false}
 if(stage!=='BASELINE')instrumentPilot2(repo,output,proof)
 if(['REGISTRY','FORM_ADMISSION','SCANNER','COLD_ACQUISITION','PRIVATE_OPERATIONS'].includes(stage))registryPilot2(repo,output,proof)
 if(['FORM_ADMISSION','SCANNER','COLD_ACQUISITION','PRIVATE_OPERATIONS'].includes(stage))humanPilot2(repo,output,proof)
 if(['SCANNER','COLD_ACQUISITION','PRIVATE_OPERATIONS'].includes(stage))scannerPilot2(repo,output,proof)
 if(['COLD_ACQUISITION','PRIVATE_OPERATIONS'].includes(stage))coldPilot2(repo,output,proof)
 if(stage==='PRIVATE_OPERATIONS')privatePilot2(repo,output,proof)
 if(stage==='PRIVATE_OPERATIONS')diagnosticPilot2(repo,output,proof)
 fs.writeFileSync(path.join(output,'baseline-proof.json'),JSON.stringify(proof,null,2)+'\n')
 return proof
}
function files(dir,prefix=''){
 return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
  const rel=path.join(prefix,e.name),full=path.join(dir,e.name)
  if(e.isSymbolicLink())return [{path:rel,type:'symlink',target:fs.readlinkSync(full)}]
  if(e.isDirectory())return files(full,rel)
  return [{path:rel,type:'file',sha256:sha(fs.readFileSync(full))}]
 })
}
export function buildBaseline(repo,t,output,stage='BASELINE'){
 if(process.version!=='v'+t.source.nodeVersion)deny('Actual Node runtime must match the accepted Staging version')
 const proof=prepareBaseline(repo,t,output,stage),app=path.join(output,'apps/srm')
 const npm=(args)=>execFileSync('npm',['--prefix',app,...args],{cwd:repo,stdio:'inherit'})
 npm(['ci','--install-links'])
 npm(['run','build'])
 const standalone=path.join(app,'.next/standalone')
 const candidates=files(standalone).filter(e=>e.type==='file'&&(e.path==='server.js'||e.path.endsWith('/server.js'))&&!e.path.split(path.sep).includes('node_modules')
  &&fs.readFileSync(path.join(standalone,e.path),'utf8').includes('startServer'))
 if(candidates.length!==1)deny('One actual Next standalone entry required')
 const entry=path.join(standalone,candidates[0].path),relative='./'+path.relative(output,entry).split(path.sep).join('/')
 const serverDirectory=path.dirname(entry)
 // Exercise the external runtime from the actual standalone closure before
 // accepting its artifact. This performs no SQL or provider HTTP requests.
 if(['REGISTRY','FORM_ADMISSION','SCANNER','COLD_ACQUISITION','PRIVATE_OPERATIONS'].includes(stage))execFileSync(process.execPath,[path.join(repo,'apps/srm/scripts/pilot2-registry-smoke.mjs'),path.join(serverDirectory,'node_modules'),stage],{stdio:'inherit'})
 fs.mkdirSync(path.join(serverDirectory,'.next'),{recursive:true})
 fs.cpSync(path.join(app,'.next/static'),path.join(serverDirectory,'.next/static'),{recursive:true})
 fs.cpSync(path.join(app,'public'),path.join(serverDirectory,'public'),{recursive:true})
 const entries=files(standalone)
 fs.writeFileSync(path.join(output,'start.cjs'),'process.env.HOSTNAME="0.0.0.0";require('+JSON.stringify(relative)+');\n')
 proof.installedDependencies=true;proof.built=true
 proof.artifact={algorithm:'sorted-relative-type-sha256-json-v1',digest:sha(JSON.stringify(entries)),entries:entries.length,
  entry:path.relative(output,entry).split(path.sep).join('/'),buildId:fs.readFileSync(path.join(app,'.next/BUILD_ID'),'utf8').trim()}
 fs.writeFileSync(path.join(output,'baseline-proof.json'),JSON.stringify(proof,null,2)+'\n')
 fs.writeFileSync(path.join(standalone,'PILOT2_BASELINE_PROOF.json'),JSON.stringify(proof,null,2)+'\n')
 return proof
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const repo=path.resolve(fileURLToPath(new URL('../../..',import.meta.url))),command=process.argv[2]
 const t=JSON.parse(fs.readFileSync(path.join(repo,'apps/srm/deployment/pilot2-runtime-targets.json'),'utf8'))
 const output=path.resolve(process.argv[3]??path.join(repo,'.pilot2-baseline'))
 const stage=process.argv[4]??'BASELINE'
 if(!['prepare','build'].includes(command))deny('Use prepare or build; no cloud mutation is performed by this builder')
 const proof=command==='prepare'?prepareBaseline(repo,t,output,stage):buildBaseline(repo,t,output,stage)
 console.log(JSON.stringify({stage:proof.stage,businessSourceSha:proof.businessSourceSha,changedFiles:proof.changedFiles,built:proof.built,artifact:proof.artifact??null}))
}

