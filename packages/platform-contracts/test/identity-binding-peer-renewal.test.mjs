import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createIdentityProvisioner } from '../src/identity-provisioning.mjs'
import { createClerkIdentityAuthenticator } from '../src/identity-provider.mjs'
import { renewalSchemaDigest, renewalSchemaUrl } from '../src/identity-renewal.mjs'
import { clerkFixture, postgresFixture } from './fixtures/identity-profile-postgres.mjs'

const peer = 'https://sg2.example.test'
const request = origin => new Request(origin + '/v1/account/renew', { method: 'POST', headers: { authorization: 'Bearer synthetic_fixture_only' } })
test('peer renewal is a distinct exact POST admission, never a reusable peer read policy', async () => {
  const f = clerkFixture(), base = { appId:'test',environment:'development',issuer:f.issuer,authorizedParties:[f.origin,peer] }
  for (const path of ['/v1/account','/v1/registration/start','/anything']) assert.throws(() => createClerkIdentityAuthenticator({ client:f.client,application:{...base,bearerPeerRenewals:[{sourceOrigin:peer,targetOrigin:f.origin,path}]},resolveBinding:async()=>null }))
  const original = f.client.authenticateRequest
  f.client.authenticateRequest = async (...args) => { const s=await original(...args),a=s.toAuth(); return {...s,toAuth:()=>({...a,sessionClaims:{...a.sessionClaims,azp:peer}})} }
  let bindingReads=0
  const authenticate = createClerkIdentityAuthenticator({client:f.client,application:{...base,bearerPeerRenewals:[{sourceOrigin:peer,targetOrigin:f.origin,path:'/v1/account/renew'}]},resolveBinding:async()=>{bindingReads++;return null}})
  for(const req of [new Request(f.origin+'/v1/account'),new Request(f.origin+'/v1/account/renew'),new Request(f.origin+'/v1/account/renew?x=1',{method:'POST',headers:{authorization:'Bearer synthetic_fixture_only'}})]) await authenticate(req)
  assert.equal(bindingReads,0)
  await authenticate(request(f.origin));assert.equal(bindingReads,1)
})
test('ordinary-role peer renewal survives token rotation without provisioning or granting access', async t => {
  const db=await postgresFixture();t.after(()=>db.close())
  await db.admin.query('BEGIN')
  await db.admin.query(fs.readFileSync(new URL(renewalSchemaUrl),'utf8'))
  await db.admin.query("INSERT INTO profitia_profile.binding_renewal_installation VALUES(true,'1.0.0',$1)",[renewalSchemaDigest()])
  await db.admin.query(`GRANT EXECUTE ON FUNCTION profitia_profile.binding_renewal_descriptor(),profitia_profile.binding_renewal_metadata(text,text,bigint,bigint,text),profitia_profile.renew_binding(text,text,text,text,bigint,bigint,bigint,text) TO identity_b1_runtime`)
  await db.admin.query('UPDATE profitia_profile.runtime_policies SET allow_binding_renewal=true,allow_expired_binding_recovery=true,expired_recovery_max_age_ms=604800000')
  await db.admin.query('COMMIT')
  const f=clerkFixture('user_peer_renewal'),options=db.options(f)
  const userId=(await createIdentityProvisioner(options).ensureAccount(f.request('POST'))).userId
  const original=f.client.authenticateRequest
  f.client.authenticateRequest=async(...args)=>{const s=await original(...args),a=s.toAuth();return {...s,toAuth:()=>({...a,sessionClaims:{...a.sessionClaims,azp:peer}})}}
  const renewalOptions={...options,renewalSchemaDigest:renewalSchemaDigest(),existingOnly:true,identityApplication:{...options.identityApplication,authorizedParties:[f.origin,peer],bearerPeerRenewals:[{sourceOrigin:peer,targetOrigin:f.origin,path:'/v1/account/renew'}]}}
  const renew=()=>createIdentityProvisioner(renewalOptions).ensureAccount(request(f.origin))
  for(let rotation=0;rotation<3;rotation++){
    await db.admin.query("UPDATE profitia_access.external_identities SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",[userId])
    assert.equal((await renew()).userId,userId)
    const after=(await db.admin.query('SELECT expires_at FROM profitia_access.external_identities WHERE user_id=$1',[userId])).rows[0]
    assert(after.expires_at.getTime()>Date.now());assert(after.expires_at.getTime()<=Date.now()+60000)
  }
  const counts=(await db.admin.query(`SELECT (SELECT count(*)::int FROM profitia_access.accounts) accounts,(SELECT count(*)::int FROM profitia_access.memberships) memberships,(SELECT count(*)::int FROM profitia_access.product_grants) grants`)).rows[0]
  assert.deepEqual(counts,{accounts:1,memberships:0,grants:0})
  f.subject='user_missing_peer';await assert.rejects(renew())
  assert.equal((await db.admin.query('SELECT count(*)::int n FROM profitia_access.accounts')).rows[0].n,1)
  f.subject='user_peer_renewal';f.active=false;await assert.rejects(renew())
})
