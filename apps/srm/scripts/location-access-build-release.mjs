import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {assembleTask02rSource,copyTask02rArtifact} from './task02r-build-release.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const accepted='7833cbfff7cea55cbc2c92be8fff71650167b22d',canonical='https://github.com/profitia/SG-dev.git'
const target='apps/srm/src/server/supplier-locations.ts',manifestPath='apps/srm/deployment/location-access-release-source.json'
const hash=v=>createHash('sha256').update(v).digest('hex')
const run=(args,cwd,options={})=>execFileSync(args[0],args.slice(1),{cwd,encoding:'utf8',maxBuffer:128*1024*1024,...options})
const fail=code=>{throw Error(code)}
function authority(repository){
 const head=run(['git','rev-parse','HEAD'],repository).trim();let origin
 try{origin=run(['git','remote','get-url','origin'],repository,{stdio:'pipe'}).trim()}catch{
  if(process.env.TARGET_ENVIRONMENT!=='development'||process.env.RENDER_SERVICE_ID!=='srv-db1vu6gm7kps73d0e3r0'
   ||process.env.RENDER_GIT_REPO_SLUG!=='profitia/SG-dev'||process.env.RENDER_GIT_BRANCH!=='main'||process.env.RENDER_GIT_COMMIT!==head)fail('DEVELOPMENT_BUILD_IDENTITY_REQUIRED')
  origin=canonical
 }
 if(![canonical,canonical.slice(0,-4),'git@github.com:profitia/SG-dev.git'].includes(origin))fail('REPOSITORY_AUTHORITY_MISMATCH')
 return head
}
export function assembleLocationAccessSource(repository,output){
 const head=authority(repository),manifest=JSON.parse(fs.readFileSync(path.join(repository,manifestPath),'utf8'))
 if(manifest.baseArtifactSourceSha!==accepted||manifest.serviceId!=='srv-db1vu6gm7kps73d0e3r0'||manifest.targetEnvironment!=='development'
  ||Object.keys(manifest.overrides).join(',')!==target)fail('LOCATION_RELEASE_SCOPE_MISMATCH')
 const sourcePath=path.join(repository,target)
 if(!fs.lstatSync(sourcePath).isFile()||fs.lstatSync(sourcePath).isSymbolicLink()||hash(fs.readFileSync(sourcePath))!==manifest.overrides[target])fail('LOCATION_OVERRIDE_DIGEST_MISMATCH')
 if(hash(fs.readFileSync(path.join(repository,'apps/srm/scripts/task02r-build-release.mjs')))!==manifest.baseAssemblerDigest)fail('BASE_ASSEMBLER_MISMATCH')
 try{run(['git','cat-file','-e',accepted+'^{commit}'],repository,{stdio:'pipe'})}catch{run(['git','fetch','--no-tags','--depth=1',canonical,accepted],repository,{stdio:'pipe'})}
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'srm-location-input-'))
 try{
  const input=path.join(temp,'input')
  run(['git','clone','--quiet','--shared','--no-checkout',repository,input],repository)
  run(['git','sparse-checkout','set','apps/srm','packages/platform-contracts','packages/srm-xray','packages/maps-contracts','packages/maps-embed'],input)
  run(['git','checkout','--quiet','--detach',accepted],input)
  run(['git','remote','set-url','origin',canonical],input)
  const base=assembleTask02rSource(input,output),old=fs.readFileSync(path.join(output,target),'utf8')
  const needle='if(!row?.nip||!row.krs)return refuse()',replacement='if(!row?.nip)return refuse()'
  if(hash(old)!==manifest.baseFileDigest||old.split(needle).length!==2||old.replace(needle,replacement)!==fs.readFileSync(sourcePath,'utf8'))fail('LOCATION_CHANGE_NOT_EXACT')
  fs.copyFileSync(sourcePath,path.join(output,target))
  const receipt={...base,sourceRepositoryHead:head,baseArtifactSourceSha:accepted,locationAccessManifest:manifest,
   locationAccessManifestDigest:hash(fs.readFileSync(path.join(repository,manifestPath))),
   changedPaths:[target],identityOrKrsSourceAdopted:false}
  fs.writeFileSync(path.join(output,'task02r-release-source.json'),JSON.stringify(receipt,null,2)+'\n')
  return receipt
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
}
function build(){
 const head=authority(root)
 if(process.env.TARGET_ENVIRONMENT!=='development'||process.env.RENDER_SERVICE_ID!=='srv-db1vu6gm7kps73d0e3r0'||process.env.RENDER_GIT_COMMIT!==head)fail('DEVELOPMENT_BUILD_IDENTITY_REQUIRED')
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'srm-location-build-'))
 try{
  const source=path.join(temp,'source'),receipt=assembleLocationAccessSource(root,source)
  run(['npm','--prefix','apps/srm','ci','--install-links'],source,{stdio:'inherit'})
  run(['npm','--prefix','apps/srm','run','build'],source,{stdio:'inherit'})
  const next=path.join(source,'apps/srm/.next'),standalone=path.join(next,'standalone')
  if(!fs.existsSync(path.join(standalone,'server.js')))fail('STANDALONE_BUILD_MISSING')
  fs.mkdirSync(path.join(standalone,'.next'),{recursive:true});fs.cpSync(path.join(next,'static'),path.join(standalone,'.next/static'),{recursive:true})
  fs.writeFileSync(path.join(standalone,'task02r-release-source.json'),JSON.stringify(receipt,null,2)+'\n')
  copyTask02rArtifact(next,path.join(root,'apps/srm/.next'))
  console.log(JSON.stringify({kind:'SRM_LOCATION_ACCESS_NARROW_BUILD',status:'PASS',...receipt}))
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 if(process.argv[2]==='--assemble-only'&&process.argv.length===4)console.log(JSON.stringify(assembleLocationAccessSource(root,path.resolve(process.argv[3]))))
 else if(process.argv.length===2)build();else fail('EXPLICIT_BUILD_OR_ASSEMBLY_REQUIRED')
}
