import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'

const hash=value=>createHash('sha256').update(value).digest('hex')
export function registryPackage(original){
 const value=structuredClone(original)
 for(const [name,location]of Object.entries({
  '@profitia/platform-contracts':'file:../../packages/platform-contracts',
  '@profitia/krs-registry-contracts':'file:../../packages/krs-registry-contracts',
  '@profitia/krs-registry-runtime':'file:../krs-registry-runtime',
 }))value.dependencies[name]=location
 value.scripts.build='node scripts/build-krs-contract.mjs && '+original.scripts.build
 return value
}
export function verifyRegistryLock(original,variant){
 for(const [name,entry]of Object.entries(original.packages)){
  if(!name)continue
  if(JSON.stringify(entry)!==JSON.stringify(variant.packages[name]))throw Error('Staging dependency changed: '+name)
 }
 for(const [name,entry]of Object.entries(variant.packages)){
  if(original.packages[name])continue
  if(!['node_modules/@profitia/platform-contracts','node_modules/@profitia/krs-registry-contracts','node_modules/@profitia/krs-registry-runtime'].includes(name))throw Error('Unexpected new dependency: '+name)
  if(entry.hasInstallScript||entry.link)throw Error('Isolated local package without lifecycle required')
 }
}
/** Retain the original dependency lock byte-for-byte for every installed
 * baseline dependency. Only three already accepted local packages are added. */
export function prepareRegistryPackages(repo,output,proof){
 const app=path.join(output,'apps/srm'),pkg=JSON.parse(fs.readFileSync(path.join(app,'package.json')))
 const expected=registryPackage(pkg),variant=JSON.parse(fs.readFileSync(path.join(repo,'apps/srm/deployment/pilot2-registry-package.json')))
 if(JSON.stringify(expected)!==JSON.stringify(variant))throw Error('Registry package variant differs from the explicit baseline extension')
 const lock=JSON.parse(fs.readFileSync(path.join(repo,'apps/srm/deployment/pilot2-registry-package-lock.json')))
 verifyRegistryLock(JSON.parse(fs.readFileSync(path.join(app,'package-lock.json'))),lock)
 for(const name of ['package.json','package-lock.json']){
  fs.copyFileSync(path.join(repo,'apps/srm/deployment/pilot2-registry-'+name),path.join(app,name))
  proof.changedFiles.push('apps/srm/'+name)
 }
 const copies=[['packages/platform-contracts',['src','package.json','package-lock.json']],
  ['packages/krs-registry-contracts',['src','package.json','package-lock.json','tsconfig.json']],
  ['apps/krs-registry-runtime',['src','package.json','package-lock.json','tsconfig.json','migrations']]]
 proof.registryPackages=[]
 for(const [name,files]of copies)for(const file of files){
  const destination=path.join(output,name,file)
  if(fs.existsSync(destination))throw Error('Registry dependency overlay would overwrite historical source')
  fs.mkdirSync(path.dirname(destination),{recursive:true})
  fs.cpSync(path.join(repo,name,file),destination,{recursive:true})
 }
 const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>{
  const file=path.join(directory,entry.name)
  if(entry.isSymbolicLink())throw Error('Registry source symlink refused')
  return entry.isDirectory()?walk(file):[[path.relative(output,file).split(path.sep).join('/'),hash(fs.readFileSync(file))]]
 })
 for(const [name]of copies)proof.registryPackages.push(...walk(path.join(output,name)))
}
