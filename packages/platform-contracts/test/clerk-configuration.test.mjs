import assert from 'node:assert/strict'
import test from 'node:test'
import { readClerkConfiguration, IdentityConfigurationUnavailable, CLERK_CONFIGURATION_CONTRACT, clerkConfigurationSourceDigest } from '../src/clerk-configuration.mjs'

const host='identity-fixture.clerk.accounts.dev'
const fixture=()=>({applicationId:'spendguru',environment:'development',issuer:`https://${host}`,publishableKey:`pk_test_${Buffer.from(host+'$').toString('base64url')}`,secretKey:'sk_test_fixture',authorizedParties:['http://localhost:3000','https://development.example.test']})
test('one shared parser returns only immutable public configuration for either application',()=>{
  for(const applicationId of ['spendguru','srm']){
    const input={...fixture(),applicationId,DATABASE_URL:'never-public',role:'admin'}
    const result=readClerkConfiguration(input)
    assert.deepEqual(Object.keys(result).sort(),['application','publishableKey'])
    assert.deepEqual(Object.keys(result.application).sort(),['appId','authorizedParties','environment','issuer'])
    assert.equal(result.application.appId,applicationId)
    assert(!JSON.stringify(result).includes(input.secretKey));assert(!JSON.stringify(result).includes('never-public'));assert(!JSON.stringify(result).includes('admin'))
    input.authorizedParties.push('https://evil.example.test')
    assert.equal(result.application.authorizedParties.length,2)
    assert.throws(()=>result.application.authorizedParties.push('https://evil.example.test'),TypeError)
  }
})
test('every missing input rejects with a redacted error',()=>{
  for(const key of Object.keys(fixture()))assert.throws(()=>readClerkConfiguration({...fixture(),[key]:undefined}),error=>error instanceof IdentityConfigurationUnavailable&&error.message==='Identity configuration unavailable'&&!error.stack.includes('sk_test_fixture'))
  for(const value of [undefined,null,[],Object.create(null)])assert.throws(()=>readClerkConfiguration(value),IdentityConfigurationUnavailable)
})
test('malformed and duplicated origins cannot widen the browser boundary',()=>{
  for(const value of [[],['https://*.example.test'],['https://ok.example.test/path'],['https://name:password@example.test'],['http://remote.example.test'],['https://one.example.test','https://one.example.test'],['https://one.example.test',null]])assert.throws(()=>readClerkConfiguration({...fixture(),authorizedParties:value}),IdentityConfigurationUnavailable)
})
test('key host, key kind and environment must all agree',()=>{
  for(const patch of [{issuer:'https://other.clerk.accounts.dev'},{secretKey:'sk_live_fixture'},{publishableKey:'pk_test_invalid'},{environment:'test'},{applicationId:'../foreign'}])assert.throws(()=>readClerkConfiguration({...fixture(),...patch}),IdentityConfigurationUnavailable)
  for(const environment of ['staging','production'])assert.throws(()=>readClerkConfiguration({...fixture(),environment}),IdentityConfigurationUnavailable)
})
test('separate release configuration is accepted without accepting it in Development',()=>{
  const live={...fixture(),issuer:'https://identity.example.test',publishableKey:`pk_live_${Buffer.from('identity.example.test$').toString('base64url')}`,secretKey:'sk_live_fixture',authorizedParties:['https://staging.example.test']}
  for(const environment of ['staging','production'])assert.equal(readClerkConfiguration({...live,environment}).application.environment,environment)
  assert.throws(()=>readClerkConfiguration(live),IdentityConfigurationUnavailable)
})
test('configuration is a separately accepted SDK/React-independent source',async()=>{
  assert.deepEqual(CLERK_CONFIGURATION_CONTRACT,{id:'profitia.clerk-configuration',version:'1.0.0'})
  assert.match(await clerkConfigurationSourceDigest(),/^[a-f0-9]{64}$/)
})
