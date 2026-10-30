import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {assertPciSmartIntegrity} from './pci-smart-integrity.mjs'
const receipt=()=>JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
const current=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url)),historical=(sha,file)=>execFileSync('git',['show',sha+':'+file])
test('smart preparation strictly binds all new/current sources while retaining every historical acceptance and engine',()=>assertPciSmartIntegrity(receipt(),current,historical))
test('tampered current file, receipt, historical digest, engine and rollback evidence are rejected',()=>{
 const r=receipt(),file=r.pciSmartPreparationCompatibility.changedSourcePaths[0]
 assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical))
 for(const mutate of [r=>r.pciSmartPreparationCompatibility.sourceDigests[file]='0'.repeat(64),r=>r.pciSmartPreparationCompatibility.srmRuntimeChanged=true,r=>r.bqlPciFirstSourceCompatibility.rulesetVersion='tampered']){const x=structuredClone(r);mutate(x);assert.throws(()=>assertPciSmartIntegrity(x,current,historical))}
 assert.throws(()=>assertPciSmartIntegrity(r,current,(sha,f)=>Buffer.concat([historical(sha,f),Buffer.from('tamper')])))
 const engine=r.pciSmartPreparationCompatibility.preservedEnginePaths[0]
 assert.throws(()=>assertPciSmartIntegrity(r,f=>f===engine?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical))
})
