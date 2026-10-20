import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement, version as reactVersion } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createClerkIdentityAuthenticator } from '@profitia/platform-contracts/identity-provider'
import { clerkConfigurationSourceDigest } from '@profitia/platform-contracts/clerk-configuration'
import { readSg2IdentityRuntime, createSg2ClerkClient, IdentityConfigurationUnavailable } from '../lib/platform/identity-runtime'
import { ClerkSignIn } from '../components/auth/clerk-sign-in'
import { Sg2IdentityProvider, Sg2SessionContent, Sg2AuthenticatedView } from '../components/auth/session-boundary'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { NodeNextRequest } from 'next/dist/server/base-http/node.js'
import { NextRequestAdapter } from 'next/dist/server/web/spec-extension/adapters/next-request.js'
import { addRequestMeta } from 'next/dist/server/request-meta.js'
import { createPublicIdentityRequestBoundary, publicIdentityRequestSourceDigest } from '@profitia/platform-contracts/public-request'

const host='identity-fixture.clerk.accounts.dev'
const fixture=()=>({PROFITIA_AUTH_PROVIDER:'clerk',TARGET_ENVIRONMENT:'development',PROFITIA_CLERK_ISSUER:`https://${host}`,
  PROFITIA_CLERK_PUBLISHABLE_KEY:`pk_test_${Buffer.from(host+'$').toString('base64url')}`,PROFITIA_CLERK_SECRET_KEY:'sk_test_fixture',
  PROFITIA_CLERK_AUTHORIZED_PARTIES:'["http://localhost:3001"]'})

test('the actual SG2 Next adapter uses an internal bind URL and the shared identity boundary pins the public authority', t => {
  const socket = new Socket(); t.after(() => socket.destroy())
  const incoming = new IncomingMessage(socket), publicOrigin = 'https://dev-sg2.spendguru.app'
  incoming.method = 'GET'; incoming.url = '/api/benchmarks/selection?context=public-fixture'
  incoming.headers = { host: new URL(publicOrigin).host, origin: publicOrigin }
  addRequestMeta(incoming, 'initURL', 'https://0.0.0.0:10000' + incoming.url)
  const request = NextRequestAdapter.fromNodeNextRequest(new NodeNextRequest(incoming), new AbortController().signal)
  assert.equal(new URL(request.url).origin, 'https://0.0.0.0:10000')
  const normalize = createPublicIdentityRequestBoundary({ publicOrigins: [publicOrigin], internalOrigins: ['https://0.0.0.0:10000'] })
  assert.equal(normalize(request)!.url, publicOrigin + incoming.url)
  request.headers.set('origin', 'https://foreign.example.test')
  assert.equal(normalize(request), null)
})
test('the public identity adoption preserves historical receipts and pins the complete current SG2 closure', async () => {
  const receipt = JSON.parse(readFileSync(new URL('../operation-integration.json', import.meta.url), 'utf8'))
  const adoption = receipt.publicIdentityRequestAdoption
  assert.equal(adoption.taskId, 'SG2-E1-CONTROLLED-DEVELOPMENT-RELEASE-20261020')
  assert.equal(adoption.previousApplicationAuthority, '05a7d705e1aeeae04465e59b371ea0cd5a0d4c06')
  assert.equal(adoption.producer.projectKey, 'ARCHITECTURE'); assert.equal(adoption.producer.sourceSha, '74df44d1f0d6df66e358bd432ebd80c3c955f70a')
  assert.equal(adoption.sdkDigest, await publicIdentityRequestSourceDigest())
  const previous = JSON.parse(execFileSync('git', ['show', adoption.previousApplicationAuthority + ':apps/sg-runtime/operation-integration.json'], { encoding: 'utf8' }))
  for (const [key, value] of Object.entries(previous)) assert.deepEqual(receipt[key], value, key)
  for (const [path, digest] of Object.entries(adoption.sourceDigests)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex'), digest, path)
  }
  assert.equal(adoption.productDeploymentPerformed, false)
})

test('SG2 requires explicit complete Clerk mode and uses the one accepted configuration parser',async()=>{
  assert.deepEqual(readSg2IdentityRuntime({}),{provider:'legacy_demo'})
  for(const env of [{PROFITIA_AUTH_PROVIDER:'unknown'},{PROFITIA_AUTH_PROVIDER:'clerk'},{...fixture(),PROFITIA_CLERK_AUTHORIZED_PARTIES:'invalid'}])assert.throws(()=>readSg2IdentityRuntime(env),IdentityConfigurationUnavailable)
  assert.equal(await clerkConfigurationSourceDigest(),'b3bdad865a16cbf677db1dd7450f594870abca30f8a252bd4d361d2387417246')
})
test('deployment-owned SG2 identity cannot borrow an application id or expose a secret',()=>{
  const result=readSg2IdentityRuntime({...fixture(),applicationId:'srm',DATABASE_URL:'not-public'})
  if(result.provider!=='clerk')throw Error('Expected Clerk')
  assert.equal(result.application.appId,'spendguru')
  assert.deepEqual(Object.keys(result).sort(),['application','provider','publishableKey'])
  assert(!JSON.stringify(result).includes('sk_test_fixture'));assert(!JSON.stringify(result).includes('not-public'))
  assert.throws(()=>result.application.authorizedParties.push('https://evil.example.test'),TypeError)
})
test('actual Clerk backend SDK composes with SG2 identity without a framework upgrade',()=>{
  const config=readSg2IdentityRuntime(fixture());if(config.provider!=='clerk')throw Error('Expected Clerk')
  const client=createSg2ClerkClient(fixture())
  assert.equal(typeof createClerkIdentityAuthenticator({client,application:config.application,resolveBinding:async()=>null}),'function')
  assert.throws(()=>createSg2ClerkClient({}),IdentityConfigurationUnavailable)
})
test('actual official UI renders with React18 and both application locales',()=>{
  assert.match(reactVersion,/^18\.3\./)
  for(const locale of ['pl','en'] as const){
    const html=renderToStaticMarkup(createElement(Sg2IdentityProvider,{mode:'clerk',publishableKey:fixture().PROFITIA_CLERK_PUBLISHABLE_KEY,locale,
      children:createElement(ClerkSignIn,{returnPath:`/${locale}/benchmark-finder`})}))
    assert(!html.includes('sk_test_fixture'));assert(!html.includes('/api/porr-demo-auth'));assert(!html.includes('name="password"'))
  }
})
test('the real sign-in uses the validated local return path without a second provider',()=>{
  for(const locale of ['pl','en'] as const){
    const element=ClerkSignIn({returnPath:`/${locale}/benchmark-finder`})
    assert.equal(element.props.forceRedirectUrl,`/${locale}/benchmark-finder`)
    assert.equal(element.props.withSignUp,false);assert.equal(element.props.routing,'hash')
  }
})
test('individual presentation withholds Finder until ready and does not put principal IDs in HTML',()=>{
  const children=createElement('div',null,'private-finder-marker')
  for(const locale of ['pl','en'] as const){
    for(const session of [{status:'loading'} as const,{status:'signed-out'} as const,{status:'signed-in',userId:'',sessionId:'synthetic-session'} as const]){
      const html=renderToStaticMarkup(createElement(Sg2SessionContent,{session,locale,children}));assert(!html.includes('private-finder-marker'))
    }
    const html=renderToStaticMarkup(createElement(Sg2SessionContent,{session:{status:'signed-in',userId:'synthetic-user',sessionId:'synthetic-session'},locale,children}))
    assert(html.includes('private-finder-marker'));assert(!html.includes('synthetic-user'));assert(!html.includes('synthetic-session'))
  }
})
test('principal or session change replaces the complete Finder subtree identity',()=>{
  const element=(userId:string,sessionId:string)=>Sg2SessionContent({session:{status:'signed-in',userId,sessionId},locale:'pl',children:createElement('div')})
  assert.equal(element('user-a','session-a').key,element('user-a','session-a').key)
  assert.notEqual(element('user-a','session-a').key,element('user-b','session-a').key)
  assert.notEqual(element('user-a','session-a').key,element('user-a','session-b').key)
})
test('missing provider or invalid explicit configuration never renders the individual application',()=>{
  const children=createElement(Sg2AuthenticatedView,{locale:'pl',children:createElement('div',null,'private-finder-marker')})
  assert(!renderToStaticMarkup(children).includes('private-finder-marker'))
  for(const mode of ['clerk','unavailable'] as const){
    assert(!renderToStaticMarkup(createElement(Sg2IdentityProvider,{mode,locale:'pl',children})).includes('private-finder-marker'))
  }
  assert(renderToStaticMarkup(createElement(Sg2IdentityProvider,{mode:'legacy_demo',locale:'pl',children})).includes('private-finder-marker'))
})
test('the SG2 receiver cannot relabel Development identity as Staging',()=>{
  assert.throws(()=>readSg2IdentityRuntime({...fixture(),TARGET_ENVIRONMENT:'staging'}),IdentityConfigurationUnavailable)
  assert.throws(()=>readSg2IdentityRuntime({...fixture(),TARGET_ENVIRONMENT:undefined,APP_ENV:'development'}),IdentityConfigurationUnavailable)
})
