import test from 'node:test'
import assert from 'node:assert/strict'
import {request as httpRequest} from 'node:http'
import {createHttpHandler} from '../dist/src/http-handler.js'
import {createNodeServer} from '../dist/src/node-server.js'
const origin='https://identity.synthetic.test'
const boundary={configuration:{origin}}
function fixture(enabled=true){let calls=0;const authority={ready:async()=>true,authorize:async(_request,input)=>{calls++;if(!input||input.denied)throw Object.assign(Error('SYNTHETIC_ONLY'),{reasonCode:'ACCESS_BASIS_INVALID'});return {payload:'SYNTHETIC_ONLY',signature:'a'.repeat(64)}}};return {handle:createHttpHandler(boundary,null,null,null,null,null,null,null,enabled?authority:null),calls:()=>calls}}
const req=(path='/v1/e1/authorize',patch={})=>new Request(origin+path,{method:'POST',headers:{authorization:'Bearer SYNTHETIC_ONLY','content-type':'application/json'},body:'{}',...patch})
test('optional producer has no fallback, closed routes, no browser cookies/CORS or caller-selected origin',async()=>{
 assert.equal((await fixture(false).handle(req())).status,503)
 const f=fixture();assert.equal((await f.handle(req())).status,200);assert.equal(f.calls(),1)
 for(const [path,patch,status] of[
  ['/v1/e1/authorize?x=1',{},404],['/v1/e1/unknown',{},404],['/v1/e1/authorize',{method:'PUT'},405],
  ['/v1/e1/authorize',{headers:{cookie:'synthetic=only','content-type':'application/json'}},403],
  ['/v1/e1/authorize',{headers:{origin,'content-type':'application/json'}},403],
  ['/v1/e1/authorize',{headers:{'content-type':'text/plain'}},403],['/v1/e1/authorize',{body:'{"denied":true}'},403],
 ])assert.equal((await f.handle(req(path,patch))).status,status)
 const ready=await f.handle(new Request(origin+'/v1/e1/ready'));assert.deepEqual(await ready.json(),{ready:true});assert.equal(ready.headers.get('cache-control'),'private, no-store');assert.equal(ready.headers.get('access-control-allow-origin'),null)
 assert.equal((await f.handle(new Request('https://foreign.synthetic.test/v1/e1/ready'))).status,403)
})
test('real Node adapter accepts a bounded previous signed proof only on the exact authority POST',async t=>{
 const seen=[],server=createNodeServer(origin,async request=>{seen.push((await request.text()).length);return new Response(null,{status:204})})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close()})
 const send=(path,method,size)=>new Promise((resolve,reject)=>{const r=httpRequest({host:'127.0.0.1',port:server.address().port,path,method,headers:{host:new URL(origin).host,'content-type':'application/json','content-length':size}},response=>{response.resume();response.once('end',()=>resolve(response.statusCode))});r.on('error',e=>e.code==='ECONNRESET'?resolve('closed'):reject(e));r.end('x'.repeat(size))})
 assert.equal(await send('/v1/e1/authorize','POST',12000),204)
 for(const args of[['/v1/e1/authorize','POST',24577],['/v1/e1/authorize','PUT',12000],['/v1/flows','POST',12000]])assert([400,'closed'].includes(await send(...args)))
 assert.deepEqual(seen,[12000])
})
