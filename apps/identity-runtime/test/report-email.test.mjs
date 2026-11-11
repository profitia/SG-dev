import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createReportEmailRuntime,renderPublishedReport} from '../dist/src/report-email.js';
const digest=v=>createHash('sha256').update(v).digest('hex');
const authorityDigest=()=>digest(readFileSync(new URL('migrations/014-recurring-delivery.sql',import.meta.resolve('@profitia/platform-current-e1-authority'))));
function fixture(options={}){
 const effects=[],request={applicationId:'profitia-insights-synthetic',deliveryId:randomUUID(),leaseId:randomUUID(),nonce:'a'.repeat(64),organisationId:randomUUID(),ownerUserId:randomUUID(),subscriptionId:randomUUID(),subscriptionVersion:'2',producerJobId:randomUUID(),pdfSha256:'b'.repeat(64)};
 const claim={request,title:'SYNTHETIC_ONLY <report>',editionId:'SYNTHETIC_ONLY',asOf:new Date().toISOString(),publishedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()};
 let state='QUEUED',active=true,proofValue=null,calls=0;
 const client={users:{async getUser(id){effects.push('clerk-account');return{id,banned:false,locked:false,deprovisioned:false,primaryEmailAddressId:'email_synthetic',emailAddresses:[{id:'email_synthetic',emailAddress:'synthetic@example.test',verification:{status:options.unverified?'unverified':'verified'}}]}}}};
 const query=async(sql,args=[])=>{
  if(sql.includes('delivery_descriptor'))return{rows:[{descriptor:{schemaDigest:authorityDigest(),reportSchemaDigest:'c'.repeat(64),policies:[{applicationId:request.applicationId,appOrigin:'https://dev-sg2.spendguru.app'}]}}]};
  if(sql.includes('delivery_claim')){if(state!=='QUEUED')return{rows:[{claim:null}]};state='LEASED';return{rows:[{claim}]}}
  if(sql.includes('delivery_identity'))return{rows:[{identity:active?{environment:'development',issuer:'https://synthetic.clerk.accounts.dev',subject:'user_synthetic'}:null}]};
  if(sql.includes('delivery_proof')){effects.push('current-e1');proofValue={request,recipientDigest:args[2]};if(options.revokeAfterProof)active=false;return{rows:[{proof:{payload:JSON.stringify(proofValue),signature:'SYNTHETIC_ONLY'}}]}}
  if(sql.includes('delivery_verify')){effects.push('verify-current-e1');if(!active)throw Error('SYNTHETIC_REVOKED');return{rows:[{proof:proofValue}]}}
  if(sql.includes('delivery_begin')){effects.push('durable-begin');assert.equal(state,'LEASED');state='SENDING';return{rows:[{}]}}
  if(sql.includes('delivery_settle')){const s=args[2];effects.push(s);state=s==='RELEASE'?'QUEUED':s;return{rows:[{}]}}
  assert.fail('Unexpected SQL port');
 };
 const fetcher=async(url,init)=>{calls++;effects.push('mailgun');assert.equal(state,'SENDING');assert.equal(init.body.get('o:tag'),'report-published-development');assert.equal(init.body.get('o:tracking'),'no');assert.equal(init.body.get('to'),'synthetic@example.test');assert(!init.body.get('html').includes('<report>'));if(options.timeout)throw Error('SYNTHETIC_TRANSPORT_LOSS');return Response.json({id:'<synthetic@mail.example.test>'},{status:200})};
 const runtime=createReportEmailRuntime({query,client,reportSchemaDigest:'c'.repeat(64),mailgun:{environment:'development',region:'eu',domain:'mail.example.test',apiKey:'SYNTHETIC_ONLY_NOT_A_REAL_KEY',authorizedRecipients:[],from:'reports@mail.example.test',senderName:'SpendGuru'},fetch:fetcher,autoStart:false,diagnostic:code=>effects.push(code)});
 return{runtime,effects,claim,get state(){return state},get calls(){return calls},revoke(){active=false}};
}
test('SYNTHETIC_ONLY: admitted published-report mail uses the existing transport after current E1 and durable begin',async()=>{
 const f=fixture();await f.runtime.ready();await Promise.all([f.runtime.tick(),f.runtime.tick()]);await f.runtime.tick();assert.equal(f.calls,1);assert.equal(f.state,'ACCEPTED');assert(f.effects.indexOf('durable-begin')<f.effects.indexOf('mailgun'));assert.equal(f.effects.filter(x=>x==='clerk-account').length,1);await f.runtime.stop();
 const content=renderPublishedReport(f.claim,'https://dev-sg2.spendguru.app');assert(content.text.includes('/pl/dashboard/procurement-insights?tab=reports&edition='));assert(!content.text.includes('delivered'));
 assert.throws(()=>renderPublishedReport(f.claim,'https://untrusted.test'));assert.throws(()=>renderPublishedReport({...f.claim,title:'header\r\ninjection'},'https://dev-sg2.spendguru.app'));
});
test('SYNTHETIC_ONLY: revoked access and an unverified primary address prevent provider calls',async()=>{
 for(const options of[{unverified:true},{revokeAfterProof:true}]){const f=fixture(options);await f.runtime.tick();assert.equal(f.calls,0);assert(['REJECTED','UNKNOWN'].includes(f.state));await f.runtime.stop()}
 const f=fixture();f.revoke();await f.runtime.tick();assert.equal(f.calls,0);assert(!f.effects.includes('durable-begin'));await f.runtime.stop();
});
test('SYNTHETIC_ONLY: a transport timeout is UNKNOWN and is never resent automatically',async()=>{
 const f=fixture({timeout:true});await f.runtime.tick();await f.runtime.tick();assert.equal(f.calls,1);assert.equal(f.state,'UNKNOWN');assert(!f.effects.includes('RELEASE'));await f.runtime.stop();
});
