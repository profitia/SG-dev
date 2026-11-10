import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {assertAssistantM1Integrity,ASSISTANT_M1_RUNTIME_PATHS,ASSISTANT_M1_PEER_PATHS,ASSISTANT_M1_CHART_CORRECTIVE_PATHS} from './assistant-m1-integrity.mjs'
import {assertPciSmartIntegrity} from './pci-smart-integrity.mjs'
const root=new URL('../../../',import.meta.url),cache=new Map(),current=p=>fs.readFileSync(new URL(p,root))
const historical=(sha,p)=>{const k=sha+':'+p;if(!cache.has(k))cache.set(k,execFileSync('git',['show',k],{cwd:root}));return cache.get(k)}
const hash=v=>createHash('sha256').update(v).digest('hex')
test('M1 binds the complete current assistant source and immutable producer without rewriting previous product acceptance',()=>{
 const receipt=JSON.parse(current('apps/sg-runtime/operation-integration.json')),a=receipt.assistantM1RuntimeSourceCompatibility
 assertAssistantM1Integrity(receipt,current,historical);assertPciSmartIntegrity(receipt,current,historical)
 for(const [p,h]of Object.entries({...a.consumerSourceDigests,...a.peerSourceDigests}))assert.equal(hash(historical(a.sourceProducerSha,p)),h,'committed M1 producer '+p)
 for(const p of [...ASSISTANT_M1_RUNTIME_PATHS,...ASSISTANT_M1_PEER_PATHS])assert.throws(()=>assertAssistantM1Integrity(receipt,f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),historical),p)
 for(const mutate of [a=>a.historyRetentionDays=31,a=>a.maximumPilotUsd=6,a=>a.maximumPilotTokens=200001,a=>a.runtimeActivated=true,a=>a.grantsChanged=true,a=>a.otherEnvironmentsChanged=true,a=>delete a.consumerSourceDigests[ASSISTANT_M1_RUNTIME_PATHS[0]],a=>a.peerSourceDigests['apps/srm/unapproved.ts']='0'.repeat(64),a=>a.previousReceiptSha256='0'.repeat(64)]){
  const changed=structuredClone(receipt);mutate(changed.assistantM1RuntimeSourceCompatibility);assert.throws(()=>assertAssistantM1Integrity(changed,current,historical))
 }
 const changed=structuredClone(receipt);changed.appShellAssistantOwnership.singleAppShellOwner=false
 assert.throws(()=>assertAssistantM1Integrity(changed,current,historical),'historical authority cannot be rewritten by a new receipt')
})
test('the actual-chart corrective is closed, committed and preserves the accepted M1 receipt byte for byte',()=>{
 const receipt=JSON.parse(current('apps/sg-runtime/operation-integration.json'))
 assert(receipt.assistantM1ChartContextCorrective)
 assertAssistantM1Integrity(receipt,current,historical)
 for(const p of ASSISTANT_M1_CHART_CORRECTIVE_PATHS)assert.throws(()=>assertAssistantM1Integrity(receipt,f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),historical),p)
 for(const mutate of [a=>a.authorizationChanged=true,a=>a.pilotLimitsChanged=true,a=>a.previousReceiptSha256='0'.repeat(64),a=>a.sourceProducerSha='0'.repeat(40),a=>a.sourceDigests['apps/srm/unapproved.ts']='0'.repeat(64)]){
  const changed=structuredClone(receipt);mutate(changed.assistantM1ChartContextCorrective);assert.throws(()=>assertAssistantM1Integrity(changed,current,historical))
 }
})
