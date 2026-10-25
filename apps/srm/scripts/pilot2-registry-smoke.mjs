import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import net from 'node:net'
import {setTimeout as delay} from 'node:timers/promises'

/** Test the shipped external package closure, never the workspace's modules.
 * Constructors may read immutable schema bytes, but cannot touch SQL or HTTP. */
const modules=path.resolve(process.argv[2])
const stage=process.argv[3]??'REGISTRY'
assert(['REGISTRY','FORM_ADMISSION','SCANNER','COLD_ACQUISITION'].includes(stage))
const load=(name,file)=>import(pathToFileURL(path.join(modules,'@profitia',name,file)).href)
const [{createPlatformIngestionHost},{createAdmittedGusSource,GUS_ORIGIN,GUS_PATH},{createNativeNipRegistrySource}]=await Promise.all([
 load('platform-contracts','src/platform-ingestion.mjs'),load('krs-registry-runtime','dist/gus-bir.js'),load('krs-registry-runtime','dist/native.js')])
const schema=fs.readFileSync(path.join(modules,'@profitia/platform-contracts/migrations/access/012-native-external-transport.sql'))
assert.equal(createHash('sha256').update(schema).digest('hex'),'6faff5f258b71cf2525d705c8fcf38c8aef9331c4e8f0bdd6f1af74e6cf76bde')
let sqlCalls=0
const noSql=async()=>{sqlCalls++;throw Error('Runtime constructor attempted SQL')}
const host={application:{appId:'krs-registry-source',profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId:'pilot2-closure-smoke',
 configurationVersion:'krs-native-pilot-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']},
 binding:{applicationId:'krs-registry-source',environment:'development',projectId:'fixture-project',branchId:'fixture-branch',databaseName:'krs_registry_pilot',role:'krs_ingest',
  deploymentId:'pilot2-closure-smoke',configurationVersion:'krs-native-pilot-v1',schemaDigest:'14d46ec280e624d79930833b022a46866864557cecbf2e3b55b1a1143fb9d66b',unmeteredSchemaDigest:'9fe56c54c22fe54aa4869966cf00e7347e8c0d040b1d3d8110fc7952a78d5e13'},
 independentQuery:noSql,transact:noSql}
const sourceHost=createPlatformIngestionHost({...host,source:{id:'krs.registry.gus',payloadSchema:'external-call-control-v1',qualityVersion:'gus-bir12-source-v1',classificationVersion:'technical-source-control-v1'},validateSharedPayload:()=>false})
const gus=await createAdmittedGusSource({sourceHost,sourceId:'krs.registry.gus',resourceId:'krs-gus:nip-map',apiKey:'x'.repeat(20),readSid:()=>null,permit:noSql,
 binding:{role:'krs_ingest',configurationVersion:'krs-native-pilot-v1',schemaDigest:'69db4ec3787937b24922f7acfc267e5aae400ddc44e0799eff09fa7e6d87e206',origin:GUS_ORIGIN,transport:'HTTPS',pathRules:[{method:'POST',path:GUS_PATH}]},
 independentQuery:noSql,query:noSql})
const krs=await createNativeNipRegistrySource({host,externalSchemaDigest:'69db4ec3787937b24922f7acfc267e5aae400ddc44e0799eff09fa7e6d87e206',transportProfile:'EXTRACTS_ONLY'})
assert.equal(typeof gus.execute,'function');assert.equal(typeof krs.acquire,'function');assert.equal(typeof krs.continuity,'function');assert.equal(sqlCalls,0)
const directory=path.dirname(modules)
// The actual compiled application must initialize the same composition, too.
// Fixture credentials have no authority and health performs no database work.
const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(error=>error?reject(error):resolve(port))})})
const connection=role=>'postgresql://'+role+':fixture@ep-fragrant-cloud-b1y6i4v8.c-5.eu-central-1.aws.neon.tech/krs_registry_pilot?sslmode=require'
const privateConnection=role=>'postgresql://'+role+':fixture@ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech/platform_private?sslmode=require'
const human=stage!=='REGISTRY'?{
 ...(['SCANNER','COLD_ACQUISITION'].includes(stage)?{SRM_PILOT2_PRIVATE_SCANNER:'true',SRM_DEMO_SESSION_SECRET:'fixture_'.repeat(8)}:{}),
 ...(stage==='COLD_ACQUISITION'?{SRM_PILOT2_COLD_ACQUISITION:'true',MGBI_API_KEY:'fixture',CEIDG_API_KEY:'fixture',VERCLY_API_KEY:'fixture',VERCLY_API_BASE_URL:'https://fixture.invalid',
 PILOT2_E1_SOURCE_URL:privateConnection('srm_pilot2_source'),PILOT2_E1_CORPORATE_URL:privateConnection('srm_pilot2_corporate')}:{}),
 PROFITIA_AUTH_PROVIDER:'clerk',SRM_PILOT2_FORM_ADMISSION:'true',PROFITIA_FIXED_ORGANISATION_ID:'11111111-1111-4111-8111-111111111111',
 PROFITIA_CLERK_ISSUER:'https://fixture.clerk.accounts.dev',PROFITIA_CLERK_PUBLISHABLE_KEY:'pk_test_'+Buffer.from('fixture.clerk.accounts.dev$').toString('base64url'),
 PROFITIA_CLERK_SECRET_KEY:'sk_test_fixture',PROFITIA_CLERK_AUTHORIZED_PARTIES:'["https://srm-krs-pilot2-development.onrender.com"]',
 PILOT2_E1_DATABASE_URL:privateConnection('srm_private_development_runtime'),PILOT2_E1_JOBS_URL:privateConnection('srm_pilot2_jobs'),
 PILOT2_PUBLIC_CATALOG_URL:'postgresql://srm_pilot2_catalog_reader:fixture@ep-fragrant-cloud-b1y6i4v8.c-5.eu-central-1.aws.neon.tech/srm_app?sslmode=require',
}:{}
const child=spawn(process.execPath,[path.join(directory,'server.js')],{cwd:directory,stdio:'ignore',env:{PATH:process.env.PATH,NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:String(port),
 TARGET_ENVIRONMENT:'development',RENDER_SERVICE_ID:'srv-dbeh6srrjlhs73fmikrg',RENDER_GIT_COMMIT:'a'.repeat(40),GUS_BIR_API_KEY:'x'.repeat(20),
 KRS_PILOT2_READER_URL:connection('krs_reader'),KRS_PILOT2_SOURCE_URL:connection('krs_ingest'),...human}})
let exitCode,healthy=false;child.once('exit',code=>{exitCode=code})
try{
 for(let attempt=0;attempt<80;attempt++){
  if(exitCode!==undefined)throw Error('Standalone server exited before readiness')
  let response;try{response=await fetch('http://127.0.0.1:'+port+'/api/health',{signal:AbortSignal.timeout(1000)})}catch{}
  if(response){assert.equal(response.status,200,'Actual bundled registry constructor must pass readiness');const body=await response.json();assert.equal(body.status,'ok');healthy=true;break}
  await delay(100)
 }
 assert(healthy,'Standalone readiness timeout')
}finally{child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(2000)]);if(exitCode===undefined)child.kill('SIGKILL')}
console.log(JSON.stringify({stage,pilot2StandaloneRegistryInitialization:'PASS',humanComposition:stage!=='REGISTRY'?'INITIALIZED_WITHOUT_SQL_OR_HTTP':'NOT_APPLICABLE',actualBundledHealth:'PASS',immutableNativeSchema:'PASS',sqlCalls:0,providerHttpCalls:0}))
