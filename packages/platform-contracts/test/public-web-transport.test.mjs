import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {isPublicAddress,publicUrl,resolvePublicUrl,publicWebHop,createSafePublicFetch} from '../src/public-web-transport.mjs'
import {captureNativeTransport,nativeRequestRule,readNativeProviderResponse} from '../src/native-external-transport.mjs'
const rules=[{method:'GET',prefix:'/',parameter:'PUBLIC_PATH',suffix:'',requestFormat:'NONE'}]
const config={schemaDigest:'a'.repeat(64),pathRules:rules,redirectOrigins:[],maximumResponseBytes:2000,credentialMode:'NONE',completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT'}
for(const address of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.0.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','255.255.255.255','::1','::','fe80::1','fc00::1','ff02::1','::ffff:127.0.0.1','::ffff:10.0.0.1','not-an-ip'])test('private/reserved address denied: '+address,()=>assert.equal(isPublicAddress(address),false))
test('ordinary public IPv4, IPv6 and mapped public IPv4 retain original classifier semantics',()=>{
 for(const address of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111','::ffff:8.8.8.8'])assert.equal(isPublicAddress(address),true,address)
})
for(const url of ['file:///etc/passwd','ftp://supplier.example/a','https://u:p@supplier.example/','http://localhost/','http://foo.local/','http://foo.internal/','http://foo.test/','http://foo.invalid/','https://supplier.example:8443/a'])test('unsafe public URL denied: '+url,()=>assert.throws(()=>publicUrl(url)))
test('all DNS answers must be public before selecting a pinned address',async()=>{
 const url='https://supplier.example/a',first={address:'8.8.8.8',family:4}
 const result=await resolvePublicUrl(url,async host=>{assert.equal(host,'supplier.example');return[first,{address:'1.1.1.1',family:4}]});assert.deepEqual(result.address,first)
 for(const addresses of [[],[first,{address:'127.0.0.1',family:4}],[first,{address:'::ffff:127.0.0.1',family:6}]])await assert.rejects(resolvePublicUrl(url,async()=>addresses))
})
test('public native path is explicit, credential-free and unavailable to old fixed modes',()=>{
 assert.throws(()=>captureNativeTransport(config,'HTTPS'))
 assert.equal(captureNativeTransport(config,'PUBLIC_WEB',true).credentialMode,'NONE')
 for(const patch of [{credentialMode:'SERVER_HEADERS'},{redirectOrigins:['https://other.example']},{maximumResponseBytes:2000001},{pathRules:[{...rules[0],method:'POST'}]},{pathRules:[{...rules[0],prefix:'/other/'}]}])assert.throws(()=>captureNativeTransport({...config,...patch},'PUBLIC_WEB',true))
 for(const path of ['/','/a/b','/kontakt.html','/za%C5%BC%C3%B3%C5%82%C4%87'])assert.equal(nativeRequestRule(config,new URL('https://supplier.example'+path),'GET').parameter,'PUBLIC_PATH')
 assert.throws(()=>nativeRequestRule(config,new URL('https://supplier.example/a'),'POST'))
})
function response(url,body='',options={}){const r=new Response(body,options);Object.defineProperty(r,'url',{value:url});return r}
test('business adapter performs five separately supplied hops at most and retains the final URL',async()=>{
 const seen=[],fetcher=createSafePublicFetch(async(url,options)=>{seen.push(url);assert(options.signal instanceof AbortSignal);return seen.length<5?response(url,null,{status:302,headers:{location:'/hop'+seen.length}}):response(url,'result',{headers:{'content-type':'text/html'}})})
 const result=await fetcher('https://supplier.example/');assert.equal(result.body.toString(),'result');assert.equal(result.url,'https://supplier.example/hop4');assert.equal(seen.length,5)
 let calls=0;await assert.rejects(createSafePublicFetch(async url=>{calls++;return response(url,null,{status:307,headers:{location:'/again'}})})('https://supplier.example/'),/REDIRECT_LIMIT/);assert.equal(calls,5)
})
test('unsafe redirect, automatic redirect, compression, body overflow and cancelled work deny output',async()=>{
 let calls=0;await assert.rejects(createSafePublicFetch(async url=>{calls++;return response(url,null,{status:302,headers:{location:'http://foo.internal/'}})})('https://supplier.example/'));assert.equal(calls,1)
 for(const make of [url=>response(url,'x',{headers:{'content-encoding':'gzip'}}),url=>response(url,'xx'),url=>response('https://other.example/','x')])await assert.rejects(createSafePublicFetch(async url=>make(url))('https://supplier.example/',{maxBytes:1}))
 const ac=new AbortController();ac.abort();let sent=false;await assert.rejects(createSafePublicFetch(async url=>{sent=true;return response(url,'x')})('https://supplier.example/',{signal:ac.signal}));assert.equal(sent,false)
})
test('each public redirect Location is revalidated without credential or cookie publication',async()=>{
 const opts={config,requestUrl:'https://supplier.example/a',signal:new AbortController().signal,assertActive(){},publicWeb:true}
 const r=await readNativeProviderResponse(new Response(null,{status:302,headers:{location:'https://other.example/b','set-cookie':'private'}}),opts)
 assert.equal(r.headers.location,'https://other.example/b');assert.equal(r.headers['set-cookie'],undefined)
 for(const location of ['http://metadata.internal/a','https://u:p@other.example/a','https://other.example:8443/a'])await assert.rejects(readNativeProviderResponse(new Response(null,{status:302,headers:{location}}),opts))
})
test('public redirect anchors keep original website behavior while fixed native policies still reject them',async()=>{
 const requestUrl='https://supplier.example/a',base={config,requestUrl,signal:new AbortController().signal,assertActive(){}}
 const r=await readNativeProviderResponse(new Response(null,{status:302,headers:{location:'/kontakt#firma'}}),{...base,publicWeb:true})
 assert.equal(r.headers.location,'https://supplier.example/kontakt')
 await assert.rejects(readNativeProviderResponse(new Response(null,{status:302,headers:{location:'/kontakt#firma'}}),{...base,config:{...config,redirectOrigins:['https://supplier.example']}}))
})
test('one real bounded synthetic socket uses original fixed headers and never follows a redirect',async()=>{
 let hits=0,seen;const server=http.createServer((req,res)=>{hits++;seen=req.headers;if(req.url==='/redirect'){res.writeHead(302,{location:'https://other.example/final','set-cookie':'private'});res.end()}else if(req.url==='/compressed'){res.writeHead(200,{'content-encoding':'gzip'});res.end('x')}else res.end('hello')})
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
 const origin='http://127.0.0.1:'+server.address().port
 try{
  const r=await publicWebHop('https://supplier.example/redirect',{},origin);assert.equal(r.status,302);assert.equal(hits,1);assert.equal(r.url,'https://supplier.example/redirect');assert.equal(r.headers.get('set-cookie'),null)
  for(const key of ['authorization','cookie','proxy-authorization'])assert.equal(seen[key],undefined)
  assert.equal(seen['accept-encoding'],'identity');assert.match(seen['user-agent'],/supplier website verification/)
  await assert.rejects(publicWebHop('https://supplier.example/compressed',{},origin))
  await assert.rejects(publicWebHop('https://supplier.example/large',{maxBytes:1},origin))
  const ac=new AbortController();ac.abort();const before=hits;await assert.rejects(publicWebHop('https://supplier.example/',{signal:ac.signal},origin));assert.equal(hits,before)
  await assert.rejects(publicWebHop('https://supplier.example/',{},'http://other.example:1234'))
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
})
