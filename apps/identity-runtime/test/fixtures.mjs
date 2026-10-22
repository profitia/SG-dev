import { readConfiguration } from '../dist/src/config.js'
import { createSessionBoundary } from '../dist/src/session-boundary.js'
export const issuer='https://synthetic.clerk.accounts.dev', origin='http://localhost:3600'
export const ids={a:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}
export function configuration(patch={}) { return readConfiguration({applicationId:'identity-runtime-development',environment:'development',origin,issuer,
 publishableKey:'pk_test_'+Buffer.from('synthetic.clerk.accounts.dev$').toString('base64url'),targets:{sg2:{applicationId:'sg2-fixture',origin:'https://sg2.example.test',routes:{home:'/',account:'/account'}},srm:{applicationId:'srm-fixture',origin:'https://srm.example.test',routes:{home:'/'}}},...patch}) }
export function fixture(patch={}) {
 const f={now:Date.now(),user:'a',status:'signed-in',tokenExpiry:undefined,sessionStatus:'active',banned:false,locked:false,deprovisioned:false,impersonating:false,
  bindingStatus:'ACTIVE',bindingExpired:false,bindingMissing:false,providerError:false,sdkError:false,revocationError:false,ready:true,calls:[],sdkCalls:0,switchAt:0,...patch}
 f.config=configuration(f.configPatch??{})
 f.client={authenticateRequest:async(_request,options)=>{f.calls.push('sdk');f.sdkCalls++;if(f.switchAt===f.sdkCalls)f.user='b';if(f.sdkError)throw Error('synthetic SDK unavailable');const user=f.user,session='sess_'+user;return {status:f.status,isAuthenticated:f.status==='signed-in',toAuth:()=>({isAuthenticated:true,tokenType:'session_token',userId:'provider_'+user,sessionId:session,actor:f.impersonating?{}:null,sessionClaims:{iss:f.tokenIssuer??issuer,sub:'provider_'+user,sid:session,azp:f.party??f.config.origin,exp:f.tokenExpiry??Math.floor(f.now/1000)+300,act:f.impersonating?{}:undefined}})}},
 sessions:{getSession:async id=>{f.calls.push('session');if(f.providerError)throw Error('synthetic provider unavailable');return {id,userId:'provider_'+id.slice(5),status:f.sessionStatus,expireAt:f.now+(f.sessionExpired?-1:300000),abandonAt:f.now+300000,actor:f.impersonating?{}:null}},revokeSession:async id=>{f.calls.push('revoke:'+id);if(f.revocationError)throw Error('synthetic revocation failure');f.sessionStatus='revoked';return {id,status:'revoked'}}},
 users:{getUser:async id=>{f.calls.push('user');if(f.providerError)throw Error('synthetic provider unavailable');return {id,banned:f.banned,locked:f.locked,deprovisioned:f.deprovisioned}}}}
 f.authority={resolveBinding:async key=>{f.calls.push('binding');if(f.bindingMissing)return null;return {...key,userId:ids[key.subject.slice(-1)],status:f.bindingStatus,version:f.bindingVersion??'fixture-v1',sourceRef:'fixture-only',expiresAt:new Date(f.now+(f.bindingExpired?-1:300000)).toISOString()}},ready:async()=>f.ready}
 f.request=(path='/v1/session',method='GET',body,headers={})=>new Request(f.config.origin+path,{method,headers:{...(method==='POST'?{origin:f.config.origin,'content-type':'application/json'}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})})
 f.boundary=createSessionBoundary({configuration:f.config,client:f.client,authority:f.authority,now:()=>f.now,...(f.flowStore?{flowStore:f.flowStore}:{})})
 return f
}
export const intent={targetId:'sg2',routeKey:'home',flow:'login'}
