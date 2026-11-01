import {assertStyleConsumerAcceptance} from '../../scripts/xray-style-acceptance.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../../../..');
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const read=(file:string)=>fs.readFileSync(path.join(root,file));
const historical=(sha:string,file:string)=>execFileSync('git',['show',sha+':'+file],{cwd:root});
function assertAdoption(receipt:any,current=read){
 if(receipt.xrayStyleIsolationConsumerAcceptance){const n=assertStyleConsumerAcceptance(receipt,current,historical);return assertAdoption(n.prior,n.previousBytes)}
 if(Object.hasOwn(receipt,'freshPreparationRecovery')){
  const next=receipt.freshPreparationRecovery;
  assert.equal(next.taskId,'SRM-XRAY-FRESH-PERFORMANCE-RECOVERY-20261029');
  assert.equal(next.previousReceiptSourceSha,'7e20e2c7f4f5fc936d91dc869956aeb71376567f');
  assert.equal(next.targetEnvironment,'development');assert.equal(next.acceptedFullUiSourcesUnchanged,true);
  assert.equal(next.currentClerkE1RlsPreserved,true);assert.equal(next.closedPresentationAdmissionOnly,true);
  const bytes=historical(next.previousReceiptSourceSha,'apps/srm/operation-integration.json');
  assert.equal(hash(bytes),next.previousReceiptDigest);
  const {freshPreparationRecovery,...preserved}=receipt,prior=JSON.parse(bytes.toString());
  assert.deepEqual(preserved,prior,'the accepted 834 receipt and all preceding history remain immutable');
  for(const [file,digest] of Object.entries(next.applicationSourceDigests))assert.equal(hash(current('apps/srm/'+file)),digest,file);
  return assertAdoption(prior,file=>Object.hasOwn(next.applicationSourceDigests,path.posix.relative('apps/srm',file))?historical(next.previousReceiptSourceSha,file):current(file));
 }

 if(receipt.pciSmartInputIntegrityContinuation){
  const a=receipt.pciSmartInputIntegrityContinuation,previous=historical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json')
  assert.equal(a.taskId,'SRM-PCI-SMART-LIVE-400-INTEGRITY-20261101');assert.equal(a.previousReceiptSourceSha,'4040eaf576c6934ede4f9040e52c5c3f9e8bd9fa');assert.equal(hash(previous),a.previousReceiptSha256)
  const {pciSmartInputIntegrityContinuation,...preserved}=receipt;assert.deepEqual(preserved,JSON.parse(previous.toString()))
  for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(current('apps/srm/'+file)),digest,file)
  for(const[file,digest]of Object.entries(a.consumerSourceDigests))assert.equal(hash(current(path.posix.normalize('apps/srm/'+file))),digest,file)
  return assertAdoption(JSON.parse(previous.toString()),f=>Object.hasOwn(a.applicationSourceDigests,path.posix.relative('apps/srm',f))?historical(a.previousReceiptSourceSha,f):current(f))
 }

 const a=receipt.fullUiParityAdoption;
 assert.equal(a.projectKey,'SRM');assert.equal(a.taskId,'SRM-XRAY-FULL-UI-PARITY-B-20261031');
 assert.equal(a.status,'SOURCE_CANDIDATE');assert.equal(a.targetEnvironment,'development');
 const previous=historical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json');
 assert.equal(hash(previous),a.previousReceiptDigest);
 const {fullUiParityAdoption,...preserved}=receipt;
 assert.deepEqual(preserved,JSON.parse(previous.toString()),'every preceding receipt is immutable');
 const priorCandidate=a.sourceCandidateHistory;
 assert.equal(priorCandidate.previousCandidateSourceSha,'26c3cecdbd434ac1e3ee4b731550cc49756f1ae5');
 const candidateBytes=historical(priorCandidate.previousCandidateSourceSha,'apps/srm/operation-integration.json');
 assert.equal(hash(candidateBytes),priorCandidate.previousCandidateReceiptSha256);
 assert.deepEqual(a.publicUi,JSON.parse(candidateBytes.toString()).fullUiParityAdoption.publicUi,'the complete previously reviewed UI stays exact');
 assert.equal(priorCandidate.preservedPublicUiDigest,a.publicUi.sourceDigest);
 assert.equal(a.publicUi.package,'@profitia/srm-xray');assert.equal(a.publicUi.version,'0.4.0');
 const packageRoot='packages/srm-xray/',digest=createHash('sha256');
 for(const file of a.publicUi.sourceFiles){assert(!path.isAbsolute(file)&&!file.split('/').includes('..'));digest.update(file).update('\0').update(current(packageRoot+file)).update('\0')}
 assert.equal(digest.digest('hex'),a.publicUi.sourceDigest);
 for(const [file,value] of Object.entries(a.applicationSourceDigests))assert.equal(hash(current(path.posix.normalize('apps/srm/'+file))),value,file);
 for(const [file,value] of Object.entries(a.unchangedDomainSourceDigests)){
  assert.equal(hash(current(file)),value,file);
  assert.equal(hash(historical(a.previousReceiptSourceSha,file)),value,'unchanged domain '+file);
 }
 for(const key of ['financialEngineChanged','identityOrE1Changed','providerRoutingChanged','schemaChanged','productDeploymentPerformed'])assert.equal(a[key],false,key);
}
test('full UI adoption preserves every old receipt, pins the entire shared package and leaves domain authorities unchanged',()=>{
 assertAdoption(JSON.parse(read('apps/srm/operation-integration.json').toString()));
});
test('full UI adoption rejects receipt rewriting, public UI drift and financial authority drift',()=>{
 const receipt=JSON.parse(read('apps/srm/operation-integration.json').toString());
 for(const mutate of [(r:any)=>{r.fullUiParityAdoption.publicUi.sourceDigest='0'.repeat(64)},(r:any)=>{r.freshPerformanceRecovery.browserTelemetryOnly=false},(r:any)=>{r.pciSmartPreparationIntegrityContinuation.runtimeChanged=true},(r:any)=>{r.fullUiParityAdoption.sourceCandidateHistory.previousCandidateReceiptSha256='0'.repeat(64)}]){
  const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>assertAdoption(changed));
 }
 for(const file of ['packages/srm-xray/src/full-report.tsx','apps/srm/src/server/financial-excel.ts']){
  assert.throws(()=>assertAdoption(receipt,p=>p===file?Buffer.concat([read(p),Buffer.from('\n/* drift */')]):read(p)));
 }
 for(const mutate of [(r:any)=>{r.freshPreparationRecovery.previousReceiptSourceSha='UNACCEPTED'},(r:any)=>{r.freshPreparationRecovery.currentClerkE1RlsPreserved=false},(r:any)=>{r.freshPreparationRecovery.acceptedFullUiSourcesUnchanged=false}]){
  const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>assertAdoption(changed));
 }
});
