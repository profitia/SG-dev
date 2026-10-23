import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {fileURLToPath, pathToFileURL} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const manifestPath='apps/srm/deployment/task02r-release-source.json'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const run=(command,args,cwd,extra={})=>execFileSync(command,args,{cwd,encoding:'utf8',maxBuffer:128*1024*1024,...extra})
const fail=code=>{throw Error(code)}
function regular(root,name){
 if(!/^[a-zA-Z0-9._/-]+$/.test(name)||name.split('/').some(p=>p==='..'||p===''))fail('INVALID_RELEASE_PATH')
 let cursor=root
 for(const part of name.split('/')){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())fail('RELEASE_SYMLINK_REFUSED')}
 if(!fs.statSync(cursor).isFile())fail('RELEASE_FILE_REQUIRED')
 return cursor
}
function updateJson(output,name,change){
 const file=regular(output,name),value=JSON.parse(fs.readFileSync(file,'utf8'))
 change(value);fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n')
}

/** A fresh build tree, never a reset/revert of main or an existing checkout.
 * All unlisted source bytes come from the currently deployed accepted release. */
export function assembleTask02rSource(repositoryRoot,outputRoot){
 const manifest=JSON.parse(fs.readFileSync(path.join(repositoryRoot,manifestPath),'utf8'))
 const expectedBase='a0a3b0626fac16e011b57d6284ce55abcfcd3ca3'
 const expectedPaths=['apps/srm/src/server/native-pg-driver.ts','apps/srm/src/server/supplier-request-work.ts',
  'packages/maps-embed/package.json','packages/platform-contracts/src/operation-context.d.mts',
  'packages/platform-contracts/src/operation-context.mjs','packages/platform-contracts/src/private-operation-host.d.mts',
  'packages/platform-contracts/src/private-operation-host.mjs']
 if(manifest.baselineSha!==expectedBase||manifest.targetEnvironment!=='development'
  ||manifest.serviceId!=='srv-db1vu6gm7kps73d0e3r0'||manifest.platformVersion!=='1.26.0'
  ||JSON.stringify(Object.keys(manifest.overrides).sort())!==JSON.stringify(expectedPaths))fail('RELEASE_SCOPE_MISMATCH')
 if(!path.isAbsolute(outputRoot)||fs.existsSync(outputRoot))fail('FRESH_RELEASE_DIRECTORY_REQUIRED')
 const origin=run('git',['remote','get-url','origin'],repositoryRoot).trim()
 if(!['https://github.com/profitia/SG-dev','https://github.com/profitia/SG-dev.git','git@github.com:profitia/SG-dev.git'].includes(origin))fail('REPOSITORY_AUTHORITY_MISMATCH')
 for(const [name,digest]of Object.entries(manifest.overrides))if(hash(fs.readFileSync(regular(repositoryRoot,name)))!==digest)fail('RELEASE_OVERRIDE_DIGEST_MISMATCH')
 // A shallow provider checkout may need the explicitly pinned ancestor only.
 try{run('git',['cat-file','-e',expectedBase+'^{commit}'],repositoryRoot,{stdio:'pipe'})}
 catch{run('git',['fetch','--no-tags','--depth=1','origin',expectedBase],repositoryRoot,{stdio:'pipe'})}
 fs.mkdirSync(outputRoot)
 const sourceRoots=['apps/srm','packages/platform-contracts','packages/srm-xray','packages/maps-contracts','packages/maps-embed']
 const archive=run('git',['archive','--format=tar',expectedBase,...sourceRoots],repositoryRoot,{encoding:null})
 run('tar',['-xf','-','-C',outputRoot],repositoryRoot,{input:archive})
 for(const name of Object.keys(manifest.overrides)){
  const target=regular(outputRoot,name)
  fs.copyFileSync(regular(repositoryRoot,name),target)
 }
 const version=value=>{if(value.version!=='1.25.0')fail('BASE_PLATFORM_VERSION_MISMATCH');value.version=manifest.platformVersion}
 updateJson(outputRoot,'packages/platform-contracts/package.json',version)
 updateJson(outputRoot,'packages/platform-contracts/package-lock.json',value=>{version(value);version(value.packages[''])})
 updateJson(outputRoot,'apps/srm/package-lock.json',value=>{
  let found=false
  for(const [name,pkg]of Object.entries(value.packages)){
   if(name==='node_modules/@profitia/platform-contracts'){version(pkg);found=true}
   if(name==='node_modules/@profitia/maps-embed'){
    const peer=pkg.peerDependencies?.['@profitia/platform-contracts']
    if(typeof peer!=='string'||!peer.endsWith('1.25.0'))fail('BASE_MAPS_PEER_MISMATCH')
    pkg.peerDependencies['@profitia/platform-contracts']=peer+' || 1.26.0'
   }
  }
  if(!found)fail('BASE_PLATFORM_LOCK_MISSING')
 })
 const receipt={...manifest,sourceRepositoryHead:run('git',['rev-parse','HEAD'],repositoryRoot).trim(),
  manifestSha256:hash(fs.readFileSync(path.join(repositoryRoot,manifestPath))),
  sourceRoots,sourceSelection:'ACCEPTED_BASELINE_PLUS_EXACT_OVERRIDES',identityOrKrsSourceAdopted:false}
 fs.writeFileSync(path.join(outputRoot,'task02r-release-source.json'),JSON.stringify(receipt,null,2)+'\n')
 return receipt
}

function build(){
 if(process.env.TARGET_ENVIRONMENT!=='development'||process.env.RENDER_SERVICE_ID!=='srv-db1vu6gm7kps73d0e3r0'
  ||!/^[a-f0-9]{40}$/.test(process.env.RENDER_GIT_COMMIT??'')
  ||run('git',['rev-parse','HEAD'],root).trim()!==process.env.RENDER_GIT_COMMIT)fail('DEVELOPMENT_BUILD_IDENTITY_REQUIRED')
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'srm-task02r-release-'))
 try{
  const source=path.join(temporary,'source'),receipt=assembleTask02rSource(root,source)
  run('npm',['--prefix','apps/srm','ci','--install-links'],source,{stdio:'inherit'})
  run('npm',['--prefix','apps/srm','run','build'],source,{stdio:'inherit'})
  const next=path.join(source,'apps/srm/.next'),standalone=path.join(next,'standalone')
  if(!fs.existsSync(path.join(standalone,'server.js')))fail('STANDALONE_BUILD_MISSING')
  fs.mkdirSync(path.join(standalone,'.next'),{recursive:true})
  fs.cpSync(path.join(next,'static'),path.join(standalone,'.next/static'),{recursive:true})
  fs.writeFileSync(path.join(standalone,'task02r-release-source.json'),JSON.stringify(receipt,null,2)+'\n')
  // This is the isolated provider BUILD workspace; never the running instance.
  const destination=path.join(root,'apps/srm/.next')
  if(fs.existsSync(destination)&&fs.lstatSync(destination).isSymbolicLink())fail('BUILD_DESTINATION_SYMLINK_REFUSED')
  fs.rmSync(destination,{recursive:true,force:true})
  fs.cpSync(next,destination,{recursive:true})
  console.log(JSON.stringify({kind:'TASK02R_NARROW_BUILD',status:'PASS',...receipt}))
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 if(process.argv[2]==='--assemble-only'&&process.argv.length===4)console.log(JSON.stringify(assembleTask02rSource(root,path.resolve(process.argv[3]))))
 else if(process.argv.length===2)build()
 else fail('EXPLICIT_BUILD_OR_FRESH_ASSEMBLY_PATH_REQUIRED')
}
