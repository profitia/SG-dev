import test from 'node:test'
import assert from 'node:assert/strict'
import {createEmailRecipientVerifier} from '../dist/src/email-correlation.js'
test('signed user ID and exact provider email ID required; never select latest signup or search by recipient',async()=>{
  let calls=0
  const user={id:'user_bound123',emailAddresses:[{id:'idn_bound123',emailAddress:'Known@example.test'}]}
  const verify=createEmailRecipientVerifier({users:{getUser:async id=>{calls++;assert.equal(id,user.id);return user}}})
  const instruction={providerUserId:user.id,emailAddressId:'idn_bound123',recipient:'Known@example.test'}
  assert.equal(await verify(instruction),'bound')
  for(const extra of [{emailAddressId:null},{emailAddressId:'idn_other123'},{recipient:'known@example.test'},{recipient:'other@example.test'}]) assert.equal(await verify({...instruction,...extra}),'rejected')
  const before=calls
  assert.equal(await verify({...instruction,providerUserId:null,avatar:'male',unsafeMetadata:{assistantAvatar:'female'}}),'unbound')
  assert.equal(calls,before)
  for(const field of ['banned','locked','deprovisioned']){user[field]=true;assert.equal(await verify(instruction),'rejected');delete user[field]}
  user.id='user_foreign123';assert.equal(await verify({...instruction,providerUserId:user.id,emailAddressId:'idn_foreign123'}),'rejected')
})
