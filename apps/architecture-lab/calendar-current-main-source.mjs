// Isolated proposal: closed build/test source compatibility, never runtime authority.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
export const CALENDAR_CURRENT_MAIN_RECORD='apps/architecture-lab/calendar-current-main-source.json'
export const CALENDAR_CURRENT_MAIN_RECORD_SHA256='7a44f6af8e8b7f999608964d14b9fd8331aa066e83c1afb5b9dae7ad3f4c5219'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const absent=(error,historical)=>{
 if(error?.code==='ENOENT')return true
 if(error?.status!==128)return false
 const text=String(error.stderr??'').trim(),prefix="fatal: path '"+CALENDAR_CURRENT_MAIN_RECORD+"' "
 if(!text.startsWith(prefix))return false
 const m=/^(?:does not exist in|exists on disk, but not in) '([a-f0-9]{40})'$/.exec(text.slice(prefix.length))
 if(!m)return false
 const witness=historical(m[1],'AGENTS.md')
 assert((Buffer.isBuffer(witness)||typeof witness==='string')&&witness.length>0,'readable historical revision required')
 return true
}
export function calendarCurrentMainPredecessor(current,historical){
 let bytes;try{bytes=current(CALENDAR_CURRENT_MAIN_RECORD)}catch(error){if(absent(error,historical))return null;throw error}
 assert.equal(hash(bytes),CALENDAR_CURRENT_MAIN_RECORD_SHA256,'exact closed Calendar/Knowledge source record')
 const a=JSON.parse(bytes)
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.scope,'CALENDAR_CURRENT_MAIN_EXACT_SOURCE_COMPATIBILITY')
 assert.equal(a.calendarInputSha,'69d02834e863a51506aa4f50fbeb20f7fda3575b');assert.equal(a.acceptedMainSha,'7a003e546268077c51059db564e297723334e98d')
 for(const k of ['runtimeActivated','newGrantsInstalled','providerCallsPerformed','deploymentPerformed'])assert.equal(a[k],false,k)
 // Every current byte is authenticated before either closed predecessor can be read.
 for(const [p,expected]of Object.entries(a.sourceDigests))assert.equal(hash(current(p)),expected,'complete joint current source '+p)
 const readers={}
 for(const name of ['calendar','acceptedMain']){
  const view=a.views[name];assert.equal(view.sourceSha,a[name==='calendar'?'calendarInputSha':'acceptedMainSha'])
  const added=new Set(view.addedPaths),cache=new Map()
  for(const [p,entry]of Object.entries(view.replacements)){
   assert.equal(entry.currentSha256,a.sourceDigests[p],'current replacement binding '+p)
   const before=Buffer.from(historical(view.sourceSha,p));assert.equal(hash(before),entry.previousSha256,'exact joint historical source '+name+':'+p);cache.set(p,before)
  }
  readers[name]=p=>{
   if(added.has(p))throw Object.assign(Error('Absent from closed '+name+' predecessor: '+p),{code:'ENOENT'})
   if(cache.has(p))return Buffer.from(cache.get(p))
   const data=Buffer.from(current(p));if(a.sourceDigests[p])assert.equal(hash(data),a.sourceDigests[p],'current source remains exact '+p)
   return data
  }
 }
 return{manifest:a,sourceDigests:{...a.sourceDigests,[CALENDAR_CURRENT_MAIN_RECORD]:hash(bytes),['apps/architecture-lab/calendar-current-main-source.mjs']:hash(current('apps/architecture-lab/calendar-current-main-source.mjs'))},calendarBytes:readers.calendar,acceptedMainBytes:readers.acceptedMain}
}

// Historical test suites need a complete clean input, not a partial overlay that
// leaves later Calendar records visible in an earlier ACG/Knowledge fixture.
// Authenticate every current graph byte before making this closed local clone.
export function createCalendarAcceptedMainTestFixture(sourceRoot){
 const source=sourceRoot instanceof URL?fileURLToPath(sourceRoot):path.resolve(sourceRoot)
 const git=(cwd,args)=>execFileSync('git',['-c','core.hooksPath=/dev/null',...args],{cwd,stdio:['ignore','pipe','pipe']})
 const current=p=>fs.readFileSync(path.join(source,p)),historical=(sha,p)=>git(source,['cat-file','blob',sha+':'+p])
 const joint=calendarCurrentMainPredecessor(current,historical)
 if(!joint)return {root:source,close(){}}
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'calendar-accepted-input-test-')),root=path.join(temporary,'source')
 const close=()=>fs.rmSync(temporary,{recursive:true,force:true})
 try{
  git(source,['clone','--quiet','--shared','--no-checkout','--',source,root])
  git(root,['checkout','--quiet','--detach',joint.manifest.acceptedMainSha])
  assert.equal(String(git(root,['rev-parse','HEAD'])).trim(),joint.manifest.acceptedMainSha)
  assert.equal(String(git(root,['status','--porcelain'])),'')
  const authority=String(git(source,['rev-parse','--verify','refs/remotes/origin/main^{commit}'])).trim()
  git(root,['update-ref','refs/remotes/origin/main',authority])
  return {root,close}
 }catch(error){close();throw error}
}
