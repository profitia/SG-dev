import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createCurrentFreshReportHost,CURRENT_FRESH_REPORT_CONTRACT,currentFreshReportSourceDigest} from '../current-fresh-report/src/current-fresh-report.mjs'
import {currentHumanReadSourceDigest,CURRENT_HUMAN_READ_CONTRACT} from '../src/current-human-read.mjs'
import {privateOperationHostSourceDigest} from '../src/private-operation-host.mjs'

function fixture(){
 const unexpected=async()=>assert.fail('No external call in constructor or rejected input')
 const application={appId:'srm',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',environment:'development',deploymentId:'synthetic',configurationVersion:'1',identityIssuer:'https://identity.fixture.test',organisationId:null,operations:['supplier.report.read'],features:['supplier_report']}
 const binding={applicationId:'srm',environment:'development',projectId:'isolated',branchId:'isolated',databaseName:'synthetic',role:'synthetic_runtime',schemaDigest:'a'.repeat(64)}
 const module={id:'supplier_report',schemaDigest:'b'.repeat(64),auditSchemaDigest:'c'.repeat(64)}
 const probe={application,binding,module,independentQuery:unexpected,transact:unexpected,readResources:unexpected,projectOutput:unexpected}
 return {clerk:{authenticateRequest:unexpected,sessions:{getSession:unexpected},users:{getUser:unexpected}},
  identity:{appId:'srm',environment:'development',issuer:application.identityIssuer,authorizedParties:['https://srm.fixture.test']},
  receiverBoundary:{publicOrigins:['https://srm.fixture.test'],internalOrigins:['http://127.0.0.1:9999']},
  probe,refresh:{...probe,application:{...application,operations:['supplier.report.refresh']},requestLedger:{schemaDigest:'d'.repeat(64),externalSchemaDigest:'e'.repeat(64)}},read:{...probe}}
}
test('additive producer has an independent fingerprint and preserves existing READY and host digests',async()=>{
 assert.deepEqual(CURRENT_FRESH_REPORT_CONTRACT,{id:'profitia.current-fresh-report',version:'1.0.0'})
 assert.deepEqual(CURRENT_HUMAN_READ_CONTRACT,{id:'profitia.current-human-read',version:'1.1.0'})
 const accepted=JSON.parse(fs.readFileSync(new URL('../../../apps/srm/operation-integration.json',import.meta.url)))
 assert.equal(await currentHumanReadSourceDigest(),accepted.freshPostfetchRecovery.sdkDigests.currentHumanReadSourceDigest)
 assert.equal(await privateOperationHostSourceDigest(),accepted.freshPostfetchRecovery.sdkDigests.privateOperationHostSourceDigest)
 assert.match(await currentFreshReportSourceDigest(),/^[a-f0-9]{64}$/)
 assert.equal(createCurrentFreshReportHost(fixture()).hostContract,CURRENT_FRESH_REPORT_CONTRACT)
})
test('the public package entry exposes the same implementation to ESM and CommonJS',()=>{
 const sdk=createRequire(new URL('../current-fresh-report/package.json',import.meta.url))('@profitia/platform-current-fresh-report')
 assert.equal(sdk.createCurrentFreshReportHost,createCurrentFreshReportHost)
 assert.equal(sdk.CURRENT_FRESH_REPORT_CONTRACT,CURRENT_FRESH_REPORT_CONTRACT)
})
test('packed public install uses exactly one unchanged SDK 1.32.3 peer, without credentials, scripts or registry',async()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'fresh-report-public-install-'))
 const artifacts=path.join(temporary,'packages');fs.mkdirSync(artifacts)
 const userconfig=path.join(temporary,'user.npmrc'),globalconfig=path.join(temporary,'global.npmrc')
 fs.writeFileSync(userconfig,'');fs.writeFileSync(globalconfig,'')
 const env=Object.fromEntries(['PATH','HOME','TMPDIR','SystemRoot'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))
 const args=['--userconfig',userconfig,'--globalconfig',globalconfig,'--cache',path.join(temporary,'cache'),'--offline','--ignore-scripts','--no-audit','--no-fund']
 const npm=(arguments_,cwd)=>execFileSync('npm',[...arguments_,...args],{cwd,env,encoding:'utf8',stdio:['ignore','pipe','pipe']})
 const sdkRoot=fileURLToPath(new URL('../',import.meta.url)),leafRoot=path.join(sdkRoot,'current-fresh-report')
 let passed=false
 try{
  const pack=cwd=>path.join(artifacts,JSON.parse(npm(['pack','--json','--pack-destination',artifacts],cwd))[0].filename)
  const sdk=pack(sdkRoot),leaf=pack(leafRoot),classifier=pack(fs.realpathSync(path.join(sdkRoot,'node_modules/ipaddr.js')))
  fs.writeFileSync(path.join(temporary,'package.json'),JSON.stringify({name:'isolated-fresh-public-consumer',version:'1.0.0',private:true,type:'module',
   dependencies:{'@profitia/platform-contracts':'file:'+sdk,'@profitia/platform-current-fresh-report':'file:'+leaf,'ipaddr.js':'file:'+classifier}}))
  npm(['install','--omit=dev'],temporary)
  const expected=await currentFreshReportSourceDigest()
  const script=`import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
   import * as fresh from '@profitia/platform-current-fresh-report';
   import {CURRENT_HUMAN_READ_CONTRACT} from '@profitia/platform-contracts/current-human-read';
   const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/operation-context'));
   assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,'1.32.3');
   assert.equal(CURRENT_HUMAN_READ_CONTRACT.version,'1.1.0');assert.equal(fresh.CURRENT_FRESH_REPORT_CONTRACT.version,'1.0.0');
   assert.equal(await fresh.currentFreshReportSourceDigest(),${JSON.stringify(expected)});
   const require=createRequire(import.meta.url),inside=createRequire(import.meta.resolve('@profitia/platform-current-fresh-report'));
   assert.equal(require('@profitia/platform-current-fresh-report').createCurrentFreshReportHost,fresh.createCurrentFreshReportHost);
   assert.equal(inside.resolve('@profitia/platform-contracts/operation-context'),require.resolve('@profitia/platform-contracts/operation-context'));
   console.log('PASS: packed ESM/CommonJS export, exact unchanged peer, one SDK copy, matching complete fingerprint');`
  fs.writeFileSync(path.join(temporary,'verify.mjs'),script)
  const output=execFileSync(process.execPath,['verify.mjs'],{cwd:temporary,env,encoding:'utf8'})
  assert.match(output,/PASS: packed ESM\/CommonJS/);passed=true
 }finally{
  if(passed)fs.rmSync(temporary,{recursive:true,force:true})
  else process.stderr.write('Public-install fixture retained: '+temporary+'\n')
 }
})
for(const key of ['clerk','identity','receiverBoundary','probe','refresh','read','now'])test('rejects missing/invalid '+key,()=>{
 const f=fixture();f[key]=null;assert.throws(()=>createCurrentFreshReportHost(f),TypeError)
})
for(const key of ['reportAdmission','cache','authenticate','createAuthenticator','readExternalAccount','allow'])test('does not accept another authorization path '+key,()=>{
 assert.throws(()=>createCurrentFreshReportHost({...fixture(),[key]:()=>true}),TypeError)
})
for(const key of ['probe','refresh','read'])for(const mutation of ['application','store','service','module','operation','authenticator'])test(key+' rejects foreign '+mutation,()=>{
 const f=fixture(),base={...f[key]};f[key]=base
 if(mutation==='application')base.application={...base.application,appId:'foreign'}
 if(mutation==='store')base.binding={...base.binding,databaseName:'foreign'}
 if(mutation==='service')base.binding={...base.binding,service:{}}
 if(mutation==='module')base.module={...base.module,id:'supplier_private'}
 if(mutation==='operation')base.application={...base.application,operations:['supplier.private.read']}
 if(mutation==='authenticator')base.createAuthenticator=()=>async()=>({kind:'HUMAN'})
 assert.throws(()=>createCurrentFreshReportHost(f),TypeError)
})
test('invalid input and reused factory cannot trigger SQL or identity',async()=>{
 const host=createCurrentFreshReportHost(fixture())
 await assert.rejects(host.execute({},{}),e=>e.reasonCode==='CONTEXT_INVALID')
 await assert.rejects(host.execute({},{}),e=>e.reasonCode==='ACCESS_BASIS_INVALID')
})
test('abort refuses the opening before authentication or SQL',async()=>{
 const controller=new AbortController();controller.abort()
 const host=createCurrentFreshReportHost(fixture()),bad=async()=>assert.fail('No action')
 await assert.rejects(host.execute({request:new Request('https://srm.fixture.test/api/search',{signal:controller.signal}),
  organisationId:'11111111-1111-4111-8111-111111111111',nip:'5272443955',idempotencyKey:null},
 {probe:bad,refresh:bad,work:bad,read:bad}),e=>e.name==='AbortError')
})
test('public declarations compile positive calls and reject alternate authority and Work output',async()=>{
 const require=createRequire(new URL('../../../apps/architecture-lab/package.json',import.meta.url)),ts=require('typescript')
 const file=new URL('./types/current-fresh-report.mts',import.meta.url).pathname
 const program=ts.createProgram([file],{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,strict:true,noEmit:true,types:[],lib:['lib.es2022.d.ts','lib.dom.d.ts']})
 const errors=ts.getPreEmitDiagnostics(program)
 assert.equal(errors.length,0,ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}))
})
