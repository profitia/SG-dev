import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import pg from 'pg'
import { NextRequest } from 'next/server.js'
import { accessSchemaUrl, moduleAuditSchemaDigest } from '@profitia/platform-contracts/access-store'
import { moduleSchemaDigest } from '@profitia/platform-contracts/module-scope'
import { IdentityConfigurationUnavailable } from '../src/server/identity-runtime.ts'
import { readSrmPrivateReportConfiguration, getSrmReportRuntime, srmPrivatePoolConfiguration } from '../src/server/private-runtime.ts'
import { createRuntimeSrmReportHandler } from '../src/server/report-runtime.ts'
import { privateBusinessPlan } from '../db/private-store/initialize.mjs'
import { POST as deployedPOST } from '../app/api/xray/report-data/route.ts'
import { middleware } from '../middleware.ts'
const targets = JSON.parse(readFileSync(new URL('../deployment/private-runtime-targets.json', import.meta.url), 'utf8'))
const target = targets.environments.development
const A = '11111111-1111-4111-8111-111111111111'
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
const request = () => new Request('https://app.fixture.test/api/xray/report-data', { method: 'POST',
  headers: { 'content-type': 'application/json', 'x-clerk-user-id': 'forged-user', 'x-clerk-org-id': 'forged-org' },
  body: JSON.stringify({ nip: '8650004194', entityType: 'COMPANY' }) })

test('SRM receiver pins match recorded private preparation, topology and actual accepted source bytes', async () => {
  const prepared = JSON.parse(readFileSync(new URL('../deployment/private-business-preparation.json', import.meta.url), 'utf8'))
  const registry = JSON.parse(readFileSync(new URL('../../../Canon/registries/platform-private-onboarding-v1.json', import.meta.url), 'utf8'))
  const topology = JSON.parse(readFileSync(new URL('../../../Canon/registries/srm-environment-topology-v1.json', import.meta.url), 'utf8'))
  assert.equal(target.serviceId, topology.environments.development.render.services.runtime.serviceId)
  for (const key of ['projectId','branchId','databaseName','runtimeRole']) assert.equal(target[key], prepared.physicalBinding[key])
  assert.equal(target.schemaName, prepared.physicalBinding.schemaName)
  assert.deepEqual(target.hosts, [registry.neon.host, registry.neon.pooledHost])
  assert.equal(target.runtimeRole, registry.srmBusinessStoreInitialization.runtimeRole)
  assert.equal(target.businessSchemaDigest, prepared.source.schema_digest)
  const plan = privateBusinessPlan({ binding: { environment: 'development', projectId: target.projectId, branchId: target.branchId,
    databaseName: target.databaseName, role: target.runtimeRole }, sourceSha: prepared.sourceSha })
  assert.equal(plan.schemaDigest, target.businessSchemaDigest)
  assert.equal(target.accessSchemaDigest, createHash('sha256').update(readFileSync(new URL(accessSchemaUrl))).digest('hex'))
  assert.equal(target.moduleSchemaDigest, await moduleSchemaDigest()); assert.equal(target.auditSchemaDigest, await moduleAuditSchemaDigest())
  const role = prepared.controls.actualRuntimeRoles.find(r => r.current_user === target.runtimeRole)
  assert(role && role.session_user === target.runtimeRole && role.srm_usage && !role.rolbypassrls && !role.owner_member)
})
test('default and exact legacy mode never initialize private configuration', () => {
  assert.deepEqual(readSrmPrivateReportConfiguration({}), { provider: 'legacy_demo' })
  assert.deepEqual(getSrmReportRuntime({}), { provider: 'legacy_demo' })
  assert.deepEqual(readSrmPrivateReportConfiguration({ PROFITIA_AUTH_PROVIDER: 'legacy_demo', PROFITIA_PRIVATE_DATABASE_URL: 'invalid' }), { provider: 'legacy_demo' })
})
test('explicit server intent binds its fixed tenant, deployment and only current report operations', () => {
  const env = fixture(), config = readSrmPrivateReportConfiguration(env)
  assert.equal(config.provider, 'clerk'); assert.equal(config.application.profileId, 'PORR_SUITE')
  assert.equal(config.application.organisationId, A); assert.equal(config.application.appId, 'srm')
  assert.equal(config.application.deploymentId, `${target.serviceId}:${env.RENDER_GIT_COMMIT}`)
  assert.deepEqual(config.application.operations, ['supplier.report.read','supplier.report.project'])
  assert.deepEqual(config.application.features, ['supplier_report'])
  assert.equal(readSrmPrivateReportConfiguration({ ...env, NODE_ENV: 'production' }).provider, 'clerk')
})
test('missing or inconsistent private intent is refused with a redacted error', () => {
  const env = fixture()
  for (const value of ['', 'CLERK', 'clerkk', 'false', 'unknown']) assert.throws(() => readSrmPrivateReportConfiguration({ ...env, PROFITIA_AUTH_PROVIDER: value }), IdentityConfigurationUnavailable)
  for (const key of Object.keys(env).filter(k => !['APP_ENV','PROFITIA_AUTH_PROVIDER'].includes(k))) assert.throws(() => readSrmPrivateReportConfiguration({ ...env, [key]: undefined }), IdentityConfigurationUnavailable)
  for (const patch of [{ APP_ENV: 'staging' }, { RENDER_SERVICE_ID: 'other' }, { RENDER_GIT_COMMIT: 'main' },
    { PROFITIA_FIXED_ORGANISATION_ID: 'demo' }, { SRM_DEMO_SESSION_SECRET: 'short' }, { PROFITIA_OPERATION_CONFIGURATION_VERSION: 'unknown' }]) {
    assert.throws(() => readSrmPrivateReportConfiguration({ ...env, ...patch }), error => error instanceof IdentityConfigurationUnavailable && !error.message.includes('synthetic'))
  }
})
test('Stage and Production cannot borrow this Development private store even with valid live identity syntax', () => {
  const issuer = 'https://identity.fixture.test'
  for (const environment of ['staging', 'production']) assert.throws(() => readSrmPrivateReportConfiguration({ ...fixture(),
    TARGET_ENVIRONMENT: environment, APP_ENV: environment, PROFITIA_CLERK_ISSUER: issuer,
    PROFITIA_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from(`${new URL(issuer).host}$`).toString('base64url')}`,
    PROFITIA_CLERK_SECRET_KEY: 'sk_live_fixture' }), IdentityConfigurationUnavailable)
})
test('owner, legacy, SG2, foreign database/host, transport and arbitrary connection options are refused', () => {
  const env = fixture()
  const edits = [u => { u.hostname='foreign.neon.tech' },u=>{u.hostname='127.0.0.1'},
    ...['neondb_owner','srm_app_runtime','sg2_private_development_runtime','sg2_private_development_dashboard'].map(role=>u=>{u.username=role}),
    u=>{u.password=''},u=>{u.pathname='/neondb'},u=>{u.pathname='/srm_app'},u=>{u.port='55439'},u=>{u.hash='fragment'},
    u=>{u.searchParams.set('sslmode','disable')},u=>{u.searchParams.delete('sslmode')},u=>{u.searchParams.append('sslmode','require')},
    u=>{u.searchParams.set('channel_binding','disable')},u=>{u.searchParams.append('channel_binding','require')},
    ...['host','options','sslrootcert','sslaccept','connection_limit'].map(key=>u=>{u.searchParams.set(key,'hostile')})]
  for (const edit of edits) {
    const url = new URL(env.PROFITIA_PRIVATE_DATABASE_URL); edit(url)
    assert.notEqual(url.toString(), env.PROFITIA_PRIVATE_DATABASE_URL)
    assert.throws(() => readSrmPrivateReportConfiguration({ ...env, PROFITIA_PRIVATE_DATABASE_URL:url.toString() }), IdentityConfigurationUnavailable)
  }
  for (const input of [env.PROFITIA_PRIVATE_DATABASE_URL.replace(/^postgresql:/,'https:'),` ${env.PROFITIA_PRIVATE_DATABASE_URL}`]) assert.throws(()=>readSrmPrivateReportConfiguration({...env,PROFITIA_PRIVATE_DATABASE_URL:input}),IdentityConfigurationUnavailable)
})
test('native pg configuration preserves strict TLS and isolates inherited destination/options without connecting', () => {
  const config = readSrmPrivateReportConfiguration(fixture())
  const old = { PGHOST: process.env.PGHOST, PGOPTIONS: process.env.PGOPTIONS, PGDATABASE: process.env.PGDATABASE }
  Object.assign(process.env, { PGHOST: 'foreign.invalid', PGOPTIONS: '-c search_path=public', PGDATABASE: 'foreign' })
  try {
    const business = srmPrivatePoolConfiguration(config,3), audit = srmPrivatePoolConfiguration(config,1)
    const client = new pg.Client(business)
    assert.equal(client.connectionParameters.host,target.hosts[0]); assert.equal(client.connectionParameters.user,target.runtimeRole)
    assert.equal(client.connectionParameters.database,target.databaseName); assert.equal(client.connectionParameters.options,'-c search_path=pg_catalog')
    assert.deepEqual(client.connectionParameters.ssl,{rejectUnauthorized:true}); assert.equal(business.enableChannelBinding,true)
    assert.equal(business.max+audit.max,4); assert.equal(business.connectionString,undefined)
  } finally { for(const [key,value]of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value} }
})
test('a cached server under changed configuration is rejected before constructing another pool', () => {
  const old = globalThis.__srmPrivateReportRuntime__
  globalThis.__srmPrivateReportRuntime__={key:'different',runtime:{provider:'legacy_demo'}}
  try {assert.throws(()=>getSrmReportRuntime(fixture()),IdentityConfigurationUnavailable)}
  finally{globalThis.__srmPrivateReportRuntime__=old}
})
test('unavailable or unknown runtime never invokes a legacy callback', async () => {
  let calls=0;const legacy=async()=>{calls++;return Response.json({legacy:true})}
  for(const resolve of [()=>{throw Error('hidden diagnostic')},()=>({provider:'unknown'})]){
    const response=await createRuntimeSrmReportHandler(resolve,legacy)(request())
    assert.equal(response.status,503);assert.equal(response.headers.get('Cache-Control'),'private, no-store')
    assert.equal(response.headers.get('Vary'),'Cookie, Authorization');assert.deepEqual(await response.json(),{error:'Operation unavailable'})
  }
  assert.equal(calls,0);assert.equal((await createRuntimeSrmReportHandler(()=>({provider:'legacy_demo'}),legacy)(request())).status,200);assert.equal(calls,1)
})
test('middleware forwards only the adopted report API; its actual entry rejects incomplete Clerk and forged headers', async () => {
  const old=process.env.PROFITIA_AUTH_PROVIDER;process.env.PROFITIA_AUTH_PROVIDER='clerk'
  try{
    const forwarded=await middleware(new NextRequest(request()))
    assert.equal(forwarded.headers.get('x-middleware-next'),'1')
    const response=await deployedPOST(request());assert.equal(response.status,503)
    assert.equal(response.headers.get('Cache-Control'),'private, no-store')
    assert.deepEqual(await response.json(),{error:'Operation unavailable'})
    assert.equal((await middleware(new NextRequest('https://app.fixture.test/api/xray/lookup'))).status,401)
    assert.equal((await middleware(new NextRequest('https://app.fixture.test/'))).status,307)
  }finally{if(old===undefined)delete process.env.PROFITIA_AUTH_PROVIDER;else process.env.PROFITIA_AUTH_PROVIDER=old}
})
