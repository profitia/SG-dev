import {calendarCurrentMainPredecessor} from '../../architecture-lab/calendar-current-main-source.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {procurementInsightsEditorialPackagePredecessor,EDITORIAL_PACKAGE_BASE,EDITORIAL_PACKAGE_RECEIPT,EDITORIAL_PACKAGE_PATHS} from './procurement-insights-editorial-package-integrity.mjs'
const root=fileURLToPath(new URL('../../../',import.meta.url))
const historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root})
const physical=p=>fs.readFileSync(path.join(root,p))
const current=calendarCurrentMainPredecessor(physical,historical)?.acceptedMainBytes??physical
const hash=b=>createHash('sha256').update(b).digest('hex')
test('editorial package continuation verifies version-only metadata and all29 immutable receipts',()=>{
 const v=procurementInsightsEditorialPackagePredecessor(current,historical)
 assert.equal(v.manifest.packageVersionAfter,'1.2.1');assert.equal(Object.keys(v.manifest.preservedReceipts).length,29)
 for(const p of EDITORIAL_PACKAGE_PATHS.filter(p=>!p.includes('editorial-package-integrity'))){
  assert.deepEqual(v.previousBytes(p),historical(EDITORIAL_PACKAGE_BASE,p));const mutable=v.previousBytes(p);mutable.fill(0);assert.deepEqual(v.previousBytes(p),historical(EDITORIAL_PACKAGE_BASE,p))
 }
 assert.throws(()=>v.previousBytes(EDITORIAL_PACKAGE_RECEIPT),e=>e.code==='ENOENT')
})
test('editorial package continuation rejects tampered source, widened dependency or authority',()=>{
 const p='apps/insights-runtime/package.json'
 assert.throws(()=>procurementInsightsEditorialPackagePredecessor(f=>f===p?Buffer.from('{}'):current(f),historical))
 const modified=JSON.parse(current(p));modified.dependencies.pg='0.0.0'
 const b=Buffer.from(JSON.stringify(modified)),receipt=JSON.parse(current(EDITORIAL_PACKAGE_RECEIPT));receipt.sourceDigests[p]=hash(b)
 assert.throws(()=>procurementInsightsEditorialPackagePredecessor(f=>f===p?b:f===EDITORIAL_PACKAGE_RECEIPT?Buffer.from(JSON.stringify(receipt)):current(f),historical),/only editorial local package version/)
 receipt.authorisationChanged=true
 assert.throws(()=>procurementInsightsEditorialPackagePredecessor(f=>f===EDITORIAL_PACKAGE_RECEIPT?Buffer.from(JSON.stringify(receipt)):current(f),historical))
})
test('editorial package continuation leaves receipt-absent historical graphs untouched',()=>{
 assert.equal(procurementInsightsEditorialPackagePredecessor(p=>{if(p===EDITORIAL_PACKAGE_RECEIPT)throw Object.assign(Error('absent'),{code:'ENOENT'});return current(p)},historical),null)
})

import os from 'node:os'
test('versioned lock refresh replaces a cached local package using offline npm',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pi-editorial-package-cache-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
 const pkg=path.join(dir,'package'),app=path.join(dir,'app');fs.mkdirSync(path.join(pkg,'src'),{recursive:true});fs.mkdirSync(app)
 const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n'),meta=path.join(pkg,'package.json')
 write(meta,{name:'@profitia/editorial-cache-fixture',version:'1.2.0',files:['src']});fs.writeFileSync(path.join(pkg,'src/profile.txt'),'PREVIOUS_PROFILE')
 write(path.join(app,'package.json'),{name:'controlled-editorial-cache-test',version:'1.0.0',dependencies:{'@profitia/editorial-cache-fixture':'file:../package'}})
 for(const p of ['user','global'])fs.writeFileSync(path.join(dir,p),'')
 const env={PATH:process.env.PATH,...(process.env.HOME?{HOME:process.env.HOME}:{}),NPM_CONFIG_USERCONFIG:path.join(dir,'user'),NPM_CONFIG_GLOBALCONFIG:path.join(dir,'global'),NPM_CONFIG_CACHE:path.join(dir,'cache')}
 const install=()=>execFileSync('npm',['install','--offline','--install-links','--ignore-scripts','--no-audit','--no-fund'],{cwd:app,env,stdio:'pipe'})
 const installed=()=>fs.readFileSync(path.join(app,'node_modules/@profitia/editorial-cache-fixture/src/profile.txt'),'utf8')
 install();assert.equal(installed(),'PREVIOUS_PROFILE')
 fs.writeFileSync(path.join(pkg,'src/profile.txt'),'APPROVED_EDITORIAL_PROFILE');install();assert.equal(installed(),'PREVIOUS_PROFILE','same version retains the cached local package')
 write(meta,{name:'@profitia/editorial-cache-fixture',version:'1.2.1',files:['src']});const lock=JSON.parse(fs.readFileSync(path.join(app,'package-lock.json')));lock.packages['node_modules/@profitia/editorial-cache-fixture'].version='1.2.1';write(path.join(app,'package-lock.json'),lock)
 install();assert.equal(installed(),'APPROVED_EDITORIAL_PROFILE')
})
