import test from 'node:test'
import assert from 'node:assert/strict'
import {createRegistrationProvider} from '../dist/src/registration-provider.js'
function fixture(){
 const f={calls:[],settings:{attributes:{email_address:{enabled:true,required:true,first_factors:['email_code']},first_name:{required:true},last_name:{required:true},password:{required:false},ticket:{enabled:true}},sign_up:{mode:'public',captcha_enabled:false,legal_consent_enabled:false,custom_action_required:false,mfa:{required:false}},sign_in:{second_factor:{required:false}},restrictions:{allowlist:{enabled:false},blocklist:{enabled:false},allowlist_blocklist_disabled_on_sign_in:{enabled:true}}},users:[],verified:false}
 f.user={id:'user_pending1234',external_id:'registration-test-id',primary_email_address_id:'idn_pending1234',email_addresses:[{id:'idn_pending1234',email_address:'synthetic@example.test',reserved:true,verification:null}]}
 f.provider=createRegistrationProvider({secret:'sk_test_synthetic',issuer:'https://synthetic.clerk.accounts.dev',instanceId:'ins_test1234',environment:'development'},async(url,init={})=>{
  const path=new URL(url).pathname;const body=init.body?JSON.parse(init.body):undefined;f.calls.push({path,method:init.method,body})
  if(path==='/v1/environment')return Response.json({user_settings:f.settings})
  if(path==='/v1/instance')return Response.json({id:'ins_test1234'})
  if(path==='/v1/users'&&init.method==='GET')return Response.json(f.users)
  if(path==='/v1/users'&&init.method==='POST')return Response.json(f.user)
  if(path==='/v1/users/user_pending1234')return Response.json(f.user)
  if(path.endsWith('/metadata'))return Response.json({})
  if(path.endsWith('/prepare_verification'))return Response.json({status:'unverified',strategy:'email_code',id:'ver_test1234'})
  if(path.endsWith('/attempt_verification'))return Response.json({status:f.verified?'verified':'unverified',strategy:'email_code',id:'ver_test1234'})
  if(path==='/v1/sign_in_tokens')return Response.json({user_id:f.user.id,token:'synthetic-ticket'})
  throw Error('Unexpected '+path)
 });return f
}
const draft={email:'synthetic@example.test',firstName:'Ada',lastName:'Testowa',avatar:'female',language:'en'}
test('explicit reserved address; retry recovers only matching external id and never adopts a foreign account',async()=>{
 const f=fixture();await f.provider.guard();await f.provider.reserve('test-id',draft,null,null)
 assert.deepEqual(f.calls.find(x=>x.method==='POST').body.email_address_identification_status,['reserved'])
 assert(!JSON.stringify(f.calls).includes('skip_password_checks'))
 f.users=[f.user];const before=f.calls.length;await f.provider.reserve('test-id',draft,null,null);assert(!f.calls.slice(before).some(x=>x.method==='POST'))
 f.user.external_id='unrelated';await assert.rejects(f.provider.reserve('test-id',draft,null,null));await assert.rejects(f.provider.reserve('test-id',draft,f.user.id,'idn_pending1234'))
})
test('new policy requirements fail closed; no create, OTP or ticket',async()=>{
 const mutations=[s=>s.sign_up.captcha_enabled=true,s=>s.sign_up.legal_consent_enabled=true,s=>s.sign_up.custom_action_required=true,s=>s.sign_up.mode='restricted',s=>s.sign_up.mfa.required=true,s=>s.sign_in.second_factor.required=true,s=>s.attributes.password.required=true,s=>s.restrictions.blocklist.enabled=true,s=>s.attributes.ticket.enabled=false]
 for(const change of mutations){const f=fixture();change(f.settings);await assert.rejects(f.provider.guard());assert(!f.calls.some(x=>x.method==='POST'))}
})
test('opaque attempt id is set before OTP; preferences are never provider authorization metadata',async()=>{
 const f=fixture();const id='11111111-1111-4111-8111-111111111111';await f.provider.prepare(f.user.id,'idn_pending1234',id)
 assert.deepEqual(f.calls.find(x=>x.path.endsWith('/metadata')).body,{public_metadata:{registrationAttemptId:id}})
 assert.equal(f.calls.at(-1).path,'/v1/email_addresses/idn_pending1234/prepare_verification')
 assert(!JSON.stringify(f.calls).includes('female'))
})
test('wrong OTP, unverified/locked user and MFA never issue a login ticket; verified ticket expires in 60 seconds',async()=>{
 const f=fixture();assert.equal(await f.provider.verify('idn_pending1234','ver_test1234','000000'),false)
 await assert.rejects(f.provider.ticket(f.user.id,'idn_pending1234',draft))
 f.user.email_addresses[0].verification={status:'verified'};f.user.locked=true;await assert.rejects(f.provider.ticket(f.user.id,'idn_pending1234',draft));f.user.locked=false
 f.user.two_factor_enabled=true;await assert.rejects(f.provider.ticket(f.user.id,'idn_pending1234',draft));f.user.two_factor_enabled=false
 assert.equal(await f.provider.ticket(f.user.id,'idn_pending1234',draft),'synthetic-ticket')
 assert.deepEqual(f.calls.at(-1).body,{user_id:f.user.id,expires_in_seconds:60})
 assert.deepEqual(f.calls.at(-2).body,{public_metadata:{registrationAttemptId:null}})
})
