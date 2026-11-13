import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {organisationContextSchemaDigest} from '@profitia/platform-contracts/organisation-context'
import {bindSrmRequestRuntime,organisationContextConfiguration} from './organisation-context'
import {readSrmPrivateReportConfiguration} from './private-runtime'
const targets=JSON.parse(readFileSync(new URL('../../deployment/private-runtime-targets.json',import.meta.url),'utf8'))
const target=targets.environments.development
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222'
function fixture() {
  const issuer = 'https://identity-fixture.accounts.dev'
  const url = new URL('postgresql://local.invalid')
  url.hostname = target.hosts[0]; url.username = target.runtimeRole; url.password = 'synthetic_fixture_only'
  url.pathname = `/${target.databaseName}`; url.search = '?sslmode=require&channel_binding=require'
  return { PROFITIA_AUTH_PROVIDER: 'clerk', TARGET_ENVIRONMENT: 'development', APP_ENV: 'development',
    PROFITIA_CLERK_ISSUER: issuer, PROFITIA_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from(`${new URL(issuer).host}$`).toString('base64url')}`,
    PROFITIA_CLERK_SECRET_KEY: 'sk_test_fixture', PROFITIA_CLERK_AUTHORIZED_PARTIES: '["https://app.fixture.test"]',
    PROFITIA_PRIVATE_DATABASE_URL: url.toString(), PROFITIA_FIXED_ORGANISATION_ID: A,
    PROFITIA_OPERATION_CONFIGURATION_VERSION: targets.configurationVersion, RENDER_SERVICE_ID: target.serviceId,
    RENDER_GIT_COMMIT: 'a'.repeat(40), SRM_DEMO_SESSION_SECRET: 'synthetic_preference_scope_secret_only_32' }
}
test('fixed-organisation behaviour remains the default; SaaS requires the exact schema and deployment opt-in',()=>{
 const original=readSrmPrivateReportConfiguration(fixture())
 assert(original.provider==='clerk')
 assert.equal(original.application.organisationId,A);assert.equal(original.application.profileId,'PORR_SUITE')
 const env={...fixture(),PROFITIA_FIXED_ORGANISATION_ID:undefined,PROFITIA_ORGANISATION_CONTEXT_ENABLED:'true',PROFITIA_ORGANISATION_CONTEXT_SCHEMA_DIGEST:organisationContextSchemaDigest()}
 const current=readSrmPrivateReportConfiguration(env)
 assert(current.provider==='clerk')
 assert.equal(current.application.organisationId,null);assert.equal(current.application.profileId,'SPENDGURU_SAAS')
 assert.equal(current.organisationContext?.schemaDigest,organisationContextSchemaDigest())
 for(const flag of ['','TRUE','yes'])assert.throws(()=>organisationContextConfiguration({...env,PROFITIA_ORGANISATION_CONTEXT_ENABLED:flag}))
 for(const digest of [undefined,'a'.repeat(64),''])assert.throws(()=>organisationContextConfiguration({...env,PROFITIA_ORGANISATION_CONTEXT_SCHEMA_DIGEST:digest}))
 assert.throws(()=>organisationContextConfiguration({...env,TARGET_ENVIRONMENT:'production'}))
})
test('legacy and ordinary fixed runtimes are returned unchanged',async()=>{
 const req=new Request('https://srm.fixture.test/')
 for(const r of [{provider:'legacy_demo'},{provider:'clerk',defaultOrganisationId:A}])assert.equal(await bindSrmRequestRuntime(r,req),r)
})
test('concurrent requests receive separate canonical organisations and retain shared technical resources',async()=>{
 const ra=new Request('https://srm.fixture.test/?organisationId='+B,{headers:{'x-clerk-org-id':B}})
 const rb=new Request('https://srm.fixture.test/?organisationId='+A)
 const technical=Object.freeze({execute:()=>{throw Error('business authorization has not run')}})
 const select=new WeakMap([[ra,A],[rb,B]])
 const runtime=Object.freeze({provider:'clerk',executor:technical,
  get defaultOrganisationId():string{throw Error('unbound organisation cannot be used')},
  currentOrganisation:async(request:Request)=>{await new Promise(r=>setTimeout(r,request===ra?10:0));return {userId:A,organisationId:select.get(request)??null,expiresAt:new Date(Date.now()+10000).toISOString()}}})
 const [a,b]=await Promise.all([bindSrmRequestRuntime(runtime,ra),bindSrmRequestRuntime(runtime,rb)])
 assert.equal(a.defaultOrganisationId,A);assert.equal(b.defaultOrganisationId,B)
 assert.equal(a.executor,technical);assert.equal(b.executor,technical)
 assert(Object.isFrozen(a));assert(Object.isFrozen(b));assert.throws(()=>runtime.defaultOrganisationId)
 assert.equal(await runtime.currentOrganisation(ra).then(x=>x.organisationId),A)
})
test('missing membership or a failed current-account read never falls back to the configured tenant',async()=>{
 const req=new Request('https://srm.fixture.test/')
 for(const organisationId of [null,'', 'foreign', '00000000-0000-0000-0000-000000000000']){
  await assert.rejects(bindSrmRequestRuntime({provider:'clerk',defaultOrganisationId:A,currentOrganisation:async()=>({userId:A,organisationId,expiresAt:new Date().toISOString()})},req))
 }
 await assert.rejects(bindSrmRequestRuntime({provider:'clerk',defaultOrganisationId:A,currentOrganisation:async()=>{throw Error('unavailable')}},req),/unavailable/)
})
