import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {assertPciSmartIntegrity} from './pci-smart-integrity.mjs'
const receipt=()=>JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
const current=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url)),historical=(sha,file)=>execFileSync('git',['show',sha+':'+file])
function candidateSourcePaths(root){
 // The receipt's historical baseline remains immutable. Scope coverage uses the
 // actual PR merge-base, so already accepted parallel work is not attributed to PCI.
 const base=execFileSync('git',['merge-base','HEAD','origin/main'],{encoding:'utf8',cwd:root}).trim()
 return execFileSync('git',['diff','--name-only',base,'HEAD','--','apps/sg-runtime','packages/sg2-price-change-index-ui','apps/sg2-price-change-index-demo'],{encoding:'utf8',cwd:root}).trim().split('\n').filter(f=>f&&f!=='apps/sg-runtime/operation-integration.json').sort()
}
test('smart preparation strictly binds all new/current sources while retaining every historical acceptance and engine',()=>assertPciSmartIntegrity(receipt(),current,historical))
test('tampered current file, receipt, historical digest, engine and rollback evidence are rejected',()=>{
 const r=receipt(),file=r.pciSmartPreparationCompatibility.changedSourcePaths[0]
 assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical))
 for(const mutate of [r=>r.pciSmartPreparationCompatibility.sourceDigests[file]='0'.repeat(64),r=>r.pciSmartPreparationCompatibility.srmRuntimeChanged=true,r=>r.bqlPciFirstSourceCompatibility.rulesetVersion='tampered']){const x=structuredClone(r);mutate(x);assert.throws(()=>assertPciSmartIntegrity(x,current,historical))}
 assert.throws(()=>assertPciSmartIntegrity(r,current,(sha,f)=>Buffer.concat([historical(sha,f),Buffer.from('tamper')])))
 const engine=r.pciSmartPreparationCompatibility.preservedEnginePaths[0]
 assert.throws(()=>assertPciSmartIntegrity(r,f=>f===engine?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical))
})
test('every changed SG2 source in the candidate has an exact additive binding',()=>{
 const a=receipt().pciSmartPreparationCompatibility
 // Prisma lifecycle output is independently generated, never an authored source change.
 assert.deepEqual(a.changedSourcePaths,candidateSourcePaths(new URL('../../../',import.meta.url)))
})
test('scope coverage retains accepted parallel files but rejects any unbound candidate amendment',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sg2-pci-source-scope-'))
 const git=(...args)=>execFileSync('git',['-c','core.hooksPath=/dev/null',...args],{cwd:root,encoding:'utf8'})
 const write=(file,text)=>{const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text)}
 const parallel='apps/sg-runtime/docs/accepted-maps.md',pci='apps/sg-runtime/lib/pci-candidate.ts'
 const commit=()=>{git('add','.');git('-c','user.name=Isolated fixture','-c','user.email=fixture@example.invalid','commit','-qm','isolated fixture')}
 try{
  git('init','-q','-b','main');write('README.md','fixture');commit()
  write(parallel,'accepted independent owner source');commit();git('update-ref','refs/remotes/origin/main','HEAD')
  git('switch','-qc','candidate');write(pci,'PCI source');commit()
  assert.deepEqual(candidateSourcePaths(root),[pci])
  write(parallel,'unapproved amendment');commit()
  assert.deepEqual(candidateSourcePaths(root),[parallel,pci])
  assert.throws(()=>assert.deepEqual(candidateSourcePaths(root),[pci]),'An amendment to accepted parallel work must remain detectable')
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
