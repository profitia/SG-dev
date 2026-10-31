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
 const a=receipt.fullUiParityAdoption;
 assert.equal(a.projectKey,'SRM');assert.equal(a.taskId,'SRM-XRAY-FULL-UI-PARITY-B-20261031');
 assert.equal(a.status,'SOURCE_CANDIDATE');assert.equal(a.targetEnvironment,'development');
 const previous=historical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json');
 assert.equal(hash(previous),a.previousReceiptDigest);
 const {fullUiParityAdoption,...preserved}=receipt;
 assert.deepEqual(preserved,JSON.parse(previous.toString()),'every preceding receipt is immutable');
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
 for(const mutate of [(r:any)=>{r.fullUiParityAdoption.publicUi.sourceDigest='0'.repeat(64)},(r:any)=>{r.freshPerformanceRecovery.browserTelemetryOnly=false}]){
  const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>assertAdoption(changed));
 }
 for(const file of ['packages/srm-xray/src/full-report.tsx','apps/srm/src/server/financial-excel.ts']){
  assert.throws(()=>assertAdoption(receipt,p=>p===file?Buffer.concat([read(p),Buffer.from('\n/* drift */')]):read(p)));
 }
});
