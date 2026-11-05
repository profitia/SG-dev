// SYNTHETIC_ONLY transport tests. The PostgreSQL package suite proves current
// key/grant/actor facts; this suite proves the real Identity HTTP boundary.
import test from 'node:test';import assert from 'node:assert/strict';
import {createHttpHandler} from '../dist/src/http-handler.js';
const origin='https://identity.synthetic.test',boundary={configuration:{origin}};
test('first-party authority is optional, server-only, bounded and never falls back to legacy authorization',async()=>{
 let sourceCalls=0,legacyCalls=0;
 const authority={ready:async()=>true,authorize:async()=>{legacyCalls++;throw Error('NO_LEGACY_FALLBACK');},sourceReady:async()=>true,authorizeSource:async(_request,input)=>{sourceCalls++;if(input.denied)throw Object.assign(Error('SYNTHETIC_ONLY'),{reasonCode:'ACCESS_BASIS_INVALID'});return {payload:'SYNTHETIC_ONLY',signature:'a'.repeat(64)};}};
 const handler=a=>createHttpHandler(boundary,null,null,null,null,null,null,null,a),handle=handler(authority);
 const request=(patch={})=>new Request(origin+'/v1/e1/source/authorize',{method:'POST',headers:{'content-type':'application/json'},body:'{}',...patch});
 assert.equal((await handler(null)(request())).status,503);
 assert.equal((await handler({...authority,authorizeSource:undefined})(request())).status,503);
 assert.equal((await handle(request())).status,200);
 for(const patch of[{headers:{cookie:'synthetic=only','content-type':'application/json'}},{headers:{origin,'content-type':'application/json'}},{headers:{'content-type':'text/plain'}},{body:'{"denied":true}'}])assert.equal((await handle(request(patch))).status,403);
 assert.equal((await handle(request({method:'PUT'}))).status,405);assert.equal((await handle(new Request('https://foreign.synthetic.test/v1/e1/source/ready'))).status,403);
 const ready=await handle(new Request(origin+'/v1/e1/source/ready'));assert.deepEqual(await ready.json(),{ready:true});assert.equal(ready.headers.get('access-control-allow-origin'),null);assert.equal(ready.headers.get('cache-control'),'private, no-store');assert.equal(legacyCalls,0);assert.equal(sourceCalls,2);
});
