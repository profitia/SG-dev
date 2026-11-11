import {test} from 'node:test';import assert from 'node:assert/strict';
import {once} from 'node:events';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';
import {schemas,assertQuery} from '../../../packages/platform-knowledge-contracts/index.mjs';
import {loadConfig} from '../src/config.mjs';import {createTelemetry} from '../src/observability.mjs';import {createServer} from '../src/server.mjs';
const env=()=>({PK_ENVIRONMENT:'development',PK_RELEASE_SHA:'a'.repeat(40),PK_DATABASE_HOST:'ep-fixture-pooler.c-7.eu-central-1.aws.neon.tech',PK_NEON_PROJECT_ID:'synthetic',PK_NEON_BRANCH_ID:'br-fixture',DATABASE_URL:'postgresql://platform_knowledge_api:secret@ep-fixture-pooler.c-7.eu-central-1.aws.neon.tech/platform_knowledge?sslmode=require'});
test('bootstrap rejects owner, foreign database, environment, TLS downgrade, enabled engine and missing exact release',()=>{
 assert.equal(loadConfig(env(),'api').processingEnabled,false);
 for(const patch of [{PK_ENVIRONMENT:'production'},{PK_PROCESSING_ENABLED:'true'},{PK_RELEASE_SHA:'main'},
   {DATABASE_URL:env().DATABASE_URL.replace('platform_knowledge_api','neondb_owner')},
   {DATABASE_URL:env().DATABASE_URL.replace('/platform_knowledge?','/neondb?')},
   {DATABASE_URL:env().DATABASE_URL.replace('sslmode=require','sslmode=disable')},
   {PK_DATABASE_HOST:'other.neon.tech'}])assert.throws(()=>loadConfig({...env(),...patch},'api'));
});
test('schemas compile; lifecycle, imports and contexts reject extra identity assertions',()=>{
 const ajv=new Ajv({strict:true});addFormats(ajv);ajv.addSchema(schemas);
 for(const name of Object.keys(schemas.$defs))assert.equal(typeof ajv.getSchema(`${schemas.$id}#/$defs/${name}`),'function');
 const command={version:'0.1.0',commandId:'cmd',environment:'development',internalUserId:'user-a',scope:'ACCOUNT_PRIVATE_ALL',effectiveAt:'2026-11-11T12:00:00Z',reason:'ACCOUNT_DELETED'};
 const validate=ajv.getSchema(`${schemas.$id}#/$defs/AccountDeletionCommand`);
 assert.equal(validate(command),true);assert.equal(validate({...command,organisationId:'org'}),false);
 const q={version:'0.1.0',requestId:'req',task:'ANSWER',query:'Jakie są wymagania?',language:'pl',scopes:['ACCOUNT_PRIVATE'],maxTokens:100,tokenizerId:'fixture',targetModel:'fixture'};
 const v=ajv.getSchema(`${schemas.$id}#/$defs/Query`);assert.equal(v(q),true);assertQuery(q);assert.equal(v({...q,userId:'other'}),false);
});
test('telemetry ignores arbitrary payloads and does not block on transport failure',()=>{
 const lines=[],events=[],config={role:'api',environment:'development',release:'a'.repeat(40)};
 const t=createTelemetry({config,write:x=>lines.push(x),send:x=>events.push(x)});
 t.emit('password=secret');t.emit('FOUNDATION_PROBE_FAILED');assert.equal(lines.length,1);assert.equal(events.length,1);
 assert.doesNotMatch(lines[0],/password|secret|DATABASE_URL/);
 assert.doesNotThrow(()=>createTelemetry({config,write:()=>{throw Error('transport');},send:()=>{throw Error('transport');}}).emit('FOUNDATION_PROBE_FAILED'));
});
test('live is distinct from processing readiness; no business endpoint can accept an upload',async()=>{
 let probes=0;const codes=[];
 const server=createServer({database:{probe:async()=>{probes++;}},telemetry:{emit:x=>codes.push(x)}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 try{
   assert.equal((await fetch(base+'/health/live')).status,200);
   assert.equal((await fetch(base+'/health/ready')).status,503);
   const results=await Promise.all([fetch(base+'/health/foundation'),fetch(base+'/health/foundation')]);assert.ok(results.every(r=>r.status===200));assert.equal(probes,1);
   assert.equal((await fetch(base+'/v1/imports',{method:'POST',body:'private document'})).status,503);
   assert.deepEqual(codes,['FOUNDATION_PROBE_OK']);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('database errors expose neither server messages nor identities',async()=>{
 const server=createServer({database:{probe:async()=>{throw Error('private password and query');}},telemetry:{emit:()=>{}}});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{const r=await fetch(`http://127.0.0.1:${server.address().port}/health/foundation`);assert.equal(r.status,503);assert.equal(await r.text(),'{"status":"FOUNDATION_UNAVAILABLE"}');}
 finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
