import { BoundaryError } from './contracts.js'
import { mailbox } from './mailgun-delivery.js'
import type { RegistrationStore, RegistrationReceipt, RegistrationDraft } from './registration-store.js'
import { RegistrationProviderError, type RegistrationProvider } from './registration-provider.js'
export interface RegistrationSurface { ready():Promise<void>; start(input:unknown):Promise<unknown>; verify(input:unknown):Promise<unknown> }
function record(value:unknown,keys:string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys.sort().join(','))throw new BoundaryError(400,'INVALID_REGISTRATION')
 return value as Record<string,unknown>
}
export function registrationLanguage(language:unknown):'pl'|'en'{return typeof language==='string'&&/^pl(?:-|$)/i.test(language.trim())?'pl':'en'}
export function registrationDraft(input:unknown):RegistrationDraft{
 const v=record(input,['email','firstName','lastName','avatar','browserLanguage'])
 const name=(x:unknown)=>{if(typeof x!=='string'||!x.trim()||x.length>100||/[\x00-\x1f\x7f]/.test(x))throw new BoundaryError(400,'INVALID_REGISTRATION');return x.trim().normalize('NFC')}
 if(!['male','female'].includes(String(v.avatar))||typeof v.browserLanguage!=='string'||v.browserLanguage.length>100)throw new BoundaryError(400,'INVALID_REGISTRATION')
 let email:string
 try { email=mailbox(typeof v.email==='string'?v.email.trim().toLowerCase():v.email) } catch { throw new BoundaryError(400,'INVALID_REGISTRATION') }
 return {email,firstName:name(v.firstName),lastName:name(v.lastName),avatar:v.avatar as 'male'|'female',language:registrationLanguage(v.browserLanguage)}
}
export function createRegistrationSurface(store:RegistrationStore,provider:RegistrationProvider):RegistrationSurface{
 const receipt=(v:Record<string,unknown>):RegistrationReceipt=>{
  if(typeof v.attemptId!=='string'||!/^\w{8}-\w{4}-4\w{3}-[89ab]\w{3}-\w{12}$/i.test(v.attemptId)||typeof v.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(v.token))throw new BoundaryError(400,'INVALID_REGISTRATION')
  return {attemptId:v.attemptId,token:v.token}
 }
 return {
  ready:()=>store.ready(),
  async start(input){
   const draft=registrationDraft(input);await provider.guard()
   const started=await store.start(draft)
   if(started.status==='login')return {status:'login'}
   if(started.status!=='preparing')throw new BoundaryError(429,'REGISTRATION_RETRY_LATER')
   const proof=receipt(started)
   try{
    const bound=await provider.reserve(String(started.registrationId),draft,started.subject as string|null,started.emailAddressId as string|null)
    await store.command('bind',proof,bound)
    const verificationId=await provider.prepare(bound.subject,bound.emailAddressId,proof.attemptId)
    await store.command('ready',proof,{verificationId})
    return {status:'code',...proof}
   }catch(e){if(e instanceof RegistrationProviderError&&e.code==='ACCOUNT_EXISTS')return {status:'login'};throw e}
  },
  async verify(input){
   const v=record(input,['attemptId','token','code']),proof=receipt(v)
   if(typeof v.code!=='string'||!/^\d{6}$/.test(v.code))throw new BoundaryError(400,'INVALID_CODE')
   await provider.guard()
   const a=await store.command('verify',proof)
   const ok=await provider.verify(String(a.emailAddressId),String(a.verificationId),v.code)
   await store.command('verified',proof,{verified:ok})
   if(!ok)throw new BoundaryError(400,'INVALID_CODE')
   const draft=store.decrypt(proof.attemptId,String(a.ciphertext))
   const bound=await store.command('ticket',proof)
   const ticket=await provider.ticket(String(bound.subject),String(bound.emailAddressId),draft)
   return {status:'verified',ticket,subject:bound.subject}
  }
 }
}
