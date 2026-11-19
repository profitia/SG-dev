import {createHash,randomUUID,randomBytes} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
import {createClerkAccountStatusReader} from '@profitia/platform-contracts/identity-provider'
import {createMailgunCalendarSender,mailbox,type TransactionalMailgunConfig,type EmailContent} from './mailgun-delivery.js'
import {mailgunMessageDigest} from './calendar-mailgun-webhook.js'
type Query=(sql:string,values?:unknown[])=>Promise<{rows:Record<string,any>[]}>
type Claim={request:{applicationId:string;deliveryId:string;leaseId:string;nonce:string;organisationId:string;ownerUserId:string;eventId:string;payloadDigest:string};payload:Record<string,any>;expiresAt:string}
const digest=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex')
const schema=()=>digest(readFileSync(new URL('migrations/015-calendar-delivery.sql',import.meta.resolve('@profitia/platform-current-e1-authority'))))
const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const text=(v:unknown,max=600):string=>{if(typeof v!=='string'||!v.length||v.length>max||/[\x00-\x1f\x7f]/.test(v))throw Error('VERIFIED_CALENDAR_CONTENT_REQUIRED');return v}
export function renderCalendarNotification(claim:Claim,origin:string):EmailContent{
 const p=claim.payload
 if(origin!=='https://dev-sg2.spendguru.app'||!/^ecr_evt_[a-f0-9]{64}$/.test(claim.request.eventId)||p.eventId!==claim.request.eventId||!['approaching','results','changes'].includes(p.type))throw Error('CALENDAR_CONTENT_BINDING_REQUIRED')
 const title=text(p.title,300),heading=p.controlTest===true?'Kontrolny test doręczenia':p.type==='approaching'?'Nadchodząca publikacja':p.type==='results'?'Nowy wynik publikacji':'Zaobserwowana zmiana publikacji'
 const lines=['SpendGuru — Kalendarz rynkowy',heading,title,'Źródło: '+text(p.provider)]
 if(p.controlTest===true)lines.push('WIADOMOŚĆ TESTOWA. Pokazujemy istniejący, rzeczywisty rekord ECR. Ten test nie potwierdza nowej publikacji, zmiany terminu ani rewizji.')
 if(p.type==='approaching'){
  const s=p.schedule
  if(!s||!['INSTANT','TIME_WINDOW','DATE'].includes(s.timePrecision))throw Error('VERIFIED_CALENDAR_TIME_REQUIRED')
  if(s.timePrecision==='DATE')lines.push('Data publikacji: '+text(s.dateOnly)+'. Źródło nie potwierdza godziny; przypomnienie jest wysyłane o 09:00 w Twojej strefie.')
  else{if(!Number.isFinite(Date.parse(s.scheduledAt)))throw Error('VERIFIED_CALENDAR_TIME_REQUIRED');lines.push('Planowany termin: '+new Intl.DateTimeFormat('pl-PL',{dateStyle:'long',timeStyle:'short',timeZone:s.timeZone}).format(new Date(s.scheduledAt))+' ('+text(s.timeZone)+')');if(s.timePrecision==='TIME_WINDOW')lines.push('Źródło podaje przedział czasu, nie gwarantowaną minutę publikacji.')}
  if(s.scheduleStatus==='RULE_DERIVED_UNCONFIRMED')lines.push('Termin wynika ze standardowej reguły źródła i może ulec zmianie.')
 }else{
  if(p.type==='results'&&(!Array.isArray(p.results)||!p.results.length))throw Error('ACTUAL_RESULT_REQUIRED')
  if(Array.isArray(p.results))for(const r of p.results){if(!/^[+-]?\d+(?:\.\d+)?$/.test(String(r.actual)))throw Error('ACTUAL_RESULT_REQUIRED');lines.push(text(r.series)+': '+String(r.actual)+' '+text(r.unit)+'; okres: '+text(r.referencePeriod))}
  if(p.type==='changes'){if(p.controlTest!==true)lines.push('Zmianę rzeczywiście zaobserwowano w ECR; otwórz szczegóły, aby zobaczyć historię.');if(!Array.isArray(p.results)||!p.results.length)lines.push('Ta wiadomość nie potwierdza opublikowania wyniku liczbowego.')}
 }
 const link=origin+'/pl/dashboard/procurement-insights?tab=calendar&calendarEvent='+claim.request.eventId
 lines.push('Otwórz wydarzenie: '+link,'Dostęp wymaga zalogowania. Typy powiadomień i zgodę e-mail możesz wyłączyć w Kalendarzu rynkowym.')
 return{subject:(p.controlTest===true?'[TEST] ':'')+'SpendGuru — '+heading,text:lines.join('\n\n'),html:'<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1b2430"><main style="max-width:600px;margin:24px auto;padding:24px"><h1>'+escape(heading)+'</h1>'+lines.filter(x=>!x.startsWith('Otwórz wydarzenie:')).map(x=>'<p>'+escape(x)+'</p>').join('')+'<p><a href="'+escape(link)+'">Otwórz wydarzenie</a></p></main></body></html>'}
}

/** Existing Identity process, its verified account reader and mail transport.
 * ECR alone owns consent, source facts, deduplication and delivery state. */
export function createCalendarEmailRuntime(options:{query:Query;calendarQuery:Query;client:any;calendarSchemaDigest:string;mailgun:Omit<TransactionalMailgunConfig,'recipientPolicy'>;fetch?:typeof fetch;pollMs?:number;autoStart?:boolean;now?:()=>number;diagnostic?:(code:'calendar-mail-unavailable'|'calendar-mail-unknown')=>void}){
 const q=options.query,cq=options.calendarQuery,now=options.now??Date.now,poll=options.pollMs??60000
 if(!/^[a-f0-9]{64}$/.test(options.calendarSchemaDigest)||!Number.isInteger(poll)||poll<100||poll>60000)throw Error('CALENDAR_DELIVERY_CONFIGURATION_REQUIRED')
 let stopped=false,running:Promise<void>|null=null
 const one=async(port:Query,sql:string,args:unknown[]=[])=>{const r=await port(sql,args);if(r.rows.length!==1)throw Error('CALENDAR_DELIVERY_UNAVAILABLE');return r.rows[0]!}
 const descriptor=async()=>{
  const d=(await one(q,'SELECT profitia_e1_authority.calendar_delivery_descriptor() AS descriptor')).descriptor
  const c=(await one(cq,'SELECT economic_calendar.notification_descriptor() AS descriptor')).descriptor
  if(d?.schemaDigest!==schema()||c?.schemaDigest!==options.calendarSchemaDigest||c?.contract!=='profitia.economic-calendar-notifications/1.0.0'||c?.environment!=='development'||!Array.isArray(d.policies)||!d.policies.some((p:{applicationId:string})=>p.applicationId===c.applicationId))throw Error('CALENDAR_DELIVERY_UNAVAILABLE')
  return d
 }
 const settle=async(c:Claim,status:string,id:string|null=null)=>one(cq,'SELECT economic_calendar.notification_settle($1::uuid,$2::uuid,$3,$4) AS settled',[c.request.deliveryId,c.request.leaseId,status,id?mailgunMessageDigest(id):null])
 const processOne=async()=>{
  let claim:Claim|null=null,started=false
  try{
   const d=await descriptor();claim=(await one(cq,'SELECT economic_calendar.notification_claim($1::uuid,$2) AS claim',[randomUUID(),randomBytes(32).toString('hex')])).claim as Claim|null;if(!claim)return
   const c=claim,policy=d.policies.find((p:{applicationId:string})=>p.applicationId===c.request.applicationId)
   if(stopped){await settle(c,'RELEASE');return}if(!policy||Date.parse(c.expiresAt)<=now()){await settle(c,'REJECTED');return}
   const identity=(await one(q,'SELECT profitia_e1_authority.calendar_delivery_identity($1::jsonb) AS identity',[JSON.stringify(c.request)])).identity
   if(!identity){await settle(c,'REJECTED');return}
   const user=await options.client.users.getUser(identity.subject)
   const observation=await createClerkAccountStatusReader({client:{...options.client,users:{getUser:async()=>user}},environment:'development',issuer:identity.issuer,now})(identity)
   const primary=user.emailAddresses?.find((e:{id:string})=>e.id===user.primaryEmailAddressId)
   if(!observation||primary?.verification?.status!=='verified'){await settle(c,'REJECTED');return}
   const recipient=mailbox(primary.emailAddress),recipientDigest=digest(recipient),message=renderCalendarNotification(c,policy.appOrigin)
   const proof=(await one(q,'SELECT profitia_e1_authority.calendar_delivery_proof($1::jsonb,$2::jsonb,$3) AS proof',[JSON.stringify(c.request),JSON.stringify(observation),recipientDigest])).proof
   if(!proof){await settle(c,'REJECTED');return}if(stopped){await settle(c,'RELEASE');return}
   const sender=createMailgunCalendarSender(options.mailgun,async m=>{
    if(digest(m.recipient)!==recipientDigest||m.subject!==message.subject||m.html!==message.html||m.text!==message.text||m.calendarDelivery?.id!==c.request.deliveryId||m.calendarDelivery?.leaseId!==c.request.leaseId)return false
    try{
     const accepted=(await one(q,'SELECT profitia_e1_authority.calendar_delivery_verify($1::jsonb) AS proof',[JSON.stringify(proof)])).proof
     const gate=(await one(cq,'SELECT economic_calendar.notification_gate($1::uuid) AS allowed',[c.request.deliveryId])).allowed
     return gate===true&&accepted?.recipientDigest===recipientDigest&&operationPayloadDigest(accepted.request)===operationPayloadDigest(c.request)
    }catch{return false} // No HTTP has begun: this is a definite refusal, not UNKNOWN.
   },options.fetch??fetch)
   const begun=(await one(cq,'SELECT economic_calendar.notification_begin($1::uuid,$2::uuid,$3,$4) AS begun',[c.request.deliveryId,c.request.leaseId,c.request.nonce,recipientDigest])).begun
   if(!begun){await settle(c,'REJECTED');return}started=true
   const result=await sender({...message,recipient,calendarDelivery:{id:c.request.deliveryId,leaseId:c.request.leaseId}})
   await settle(c,result.status==='accepted'?'ACCEPTED':result.status==='rejected'?'REJECTED':'UNKNOWN',result.status==='accepted'?result.providerId:null)
   if(result.status==='unknown')options.diagnostic?.('calendar-mail-unknown')
  }catch{
   if(claim)try{await settle(claim,started?'UNKNOWN':'RELEASE')}catch{/* expired SENDING is reconciled to UNKNOWN, never blindly retried */}
   options.diagnostic?.('calendar-mail-unavailable')
  }
 }
 const tick=async()=>{if(stopped)return;if(!running)running=processOne().finally(()=>{running=null});await running}
 const timer=options.autoStart===false?null:setInterval(()=>{void tick()},poll);timer?.unref()
 return Object.freeze({ready:descriptor,tick,async stop(){stopped=true;if(timer)clearInterval(timer);await running}})
}
