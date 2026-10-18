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
function codeFiles(directory,prefix=''){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const relative=path.join(prefix,entry.name),file=path.join(directory,entry.name)
    if(entry.isSymbolicLink())throw Error('Local SDK source symlink refused')
    return entry.isDirectory()?codeFiles(file,relative):[relative]
  })
}
function mkdir(directory){
  if(fs.existsSync(directory))return
  mkdir(path.dirname(directory));fs.mkdirSync(directory);directories.push(directory)
}
try{
  if(manifest.name!==name||fs.realpathSync(source)!==source||['dependencies','peerDependencies','optionalDependencies'].some(key=>Object.keys(manifest[key]??{}).length))throw Error('Local SDK requires an explicit dependency setup review')
  const files=['src','migrations'].flatMap(directory=>codeFiles(path.join(source,directory)).map(file=>path.join(directory,file)))
  for(const app of['sg-runtime','dashboard-preview']){
    const consumer=path.join(root,'apps',app),declared=read(path.join(consumer,'package.json'))
    const lock=read(path.join(consumer,'package-lock.json')).packages?.[`node_modules/${name}`]
    if(declared.dependencies?.[name]!=='file:../../packages/platform-contracts'||!lock||lock.link
      ||lock.version!==manifest.version||!['file:../../packages/platform-contracts','../../packages/platform-contracts'].includes(lock.resolved))throw Error(`Unaccepted local SDK binding: ${app}`)
    const destination=path.join(consumer,'node_modules',name)
    if(!fs.existsSync(destination)){
      // A dangling existing link is someone else's state; do not replace it.
      try{fs.lstatSync(destination);throw Error(`Existing incomplete SDK fixture: ${app}`)}catch(error){if(error.code!=='ENOENT')throw error}
      mkdir(path.dirname(destination));fs.symlinkSync(source,destination,'dir')
      links.push({destination,inode:fs.lstatSync(destination).ino})
    }
    const installed=read(path.join(destination,'package.json'))
    if(installed.name!==name||installed.version!==manifest.version||installed.type!==manifest.type
      ||JSON.stringify(installed.exports)!==JSON.stringify(manifest.exports)
      ||files.some(file=>digest(path.join(source,file))!==digest(path.join(destination,file))))throw Error(`Existing SDK bytes differ: ${app}`)
  }
  if(!process.argv[2])throw Error('Explicit Node test arguments required')
  const result=spawnSync(process.execPath,process.argv.slice(2),{cwd:process.cwd(),stdio:'inherit'})
  if(result.error)throw Error('Cross-host test process could not start')
  process.exitCode=result.status??1
}catch(error){console.error(`[cross-host local SDK] ${error.message}`);process.exitCode=1}
finally{
  for(const {destination,inode}of links.reverse()){
    try{
      const current=fs.lstatSync(destination)
      if(current.ino===inode&&current.isSymbolicLink()&&fs.realpathSync(destination)===source)fs.unlinkSync(destination)
      else{console.error('[cross-host local SDK] Changed dependency preserved for recovery');process.exitCode=1}
    }catch(error){if(error.code!=='ENOENT'){console.error('[cross-host local SDK] Cleanup requires recovery');process.exitCode=1}}
  }
  for(const directory of directories.reverse())if(fs.existsSync(directory)&&fs.readdirSync(directory).length===0)fs.rmdirSync(directory)
}
