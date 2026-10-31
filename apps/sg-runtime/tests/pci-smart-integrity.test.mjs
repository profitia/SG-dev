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
function assertSourceCoverage(changed,bound){
 assert.deepEqual(changed,changed.filter(file=>Object.hasOwn(bound,file)),'every actual candidate amendment requires an exact source binding')
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
test('every changed SG2 source in the candidate or resulting main has an exact additive binding',()=>{
 const r=receipt(),a=r.pciSmartPreparationCompatibility
 // Prisma lifecycle output is independently generated, never an authored source change.
 // A published receipt retains its original source set after merge. Current
 // bytes are strictly verified above; an accepted main has no new amendments.
 assertSourceCoverage(candidateSourcePaths(new URL('../../../',import.meta.url)),{...a.sourceDigests,...r.pciSmartResultingMainScopeCompatibility?.sourceDigests})
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
  assertSourceCoverage(candidateSourcePaths(root),{[pci]:'exact digest checked by the integrity verifier'})
  git('update-ref','refs/remotes/origin/main','HEAD')
  assert.deepEqual(candidateSourcePaths(root),[])
  assertSourceCoverage(candidateSourcePaths(root),{[pci]:'retained published binding'})
  write(parallel,'unapproved amendment');commit()
  assert.deepEqual(candidateSourcePaths(root),[parallel])
  assert.throws(()=>assertSourceCoverage(candidateSourcePaths(root),{[pci]:'retained published binding'}),'An amendment to accepted parallel work must remain detectable')
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
test('resulting-main continuation rejects every amended current source and prior-receipt manipulation',()=>{
 const r=receipt(),a=r.pciSmartResultingMainScopeCompatibility
 assert(a)
 for(const file of Object.keys(a.sourceDigests))assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical))
 for(const mutate of [r=>r.pciSmartResultingMainScopeCompatibility.previousReceiptSha256='0'.repeat(64),r=>r.pciSmartResultingMainScopeCompatibility.sourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64),r=>r.pciSmartResultingMainScopeCompatibility.productChanged=true,r=>r.unapprovedReceipt={}]){
  const changed=structuredClone(r);mutate(changed);assert.throws(()=>assertPciSmartIntegrity(changed,current,historical))
 }
})
