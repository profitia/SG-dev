import test from 'node:test';
import assert from 'node:assert/strict';
import {parseObservation} from '../../../packages/newsfeed-contracts/index.mjs';
import {readConfiguration} from '../src/config.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const repositoryRoot=new URL('../../../',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const current=file=>readFileSync(new URL(file,repositoryRoot));
const historical=(sha,file)=>execFileSync('git',['show',sha+':'+file],{cwd:repositoryRoot});
function oilSdkContinuation(receipt){
 const a=receipt.oilAutonomousReportSdkCompatibility;
 assert(a,'explicit source-only Oil SDK continuation required');
 assert.equal(a.producerSourceSha,'b696932487ef12ef43b862f677931afc5719f733');
 assert.equal(a.previousReceiptSourceSha,'400f3970fad60d1e24e20bf90e12e5e02bca4365');
 const prior=historical(a.previousReceiptSourceSha,'apps/newsfeed-runtime/operation-integration.json');
 assert.equal(hash(prior),a.previousReceiptSha256);
 const {oilAutonomousReportSdkCompatibility,...preserved}=receipt;assert.deepEqual(preserved,JSON.parse(prior));
 for(const [file,digest] of Object.entries(a.sourceDigests)){
  assert.equal(hash(current('packages/platform-contracts/'+file)),digest,'current shared source '+file);
  assert.equal(hash(historical(a.producerSourceSha,'packages/platform-contracts/'+file)),digest,'immutable producer '+file);
 }
 for(const [file,digest] of Object.entries(a.consumerSourceDigests))assert.equal(hash(current(file)),digest,'current consumer test '+file);
 for(const flag of ['runtimeAdoption','authorizationChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag);
 return a;
}
const input={name:'Own topic',subjectKind:'topic',subject:'infrastructure',request:{contractVersion:'1.0.0',family:'news-discovery',provider:'brave',operation:'search',criteria:{text:'infrastructure'}}};
test('observation accepts arbitrary topics without Supplier ID, SRM or an organisation from the body',()=>{assert.equal(parseObservation(input).subjectKind,'topic');for(const patch of[{supplierId:'forced'},{ownerUserId:'client'},{organisationId:'client'},{actorId:'client'},{request:{...input.request,family:'indicators'}}])assert.throws(()=>parseObservation({...input,...patch}));});
test('updates require an optimistic version and explicit active/paused status',()=>{assert.deepEqual(parseObservation({version:1,status:'PAUSED'},{partial:true}),{version:1,status:'PAUSED'});for(const value of[{}, {version:1},{version:0,status:'PAUSED'},{version:1,status:'DELETED'}])assert.throws(()=>parseObservation(value,{partial:true}));});
test('Newsfeed refuses Staging, Production and a Production/owner connection before any I/O',()=>{for(const e of['production','staging'])assert.throws(()=>readConfiguration({NEWSFEED_ENVIRONMENT:e}));assert.throws(()=>readConfiguration({NEWSFEED_ENVIRONMENT:'development',NEWSFEED_DATABASE_URL:'postgresql://neondb_owner@ep-aged-sun-b9ooczkd-pooler.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require'}));});
test('consumer adoption pins the actual installed SDK and migration bytes without claiming infrastructure activation',async()=>{
 const receipt=JSON.parse(readFileSync(new URL('../operation-integration.json',import.meta.url))),modules=await Promise.all(['operation-context','identity-provider','access-store','private-operation-host','peer-operation','platform-ingestion','external-call'].map(name=>import('@profitia/platform-contracts/'+name)));
 const oil=oilSdkContinuation(receipt);
 for(const [name,expected]of Object.entries(receipt.sdkDigests)){const source=modules.find(m=>typeof m[name]==='function');assert(source,name);assert.equal(await source[name](),oil.sdkDigests[name]??receipt.marketSymbolSdkCompatibility?.sdkDigests[name]??expected,name);}
 for(const m of Object.values(receipt.migrations))assert.equal(createHash('sha256').update(readFileSync(new URL('../../../'+m.file,import.meta.url))).digest('hex'),m.sha256,m.file);
 assert.equal(receipt.contractVersions.platformSdk,'1.33.0');assert.equal(receipt.authorization.peerProofIsBusinessGrant,false);assert.equal(receipt.authorization.realE1AndSourceActivation,'NOT_ACTIVATED');assert.equal(receipt.validation.deploymentPerformed,false);
});
test('SDK1.34 Newsfeed compatibility preserves its complete earlier receipt and enables no new source family',()=>{
 const root=new URL('../../../',import.meta.url),receipt=JSON.parse(readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.marketSymbolSdkCompatibility;
 assert.equal(a.taskId,'ARCH-SOURCE-HUB-TE-MARKETS-ACTIVATION-20261106');assert.equal(a.platformVersion,'1.34.0');assert.equal(a.previousReceiptSourceSha,'3d660eeaf8b6b7ef914a612b8383514f99e857d3');
 const bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/newsfeed-runtime/operation-integration.json'],{cwd:root});assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptSha256);
 const oil=oilSdkContinuation(receipt);
 const {marketSymbolSdkCompatibility,oilAutonomousReportSdkCompatibility,...preserved}=receipt;assert.deepEqual(preserved,JSON.parse(bytes));
 for(const [p,h]of Object.entries(a.sourceDigests)){assert.equal(hash(historical(oil.previousReceiptSourceSha,'packages/platform-contracts/'+p)),h,'unchanged preceding SDK1.34 '+p);assert.equal(hash(current('packages/platform-contracts/'+p)),oil.sourceDigests[p]??h,p);}
 for(const [p,h]of Object.entries(a.consumerSourceDigests)){assert.equal(hash(historical(oil.previousReceiptSourceSha,p)),h,'immutable SDK1.34 consumer '+p);assert.equal(hash(current(p)),oil.consumerSourceDigests[p]??h,p);}
 for(const flag of ['marketSymbolOptedIn','sql029Installed','authorizationChanged','businessLogicChanged','deploymentPerformed'])assert.equal(a[flag],false,flag);
});

test('Oil SDK continuation rejects changed current source, rewritten history and false activation',()=>{
 const receipt=JSON.parse(current('apps/newsfeed-runtime/operation-integration.json'));
 for(const mutate of [a=>a.producerSourceSha='0'.repeat(40),a=>a.previousReceiptSha256='0'.repeat(64),a=>a.sourceDigests['src/operation-context.mjs']='0'.repeat(64),a=>a.consumerSourceDigests['apps/newsfeed-runtime/test/runtime.test.mjs']='0'.repeat(64),a=>a.authorizationChanged=true]){
  const altered=structuredClone(receipt);mutate(altered.oilAutonomousReportSdkCompatibility);assert.throws(()=>oilSdkContinuation(altered));
 }
});
