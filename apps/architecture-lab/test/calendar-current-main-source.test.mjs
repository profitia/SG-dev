// Isolated exact-source proposal regressions. No provider, database or mail effects.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {calendarCurrentMainPredecessor,CALENDAR_CURRENT_MAIN_RECORD,CALENDAR_CURRENT_MAIN_RECORD_SHA256} from '../calendar-current-main-source.mjs'
const root=new URL('../../../',import.meta.url),current=p=>readFileSync(new URL(p,root)),cache=new Map()
const hash=b=>createHash('sha256').update(b).digest('hex')
const historical=(sha,p)=>{const key=sha+':'+p;if(!cache.has(key))cache.set(key,execFileSync('git',['cat-file','blob',key],{cwd:root,stdio:['ignore','pipe','pipe']}));return Buffer.from(cache.get(key))}
const record=()=>JSON.parse(current(CALENDAR_CURRENT_MAIN_RECORD))
test('joint closure authenticates both exact predecessors and keeps actual Root1.36 E1.3 SourceHub1.8',()=>{
 const view=calendarCurrentMainPredecessor(current,historical);assert(view);assert.equal(hash(current(CALENDAR_CURRENT_MAIN_RECORD)),CALENDAR_CURRENT_MAIN_RECORD_SHA256)
 for(const [name,read]of [['calendar',view.calendarBytes],['acceptedMain',view.acceptedMainBytes]]){
  const v=view.manifest.views[name]
  for(const p of Object.keys(v.replacements))assert.deepEqual(read(p),historical(v.sourceSha,p),name+':'+p)
  for(const p of v.addedPaths)assert.throws(()=>read(p),{code:'ENOENT'},name+':'+p)
  assert.equal(calendarCurrentMainPredecessor(read,historical),null)
 }
 const version=(read,p)=>JSON.parse(read(p)).version
 assert.equal(version(current,'packages/platform-contracts/package.json'),'1.36.0');assert.equal(version(current,'packages/platform-contracts/current-e1-authority/package.json'),'1.3.0');assert.equal(version(current,'packages/platform-source-hub-contracts/package.json'),'1.8.0')
 assert.equal(version(view.calendarBytes,'packages/platform-contracts/package.json'),'1.36.0');assert.equal(version(view.acceptedMainBytes,'packages/platform-source-hub-contracts/package.json'),'1.7.1')
 for(const p of ['apps/economic-calendar-runtime/package-lock.json','apps/newsfeed-runtime/package-lock.json','apps/platform-source-hub/package-lock.json','apps/sg-runtime/package-lock.json','apps/insights-runtime/package-lock.json']){
  const d=JSON.parse(current(p)).packages
  assert.equal(d['node_modules/@profitia/platform-contracts'].version,'1.36.0',p);assert.equal(d['node_modules/@profitia/platform-current-e1-authority'].version,'1.3.0',p);assert.equal(d['node_modules/@profitia/platform-source-hub-contracts'].version,'1.8.0',p)
  assert.equal(d['node_modules/@profitia/platform-source-hub-contracts'].peerDependencies['@profitia/platform-current-e1-authority'],'1.1.0 || 1.2.0 || 1.2.1 || 1.3.0',p)
 }
})
test('every changed or missing current graph byte is refused before any historical source is exposed',()=>{
 for(const p of Object.keys(record().sourceDigests)){
  let calls=0;const history=()=>{calls++;throw Error('HISTORY_MUST_NOT_BE_REACHED')}
  assert.throws(()=>calendarCurrentMainPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNREVIEWED')]):current(f),history),p)
  assert.equal(calls,0,p)
  assert.throws(()=>calendarCurrentMainPredecessor(f=>{if(f===p)throw Object.assign(Error('Missing current source'),{code:'ENOENT'});return current(f)},history),p)
  assert.equal(calls,0,p)
 }
})
test('every historical replacement is independently bound to its immutable input',()=>{
 for(const [name,v]of Object.entries(record().views))for(const p of Object.keys(v.replacements))assert.throws(()=>calendarCurrentMainPredecessor(current,(sha,f)=>sha===v.sourceSha&&f===p?Buffer.concat([historical(sha,f),Buffer.from('REBOUND')]):historical(sha,f)),name+':'+p)
})
test('altered record, source SHA, path inventory and activation flags cannot authorize either view',()=>{
 const a=record();for(const changed of [{...a,calendarInputSha:'f'.repeat(40)},{...a,acceptedMainSha:'f'.repeat(40)},{...a,sourceDigests:{}},{...a,runtimeActivated:true},{...a,unreviewed:true}])assert.throws(()=>calendarCurrentMainPredecessor(p=>p===CALENDAR_CURRENT_MAIN_RECORD?Buffer.from(JSON.stringify(changed)):current(p),historical))
 const denied=Object.assign(Error('Access denied'),{code:'EACCES'});assert.throws(()=>calendarCurrentMainPredecessor(()=>{throw denied},historical),e=>e===denied)
})
test('only genuine optional-record absence is optional; foreign paths and unknown revisions stay fatal',()=>{
 const main='77369b63888c5fa66d8d8159d5e8f36a23d25c83';assert.equal(calendarCurrentMainPredecessor(p=>historical(main,p),historical),null)
 assert.throws(()=>calendarCurrentMainPredecessor(p=>historical('f'.repeat(40),p),historical))
 assert.throws(()=>calendarCurrentMainPredecessor(()=>historical(main,'foreign-unreviewed-record.json'),historical))
 const denied=Object.assign(Error('Denied Git read'),{code:'EACCES',status:128});assert.throws(()=>calendarCurrentMainPredecessor(()=>{throw denied},historical),e=>e===denied)
})
test('closed predecessor buffers cannot mutate shared cached history',()=>{
 const view=calendarCurrentMainPredecessor(current,historical),p=Object.keys(view.manifest.views.calendar.replacements)[0],before=view.calendarBytes(p),original=Buffer.from(before);before.fill(0);assert.deepEqual(view.calendarBytes(p),original)
})
