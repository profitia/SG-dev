import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {accountBrowserScript} from '../dist/src/account-page.js'

const userId='11111111-1111-4111-8111-111111111111'
async function browser(){
 const calls=[],state={expired:false,deny:false,foreign:false,expiredReceipt:false,switchDuringToken:false,switchDuringMaintenance:false}
 const nodes=new Map(),events=new Map();let identityRequest,tokenVersion=0,accountPosts=0
 const cfg={en:false,flow:'login',organisationOnboarding:true,organisationInvitation:false,organisationWorkspaceUrl:'https://workspace.example.test/pl/dashboard',returnTo:'https://workspace.example.test/pl/dashboard',signInUrl:'https://identity.example.test/account/sg2/account-pl/login',signUpUrl:'https://identity.example.test/account/sg2/account-pl/registration'}
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:id==='account-config'?JSON.stringify(cfg):'',replaceChildren(){}});return nodes.get(id)}
 const document={getElementById:node,body:{classList:{add(){},remove(){}}}}
 const window={document,location:{origin:'https://identity.example.test',pathname:'/account/sg2/account-pl/login',replace(){throw Error('Unexpected redirect')}},__internal_ClerkUICtor:class{},addEventListener:(name,callback)=>events.set(name,callback),spendGuruRegistrationReceipt:()=> 'r'.repeat(43)}
 const session={id:'sess_browser_original',getToken:async options=>{assert.equal(options.skipCache,true);tokenVersion++;if(state.switchDuringToken)window.Clerk.session={...session,id:'sess_browser_switched'};return 'fresh-'+tokenVersion}}
 window.Clerk={session,user:{id:'user_browser_original',unsafeMetadata:{}},load:async()=>{},addListener(){},signOut:async()=>{}}
 const fetch=async(path,options)=>{
  calls.push({path,method:options.method,headers:{...options.headers},body:options.body,credentials:options.credentials,cache:options.cache,redirect:options.redirect,signal:options.signal})
  if(path==='/v1/account'){
   accountPosts++
   if(accountPosts>1&&state.switchDuringMaintenance)window.Clerk.session={...session,id:'sess_browser_switched'}
   if(accountPosts>1&&state.deny)return Response.json({error:'ACCOUNT_REQUIRED'},{status:403})
   state.expired=false
   return Response.json({authenticated:true,userId:accountPosts>1&&state.foreign?'22222222-2222-4222-8222-222222222222':userId,expiresAt:new Date(accountPosts>1&&state.expiredReceipt?0:Date.now()+60000).toISOString()})
  }
  if(path==='/v1/account/assistant-avatar')return Response.json({userId,avatarSex:'male',version:'1'})
  if(path==='/v1/account/communication-language')return Response.json({userId,language:'pl',source:'user',version:'1'})
  if(state.expired)return Response.json({error:'EXPIRED_PRIVATE_BINDING'},{status:403})
  return Response.json({ready:true})
 }
 vm.runInNewContext(accountBrowserScript,{window,document,fetch,Response,Request,URL,DOMException,AbortController,Date,JSON,Intl,navigator:{languages:['pl'],language:'pl'},setTimeout,clearTimeout},{timeout:1000})
 // Capture the actual account-page transport; the conversation UI has its own tests.
 window.startSpendGuruOrganisation=async(_cfg,request)=>{identityRequest=request}
 assert.equal(typeof events.get('load'),'function');await events.get('load')();assert.equal(typeof identityRequest,'function')
 calls.length=0
 return{state,calls,request:identityRequest,get tokenVersion(){return tokenVersion}}
}

test('each delayed onboarding step revalidates the same account before its effect with the same fresh token',async()=>{
 const f=await browser()
 for(let i=0;i<3;i++){
  f.state.expired=true
  assert.equal((await f.request('/v1/account/organisation-onboarding/snapshot','GET')).ready,true)
 }
 assert.equal(f.calls.length,6)
 for(let i=0;i<6;i+=2){
  const account=f.calls[i],effect=f.calls[i+1]
  assert.equal(account.path,'/v1/account');assert.equal(account.method,'POST');assert.equal(account.body,'{}')
  assert.equal(effect.path,'/v1/account/organisation-onboarding/snapshot')
  assert.equal(account.headers.Authorization,effect.headers.Authorization);assert.equal(account.headers.Authorization,'Bearer fresh-'+(i/2+2))
  assert.equal(account.headers['X-Registration-Receipt'],undefined)
  for(const request of [account,effect]){assert.equal(request.credentials,'omit');assert.equal(request.cache,'no-store');assert.equal(request.redirect,'error');assert(request.signal instanceof AbortSignal)}
 }
 assert(!f.calls.some(x=>x.path==='/v1/account/renew'))
})
test('revoked or unavailable account revalidation prevents the onboarding operation',async()=>{
 const f=await browser();f.state.deny=true
 await assert.rejects(f.request('/v1/account/organisation-onboarding/company','POST',{nip:'1234563218'}),/ACCOUNT_UNAVAILABLE/)
 assert.deepEqual(f.calls.map(x=>x.path),['/v1/account'])
})
test('another account or expired account response never advances the onboarding operation',async()=>{
 for(const field of ['foreign','expiredReceipt']){
  const f=await browser();f.state[field]=true
  await assert.rejects(f.request('/v1/account/organisation-onboarding/snapshot','GET'),/ACCOUNT_UNAVAILABLE/)
  assert.deepEqual(f.calls.map(x=>x.path),['/v1/account'])
 }
})
test('session switch while obtaining a fresh token stops before account revalidation',async()=>{
 const f=await browser();f.state.switchDuringToken=true
 await assert.rejects(f.request('/v1/account/organisation-onboarding/snapshot','GET'),error=>error.name==='AbortError')
 assert.equal(f.calls.length,0)
})
test('session switch during account revalidation stops before an onboarding effect',async()=>{
 const f=await browser();f.state.switchDuringMaintenance=true
 await assert.rejects(f.request('/v1/account/organisation-onboarding/snapshot','GET'),error=>error.name==='AbortError')
 assert.deepEqual(f.calls.map(x=>x.path),['/v1/account'])
})
