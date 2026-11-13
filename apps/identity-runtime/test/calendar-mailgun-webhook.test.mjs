// SYNTHETIC_ONLY signed provider fixtures; no message is sent.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac,randomUUID} from 'node:crypto'
import {createCalendarMailgunWebhook,mailgunMessageDigest} from '../dist/src/calendar-mailgun-webhook.js'
import {createHttpHandler} from '../dist/src/http-handler.js'
const key='a'.repeat(64),origin='https://identity.example.test',domain='mail.example.test',at=Date.now()
function fixture(){
 const rows=[],tokens=new Map();let unavailable=false
 const handler=createCalendarMailgunWebhook({signingKey:key,origin,domain,now:()=>at,query:async(sql,args)=>{
  assert.match(sql,/notification_provider_event/);if(unavailable)throw Error('SYNTHETIC_DB_FAILURE')
  const r=JSON.parse(args[0]),previous=tokens.get(r.tokenDigest);if(previous)return{rows:[{accepted:previous===r.payloadDigest}]}
  tokens.set(r.tokenDigest,r.payloadDigest);rows.push(r);return{rows:[{accepted:true}]}
 }})
 const body=()=>({signature:{timestamp:String(Math.floor(at/1000)),token:'SYNTHETICTOKEN'+randomUUID().replaceAll('-','')},'event-data':{id:randomUUID(),event:'delivered',timestamp:at/1000,recipient:'synthetic@example.test',tags:['calendar-notification-development'],message:{headers:{from:'SpendGuru <notifications@'+domain+'>','message-id':'synthetic@'+domain}},'delivery-status':{code:250},'user-variables':{calendar_delivery_id:randomUUID(),calendar_lease_id:randomUUID()}}})
 const sign=b=>{b.signature.signature=createHmac('sha256',key).update(b.signature.timestamp+b.signature.token).digest('hex');return b}
 const request=(b,url=origin+'/v1/webhooks/calendar-mailgun')=>new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})
 return{handler,body,sign,request,rows,fail(){unavailable=true}}
}
test('signed delivery callbacks persist only bounded opaque evidence and normalize API/webhook message IDs',async()=>{
 const f=fixture(),b=f.sign(f.body());assert.equal((await f.handler(f.request(b))).status,200)
 assert.equal((await f.handler(f.request(b))).status,200);assert.equal(f.rows.length,1)
 const saved=JSON.stringify(f.rows);assert(!saved.includes('synthetic@'));assert(!saved.includes(key));assert(!saved.includes('notifications@'));assert(!saved.includes(b.signature.token))
 assert.equal(f.rows[0].status,'DELIVERED');assert.equal(f.rows[0].messageDigest,mailgunMessageDigest('<synthetic@'+domain+'>'))
 b['event-data'].event='failed';b['event-data'].severity='permanent';assert.equal((await f.handler(f.request(b))).status,406)
})
test('tampering, stale signatures, wrong origin, missing correlation and fake test-mode delivery never persist',async()=>{
 for(const alter of [b=>b.signature.signature='0'.repeat(64),b=>b.signature.timestamp=String(Math.floor(at/1000)-90000),b=>delete b['event-data']['user-variables'],b=>b['event-data']['delivery-status'].code=650,b=>b['event-data'].flags={'is-test-mode':true},b=>b['event-data'].message.headers.from='wrong@other.example.test']){
  const f=fixture(),b=f.body();alter(b);if(!b.signature.signature)f.sign(b);assert.equal((await f.handler(f.request(b))).status,406);assert.equal(f.rows.length,0)
 }
 const f=fixture();assert.equal((await f.handler(f.request(f.sign(f.body()),'https://other.example.test/v1/webhooks/calendar-mailgun'))).status,406)
 const huge=f.sign(f.body());huge['event-data'].untrusted='x'.repeat(65536);assert.equal((await f.handler(f.request(huge))).status,406)
})
test('temporary/permanent failures stay distinct; DB uncertainty is retryable, unrelated purposes are ignored',async()=>{
 for(const [severity,status]of [['temporary','DEFERRED'],['permanent','FAILED']]){const f=fixture(),b=f.body();Object.assign(b['event-data'],{event:'failed',severity});assert.equal((await f.handler(f.request(f.sign(b)))).status,200);assert.equal(f.rows[0].status,status)}
 const f=fixture(),b=f.body();b['event-data'].tags=['identity-transactional-development'];assert.equal((await f.handler(f.request(f.sign(b)))).status,200);assert.equal(f.rows.length,0)
 f.fail();assert.equal((await f.handler(f.request(f.sign(f.body())))).status,503)
})
test('calendar webhook is a separately admitted route; an existing Clerk webhook does not activate it',async()=>{
 const f=fixture(),r=f.request(f.sign(f.body()))
 assert.equal((await createHttpHandler(null)(r.clone())).status,404)
 const enabled=createHttpHandler(null,null,null,null,null,null,null,null,null,f.handler)
 assert.equal((await enabled(r)).status,200)
 assert.equal((await enabled(new Request(origin+'/v1/webhooks/calendar-mailgun'))).status,405)
 assert.equal((await enabled(f.request(f.sign(f.body()),origin+'/v1/webhooks/calendar-mailgun?email=untrusted'))).status,404)
 assert.equal((await enabled(new Request(origin+'/v1/webhooks/clerk-email',{method:'POST'}))).status,404)
})
