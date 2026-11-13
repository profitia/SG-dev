import {createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {mailbox} from './mailgun-delivery.js'
type Query=(sql:string,values?:unknown[])=>Promise<{rows:Record<string,unknown>[]}>
const hash=(value:string)=>createHash('sha256').update(value).digest('hex')
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
/** Mailgun's submission API wraps this value in angle brackets, while its
 * delivery webhook uses the bare message-id. Neither form is a recipient. */
export function mailgunMessageDigest(value:unknown):string{
 if(typeof value!=='string'||value.length>255||!/^<?[A-Za-z0-9_.@+-]+>?$/.test(value)||value.startsWith('<')!==value.endsWith('>'))throw Error('MAILGUN_MESSAGE_ID_REQUIRED')
 return hash(value.replace(/^<|>$/g,''))
}
const response=(status:number)=>new Response(null,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})
/** Account HTTP signing key, not the API/domain sending key. No raw webhook,
 * recipient, secret, message content or SMTP diagnostic is persisted/logged. */
export function createCalendarMailgunWebhook(options:{query:Query;signingKey:string;origin:string;domain:string;now?:()=>number}){
 if(!/^[a-f0-9]{32,128}$/i.test(options.signingKey)||new URL(options.origin).protocol!=='https:'||!/^[a-z0-9.-]+$/.test(options.domain))throw Error('CALENDAR_WEBHOOK_CONFIGURATION_REQUIRED')
 const now=options.now??Date.now
 return async(request:Request):Promise<Response>=>{
  let receipt:Record<string,unknown>
  try{
   const url=new URL(request.url)
   if(url.origin!==options.origin||url.pathname!=='/v1/webhooks/calendar-mailgun'||url.search||url.hash||request.method!=='POST'||request.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')return response(406)
   const length=request.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>65536))return response(406)
   const reader=request.body?.getReader();if(!reader)return response(406)
   const chunks:Uint8Array[]=[];let size=0
   try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>65536){await reader.cancel();return response(406)}chunks.push(r.value)}}finally{reader.releaseLock()}
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8')),s=body?.signature,e=body?.['event-data']
   if(!s||typeof s.timestamp!=='string'||!/^\d{10}$/.test(s.timestamp)||typeof s.token!=='string'||!/^[A-Za-z0-9]{20,128}$/.test(s.token)||typeof s.signature!=='string'||!/^[a-f0-9]{64}$/.test(s.signature))return response(406)
   const age=now()-Number(s.timestamp)*1000
   // Provider retries can be delayed for hours; the durable token ledger is
   // authoritative for replay, while this window bounds stale signed traffic.
   if(age>24*3600000||age< -60000||!timingSafeEqual(Buffer.from(s.signature,'hex'),createHmac('sha256',options.signingKey).update(s.timestamp+s.token).digest()))return response(406)
   if(!e||!Array.isArray(e.tags)||!e.tags.includes('calendar-notification-development'))return response(200)
   if(!['delivered','failed'].includes(e.event))return response(200)
   if(e.flags?.['is-test-mode']===true||Number(e['delivery-status']?.code)===650)return response(406)
   const v=e['user-variables'],id=v?.calendar_delivery_id,lease=v?.calendar_lease_id
   if(!uuid.test(id??'')||!uuid.test(lease??'')||typeof e.id!=='string'||!e.id.length||e.id.length>255||typeof e.timestamp!=='number'||!Number.isFinite(e.timestamp)||e.timestamp*1000>now()+60000||typeof e.recipient!=='string')return response(406)
   const message=e.message?.headers
   if(typeof message?.from!=='string'||!message.from.endsWith('@'+options.domain)&&!message.from.endsWith('@'+options.domain+'>'))return response(406)
   const status=e.event==='delivered'?'DELIVERED':e.severity==='permanent'?'FAILED':e.severity==='temporary'?'DEFERRED':null
   if(!status)return response(406)
   const facts={deliveryId:id,leaseId:lease,recipientDigest:hash(mailbox(e.recipient)),messageDigest:mailgunMessageDigest(message['message-id']),eventDigest:hash(e.id),status,occurredAt:new Date(e.timestamp*1000).toISOString()}
   receipt={...facts,tokenDigest:hash(s.token),payloadDigest:hash(JSON.stringify(facts))}
  }catch{return response(406)}
  try{
   const r=await options.query('SELECT economic_calendar.notification_provider_event($1::jsonb) AS accepted',[JSON.stringify(receipt)])
   return response(r.rows.length===1&&r.rows[0]?.accepted===true?200:406)
  }catch{return response(503)} // Retry only an unconfirmed durable write.
 }
}
