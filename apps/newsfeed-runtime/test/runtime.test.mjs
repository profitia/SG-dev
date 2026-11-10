import {assertOilReportSourceCompatibility} from '../../srm/scripts/source-hub-sdk-compatibility.mjs';
import {assistantSdkPredecessor,ASSISTANT_SDK_PREDECESSOR,ASSISTANT_SDK_PRODUCER} from '../../architecture-lab/assistant-m1-sdk-compatibility.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseObservation} from '../../../packages/newsfeed-contracts/index.mjs';
import {readConfiguration} from '../src/config.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=new URL('../../../',import.meta.url),rawCurrent=p=>readFileSync(new URL(p,root)),historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root}),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function oilAcceptance(receipt=JSON.parse(rawCurrent('apps/newsfeed-runtime/operation-integration.json'))){
 const file='apps/newsfeed-runtime/operation-integration.json',a=receipt.oilAutonomousReportSdkCompatibility;
 assert(a,'explicit Oil SDK receipt required');assert.equal(a.producerSourceSha,'e189433899349ddda6664c37988255c13845b3e2');assert.equal(a.previousReceiptSourceSha,'7ed96210f4cc3ccfcd0e0dac6ad126144bdcdecb');
 const bytes=historical(a.previousReceiptSourceSha,file),prior=JSON.parse(bytes);assert.equal(hash(bytes),a.previousReceiptSha256);
 const {oilAutonomousReportSdkCompatibility,...preserved}=receipt;assert.deepEqual(preserved,prior,'all pre-Oil Newsfeed and M1 acceptance stays immutable');
 const owner=JSON.parse(rawCurrent('apps/sg-runtime/operation-integration.json')),view=assertOilReportSourceCompatibility(owner,rawCurrent,historical,{projectKey:'SG2'});
 assert.deepEqual(a.sdkDigests,owner.oilAutonomousReportCompatibility.sdkDigests);assert.deepEqual(a.sourceDigests,owner.oilAutonomousReportCompatibility.sourceDigests);
 assert.deepEqual(Object.keys(a.consumerSourceDigests),['apps/newsfeed-runtime/test/runtime.test.mjs']);for(const[p,h]of Object.entries(a.consumerSourceDigests))assert.equal(hash(rawCurrent(p)),h,p);
 for(const flag of ['runtimeAdoption','authorizationChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag);
 return {receipt,prior,previousBytes:p=>p===file?bytes:view.previousBytes(p)};
}
const oilView=oilAcceptance(),current=p=>oilView.previousBytes(p);
function assistantAcceptance(){
 const file='apps/newsfeed-runtime/operation-integration.json',receipt=JSON.parse(current(file)),a=receipt.assistantM1SourceCompatibility;
 assert.equal(a.taskId,'ARCH-ACG-M1-EXECUTION-20261109');assert.equal(a.scope,'SDK_SOURCE_COMPATIBILITY_WITHOUT_NEWSFEED_ACTIVATION');assert.equal(a.previousReceiptSourceSha,ASSISTANT_SDK_PREDECESSOR);assert.equal(a.producerSourceSha,ASSISTANT_SDK_PRODUCER);
 const bytes=historical(ASSISTANT_SDK_PREDECESSOR,file),prior=JSON.parse(bytes);assert.equal(hash(bytes),a.previousReceiptSha256);
 const {assistantM1SourceCompatibility,...preserved}=receipt;assert.deepEqual(preserved,prior,'all historical Newsfeed fields remain immutable');
 const sdk=assistantSdkPredecessor(current,historical);assert.deepEqual(a.sdkDigests,sdk.record.sdkDigests);assert.deepEqual(a.sourceDigests,{...sdk.record.sourceDigests,...sdk.record.compatibilityTestSourceDigests});
 assert.deepEqual(Object.keys(a.consumerSourceDigests),['apps/newsfeed-runtime/test/runtime.test.mjs']);for(const[p,h]of Object.entries(a.consumerSourceDigests))assert.equal(hash(current(p)),h,p);
 for(const flag of ['assistantOptedIn','schemaInstalled','grantsChanged','businessLogicChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag);
 return {receipt,prior,previousBytes:p=>Object.hasOwn(a.consumerSourceDigests,p)?historical(ASSISTANT_SDK_PREDECESSOR,p):sdk.previousBytes(p)};
}
const input={name:'Own topic',subjectKind:'topic',subject:'infrastructure',request:{contractVersion:'1.0.0',family:'news-discovery',provider:'brave',operation:'search',criteria:{text:'infrastructure'}}};
test('observation accepts arbitrary topics without Supplier ID, SRM or an organisation from the body',()=>{assert.equal(parseObservation(input).subjectKind,'topic');for(const patch of[{supplierId:'forced'},{ownerUserId:'client'},{organisationId:'client'},{actorId:'client'},{request:{...input.request,family:'indicators'}}])assert.throws(()=>parseObservation({...input,...patch}));});
test('updates require an optimistic version and explicit active/paused status',()=>{assert.deepEqual(parseObservation({version:1,status:'PAUSED'},{partial:true}),{version:1,status:'PAUSED'});for(const value of[{}, {version:1},{version:0,status:'PAUSED'},{version:1,status:'DELETED'}])assert.throws(()=>parseObservation(value,{partial:true}));});
test('Newsfeed refuses Staging, Production and a Production/owner connection before any I/O',()=>{for(const e of['production','staging'])assert.throws(()=>readConfiguration({NEWSFEED_ENVIRONMENT:e}));assert.throws(()=>readConfiguration({NEWSFEED_ENVIRONMENT:'development',NEWSFEED_DATABASE_URL:'postgresql://neondb_owner@ep-aged-sun-b9ooczkd-pooler.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require'}));});
test('consumer adoption pins the actual installed SDK and migration bytes without claiming infrastructure activation',async()=>{
 const receipt=JSON.parse(readFileSync(new URL('../operation-integration.json',import.meta.url))),modules=await Promise.all(['operation-context','identity-provider','access-store','private-operation-host','peer-operation','platform-ingestion','external-call'].map(name=>import('@profitia/platform-contracts/'+name)));
 for(const [name,expected]of Object.entries(receipt.sdkDigests)){const source=modules.find(m=>typeof m[name]==='function');assert(source,name);assert.equal(await source[name](),receipt.oilAutonomousReportSdkCompatibility?.sdkDigests[name]??receipt.assistantM1SourceCompatibility?.sdkDigests[name]??receipt.marketSymbolSdkCompatibility?.sdkDigests[name]??expected,name);}
 for(const m of Object.values(receipt.migrations))assert.equal(createHash('sha256').update(readFileSync(new URL('../../../'+m.file,import.meta.url))).digest('hex'),m.sha256,m.file);
 assert.equal(receipt.contractVersions.platformSdk,'1.33.0');assert.equal(receipt.authorization.peerProofIsBusinessGrant,false);assert.equal(receipt.authorization.realE1AndSourceActivation,'NOT_ACTIVATED');assert.equal(receipt.validation.deploymentPerformed,false);
});
test('SDK1.34 Newsfeed compatibility preserves its complete earlier receipt and enables no new source family',()=>{
 const view=assistantAcceptance(),receipt=view.prior,a=receipt.marketSymbolSdkCompatibility;
 assert.equal(a.taskId,'ARCH-SOURCE-HUB-TE-MARKETS-ACTIVATION-20261106');assert.equal(a.platformVersion,'1.34.0');assert.equal(a.previousReceiptSourceSha,'3d660eeaf8b6b7ef914a612b8383514f99e857d3');
 const bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/newsfeed-runtime/operation-integration.json'],{cwd:root});assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptSha256);
 const {marketSymbolSdkCompatibility,...preserved}=receipt;assert.deepEqual(preserved,JSON.parse(bytes));
 for(const [p,h]of Object.entries(a.sourceDigests))assert.equal(createHash('sha256').update(view.previousBytes('packages/platform-contracts/'+p)).digest('hex'),h,p);
 for(const [p,h]of Object.entries(a.consumerSourceDigests))assert.equal(createHash('sha256').update(view.previousBytes(p)).digest('hex'),h,p);
 for(const flag of ['marketSymbolOptedIn','sql029Installed','authorizationChanged','businessLogicChanged','deploymentPerformed'])assert.equal(a[flag],false,flag);
});

test('M1 SDK compatibility closes actual Newsfeed test and SDK bytes without new operations or activation',()=>{assistantAcceptance();});

test('Oil continuation preserves M1 and rejects changed source, history and activation claims',()=>{for(const mutate of [a=>a.previousReceiptSha256='0'.repeat(64),a=>a.producerSourceSha='0'.repeat(40),a=>a.consumerSourceDigests['apps/newsfeed-runtime/test/runtime.test.mjs']='0'.repeat(64),a=>a.authorizationChanged=true]){const changed=JSON.parse(rawCurrent('apps/newsfeed-runtime/operation-integration.json'));mutate(changed.oilAutonomousReportSdkCompatibility);assert.throws(()=>oilAcceptance(changed));}});
