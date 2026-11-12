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
