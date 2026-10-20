import test from 'node:test'
import assert from 'node:assert/strict'
import type {PrismaClient} from '@prisma/client'
import {createFinderSourceTransport,finderSourcePolicy,type FinderSourceOptions} from '../lib/benchmark/discovery-source'

function fixture(){
 let queries=0
 const noSql={async $queryRawUnsafe(){queries++;assert.fail('Rejected command must not reach SQL')},async $executeRawUnsafe(){queries++;assert.fail('Rejected command must not reach SQL')},async $transaction(){queries++;assert.fail('Rejected command must not start SQL')}} as unknown as PrismaClient
 const options:FinderSourceOptions={application:{appId:'spendguru-benchmark-source',profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId:'fixture',configurationVersion:'source-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']},
  binding:{applicationId:'spendguru-benchmark-source',environment:'development',projectId:'fixture-source-project',branchId:'fixture-source-branch',databaseName:'fixture_source',role:'fixture_source_runtime',schemaDigest:'a'.repeat(64),deploymentId:'fixture',configurationVersion:'source-v1'},
  prisma:noSql,auditPrisma:{...noSql} as unknown as PrismaClient,external:{configurationVersion:'finder-provider-v1',schemaDigest:'b'.repeat(64),nativeSchemaDigest:'c'.repeat(64)},operationKey:'d'.repeat(64),credentials:{macrobondClientId:'fixture-client',macrobondClientSecret:'fixture-value',openAiKey:'fixture-ai-value',openAiModel:'fixture-model'}}
 return{options,transport:createFinderSourceTransport(options),queries:()=>queries}
}
const unavailable=(e:unknown)=>e instanceof Error&&e.name==='ExternalCallUnavailable'&&'certainty'in e&&e.certainty==='NOT_SENT'
test('construction is lazy and fixed policies expose no arbitrary data/hydration endpoint',()=>{
 const f=fixture();assert.equal(f.queries(),0)
 const api=finderSourcePolicy('MACROBOND_API')
 assert.equal(api.origin,'https://api.macrobondfinancial.com');assert.equal(api.pathRules.length,5)
 assert(!api.pathRules.some(r=>'path'in r&&r.path==='/v1/series/fetchseries'))
 assert.equal(finderSourcePolicy('MACROBOND_TOKEN').credentialMode,'NONE');assert.equal(finderSourcePolicy('OPENAI').credentialMode,'SERVER_HEADERS')
})
test('missing optional provider credentials do not disable a stored-metadata-only composition',async()=>{
 const f=fixture(),t=createFinderSourceTransport({...f.options,credentials:{macrobondClientId:null,macrobondClientSecret:null,openAiKey:null,openAiModel:'fixture-model'}})
 await assert.rejects(t.macrobond('https://apiauth.macrobondfinancial.com/mbauth/connect/token',{method:'POST',body:'grant_type=client_credentials'}),unavailable)
 await assert.rejects(t.openai('https://api.openai.com/v1/responses',{method:'POST',body:JSON.stringify({model:'fixture-model',store:false}),headers:{authorization:'Bearer null'}}),unavailable)
 assert.equal(f.queries(),0)
})
for(const input of ['https://attacker.invalid/mbauth/connect/token','http://127.0.0.1/mbauth/connect/token','https://apiauth.macrobondfinancial.com/mbauth/connect/token?leak=1','https://apiauth.macrobondfinancial.com/mbauth/connect/token#fragment'])test('foreign or substituted OAuth destination refused before authority reads '+input,async()=>{
 const f=fixture();await assert.rejects(f.transport.macrobond(input,{method:'POST',body:new URLSearchParams({grant_type:'client_credentials',client_id:'fixture-client',client_secret:'fixture-value'})}),unavailable);assert.equal(f.queries(),0)
})
test('changed OAuth credentials, extra headers, method and transport hooks are refused without network or SQL',async()=>{
 const f=fixture(),url='https://apiauth.macrobondfinancial.com/mbauth/connect/token',body=new URLSearchParams({grant_type:'client_credentials',client_id:'fixture-client',client_secret:'fixture-value'})
 for(const init of [{method:'POST',body:new URLSearchParams({...Object.fromEntries(body),client_secret:'different'})},
  {method:'POST',body,headers:{authorization:'foreign'}},{method:'POST',body,headers:{cookie:'private'}},
  {method:'GET',body},{method:'POST',body,redirect:'follow'},{method:'POST',body,fetcher:()=>{throw Error('must not run')}}])await assert.rejects(f.transport.macrobond(url,init as RequestInit),unavailable)
 assert.equal(f.queries(),0)
})
test('API calls cannot supply an access credential not returned by their own admitted OAuth exchange',async()=>{
 const f=fixture();await assert.rejects(f.transport.macrobond('https://api.macrobondfinancial.com/v1/series/fetchentities',{method:'POST',body:'[]',headers:{authorization:'Bearer fixture-unissued'}}),unavailable);assert.equal(f.queries(),0)
})
test('AI rejects another model, retained input, wrong credential and redirected origin before any effect',async()=>{
 const f=fixture(),url='https://api.openai.com/v1/responses'
 for(const init of [{method:'POST',body:JSON.stringify({model:'different',store:false}),headers:{authorization:'Bearer fixture-ai-value'}},
  {method:'POST',body:JSON.stringify({model:'fixture-model',store:true}),headers:{authorization:'Bearer fixture-ai-value'}},
  {method:'POST',body:JSON.stringify({model:'fixture-model',store:false}),headers:{authorization:'Bearer different'}},
  {method:'POST',body:JSON.stringify({model:'fixture-model',store:false}),headers:{authorization:'Bearer fixture-ai-value','openai-project':'unreviewed'}}])await assert.rejects(f.transport.openai(url,init as RequestInit),unavailable)
 await assert.rejects(f.transport.openai('https://another.invalid/v1/responses',{method:'POST',body:'{}'}),unavailable);assert.equal(f.queries(),0)
})
test('accessors and caller-owned request objects cannot execute inside the Source adapter',async()=>{
 const f=fixture(),init=Object.defineProperty({},'method',{enumerable:true,get(){assert.fail('getter must not run')}})
 await assert.rejects(f.transport.macrobond('https://api.macrobondfinancial.com/v1/series/fetchentities',init),unavailable)
 await assert.rejects(f.transport.macrobond(new Request('https://api.macrobondfinancial.com/v1/series/fetchentities')),unavailable);assert.equal(f.queries(),0)
})
test('synthetic routing cannot become a cloud, caller-defined or non-Development transport',()=>{
 const f=fixture()
 for(const syntheticOrigin of ['https://another.invalid','http://localhost:1234','http://127.0.0.1:1234/path'])assert.throws(()=>createFinderSourceTransport({...f.options,syntheticOrigin}),TypeError)
 assert.throws(()=>createFinderSourceTransport({...f.options,application:{...f.options.application,environment:'staging'},syntheticOrigin:'http://127.0.0.1:1234'}),TypeError)
})
