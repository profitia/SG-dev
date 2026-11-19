import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHttpHandler} from '../dist/src/http-handler.js';
const origin='https://identity.synthetic.test',boundary={configuration:{origin}};
test('PK authority is optional, server-only, bounded and isolated from legacy routes',async()=>{
 let human=0,worker=0;
 const authority={ready:async()=>true,authorize:async()=>{throw Error('LEGACY_MUST_NOT_RUN');},knowledgeReady:async()=>true,
  authorizeKnowledgeHuman:async(_r,input)=>{human++;if(input.deny)throw{reasonCode:'ACCESS_BASIS_INVALID'};return{principal:{fixture:true}};},
  authorizeKnowledgeWorker:async()=>{worker++;return{fixture:true};}};
 const handler=a=>createHttpHandler(boundary,null,null,null,null,null,null,null,a),handle=handler(authority);
 const request=(route='human',patch={})=>new Request(origin+'/v1/e1/knowledge/'+route,{method:'POST',headers:{'content-type':'application/json'},body:'{}',...patch});
 assert.equal((await handler(null)(request())).status,503);
 assert.equal((await handle(request())).status,200);assert.equal((await handle(request('worker'))).status,200);
 assert.equal((await handle(request('human',{body:'{"deny":true}'}))).status,403);
 for(const headers of[{cookie:'fixture=only','content-type':'application/json'},{origin,'content-type':'application/json'},{'content-type':'text/plain'}])assert.equal((await handle(request('human',{headers}))).status,403);
 assert.equal((await handle(request('human',{body:JSON.stringify({oversized:'x'.repeat(24576)})}))).status,503);
 assert.equal((await handle(request('human',{method:'PUT'}))).status,405);
 assert.equal((await handle(new Request(origin+'/v1/e1/knowledge/ready'))).status,200);
 assert.equal((await handle(new Request('https://foreign.synthetic.test/v1/e1/knowledge/ready'))).status,403);
 assert.equal(human,2);assert.equal(worker,1);
});
