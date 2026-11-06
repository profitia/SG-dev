import test from 'node:test';
import assert from 'node:assert/strict';
import {parseObservation} from '../../../packages/newsfeed-contracts/index.mjs';
import {readConfiguration} from '../src/config.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const input={name:'Own topic',subjectKind:'topic',subject:'infrastructure',request:{contractVersion:'1.0.0',family:'news-discovery',provider:'brave',operation:'search',criteria:{text:'infrastructure'}}};
test('observation accepts arbitrary topics without Supplier ID, SRM or an organisation from the body',()=>{assert.equal(parseObservation(input).subjectKind,'topic');for(const patch of[{supplierId:'forced'},{ownerUserId:'client'},{organisationId:'client'},{actorId:'client'},{request:{...input.request,family:'indicators'}}])assert.throws(()=>parseObservation({...input,...patch}));});
test('updates require an optimistic version and explicit active/paused status',()=>{assert.deepEqual(parseObservation({version:1,status:'PAUSED'},{partial:true}),{version:1,status:'PAUSED'});for(const value of[{}, {version:1},{version:0,status:'PAUSED'},{version:1,status:'DELETED'}])assert.throws(()=>parseObservation(value,{partial:true}));});
test('Newsfeed refuses Staging, Production and a Production/owner connection before any I/O',()=>{for(const e of['production','staging'])assert.throws(()=>readConfiguration({NEWSFEED_ENVIRONMENT:e}));assert.throws(()=>readConfiguration({NEWSFEED_ENVIRONMENT:'development',NEWSFEED_DATABASE_URL:'postgresql://neondb_owner@ep-aged-sun-b9ooczkd-pooler.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require'}));});
test('consumer adoption pins the actual installed SDK and migration bytes without claiming infrastructure activation',async()=>{
 const receipt=JSON.parse(readFileSync(new URL('../operation-integration.json',import.meta.url))),modules=await Promise.all(['operation-context','identity-provider','access-store','private-operation-host','peer-operation','platform-ingestion','external-call'].map(name=>import('@profitia/platform-contracts/'+name)));
 for(const [name,expected]of Object.entries(receipt.sdkDigests)){const source=modules.find(m=>typeof m[name]==='function');assert(source,name);assert.equal(await source[name](),receipt.marketSymbolSdkCompatibility?.sdkDigests[name]??expected,name);}
 for(const m of Object.values(receipt.migrations))assert.equal(createHash('sha256').update(readFileSync(new URL('../../../'+m.file,import.meta.url))).digest('hex'),m.sha256,m.file);
 assert.equal(receipt.contractVersions.platformSdk,'1.33.0');assert.equal(receipt.authorization.peerProofIsBusinessGrant,false);assert.equal(receipt.authorization.realE1AndSourceActivation,'NOT_ACTIVATED');assert.equal(receipt.validation.deploymentPerformed,false);
});
test('SDK1.34 Newsfeed compatibility preserves its complete earlier receipt and enables no new source family',()=>{
 const root=new URL('../../../',import.meta.url),receipt=JSON.parse(readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.marketSymbolSdkCompatibility;
 assert.equal(a.taskId,'ARCH-SOURCE-HUB-TE-MARKETS-ACTIVATION-20261106');assert.equal(a.platformVersion,'1.34.0');assert.equal(a.previousReceiptSourceSha,'3d660eeaf8b6b7ef914a612b8383514f99e857d3');
 const bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/newsfeed-runtime/operation-integration.json'],{cwd:root});assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptSha256);
 const {marketSymbolSdkCompatibility,...preserved}=receipt;assert.deepEqual(preserved,JSON.parse(bytes));
 for(const [p,h]of Object.entries(a.sourceDigests))assert.equal(createHash('sha256').update(readFileSync(new URL('packages/platform-contracts/'+p,root))).digest('hex'),h,p);
 for(const [p,h]of Object.entries(a.consumerSourceDigests))assert.equal(createHash('sha256').update(readFileSync(new URL(p,root))).digest('hex'),h,p);
 for(const flag of ['marketSymbolOptedIn','sql029Installed','authorizationChanged','businessLogicChanged','deploymentPerformed'])assert.equal(a[flag],false,flag);
});
