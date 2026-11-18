// SYNTHETIC_ONLY transport ports. Inbox delivery is a separate LIVE gate.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {createCalendarEmailRuntime,renderCalendarNotification} from '../dist/src/calendar-email.js'
const digest=v=>createHash('sha256').update(v).digest('hex')
const authorityDigest=()=>digest(readFileSync(new URL('migrations/015-calendar-delivery.sql',import.meta.resolve('@profitia/platform-current-e1-authority'))))
function fixture(options={}){
 const effects=[],request={applicationId:'profitia-economic-calendar-runtime-development',deliveryId:randomUUID(),leaseId:randomUUID(),nonce:'a'.repeat(64),organisationId:randomUUID(),ownerUserId:randomUUID(),eventId:'ecr_evt_'+'b'.repeat(64),payloadDigest:'c'.repeat(64)}
 const claim={request,payload:{title:'SYNTHETIC_ONLY <release>',eventId:request.eventId,type:'results',provider:'eia',results:[{series:'SYNTHETIC_SERIES',actual:'0',unit:'MBBL',referencePeriod:'2026-11-06'}]},expiresAt:new Date(Date.now()+3600000).toISOString()}
 let state='PENDING',active=true,consent=true,proofValue=null,calls=0,accounts=0
 const client={users:{async getUser(id){accounts++;return{id,banned:!!options.banned,locked:false,deprovisioned:false,primaryEmailAddressId:'verified_primary',emailAddresses:[{id:'verified_primary',emailAddress:'synthetic@example.test',verification:{status:options.unverified?'unverified':'verified'}},{id:'other',emailAddress:'wrong@example.test',verification:{status:'verified'}}]}}}}
 const query=async(sql,args=[])=>{
  if(sql.includes('calendar_delivery_descriptor'))return{rows:[{descriptor:{schemaDigest:authorityDigest(),policies:[{applicationId:request.applicationId,appOrigin:'https://dev-sg2.spendguru.app'}]}}]}
  if(sql.includes('calendar_delivery_identity'))return{rows:[{identity:active?{environment:'development',issuer:'https://synthetic.clerk.accounts.dev',subject:'user_synthetic'}:null}]}
  if(sql.includes('calendar_delivery_proof')){effects.push('current-e1');if(options.failBeforeBegin)throw Error('SYNTHETIC_BEFORE_HTTP');proofValue={request,recipientDigest:args[2]};if(options.revokeAfterProof)active=false;return{rows:[{proof:{payload:JSON.stringify(proofValue),signature:'SYNTHETIC_ONLY'}}]}}
  if(sql.includes('calendar_delivery_verify')){effects.push('verify-current-e1');if(!active)throw Error('SYNTHETIC_REVOKED');return{rows:[{proof:proofValue}]}}
  assert.fail('Unexpected central port')
 }
 const calendarQuery=async(sql,args=[])=>{
  if(sql.includes('notification_descriptor'))return{rows:[{descriptor:{schemaDigest:'d'.repeat(64),applicationId:request.applicationId,contract:'profitia.economic-calendar-notifications/1.0.0',environment:'development'}}]}
  if(sql.includes('notification_claim')){if(state!=='PENDING')return{rows:[{claim:null}]};state='CLAIMED';return{rows:[{claim}]}}
  if(sql.includes('notification_gate'))return{rows:[{allowed:consent}]}
  if(sql.includes('notification_begin')){effects.push('durable-begin');assert.equal(state,'CLAIMED');assert.equal(args[3],digest('synthetic@example.test'));if(!consent)return{rows:[{begun:false}]};state='SENDING';if(options.disableAfterBegin)consent=false;return{rows:[{begun:true}]}}
  if(sql.includes('notification_settle')){effects.push(args[2]);state=args[2]==='RELEASE'?'PENDING':args[2];if(args[3])assert.match(args[3],/^[a-f0-9]{64}$/);return{rows:[{settled:true}]}}
  assert.fail('Unexpected ECR port')
 }
 const fetcher=async(url,init)=>{calls++;effects.push('http');assert.equal(state,'SENDING');assert.equal(init.body.get('o:tag'),'calendar-notification-development');assert.equal(init.body.get('o:tracking'),'no');assert.equal(init.body.get('v:calendar_delivery_id'),request.deliveryId);assert.equal(init.body.get('v:calendar_lease_id'),request.leaseId);assert.equal(init.body.get('to'),'synthetic@example.test');assert(!init.body.get('html').includes('<release>'));assert(init.body.get('text').includes('calendarEvent='+request.eventId));if(options.timeout)throw Error('SYNTHETIC_UNCERTAIN_HTTP');return Response.json({id:'<synthetic@mail.example.test>'},{status:200})}
 const runtime=createCalendarEmailRuntime({query,calendarQuery,client,calendarSchemaDigest:'d'.repeat(64),mailgun:{environment:'development',region:'eu',domain:'mail.example.test',apiKey:'SYNTHETIC_ONLY_NOT_A_REAL_KEY',authorizedRecipients:[],from:'notifications@mail.example.test',senderName:'SpendGuru'},fetch:fetcher,autoStart:false,diagnostic:code=>effects.push(code)})
 return{runtime,claim,effects,get state(){return state},get calls(){return calls},get accounts(){return accounts},revoke(){active=false}}
}
test('calendar uses verified primary recipient, one Clerk read, current E1, durable begin and one HTTP despite concurrent replay',async()=>{
 const f=fixture();await f.runtime.ready();await Promise.all([f.runtime.tick(),f.runtime.tick()]);await f.runtime.tick();assert.equal(f.state,'ACCEPTED');assert.equal(f.calls,1);assert.equal(f.accounts,1);assert(f.effects.indexOf('durable-begin')<f.effects.indexOf('http'));await f.runtime.stop()
})
test('unverified primary, banned account, revoked access or disabled consent never reaches HTTP',async()=>{
 for(const options of [{unverified:true},{banned:true},{revokeAfterProof:true},{disableAfterBegin:true}]){const f=fixture(options);await f.runtime.tick();assert.equal(f.calls,0);assert.equal(f.state,'REJECTED');await f.runtime.stop()}
 const f=fixture();f.revoke();await f.runtime.tick();assert.equal(f.calls,0);assert.equal(f.accounts,0);assert(!f.effects.includes('durable-begin'));await f.runtime.stop()
})
test('failure before begin is retryable; failure after possible HTTP acceptance is UNKNOWN and never replayed',async()=>{
 const before=fixture({failBeforeBegin:true});await before.runtime.tick();assert.equal(before.state,'PENDING');assert.equal(before.calls,0);assert(!before.effects.includes('durable-begin'));await before.runtime.stop()
 const after=fixture({timeout:true});await after.runtime.tick();await after.runtime.tick();assert.equal(after.state,'UNKNOWN');assert.equal(after.calls,1);assert(!after.effects.includes('RELEASE'));await after.runtime.stop()
})
test('mail distinguishes a missing result, observed change, date-only and uncertain rule-derived time',()=>{
 const f=fixture(),c=structuredClone(f.claim)
 assert(renderCalendarNotification(c,'https://dev-sg2.spendguru.app').text.includes('0 MBBL'))
 assert.throws(()=>renderCalendarNotification({...c,payload:{...c.payload,results:[]}},'https://dev-sg2.spendguru.app'))
 c.payload.type='changes';delete c.payload.results;assert(renderCalendarNotification(c,'https://dev-sg2.spendguru.app').text.includes('nie potwierdza opublikowania wyniku'))
 c.payload.type='approaching';c.payload.schedule={timePrecision:'DATE',dateOnly:'2026-11-13'};assert(renderCalendarNotification(c,'https://dev-sg2.spendguru.app').text.includes('nie potwierdza godziny'))
 c.payload.schedule={timePrecision:'INSTANT',scheduledAt:'2026-11-13T15:30:00Z',timeZone:'America/New_York',scheduleStatus:'RULE_DERIVED_UNCONFIRMED'};assert(renderCalendarNotification(c,'https://dev-sg2.spendguru.app').text.includes('może ulec zmianie'))
 assert.throws(()=>renderCalendarNotification(c,'https://untrusted.test'));assert.throws(()=>renderCalendarNotification({...c,payload:{...c.payload,title:'header\r\ninjection'}},'https://dev-sg2.spendguru.app'))
 const rehearsal=renderCalendarNotification({...c,payload:{...c.payload,type:'changes',controlTest:true}},'https://dev-sg2.spendguru.app')
 assert(rehearsal.subject.startsWith('[TEST] '));assert(rehearsal.text.includes('WIADOMOŚĆ TESTOWA'));assert(!rehearsal.text.includes('Zmianę rzeczywiście zaobserwowano'))
})
