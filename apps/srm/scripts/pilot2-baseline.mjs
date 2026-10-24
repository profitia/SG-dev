import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

export const BUSINESS_BASELINE='6eede5cd19fd3a4519d66298effe9ef94633757a'
const HASH=/^[a-f0-9]{40}$/
const originalBranch='br-dark-surf-b1vrhda9'
const originalHost='ep-red-smoke-b16ih64d.c-5.eu-central-1.aws.neon.tech'
const stagingHost='ep-autumn-wildflower-b1mv0vda.c-5.eu-central-1.aws.neon.tech'
const sha=value=>createHash('sha256').update(value).digest('hex')
const deny=message=>{throw new Error(message)}
export function validateTarget(t){
 if(!t||t.schemaVersion!=='1.0'||t.projectKey!=='SRM'||t.targetEnvironment!=='development'
  ||t.purpose!=='STAGED_PERFORMANCE_EXPERIMENT_ONLY'||t.source?.businessBaselineSha!==BUSINESS_BASELINE
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
export function prepareBaseline(repo,t,output){
 validateTarget(t)
 const git=args=>execFileSync('git',args,{cwd:repo,maxBuffer:256*1024*1024})
 if(!HASH.test(BUSINESS_BASELINE))deny('Exact baseline required')
 git(['merge-base','--is-ancestor',BUSINESS_BASELINE,'origin/main'])
 output=path.resolve(output)
 if(fs.existsSync(output))deny('Refusing to overwrite an existing baseline checkout')
 fs.mkdirSync(output,{recursive:true})
 const archive=git(['archive','--format=tar',BUSINESS_BASELINE,'apps/srm','packages/srm-xray'])
 execFileSync('tar',['-xf','-','-C',output],{input:archive})
 const sourceFiles=git(['ls-tree','-r','--name-only',BUSINESS_BASELINE,'apps/srm','packages/srm-xray']).toString().trim().split('\n')
 const original=Object.fromEntries(sourceFiles.map(name=>[name,sha(fs.readFileSync(path.join(output,name)))]))
 const guard='apps/srm/src/server/runtime-environment.ts'
 fs.writeFileSync(path.join(output,guard),rebindEnvironment(fs.readFileSync(path.join(output,guard),'utf8'),t))
 const changed=sourceFiles.filter(name=>sha(fs.readFileSync(path.join(output,name)))!==original[name])
 if(changed.length!==1||changed[0]!==guard)deny('Only the explicit environment binding may differ')
 const proof={schemaVersion:'1.0',businessSourceSha:BUSINESS_BASELINE,exactBusinessSource:true,byteIdenticalToStaging:false,
  environment:'development',serviceId:t.render.serviceId,branchId:t.neon.branchId,
  originalFiles:original,changedFiles:changed,adapter:{path:guard,originalSha256:original[guard],adaptedSha256:sha(fs.readFileSync(path.join(output,guard)))},
  installedDependencies:false,built:false}
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
export function buildBaseline(repo,t,output){
 const proof=prepareBaseline(repo,t,output),app=path.join(output,'apps/srm')
 const npm=(args)=>execFileSync('npm',['--prefix',app,...args],{cwd:repo,stdio:'inherit'})
 npm(['ci','--install-links'])
 npm(['run','build'])
 const standalone=path.join(app,'.next/standalone')
 const candidates=files(standalone).filter(e=>e.type==='file'&&(e.path==='server.js'||e.path.endsWith('/server.js'))&&!e.path.split(path.sep).includes('node_modules')
  &&fs.readFileSync(path.join(standalone,e.path),'utf8').includes('startServer'))
 if(candidates.length!==1)deny('One actual Next standalone entry required')
 const entry=path.join(standalone,candidates[0].path),relative='./'+path.relative(output,entry).split(path.sep).join('/')
 const serverDirectory=path.dirname(entry)
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
 if(!['prepare','build'].includes(command))deny('Use prepare or build; no cloud mutation is performed by this builder')
 const proof=command==='prepare'?prepareBaseline(repo,t,output):buildBaseline(repo,t,output)
 console.log(JSON.stringify({businessSourceSha:proof.businessSourceSha,changedFiles:proof.changedFiles,built:proof.built,artifact:proof.artifact??null}))
}

