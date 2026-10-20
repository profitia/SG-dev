/** Cross-host tests need both hosts' declared local SDK, while independent CI
 * installs only the host being built. Stage only missing genuine file deps;
 * never fetch a registry, run package hooks, overwrite or mock an SDK. */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'

const root=fs.realpathSync(fileURLToPath(new URL('../../../',import.meta.url)))
const source=path.join(root,'packages/platform-contracts'),name='@profitia/platform-contracts'
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const manifest=read(path.join(source,'package.json'))
const links=[],directories=[]
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const publicDependency=Object.freeze({name:'ipaddr.js',version:'2.2.0',
 resolved:'https://registry.npmjs.org/ipaddr.js/-/ipaddr.js-2.2.0.tgz',
 integrity:'sha512-Ag3wB2o37wslZS19hZqorUnrnzSkpOVy+IiiDEiTqNubEYpYuHWIf6K4psgN2ZWKExS4xhVCrRVfb/wfW8fWJA==',
 files:{'package.json':'fa44e1fd8e7cccd8471b75e4f801d3cfc328d5ff4acf914cf136e7d2fd4604b9',
  'lib/ipaddr.js':'75c602c8834cc9e1bcdb7d1d2eaadbbd5ba0e19660d9ea3f450dbf17f2ec8495'}})
function dependencyRecord(lock){
 const entry=lock.packages?.[`node_modules/${publicDependency.name}`]
 if(!entry||entry.link||entry.version!==publicDependency.version||entry.resolved!==publicDependency.resolved
  ||entry.integrity!==publicDependency.integrity)throw Error('Unaccepted public dependency lock')
}
function verifyPublicDirectory(directory,knownTarget=directory){
 const actual=fs.realpathSync(directory)
 if(actual!==directory&&actual!==knownTarget)throw Error('Foreign public dependency preserved')
 for(const[file,expected]of Object.entries(publicDependency.files)){
  const target=path.join(actual,file)
  if(fs.lstatSync(target).isSymbolicLink()||digest(target)!==expected)throw Error('Installed public dependency bytes differ')
 }
 const pkg=read(path.join(actual,'package.json'))
 if(pkg.name!==publicDependency.name||pkg.version!==publicDependency.version||pkg.main!=='./lib/ipaddr.js'
  ||['dependencies','peerDependencies','optionalDependencies'].some(key=>Object.keys(pkg[key]??{}).length))throw Error('Unaccepted installed public dependency')
}
function codeFiles(directory,prefix=''){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const relative=path.join(prefix,entry.name),file=path.join(directory,entry.name)
    if(entry.isSymbolicLink())throw Error('Local SDK source symlink refused')
    return entry.isDirectory()?codeFiles(file,relative):[relative]
  })
}
function mkdir(directory){
  if(fs.existsSync(directory)){
    if(fs.realpathSync(directory)!==directory||!fs.statSync(directory).isDirectory())throw Error('Foreign fixture directory preserved')
    return
  }
  mkdir(path.dirname(directory));fs.mkdirSync(directory);directories.push({directory,inode:fs.lstatSync(directory).ino})
}
function stageMissingLink(destination,target){
 if(fs.existsSync(destination))return false
 try{fs.lstatSync(destination);throw Error('Existing incomplete dependency fixture preserved')}catch(error){if(error.code!=='ENOENT')throw error}
 mkdir(path.dirname(destination));fs.symlinkSync(target,destination,'dir')
 links.push({destination,source:target,inode:fs.lstatSync(destination).ino});return true
}
try{
  if(['NPM_TOKEN','NODE_AUTH_TOKEN','SG2_PACKAGES_READ_TOKEN'].some(key=>process.env[key]))throw Error('Package credentials must be removed before cross-host execution')
  if(manifest.name!==name||fs.realpathSync(source)!==source
    ||JSON.stringify(manifest.dependencies)!==JSON.stringify({[publicDependency.name]:publicDependency.version})
    ||['peerDependencies','optionalDependencies'].some(key=>Object.keys(manifest[key]??{}).length))throw Error('Local SDK requires an explicit dependency setup review')
  const host=path.join(root,'apps/sg-runtime'),installedPublic=path.join(host,'node_modules',publicDependency.name)
  if(fs.realpathSync(process.cwd())!==host)throw Error('Explicit receiving host required')
  dependencyRecord(read(path.join(source,'package-lock.json')))
  for(const app of['sg-runtime','dashboard-preview'])dependencyRecord(read(path.join(root,'apps',app,'package-lock.json')))
  verifyPublicDirectory(installedPublic)
  const sourcePublic=path.join(source,'node_modules',publicDependency.name)
  stageMissingLink(sourcePublic,installedPublic);verifyPublicDirectory(sourcePublic,installedPublic)
  const files=['src','migrations'].flatMap(directory=>codeFiles(path.join(source,directory)).map(file=>path.join(directory,file)))
  for(const app of['sg-runtime','dashboard-preview']){
    const consumer=path.join(root,'apps',app),declared=read(path.join(consumer,'package.json'))
    const lock=read(path.join(consumer,'package-lock.json')).packages?.[`node_modules/${name}`]
    if(declared.dependencies?.[name]!=='file:../../packages/platform-contracts'||!lock||lock.link
      ||lock.version!==manifest.version||!['file:../../packages/platform-contracts','../../packages/platform-contracts'].includes(lock.resolved))throw Error(`Unaccepted local SDK binding: ${app}`)
    const destination=path.join(consumer,'node_modules',name)
    stageMissingLink(destination,source)
    const installed=read(path.join(destination,'package.json'))
    if(installed.name!==name||installed.version!==manifest.version||installed.type!==manifest.type
      ||JSON.stringify(installed.exports)!==JSON.stringify(manifest.exports)
      ||JSON.stringify(installed.dependencies)!==JSON.stringify(manifest.dependencies)
      ||files.some(file=>digest(path.join(source,file))!==digest(path.join(destination,file))))throw Error(`Existing SDK bytes differ: ${app}`)
  }
  if(!process.argv[2])throw Error('Explicit Node test arguments required')
  const result=spawnSync(process.execPath,process.argv.slice(2),{cwd:process.cwd(),stdio:'inherit'})
  if(result.error)throw Error('Cross-host test process could not start')
  process.exitCode=result.status??1
}catch(error){console.error(`[cross-host local SDK] ${error.message}`);process.exitCode=1}
finally{
  for(const {destination,source:target,inode}of links.reverse()){
    try{
      const current=fs.lstatSync(destination)
      if(current.ino===inode&&current.isSymbolicLink()&&fs.realpathSync(destination)===target)fs.unlinkSync(destination)
      else{console.error('[cross-host local SDK] Changed dependency preserved for recovery');process.exitCode=1}
    }catch(error){if(error.code!=='ENOENT'){console.error('[cross-host local SDK] Cleanup requires recovery');process.exitCode=1}}
  }
  for(const {directory,inode}of directories.reverse())if(fs.existsSync(directory)&&fs.lstatSync(directory).ino===inode
    &&fs.realpathSync(directory)===directory&&fs.statSync(directory).isDirectory()&&fs.readdirSync(directory).length===0)fs.rmdirSync(directory)
}
