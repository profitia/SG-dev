import {createHash,randomUUID,randomBytes} from 'node:crypto'
import {operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
import {readFileSync} from 'node:fs'
import {createClerkAccountStatusReader} from '@profitia/platform-contracts/identity-provider'
import {createMailgunReportSender,mailbox,type TransactionalMailgunConfig,type Submission,type EmailContent} from './mailgun-delivery.js'
type Query=(sql:string,values?:unknown[])=>Promise<{rows:Record<string,any>[]}>
type Claim={request:{applicationId:string;deliveryId:string;leaseId:string;nonce:string;organisationId:string;ownerUserId:string;subscriptionId:string;subscriptionVersion:string;producerJobId:string;pdfSha256:string};title:string;editionId:string;asOf:string;publishedAt:string;expiresAt:string}
const digest=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex')
const authoritySchema=()=>digest(readFileSync(new URL('migrations/014-recurring-delivery.sql',import.meta.resolve('@profitia/platform-current-e1-authority'))))
const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export function renderPublishedReport(claim:Claim,origin:string):EmailContent{
 if(origin!=='https://dev-sg2.spendguru.app'||typeof claim.title!=='string'||claim.title.length>300||/[\x00-\x1f\x7f]/.test(claim.title)||!/^[a-f0-9-]{36}$/.test(claim.request.producerJobId)||!Number.isFinite(Date.parse(claim.publishedAt))||!Number.isFinite(Date.parse(claim.asOf)))throw Error('PUBLISHED_REPORT_REQUIRED')
 const link=origin+'/pl/dashboard/procurement-insights?tab=reports&edition='+claim.request.producerJobId,date=new Date(claim.publishedAt).toISOString().slice(0,10),asOf=new Date(claim.asOf).toISOString().slice(0,10)
 const subject='SpendGuru — raport gotowy / report ready',text=['SpendGuru — Procurement Insights',claim.title,'Data wydania / Published: '+date,'Dane na dzień / Data as of: '+asOf,'Otwórz opublikowaną wersję / Open published edition: '+link,'Dostęp wymaga zalogowania. Preferencje e-mail zmienisz w zamówieniu raportu. / Sign-in is required. Manage email preferences in your report order.'].join('\n\n')
 return{subject,text,html:'<!doctype html><html><body style="margin:0;background:#f5f7f9;font-family:Arial,sans-serif;color:#1b2430"><main style="max-width:600px;margin:32px auto;padding:32px;background:white;border-radius:12px"><p>SpendGuru · Procurement Insights</p><h1 style="font-size:24px">'+escape(claim.title)+'</h1><p>Data wydania / Published: '+date+'</p><p>Dane na dzień / Data as of: '+asOf+'</p><p><a href="'+escape(link)+'">Otwórz raport / Open report</a></p><p style="font-size:12px">Dostęp wymaga zalogowania. Preferencje e-mail zmienisz w zamówieniu raportu.<br>Sign-in is required. Manage email preferences in your report order.</p></main></body></html>'}
}
/** Same existing Identity process and Mailgun transport. No webhook/session is
 * fabricated; all publication, recipient and current E1 checks precede begin.
 * Once begin is committed there is one attempt, never an automatic resend. */
export function createReportEmailRuntime(options:{query:Query;client:any;reportSchemaDigest:string;mailgun:Omit<TransactionalMailgunConfig,'recipientPolicy'>;fetch?:typeof fetch;pollMs?:number;autoStart?:boolean;now?:()=>number;diagnostic?:(code:'report-mail-unavailable'|'report-mail-unknown')=>void}){
 const q=options.query,now=options.now??Date.now,poll=options.pollMs??5000
 if(!/^[a-f0-9]{64}$/.test(options.reportSchemaDigest)||!Number.isInteger(poll)||poll<100||poll>60000)throw Error('REPORT_DELIVERY_CONFIGURATION_REQUIRED')
 let stopped=false,running:Promise<void>|null=null
 const one=async(sql:string,args:unknown[]=[])=>{const r=await q(sql,args);if(r.rows.length!==1)throw Error('REPORT_DELIVERY_UNAVAILABLE');return r.rows[0]!}
 const descriptor=async()=>{const d=(await one('SELECT insights_private.delivery_descriptor() AS descriptor')).descriptor;if(d?.schemaDigest!==authoritySchema()||d.reportSchemaDigest!==options.reportSchemaDigest||!Array.isArray(d.policies)||!d.policies.length)throw Error('REPORT_DELIVERY_UNAVAILABLE');return d}
 const settle=(c:Claim,status:string,id:string|null=null)=>one('SELECT insights_private.delivery_settle($1::uuid,$2::uuid,$3,$4)',[c.request.deliveryId,c.request.leaseId,status,id])
 const processOne=async()=>{
  let claim:Claim|null=null,started=false
  try{
   const d=await descriptor();claim=(await one('SELECT insights_private.delivery_claim($1::uuid,$2) AS claim',[randomUUID(),randomBytes(32).toString('hex')])).claim as Claim|null;if(!claim)return
   const c=claim,policy=d.policies.find((p:{applicationId:string})=>p.applicationId===c.request.applicationId)
   if(stopped){await settle(c,'RELEASE');return}if(!policy||Date.parse(c.expiresAt)<=now()){await settle(c,'REJECTED');return}
   const identity=(await one('SELECT profitia_e1_authority.recurring_delivery_identity($1::jsonb) AS identity',[JSON.stringify(c.request)])).identity
   if(!identity){await settle(c,'REJECTED');return}
   // One real provider-account read per attempt; the existing status adapter
   // consumes this same response rather than re-fetching Clerk redundantly.
   const user=await options.client.users.getUser(identity.subject)
   const observation=await createClerkAccountStatusReader({client:{...options.client,users:{getUser:async()=>user}},environment:'development',issuer:identity.issuer,now})(identity)
   const primary=user.emailAddresses?.find((e:{id:string})=>e.id===user.primaryEmailAddressId)
   if(!observation||primary?.verification?.status!=='verified'){await settle(c,'REJECTED');return}
   const recipient=mailbox(primary.emailAddress),recipientDigest=digest(recipient),message=renderPublishedReport(c,policy.appOrigin)
   const proof=(await one('SELECT profitia_e1_authority.recurring_delivery_proof($1::jsonb,$2::jsonb,$3) AS proof',[JSON.stringify(c.request),JSON.stringify(observation),recipientDigest])).proof
   if(!proof){await settle(c,'REJECTED');return}if(stopped){await settle(c,'RELEASE');return}
   const sender=createMailgunReportSender(options.mailgun,async m=>{
    if(digest(m.recipient)!==recipientDigest||m.subject!==message.subject||m.html!==message.html||m.text!==message.text)return false
    const accepted=(await one('SELECT profitia_e1_authority.recurring_delivery_verify($1::jsonb) AS proof',[JSON.stringify(proof)])).proof
    return accepted?.recipientDigest===recipientDigest&&operationPayloadDigest(accepted.request)===operationPayloadDigest(c.request)
   },options.fetch??fetch)
   await one('SELECT insights_private.delivery_begin($1::jsonb,$2::jsonb,$3)',[JSON.stringify(c.request),JSON.stringify(proof),recipientDigest]);started=true
   const result:Submission=await sender({...message,recipient})
   await settle(c,result.status==='accepted'?'ACCEPTED':result.status==='rejected'?'REJECTED':'UNKNOWN',result.status==='accepted'?result.providerId:null)
   if(result.status==='unknown')options.diagnostic?.('report-mail-unknown')
  }catch{
   if(claim)try{await settle(claim,started?'UNKNOWN':'RELEASE')}catch{/* expired SENDING is durably reconciled to UNKNOWN */}
   options.diagnostic?.('report-mail-unavailable')
  }
 }
 const tick=async()=>{if(stopped)return;if(!running)running=processOne().finally(()=>{running=null});await running}
 const timer=options.autoStart===false?null:setInterval(()=>{void tick()},poll);timer?.unref()
 return Object.freeze({ready:async()=>{await descriptor()},tick,async stop(){stopped=true;if(timer)clearInterval(timer);await running}})
}
