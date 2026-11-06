import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {reportWindows,createEvidenceBundle,validateNarrative,SECTION_KEYS,hash} from '../lib/insights/oil-asphalt-v04-contract.mjs';
import {prepareResearchPlan,createResearchClient,CONSUMER_ID} from '../lib/insights/oil-asphalt-v04-research.mjs';
import {prepareComposition,validateFinalGo,retainAndValidateResponse} from '../lib/insights/oil-asphalt-v04-composer.mjs';
import {createExecutionTelemetry,summarizeHubUsage} from '../lib/insights/oil-asphalt-v04-telemetry.mjs';
import {prepareSearch} from '../../platform-source-hub/src/providers/newsapi.mjs';
import {prepareBrave} from '../../platform-source-hub/src/providers/brave.mjs';
import {prepareTradingEconomics} from '../../platform-source-hub/src/providers/trading-economics.mjs';
const asOf='2026-11-05T20:00:00.000Z';
const input=()=>({asOf,timeZone:'Europe/Warsaw',windowMode:'TUESDAY_MONDAY',forecast:{classification:'SYNTHETIC_ONLY'},evidence:[],coverage:[],admissionRef:'SYNTHETIC_ONLY'});
const narrative=()=>Object.fromEntries(SECTION_KEYS.map(k=>[k,[{text:'Wniosek syntetyczny do testu, wymaga dowodu.',refs:['FORECAST']}]]));
function temp(t){const p=fs.mkdtempSync(path.join(os.tmpdir(),'oil-v04-test-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;}
test('canonical calendar uses Warsaw Tuesday–Monday, while rolling window requires an explicit exception',()=>{
 const w=reportWindows(asOf);assert.equal(w.fromInclusive,'2026-11-02T23:00:00.000Z');assert.equal(w.toExclusive,'2026-11-09T23:00:00.000Z');assert.equal(w.partialWeek,true);
 const r=reportWindows(asOf,'Europe/Warsaw','ROLLING_168H');assert.equal(r.exceptionApprovalRequired,true);assert.equal(Date.parse(r.asOf)-Date.parse(r.fromInclusive),168*3600000);
 const dst=reportWindows('2026-10-25T20:00:00.000Z');assert.equal(Date.parse(dst.toExclusive)-Date.parse(dst.fromInclusive),169*3600000);
});
test('all twelve research intents pass the actual provider criterion validators offline',()=>{
 const p=prepareResearchPlan(reportWindows(asOf,'Europe/Warsaw','ROLLING_168H'));assert.equal(p.plan.length,12);assert.equal(new Set(p.plan.map(q=>q.queryId)).size,12);assert.equal(p.automaticRetry,false);
 for(const {command:q} of p.plan){if(q.provider==='newsapi')prepareSearch(q.criteria);else if(q.provider==='brave')prepareBrave(q.criteria);else assert.equal(prepareTradingEconomics(q.family,q.criteria).market,false);}
});
test('evidence rejects raw payloads, post-asOf knowledge and known future outcomes',()=>{
 const e={id:'EV001',sourceRecordRef:'SYNTHETIC_ONLY',licenceRef:'SYNTHETIC_ONLY',contentFingerprint:'a'.repeat(64),retrievedAt:asOf,availableAt:asOf,derivedSummary:'Syntetyczne streszczenie.',claimType:'FACT',materialDepth:'STRUCTURED_DATA'};
 for(const override of [{native:{}},{publishedAt:'2026-11-06T00:00:00Z'},{eventAt:'2026-11-06T00:00:00Z',facts:{actual:1}}])assert.throws(()=>createEvidenceBundle({...input(),evidence:[{...e,...override}]}));
 assert.equal(createEvidenceBundle({...input(),evidence:[{...e,eventAt:'2026-11-06T00:00:00Z',facts:{actual:null}}]}).evidence.length,1);
});
test('composition is exact hash-bound, has no hosted tools, store or retry, and refuses unapproved final GO',()=>{
 const b=createEvidenceBundle(input()),c=prepareComposition(b),v=JSON.parse(c.body);assert.equal(c.requestSha256,hash(c.body));assert.equal(v.store,false);assert.equal(v.tools,undefined);assert.equal(v.model,'gpt-6.1-sol');assert.throws(()=>validateFinalGo({},c,{}),/FINAL_GO/);
 const n=narrative();validateNarrative(n,b);n.macro[0].text='Bezpodstawne 123';assert.throws(()=>validateNarrative(n,b),/NUMBERS/);n.macro[0]={text:'Teza',refs:['EV999']};assert.throws(()=>validateNarrative(n,b),/CITATION/);
});
test('uncertain paid results retain original bytes and UNKNOWN usage before failing validation',t=>{
 const dir=temp(t),bytes=Buffer.from('{broken');assert.throws(()=>retainAndValidateResponse({bytes,sourceReceipt:null,request:{model:'gpt-6.1-sol'},outputDirectory:dir,bundle:createEvidenceBundle(input()),latencyMs:1}));assert.deepEqual(fs.readFileSync(dir+'/OPENAI_RESPONSE.raw'),bytes);const r=JSON.parse(fs.readFileSync(dir+'/OIL_V04_OPENAI_EXECUTION_RECEIPT.json'));assert.equal(r.usage,'UNKNOWN');assert.equal(r.reportedCostUSD,'UNKNOWN');
});
test('telemetry counts uncertain attempts separately and measures elapsed phase duration',async t=>{
 const dir=temp(t),tm=createExecutionTelemetry(dir);await tm.stage('quality_gate',async()=>42);tm.finish('PREPARED');const events=fs.readFileSync(dir+'/OIL_V04_EXECUTION_TELEMETRY.jsonl','utf8').trim().split('\n').map(JSON.parse);assert.equal(events.length,2);assert(events.every(x=>x.durationMs>=0));
 const [s]=summarizeHubUsage([{provider:'brave',family:'news-discovery',status:'UNVERIFIED',upstreamAttempts:null,durationMs:5}]);assert.equal(s.acquireRequests,1);assert.equal(s.upstreamAttempts,'UNKNOWN');assert.equal(s.confirmedUpstreamAttempts,0);
});
test('failed Hub delivery records an uncertain request and never retries it',async t=>{
 const receipts=[],tm=createExecutionTelemetry(temp(t)),peer={callerApplicationId:CONSUMER_ID,receiverApplicationId:'profitia-source-hub-development',sourceOrigin:'https://oil-v04.evaluation.invalid',targetOrigin:'https://source-hub-development.onrender.com',keyId:'synthetic-v04',key:Buffer.alloc(32,8)};
 let calls=0;const client=createResearchClient({peer,telemetry:tm,onReceipt:r=>receipts.push(r),fetchImpl:async()=>{calls++;throw Error('SYNTHETIC_ONLY')}});
 const q=prepareResearchPlan(reportWindows(asOf)).plan[0];const args={...q,verifiedContext:{userId:'00000000-0000-4000-8000-000000000001',organisationId:'00000000-0000-4000-8000-000000000002'},bearer:'Bearer SYNTHETIC_ONLY',runId:'SYNTHETIC_ONLY',onTransientRecords:()=>{}};
 await assert.rejects(client.acquire(args));await assert.rejects(client.acquire(args),/AUTOMATIC_RETRY_FORBIDDEN/);assert.equal(calls,1);assert.equal(receipts[0].status,'UNVERIFIED');assert.equal(receipts[0].upstreamAttempts,null);assert(!JSON.stringify(receipts).includes('Bearer'));
});
