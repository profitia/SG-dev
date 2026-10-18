import test from 'node:test'
import assert from 'node:assert/strict'
import {NATIVE_EXTERNAL_TRANSPORT,captureNativeTransport,validNativePathRules,nativeRequestRule,validateNativeRequestBody,readNativeProviderResponse,nativeResponseDigest,responseFromNativeResult,assertNativeDescriptor} from '../src/native-external-transport.mjs'
import {externalNativeResponse,externalCallEvidence,createExternalCallHost} from '../src/external-call.mjs'
const config={schemaDigest:'a'.repeat(64),pathRules:[{method:'GET',path:'/data',requestFormat:'NONE'}],redirectOrigins:['https://storage.example'],maximumResponseBytes:1024,credentialMode:'NONE',completionMode:NATIVE_EXTERNAL_TRANSPORT.completionMode}
const options={config,requestUrl:'https://source.example/data',signal:new AbortController().signal,assertActive(){}}
for(const [name,patch] of [['null',null],['unbounded bytes',{maximumResponseBytes:33554433}],['zero',{maximumResponseBytes:0}],['unknown format',{pathRules:[{method:'POST',path:'/data',requestFormat:'RAW'}]}],['remote HTTP',{redirectOrigins:['http://storage.example']}],['credential origin',{redirectOrigins:['https://u:p@storage.example']}],['wildcard',{pathRules:[{method:'GET',path:'/*',requestFormat:'NONE'}]}],['extra authority',{organisationId:'untrusted'}]])test(name+' native policy is refused',()=>assert.throws(()=>captureNativeTransport(patch===null?null:{...config,...patch},'HTTPS'),TypeError))
test('captured policy is deeply immutable and detached from caller',()=>{const v=structuredClone(config),c=captureNativeTransport(v,'HTTPS');v.pathRules[0].path='/changed';assert.equal(c.pathRules[0].path,'/data');assert(Object.isFrozen(c.pathRules[0]))})
for(const [parameter,value]of [['HEX24','a'.repeat(24)],['UUID','01234567-1234-4123-8123-123456789012'],['OPAQUE','id_123-x'],['STORAGE_PATH','2026/report-a.xml']])test(parameter+' bounded native path and traversal refusal',()=>{
 const c={...config,pathRules:[{method:'GET',prefix:'/records/',parameter,suffix:'/file',requestFormat:'NONE'}]}
 assert(validNativePathRules(c.pathRules));assert.equal(nativeRequestRule(c,new URL('https://source.example/records/'+value+'/file'),'GET').parameter,parameter)
 for(const v of ['%2e%2e','%2f','..x','x//y','x'.repeat(1100)])assert.throws(()=>nativeRequestRule(c,new URL('https://source.example/records/'+v+'/file'),'GET'))
})
test('overlapping exact and template rules are refused at request admission',()=>{
 const c={...config,pathRules:[{method:'GET',path:'/records/one',requestFormat:'NONE'},{method:'GET',prefix:'/records/',parameter:'OPAQUE',suffix:'',requestFormat:'NONE'}]}
 assert.throws(()=>nativeRequestRule(c,new URL('https://source.example/records/one'),'GET'))
})
test('form OAuth encoding is bounded and rejects control characters and malformed escapes',async()=>{
 const r={method:'POST',url:'https://source.example/token',body:'grant_type=client_credentials&client_secret=private%20fixture'}
 assert.equal(await validateNativeRequestBody(r,{requestFormat:'FORM'},1024),'application/x-www-form-urlencoded')
 for(const body of ['secret=%0a','secret=%0d','secret=%00','secret=%zz','=empty','a=b\nc=d','a=b&'.repeat(40)])await assert.rejects(validateNativeRequestBody({...r,body},{requestFormat:'FORM'},1024))
 await assert.rejects(validateNativeRequestBody({...r,body:'{}'},{requestFormat:'NONE'},1024))
 await assert.rejects(validateNativeRequestBody({...r,body:'{"__proto__":{}}'},{requestFormat:'JSON'},1024))
})
test('native bytes are copied; diagnostic serialization omits content, URLs and headers',async()=>{
 const r=await readNativeProviderResponse(new Response(Uint8Array.of(0,255,12),{headers:{'content-type':'application/pdf','set-cookie':'private','x-private':'hidden'}}),options)
 assert.deepEqual(r.bytes,Uint8Array.of(0,255,12));r.bytes[0]=99;assert.equal(r.bytes[0],0)
 assert.equal(r.headers['set-cookie'],undefined);assert.equal(r.headers['x-private'],undefined);assert.equal(r.headers['content-length'],'3')
 assert.deepEqual(JSON.parse(JSON.stringify(r)),{protocol:NATIVE_EXTERNAL_TRANSPORT.id,status:200,byteLength:3})
 assert.deepEqual(new Uint8Array(await responseFromNativeResult(r).arrayBuffer()),r.bytes)
 assert.equal(nativeResponseDigest(r,'1'.repeat(64)).length,64)
 assert.equal(externalCallEvidence(r),null);assert.throws(()=>externalNativeResponse(r));assert.throws(()=>responseFromNativeResult({...r}));assert.throws(()=>nativeResponseDigest({...r},'1'.repeat(64)))
})
test('manual redirect only returns approved minimal location, never follows or copies cookies',async()=>{
 const r=await readNativeProviderResponse(new Response(null,{status:302,headers:{location:'https://storage.example/doc','set-cookie':'private'}}),options)
 assert.equal(r.status,302);assert.equal(r.headers.location,'https://storage.example/doc');assert.equal(r.headers['set-cookie'],undefined)
 for(const location of ['https://other.example/doc','https://u:p@storage.example/doc','https://storage.example/doc#fragment'])await assert.rejects(readNativeProviderResponse(new Response(null,{status:302,headers:{location}}),options))
 await assert.rejects(readNativeProviderResponse(new Response(null,{status:300,headers:{location:'https://storage.example'}}),options))
})
test('bounded body cancels its reader on overflow, cancellation and short read failure',async()=>{
 let cancelled=0
 const stream=()=>new ReadableStream({pull(c){c.enqueue(new Uint8Array(1025))},cancel(){cancelled++}})
 await assert.rejects(readNativeProviderResponse(new Response(stream()),options));assert.equal(cancelled,1)
 const ac=new AbortController();let pull
 const stalled=new ReadableStream({start(c){pull=c},cancel(){cancelled++}})
 const p=readNativeProviderResponse(new Response(stalled),{...options,signal:ac.signal,assertActive(){if(ac.signal.aborted)throw Error('cancelled')}});ac.abort();await assert.rejects(p);assert.equal(cancelled,2);void pull
 await assert.rejects(readNativeProviderResponse(new Response('x',{headers:{'content-length':'9999'}}),options))
})
test('descriptor requires installed policy and semantic canonical rules, independent of SQL key order',()=>{
 const d={nativeSchemaVersion:'1.0.0',nativeSchemaDigest:config.schemaDigest,nativePolicyVersion:'1',nativeCompletionMode:config.completionMode,nativeCredentialMode:config.credentialMode,nativeMaximumResponseBytes:1024,nativePathRules:[{requestFormat:'NONE',path:'/data',method:'GET'}],nativeRedirectOrigins:config.redirectOrigins,nativeSourceRef:'SYNTHETIC_ONLY',nativeExpiresAt:new Date(Date.now()+1000).toISOString()}
 assert.doesNotThrow(()=>assertNativeDescriptor(config,d))
 for(const patch of [{nativeCredentialMode:'SERVER_HEADERS'},{nativePolicyVersion:'0'},{nativePathRules:[]},{nativeSchemaDigest:'b'.repeat(64)}])assert.throws(()=>assertNativeDescriptor(config,{...d,...patch}))
})
test('NONE forbids credentials and any protocol forbids fabricated hosts',()=>{
 const base={binding:{role:'runtime',configurationVersion:'v1',schemaDigest:'a'.repeat(64),origin:'https://source.example',transport:'HTTPS',pathRules:[{method:'GET',path:'/data'}]},sourceId:'source',resourceId:'resource',sourceHost:{},independentQuery(){},query(){},parseCommand:v=>v,buildRequest(){}}
 assert.throws(()=>createExternalCallHost({...base,nativeTransport:config,getHeaders:()=>({})}))
 assert.throws(()=>createExternalCallHost({...base,nativeTransport:config,projectResponse:v=>v}))
 assert.throws(()=>createExternalCallHost({...base,nativeTransport:config}))
})
