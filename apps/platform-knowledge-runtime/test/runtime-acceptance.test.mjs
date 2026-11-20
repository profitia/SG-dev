import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {once} from 'node:events';
import {createServer} from '../src/server.mjs';
const execute=promisify(execFile);
test('parser restores an absent temporary root, keeps job privacy and cleans an aborted extraction',async()=>{
 const parent=await fs.mkdtemp(path.join(os.tmpdir(),'pk-temp-recovery-test-')),root=path.join(parent,'absent');
 try{
  const script=`import assert from 'node:assert/strict';import fs from 'node:fs/promises';import{extractDocument}from${JSON.stringify(new URL('../src/extraction.mjs',import.meta.url).href)};
   await assert.rejects(extractDocument(Buffer.from('Synthetic source'),'source.txt',{signal:AbortSignal.abort()}),e=>e.code==='JOB_LEASE_LOST');
   assert.equal((await fs.stat(process.env.TMPDIR)).mode&0o777,0o700);assert.deepEqual(await fs.readdir(process.env.TMPDIR),[]);`;
  await execute(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TMPDIR:root},timeout:10000});
 }finally{await fs.rm(parent,{recursive:true,force:true});}
});
test('parser rejects a symlink temporary root before creating document files',async()=>{
 const parent=await fs.mkdtemp(path.join(os.tmpdir(),'pk-temp-link-test-')),target=path.join(parent,'target'),link=path.join(parent,'link');
 try{
  await fs.mkdir(target,{mode:0o700});await fs.symlink(target,link);
  const script=`import assert from 'node:assert/strict';import fs from 'node:fs/promises';import{extractDocument}from${JSON.stringify(new URL('../src/extraction.mjs',import.meta.url).href)};
   await assert.rejects(extractDocument(Buffer.from('Synthetic source'),'source.txt'),e=>e.code==='PARSER_TEMP_ROOT_UNAVAILABLE');assert.deepEqual(await fs.readdir(process.env.TMPDIR),[]);`;
  await execute(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TMPDIR:link},timeout:10000});
 }finally{await fs.rm(parent,{recursive:true,force:true});}
});
test('operator page permits Clerk protection while API keeps its restrictive CSP',async()=>{
 const origin='https://platform-knowledge-development-api.onrender.com',clerk='https://synthetic.clerk.accounts.dev';
 const server=createServer({database:{probe:async()=>{}},telemetry:{emit(){}},config:{processingEnabled:true,origin,clerkFrontendOrigin:clerk,clerkPublishableKey:'pk_test_'+Buffer.from('synthetic.clerk.accounts.dev$').toString('base64')}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port;
 try{
  const response=await fetch(url+'/');assert.equal(response.status,200);
  const policy=new Map(response.headers.get('content-security-policy').split(';').map(d=>d.trim().split(/\s+/)).map(([k,...v])=>[k,v]));
  assert.deepEqual(policy.get('script-src'),["'self'",clerk,'https://challenges.cloudflare.com','https://*.protect.clerk.com']);
  assert.deepEqual(policy.get('connect-src'),["'self'",clerk,'https://*.protect.clerk.com:*']);
  assert.deepEqual(policy.get('worker-src'),["'self'",'blob:']);
  assert.deepEqual(policy.get('frame-src'),[clerk,'https://challenges.cloudflare.com','https://*.protect.clerk.com']);
  assert.deepEqual(policy.get('default-src'),["'none'"]);assert.deepEqual(policy.get('frame-ancestors'),["'none'"]);
  assert(!policy.get('script-src').includes("'unsafe-inline'")&&!policy.get('script-src').includes("'unsafe-eval'"));
  assert.equal((await fetch(url+'/health/live')).headers.get('content-security-policy'),"default-src 'none'; frame-ancestors 'none'");
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
