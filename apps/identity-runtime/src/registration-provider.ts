import type { RegistrationDraft } from './registration-store.js'
export interface RegistrationProvider {
 guard(): Promise<void>
 reserve(id:string,draft:RegistrationDraft,subject:string|null,emailId:string|null): Promise<{subject:string;emailAddressId:string}>
 prepare(subject:string,emailId:string,attemptId:string): Promise<string>
 verify(emailId:string,verificationId:string,code:string): Promise<boolean>
 ticket(subject:string,emailId:string,draft:RegistrationDraft): Promise<string>
}
export class RegistrationProviderError extends Error { constructor(readonly code:string){super(code)} }
/** Explicit reserved identification is mandatory. BAPI's verified default is
 * never used. Provider errors are redacted; no automatic mutation retries. */
export function createRegistrationProvider(config:{secret:string;issuer:string;instanceId:string;environment:string},fetcher:typeof fetch=fetch):RegistrationProvider {
 if(config.environment!=='development'||!config.secret.startsWith('sk_test_')||!/^https:\/\/[a-z0-9.-]+\.clerk\.accounts\.dev$/.test(config.issuer))throw Error('REGISTRATION_PROVIDER_CONFIGURATION')
 const request=async(path:string,method='GET',body?:unknown)=>{
  const r=await fetcher('https://api.clerk.com/v1'+path,{method,headers:{Authorization:'Bearer '+config.secret,'Content-Type':'application/json','Clerk-API-Version':'2025-11-10'},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(8000)})
  if(!r.ok)throw new RegistrationProviderError('PROVIDER_UNAVAILABLE')
  return await r.json() as any
 }
 const user=async(subject:string,emailId:string,email?:string)=>{
  const u=await request('/users/'+encodeURIComponent(subject)),e=u.email_addresses?.find((e:any)=>e.id===emailId)
  if(u.id!==subject||u.banned||u.locked||u.external_id?.startsWith('registration-')!==true||!e||(email&&e.email_address?.trim().toLowerCase()!==email))throw new RegistrationProviderError('PROVIDER_BINDING')
  return {u,e}
 }
 const guard=async()=>{
  const r=await fetcher(config.issuer+'/v1/environment',{redirect:'error',signal:AbortSignal.timeout(8000)})
  if(!r.ok)throw new RegistrationProviderError('PROVIDER_UNAVAILABLE')
  const env=await r.json() as any,s=env.user_settings,attrs=s?.attributes,signUp=s?.sign_up
  // This bounded email-code flow deliberately fails closed when provider policy
  // requires a password, consent, CAPTCHA, custom action, MFA or restrictions.
  if(!s||!attrs||!signUp||signUp.mode!=='public'||signUp.captcha_enabled!==false||signUp.legal_consent_enabled!==false||signUp.custom_action_required!==false
   ||signUp.mfa?.required!==false||s.sign_in?.second_factor?.required!==false||attrs.ticket?.enabled!==true
   ||attrs.email_address?.enabled!==true||!attrs.email_address.first_factors?.includes('email_code')
   ||Object.entries(attrs).some(([k,v]:[string,any])=>v.required===true&&!['first_name','last_name','email_address'].includes(k))
   ||Object.entries(s.restrictions??{}).some(([k,v]:[string,any])=>k!=='allowlist_blocklist_disabled_on_sign_in'&&(v===true||v?.enabled===true)))throw new RegistrationProviderError('PROVIDER_CHALLENGE_REQUIRED')
  const instance=await request('/instance');if(instance.id!==config.instanceId)throw new RegistrationProviderError('PROVIDER_INSTANCE')
 }
 return {
  guard,
  async reserve(id,draft,subject,emailId){
   if(subject&&emailId){const {u}=await user(subject,emailId,draft.email);if(u.external_id!=='registration-'+id)throw new RegistrationProviderError('PROVIDER_BINDING');return {subject,emailAddressId:emailId}}
   const external='registration-'+id,existing=await request('/users?external_id='+encodeURIComponent(external))
   if(!Array.isArray(existing)||existing.length>1)throw new RegistrationProviderError('PROVIDER_BINDING')
   let u=existing[0]
   if(!u){
    const matches=await request('/users?email_address='+encodeURIComponent(draft.email));if(!Array.isArray(matches)||matches.length)throw new RegistrationProviderError('ACCOUNT_EXISTS')
    u=await request('/users','POST',{email_address:[draft.email],email_address_identification_status:['reserved'],external_id:external,first_name:draft.firstName,last_name:draft.lastName})
    if(u.email_addresses?.length!==1||u.email_addresses[0].reserved!==true||u.email_addresses[0].verification?.status==='verified')throw new RegistrationProviderError('PROVIDER_RESERVATION')
   }
   if(u.external_id!==external||u.email_addresses?.length!==1)throw new RegistrationProviderError('PROVIDER_BINDING')
   const e=u.email_addresses[0];await user(u.id,e.id,draft.email);return {subject:u.id,emailAddressId:e.id}
  },
  async prepare(subject,emailId,attemptId){
   await user(subject,emailId)
   await request('/users/'+encodeURIComponent(subject)+'/metadata','PATCH',{public_metadata:{registrationAttemptId:attemptId}})
   const v=await request('/email_addresses/'+encodeURIComponent(emailId)+'/prepare_verification','POST')
   if(v.status!=='unverified'||v.strategy!=='email_code'||typeof v.id!=='string')throw new RegistrationProviderError('PROVIDER_VERIFICATION')
   return v.id
  },
  async verify(emailId,verificationId,code){
   const v=await request('/email_addresses/'+encodeURIComponent(emailId)+'/attempt_verification','POST',{verification_id:verificationId,code})
   return v.status==='verified'&&v.strategy==='email_code'&&v.id===verificationId
  },
  async ticket(subject,emailId,draft){
   await guard();const {u,e}=await user(subject,emailId,draft.email)
   if(e.verification?.status!=='verified'||u.primary_email_address_id!==emailId||u.two_factor_enabled===true)throw new RegistrationProviderError('PROVIDER_VERIFIED_EMAIL_REQUIRED')
   await request('/users/'+encodeURIComponent(subject),'PATCH',{first_name:draft.firstName,last_name:draft.lastName})
   await request('/users/'+encodeURIComponent(subject)+'/metadata','PATCH',{public_metadata:{registrationAttemptId:null}})
   const t=await request('/sign_in_tokens','POST',{user_id:subject,expires_in_seconds:60})
   if(typeof t.token!=='string'||t.user_id!==subject)throw new RegistrationProviderError('PROVIDER_TICKET')
   return t.token
  }
 }
}
