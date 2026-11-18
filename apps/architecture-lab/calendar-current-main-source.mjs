// Isolated proposal: closed build/test source compatibility, never runtime authority.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const CALENDAR_CURRENT_MAIN_RECORD='apps/architecture-lab/calendar-current-main-source.json'
export const CALENDAR_CURRENT_MAIN_RECORD_SHA256='16bed1c1812f346b11c1f4e0b710f6b369e46e1305c8f2eabfb18e52d1e48e69'
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
 assert.equal(a.calendarInputSha,'69d02834e863a51506aa4f50fbeb20f7fda3575b');assert.equal(a.acceptedMainSha,'d5eb40a061dd24c5ea65f9f373682179458cb589')
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
