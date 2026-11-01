import {assertPciInputCorrective} from './pci-smart-integrity.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../../..'),app=path.join(root,'apps/sg-runtime');
const hash=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const read=(file:string)=>fs.readFileSync(path.join(root,file));
const historical=(sha:string,file:string)=>execFileSync('git',['show',sha+':'+file],{cwd:root});
function verify(receipt:any,current=read){
 if(receipt.pciSmartInputCorrective){const n=assertPciInputCorrective(receipt,current,historical);return verify(n.prior,n.previousBytes)}
 const a=receipt.fullUiParityAdoption;
 assert.equal(a.projectKey,'SG2');assert.equal(a.taskId,'SG2-XRAY-FULL-UI-PARITY-B-20261031');assert.equal(a.status,'SOURCE_CANDIDATE');
 const before=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json');assert.equal(hash(before),a.previousReceiptDigest);
 const {fullUiParityAdoption,...preserved}=receipt;assert.deepEqual(preserved,JSON.parse(before.toString()),'every old operation receipt remains unchanged');
 const descriptor=JSON.parse(current('apps/sg-runtime/xray-appshell-integration.json').toString()),{fullUiParityAdoption:descriptorAdoption,...oldDescriptor}=descriptor;
 const old=historical(a.previousReceiptSourceSha,'apps/sg-runtime/xray-appshell-integration.json');assert.equal(hash(old),a.previousDescriptorDigest);assert.deepEqual(oldDescriptor,JSON.parse(old.toString()));
 const priorCandidate=a.sourceCandidateHistory;
 assert.equal(priorCandidate.previousCandidateSourceSha,'1c35e43755c603f4b4fee32f7336c68f916f3241');
 const candidateBytes=historical(priorCandidate.previousCandidateSourceSha,'apps/sg-runtime/operation-integration.json');
 assert.equal(hash(candidateBytes),priorCandidate.previousCandidateReceiptSha256);
 assert.deepEqual(a.publicUi,JSON.parse(candidateBytes.toString()).fullUiParityAdoption.publicUi,'previously reviewed producer stays exact');
 assert.equal(priorCandidate.preservedPublicUiDigest,a.publicUi.sourceDigest);
 assert.deepEqual(descriptorAdoption.publicUi,a.publicUi);
 assert.equal(a.publicUi.producer.projectKey,'SRM');assert(Number.isInteger(a.publicUi.producer.pullRequest));assert.match(a.publicUi.producer.sourceSha,/^[a-f0-9]{40}$/);
 const producer=JSON.parse(historical(a.publicUi.producer.sourceSha,'apps/srm/operation-integration.json').toString()).fullUiParityAdoption;
 const {producer:identity,...publicUi}=a.publicUi;assert.deepEqual(publicUi,producer.publicUi);
 const digest=createHash('sha256');
 for(const file of a.publicUi.sourceFiles){assert(!path.isAbsolute(file)&&!file.split('/').includes('..'));const actual=current('packages/srm-xray/'+file);assert.equal(hash(actual),hash(historical(a.publicUi.producer.sourceSha,'packages/srm-xray/'+file)),file);digest.update(file).update('\0').update(actual).update('\0')}
 assert.equal(digest.digest('hex'),a.publicUi.sourceDigest);assert.equal(a.publicUi.version,'0.4.0');
 for(const[file,value]of Object.entries(a.applicationSourceDigests))assert.equal(hash(current(path.posix.normalize('apps/sg-runtime/'+file))),value,file);
 for(const key of ['legacyPeerRoutesChanged','identityOrE1Changed','financialEngineCopied','schemaChanged','productDeploymentPerformed'])assert.equal(a[key],false,key);
 assert.equal(a.liveAcceptance,'LIVE_NOT_VERIFIED');
}
test('SG2 accepts the exact full SRM producer and preserves all preceding operation and descriptor receipts',()=>verify(JSON.parse(fs.readFileSync(path.join(app,'operation-integration.json'),'utf8'))));
test('SG2 full UI acceptance rejects rewritten history, package drift and host drift',()=>{
 const receipt=JSON.parse(fs.readFileSync(path.join(app,'operation-integration.json'),'utf8'));
 const changed=structuredClone(receipt);changed.fullUiParityAdoption.publicUi.sourceDigest='0'.repeat(64);assert.throws(()=>verify(changed));
 for(const mutate of [(r:any)=>{r.pciSmartPreparationCompatibility.srmRuntimeChanged=true},(r:any)=>{r.fullUiParityAdoption.sourceCandidateHistory.previousCandidateReceiptSha256='0'.repeat(64)}]){const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>verify(changed))}
 for(const file of ['packages/srm-xray/src/full-workflow.tsx','apps/sg-runtime/components/appshell/xray-module-host.tsx'])assert.throws(()=>verify(receipt,p=>p===file?Buffer.concat([read(p),Buffer.from('\n// drift')]):read(p)));
});
