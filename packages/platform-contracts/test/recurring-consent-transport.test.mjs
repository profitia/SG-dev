// SYNTHETIC_ONLY: transport syntax only; no session or consent is fabricated.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecurringConsentClient} from '../current-e1-authority/recurring.mjs';

const command={
 delegationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 organisationId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 operation:'newsfeed.monitor.execute',
 resourceId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 resourceVersion:'1',definitionDigest:'a'.repeat(64),
 schedule:{frequency:'DAILY',timeZone:'Europe/Warsaw',localTime:'12:05',
  startDate:'2026-11-12',endDate:'2026-11-12',weekdays:[],monthDay:null,
  dstPolicy:'SKIP_NONEXISTENT_EARLIEST_REPEAT'},enabled:true,
};
const jwtShape='eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.SYNTHETIC_ONLY.SYNTHETIC_ONLY';
async function attempt(authorization){
 let reads=0,sends=0;
 const query=async sql=>{
  reads++;
  if(sql==='SELECT profitia_e1_receiver.recurring_descriptor() AS descriptor')
   return {rows:[{descriptor:{authorityOrigin:'https://identity.synthetic.test',
    binding:{applicationId:'profitia-newsfeed-api-development',environment:'development'}}}]};
  assert.equal(sql,'SELECT txid_current()::text AS id');
  return {rows:[{id:'1'}]};
 };
 const client=createRecurringConsentClient({fetch:async(url,options)=>{
  sends++;
  assert.equal(url,'https://identity.synthetic.test/v1/e1/recurring/consent');
  assert.equal(options.headers.authorization,authorization);
  assert.equal(options.redirect,'error');
  assert.equal(JSON.parse(options.body).command.resourceId,command.resourceId);
  // A syntactically valid header never grants access: current central E1 denies.
  return Response.json({error:'SYNTHETIC_DENIAL'},{status:403});
 }});
 await assert.rejects(client.consent(query,new Request('https://newsfeed.synthetic.test/v1/saved-searches',
  {headers:authorization===null?{}:{authorization}}),command),e=>e.reasonCode==='ACCESS_BASIS_INVALID');
 return {reads,sends};
}
test('recurring consent forwards complete non-whitespace tokens to central E1 and preserves its denial',async t=>{
 for(const [label,token] of [['lowercase s','s'],['JWT-shaped synthetic value',jwtShape],
  ['existing fixture','SYNTHETIC_ONLY'],['maximum admitted length','a'.repeat(8192)]]){
  await t.test(label,async()=>assert.deepEqual(await attempt('Bearer '+token),{reads:2,sends:1}));
 }
});
test('recurring consent rejects missing, wrong-scheme, whitespace and oversized credentials before any I/O',async t=>{
 for(const [label,authorization] of [['missing',null],['wrong scheme','Basic SYNTHETIC_ONLY'],
  ['empty','Bearer'],['embedded space','Bearer first second'],['embedded tab','Bearer first\tsecond'],
  ['oversized','Bearer '+'a'.repeat(8193)]]){
  await t.test(label,async()=>assert.deepEqual(await attempt(authorization),{reads:0,sends:0}));
 }
});

import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {recurringConsentTransportPredecessor,RECURRING_CONSENT_TRANSPORT_RECORD,RECURRING_CONSENT_TRANSPORT_BASE,RECURRING_CONSENT_TRANSPORT_PATHS} from './recurring-consent-transport-source.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const sourceBytes=p=>fs.readFileSync(new URL('../../../'+p,import.meta.url));
const historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root,stdio:['ignore','pipe','pipe']});
test('consent correction authenticates its actual source graph and retains accepted predecessor bytes',()=>{
 const accepted=recurringConsentTransportPredecessor(sourceBytes,historical);
 assert.equal(Object.keys(accepted.manifest.sourceDigests).length,10);
 for(const p of RECURRING_CONSENT_TRANSPORT_PATHS.filter(p=>!p.includes('/test/recurring-consent-transport'))){
  assert.deepEqual(accepted.previousBytes(p),historical(RECURRING_CONSENT_TRANSPORT_BASE,p));
 }
 assert.throws(()=>accepted.previousBytes(RECURRING_CONSENT_TRANSPORT_RECORD),e=>e.code==='ENOENT');
 assert.throws(()=>accepted.previousBytes('packages/platform-contracts/test/recurring-consent-transport.test.mjs'),e=>e.code==='ENOENT');
});
test('consent correction rejects source drift, altered receipts, widened flags and missing source',()=>{
 const a=JSON.parse(sourceBytes(RECURRING_CONSENT_TRANSPORT_RECORD));
 for(const p of [...RECURRING_CONSENT_TRANSPORT_PATHS,...Object.keys(a.preservedReceipts)]){
  assert.throws(()=>recurringConsentTransportPredecessor(q=>q===p?Buffer.from('SYNTHETIC_TAMPER'):sourceBytes(q),historical));
 }
 for(const flag of ['authorisationChanged','schemaChanged','providerCallsPerformed','deploymentPerformed']){
  const altered=JSON.stringify({...a,[flag]:true});
  assert.throws(()=>recurringConsentTransportPredecessor(q=>q===RECURRING_CONSENT_TRANSPORT_RECORD?Buffer.from(altered):sourceBytes(q),historical));
 }
 assert.throws(()=>recurringConsentTransportPredecessor(q=>{if(q===RECURRING_CONSENT_TRANSPORT_PATHS[0])throw Object.assign(Error('missing'),{code:'ENOENT'});return sourceBytes(q)},historical));
 assert.equal(recurringConsentTransportPredecessor(()=>{throw Object.assign(Error('absent'),{code:'ENOENT'})},historical),null);
});
