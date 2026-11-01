import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {ROOT_ATOMIC_CLAIM_CONTRACT,createRootAtomicClaimReportHost,createRootAtomicClaimDeliveryHost,
 rootAtomicClaimSourceDigest,rootAtomicClaimSchemaDigest,rootAtomicClaimSchemaUrl} from '../src/root-atomic-claim.mjs'
import {readonlyMissReportSourceDigest} from '@profitia/platform-readonly-miss-report'
import {privateOperationHostSourceDigest} from '@profitia/platform-contracts/private-operation-host'

function fixture(){
 const unexpected=async()=>assert.fail('Rejected input and construction must not perform I/O')
 const application={appId:'srm',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',environment:'development',deploymentId:'synthetic',configurationVersion:'1',identityIssuer:'https://identity.fixture.test',organisationId:null,operations:['supplier.report.read'],features:['supplier_report']}
 const binding={applicationId:'srm',environment:'development',projectId:'isolated',branchId:'isolated',databaseName:'synthetic',role:'synthetic_runtime',schemaDigest:'a'.repeat(64)}
 const module={id:'supplier_report',schemaDigest:'b'.repeat(64),auditSchemaDigest:'c'.repeat(64)}
 const probe={application,binding,module,independentQuery:unexpected,transact:unexpected,readResources:unexpected,projectOutput:unexpected}
 return {probeReadOnly:{statements:['SELECT 1']},clerk:{authenticateRequest:unexpected,sessions:{getSession:unexpected},users:{getUser:unexpected}},
  identity:{appId:'srm',environment:'development',issuer:application.identityIssuer,authorizedParties:['https://srm.fixture.test']},
  receiverBoundary:{publicOrigins:['https://srm.fixture.test'],internalOrigins:['http://127.0.0.1:9999']},
  probe,refresh:{...probe,application:{...application,operations:['supplier.report.refresh']},requestLedger:{schemaDigest:'d'.repeat(64),externalSchemaDigest:'e'.repeat(64)}},read:{...probe},atomicClaim:{schemaDigest:'f'.repeat(64)}}
}
test('optional independent contract, complete source fingerprint, unchanged accepted SDK and read-only MISS',async()=>{
 assert.deepEqual(ROOT_ATOMIC_CLAIM_CONTRACT,{id:'profitia.root-atomic-claim',version:'1.0.0'})
 assert.equal(createRootAtomicClaimReportHost(fixture()).hostContract,ROOT_ATOMIC_CLAIM_CONTRACT)
 const metadata=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url)))
 assert.deepEqual(metadata.peerDependencies,{'@profitia/platform-contracts':'1.32.3','@profitia/platform-readonly-miss-report':'1.0.0'})
 const source=fs.readFileSync(new URL('./../src/root-atomic-claim.mjs',import.meta.url))
 const expected=createHash('sha256').update(source).update(fs.readFileSync(new URL('../src/root-atomic-claim.d.mts',import.meta.url)))
  .update(fs.readFileSync(new URL('../package.json',import.meta.url))).update(await rootAtomicClaimSchemaDigest())
  .update(await readonlyMissReportSourceDigest()).update(await privateOperationHostSourceDigest()).digest('hex')
 assert.equal(await rootAtomicClaimSourceDigest(),expected)
 assert.equal(await rootAtomicClaimSchemaDigest(),createHash('sha256').update(fs.readFileSync(new URL(rootAtomicClaimSchemaUrl))).digest('hex'))
})
for(const key of ['atomicClaim','refresh','now','clerk','probe','read','identity','probeReadOnly'])test('closed constructor rejects invalid '+key,()=>{
 assert.throws(()=>createRootAtomicClaimReportHost({...fixture(),[key]:null}),TypeError)
})
for(const key of ['reportAdmission','cache','readExternalAccount','authenticate','allow','revalidateExternalAccountBeforeOutcome'])test('constructor refuses alternative authority '+key,()=>{
 assert.throws(()=>createRootAtomicClaimReportHost({...fixture(),[key]:true}),TypeError)
 assert.throws(()=>createRootAtomicClaimDeliveryHost({[key]:true}),TypeError)
})
for(const atomicClaim of [{schemaDigest:'a'}, {schemaDigest:'a'.repeat(64),allow:true},Object.create(null)])test('explicit exact atomic-claim policy is mandatory '+JSON.stringify(atomicClaim),()=>{
 assert.throws(()=>createRootAtomicClaimReportHost({...fixture(),atomicClaim}),TypeError)
})
test('accessor and symbol configuration are rejected without evaluating them',()=>{
 const f=fixture();Object.defineProperty(f,'cache',{get:()=>assert.fail('Accessor must not run'),enumerable:true})
 assert.throws(()=>createRootAtomicClaimReportHost(f),TypeError)
 const g=fixture();g[Symbol('allow')]=true;assert.throws(()=>createRootAtomicClaimReportHost(g),TypeError)
})
for(const environment of ['staging','production'])test('optional producer has no implicit activation in '+environment,()=>{
 const f=fixture();f.identity={...f.identity,environment}
 assert.throws(()=>createRootAtomicClaimReportHost(f),TypeError)
})
test('invalid opening and reused factory cannot reach identity or SQL',async()=>{
 const host=createRootAtomicClaimReportHost(fixture())
 await assert.rejects(host.execute({},{}),e=>e.reasonCode==='CONTEXT_INVALID')
 await assert.rejects(host.execute({},{}),e=>e.reasonCode==='ACCESS_BASIS_INVALID')
})
test('ordinary abort preserves canonical refusal before identity or SQL',async()=>{
 const host=createRootAtomicClaimReportHost(fixture()),controller=new AbortController();controller.abort()
 const bad=async()=>assert.fail('Aborted opening must not invoke actions')
 await assert.rejects(host.execute({request:new Request('https://srm.fixture.test/api/search',{signal:controller.signal}),organisationId:'11111111-1111-4111-8111-111111111111',nip:'5272443955',idempotencyKey:null},
  {probe:bad,refresh:bad,work:bad,read:bad,ready:bad}),e=>e.name==='AbortError')
})
test('packed credential-free public install exposes ESM/CommonJS, types, migration, one exact canonical peer',async()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'root-claim-public-install-')),artifacts=path.join(temporary,'packages');fs.mkdirSync(artifacts)
 const userconfig=path.join(temporary,'user.npmrc'),globalconfig=path.join(temporary,'global.npmrc');fs.writeFileSync(userconfig,'');fs.writeFileSync(globalconfig,'')
 const env=Object.fromEntries(['PATH','HOME','TMPDIR','SystemRoot'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))
 const args=['--userconfig',userconfig,'--globalconfig',globalconfig,'--cache',path.join(temporary,'cache'),'--offline','--ignore-scripts','--no-audit','--no-fund']
 const npm=(args_,cwd)=>execFileSync('npm',[...args_,...args],{cwd,env,encoding:'utf8',stdio:['ignore','pipe','pipe']})
 const sdkRoot=fileURLToPath(new URL('../../',import.meta.url));let passed=false
 try{
  const pack=cwd=>path.join(artifacts,JSON.parse(npm(['pack','--json','--pack-destination',artifacts],cwd))[0].filename)
  const dependencies={}
  for(const [name,cwd]of [['@profitia/platform-contracts',sdkRoot],['@profitia/platform-readonly-miss-report',path.join(sdkRoot,'readonly-miss-report')],['@profitia/platform-root-atomic-claim',path.join(sdkRoot,'root-atomic-claim')],['ipaddr.js',fs.realpathSync(path.join(sdkRoot,'node_modules/ipaddr.js'))]])dependencies[name]='file:'+pack(cwd)
  fs.writeFileSync(path.join(temporary,'package.json'),JSON.stringify({name:'isolated-atomic-claim-consumer',version:'1.0.0',private:true,type:'module',dependencies}))
  npm(['install','--omit=dev'],temporary)
  const expected=await rootAtomicClaimSourceDigest()
  fs.writeFileSync(path.join(temporary,'verify.mjs'),`import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
   import * as optional from '@profitia/platform-root-atomic-claim';
   const require=createRequire(import.meta.url),inside=createRequire(import.meta.resolve('@profitia/platform-root-atomic-claim'));
   assert.equal(require('@profitia/platform-root-atomic-claim').createRootAtomicClaimReportHost,optional.createRootAtomicClaimReportHost);
   assert.equal(inside.resolve('@profitia/platform-contracts/operation-context'),require.resolve('@profitia/platform-contracts/operation-context'));
   assert.equal(await optional.rootAtomicClaimSourceDigest(),${JSON.stringify(expected)});
   assert(fs.readFileSync(new URL(optional.rootAtomicClaimSchemaUrl)).length>0);
   console.log('PASS: exact one SDK, complete fingerprint and packed migration');`)
  assert.match(execFileSync(process.execPath,['verify.mjs'],{cwd:temporary,env,encoding:'utf8'}),/PASS: exact one SDK/);passed=true
 }finally{if(passed)fs.rmSync(temporary,{recursive:true,force:true});else process.stderr.write('Fixture retained: '+temporary+'\n')}
})
