import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createOrganisationInvitationProof,organisationInvitationTokenHash,organisationInvitationProofMatches,createOrganisationInvitationLinkBuilder,ORGANISATION_INVITATION_LIFETIME_MS} from '../src/organisation-invitations.mjs'

test('invitation proof is opaque, independently random, hash-only at rest and valid for seven days',()=>{
 const now=Date.parse('2026-11-11T08:00:00Z'),values=Array.from({length:100},()=>createOrganisationInvitationProof({now:()=>now}))
 assert.equal(new Set(values.map(v=>v.token)).size,100)
 assert.equal(new Set(values.map(v=>v.tokenHash)).size,100)
 for(const value of values){
  assert(Object.isFrozen(value));assert.match(value.token,/^sgi1_[A-Za-z0-9_-]{43}$/)
  assert.match(value.tokenHash,/^[a-f0-9]{64}$/)
  assert.equal(Date.parse(value.expiresAt)-now,ORGANISATION_INVITATION_LIFETIME_MS)
  assert.equal(value.expiresAt,'2026-11-18T08:00:00.000Z')
  assert.equal(value.tokenHash,organisationInvitationTokenHash(value.token))
  assert(organisationInvitationProofMatches(value.token,value.tokenHash))
  assert.notEqual(value.tokenHash,createHash('sha256').update(value.token).digest('hex'))
 }
 assert(!organisationInvitationProofMatches(values[0].token,values[1].tokenHash))
})
test('proof parser rejects noncanonical encodings, alternate versions, metadata and oversized inputs',()=>{
 const value=createOrganisationInvitationProof()
 const suffix=value.token.slice(-1),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
 const index=alphabet.indexOf(suffix),alternative=value.token.slice(0,-1)+alphabet[index+1]
 // Non-zero unused base64 bits decode to the same bytes but must not create aliases.
 assert.deepEqual(Buffer.from(alternative.slice(5),'base64url'),Buffer.from(value.token.slice(5),'base64url'))
 for(const token of [null,{},42,'',value.token+'=',value.token+'x','sgi2_'+value.token.slice(5),value.token+'\n',' '+value.token,
  value.token+'?organisationId=foreign',alternative,'x'.repeat(100000)]){
  assert.throws(()=>organisationInvitationTokenHash(token),/Invalid organisation invitation proof/)
  assert(!organisationInvitationProofMatches(token,value.tokenHash))
 }
 for(const hash of [null,{},value.tokenHash.toUpperCase(),value.tokenHash+'0','0'.repeat(64)])assert(!organisationInvitationProofMatches(value.token,hash))
})
test('invitation URL is fixed to reviewed Identity origin, with no tenant, email or return URL authority',()=>{
 const origin='https://identity-runtime-development.onrender.com',allowed=[origin,'https://spendguru.app']
 const builder=createOrganisationInvitationLinkBuilder({identityOrigin:origin,allowedIdentityOrigins:allowed})
 allowed[0]='https://attacker.example'
 const value=createOrganisationInvitationProof(),url=new URL(builder.build(value.token))
 assert.equal(url.origin,origin);assert.equal(url.pathname,'/invite');assert.equal(url.searchParams.get('proof'),value.token)
 assert.deepEqual([...url.searchParams.keys()],['proof']);assert.equal(url.hash,'')
 assert.throws(()=>builder.build(value.token+'#x'))
 for(const identityOrigin of ['https://attacker.example','http://spendguru.app','https://spendguru.app/','https://spendguru.app/invite','https://spendguru.app?next=x',
  'https://spendguru.app#fragment','https://user:password@spendguru.app','https://SPENDGURU.app','//spendguru.app','https://spendguru.app:443']){
  assert.throws(()=>createOrganisationInvitationLinkBuilder({identityOrigin,allowedIdentityOrigins:['https://spendguru.app']}))
 }
 assert.throws(()=>createOrganisationInvitationLinkBuilder({identityOrigin:origin,allowedIdentityOrigins:[]}))
 assert.throws(()=>createOrganisationInvitationLinkBuilder({identityOrigin:origin,allowedIdentityOrigins:[origin],returnUrl:'https://attacker.example'}))
})
test('caller cannot choose raw token, lifetime, invitation identity, organisation or random generator',()=>{
 for(const patch of [{token:'chosen'},{lifetimeMs:1},{organisationId:'foreign'},{userId:'victim'},{randomBytes:()=>Buffer.alloc(32)}]){
  assert.throws(()=>createOrganisationInvitationProof(patch))
 }
 for(const timestamp of [NaN,Infinity,-1,1.5,8640000000000000]){
  assert.throws(()=>createOrganisationInvitationProof({now:()=>timestamp}))
 }
})
