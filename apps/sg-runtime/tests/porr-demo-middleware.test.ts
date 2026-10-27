import assert from 'node:assert/strict'
import test, { before } from 'node:test'

import { NextRequest } from 'next/server'

process.env.APP_ENV = 'development'
process.env.NODE_ENV = 'production'
process.env.SG_RUNTIME_PORR_DEMO = 'true'
process.env.NEXT_PUBLIC_APP_URL = 'https://dev-sg2.spendguru.app'
process.env.PORR_DEMO_PASSWORD = 'test-password'
process.env.PORR_DEMO_SESSION_SECRET = 'test-secret'
process.env.SG_RUNTIME_DEV_ORG_ID = 'test-org'
process.env.SG_RUNTIME_DEV_USER_ID = 'test-user'
process.env.SG_RUNTIME_DEV_ORG_ROLE = 'viewer'

let middleware: typeof import('../middleware').default
let createPorrDemoSessionToken: typeof import('../lib/porr-demo-session').createPorrDemoSessionToken

before(async () => {
  middleware = (await import('../middleware')).default
  createPorrDemoSessionToken = (await import('../lib/porr-demo-session')).createPorrDemoSessionToken
})

test('upgrades a valid host-only Development session for the analytics sibling host', async () => {
  const token = await createPorrDemoSessionToken('test-secret', {
    orgId: 'test-org',
    userId: 'test-user',
    orgRole: 'viewer',
  })
  const response = await middleware(new NextRequest('https://dev-sg2.spendguru.app/en/benchmark-finder', {
    headers: { cookie: `sg_porr_demo_session_development=${token}` },
  }))

  const cookie = response.cookies.get('sg_porr_demo_session_development')
  assert.equal(response.status, 200)
  assert.equal(cookie?.value, token)
  assert.equal(cookie?.domain, '.spendguru.app')
  assert.equal(cookie?.httpOnly, true)
  assert.equal(cookie?.secure, true)
  assert.ok((cookie?.maxAge ?? 0) > 0)
})

test('does not reissue an invalid session and keeps the configured domain when proxy host differs', async () => {
  const invalid = await middleware(new NextRequest('https://dev-sg2.spendguru.app/en/benchmark-finder', {
    headers: { cookie: 'sg_porr_demo_session_development=invalid' },
  }))
  assert.equal(invalid.cookies.get('sg_porr_demo_session_development'), undefined)
  assert.equal(invalid.status, 307)

  const token = await createPorrDemoSessionToken('test-secret', {
    orgId: 'test-org',
    userId: 'test-user',
    orgRole: 'viewer',
  })
  const technical = await middleware(new NextRequest('https://sg2-development-runtime.onrender.com/en/benchmark-finder', {
    headers: { cookie: `sg_porr_demo_session_development=${token}` },
  }))
  assert.equal(technical.cookies.get('sg_porr_demo_session_development')?.domain, '.spendguru.app')
})
test('explicit Clerk forwards only adopted neutral shells and never upgrades a demo cookie',async()=>{
  const previous=process.env.PROFITIA_AUTH_PROVIDER;process.env.PROFITIA_AUTH_PROVIDER='clerk'
  try{
    const token=await createPorrDemoSessionToken('test-secret',{orgId:'test-org',userId:'test-user',orgRole:'viewer'})
    for(const path of ['/','/pl','/en','/pl/benchmark-finder','/en/benchmark-finder','/pl/supplier-intelligence','/en/supplier-intelligence',
      '/pl/category-builder','/en/category-builder?seedBenchmarkId=synthetic-selection']){
      const response=await middleware(new NextRequest('https://dev-sg2.spendguru.app'+path,{headers:{cookie:`sg_porr_demo_session_development=${token}`}}))
      assert([200,307].includes(response.status))
      assert.equal(response.cookies.get('sg_porr_demo_session_development'),undefined)
      assert.equal(response.headers.get('Cache-Control'),'private, no-store')
      assert(response.headers.get('Vary')?.includes('Cookie'))
    }
    for(const path of ['/pl/category-builder/unadopted','/en/unadopted-private-page','/de/benchmark-finder','/de/category-builder']){
      assert.equal((await middleware(new NextRequest('https://dev-sg2.spendguru.app'+path))).status,403)
    }
  }finally{if(previous===undefined)delete process.env.PROFITIA_AUTH_PROVIDER;else process.env.PROFITIA_AUTH_PROVIDER=previous}
})
test('unknown, empty and whitespace provider modes refuse pages without demo fallback',async()=>{
  const previous=process.env.PROFITIA_AUTH_PROVIDER
  try{
    for(const mode of ['unknown','',' ','CLERK']){
      process.env.PROFITIA_AUTH_PROVIDER=mode
      const response=await middleware(new NextRequest('https://dev-sg2.spendguru.app/pl/benchmark-finder'))
      assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Operation unavailable'})
      assert.equal(response.cookies.get('sg_porr_demo_session_development'),undefined)
    }
  }finally{if(previous===undefined)delete process.env.PROFITIA_AUTH_PROVIDER;else process.env.PROFITIA_AUTH_PROVIDER=previous}
})

test('category shell adoption preserves the prior source acceptance and pins the complete current receiver', async () => {
  const {readFileSync}=await import('node:fs'),{execFileSync}=await import('node:child_process'),{createHash}=await import('node:crypto')
  const receipt=JSON.parse(readFileSync(new URL('../operation-integration.json',import.meta.url),'utf8'))
  const current=receipt.categoryShellAdoption
  assert.equal(current.taskId,'SG2-E1-CONTROLLED-DEVELOPMENT-RELEASE-20261020')
  assert.equal(current.previousApplicationAuthority,'6fa89839b9cb185385fe5d5f67b05318c31fee70')
  const previous=JSON.parse(execFileSync('git',['show',current.previousApplicationAuthority+':apps/sg-runtime/operation-integration.json'],{encoding:'utf8'}))
  for(const [key,value]of Object.entries(previous))assert.deepEqual(['contract','producer'].includes(key)?receipt.supplierLocationSourceCompatibility.previousRootAcceptance[key]:receipt[key],value,key)
  for(const path of Object.keys(previous.storedReadSourceAdoption.sourceDigests))assert(path in current.sourceDigests,path)
  for(const path of ['middleware.ts','app/[locale]/category-builder/page.tsx','tests/porr-demo-middleware.test.ts'])assert(path in current.sourceDigests,path)
  for(const [path,digest]of Object.entries({...current.sourceDigests,...receipt.platform125SourceCompatibility.applicationSourceDigests, ...receipt.selfServiceAccountSourceCompatibility.applicationSourceDigests, ...receipt.accountRecheckSourceCompatibility.applicationSourceDigests, ...receipt.krsSoapSourceCompatibility?.applicationSourceDigests,...receipt.assistantAvatarSourceCompatibility.applicationSourceDigests, ...receipt.unmeteredSourceCompatibility.applicationSourceDigests,...receipt.formReportSourceCompatibility.applicationSourceDigests,...receipt.requestQuotaSourceCompatibility.applicationSourceDigests,...receipt.benchmarkPresentationSourceCompatibility.applicationSourceDigests,...receipt.nativeSqlRoundtripAdoption.applicationSourceDigests,...receipt.diagnosticTelemetryAdoption.applicationSourceDigests,...receipt.appShellSourceCompatibility.applicationSourceDigests}))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex'),digest,path)
  assert.equal(current.productDeploymentPerformed,false)
})
