import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProfilePatch } from '../src/user-profile.mjs'

test('avatar preference and optional fields normalize without granting roles or verification', () => {
  assert.deepEqual(normalizeProfilePatch({avatar_sex:'female',job:'  Engineer  ',phone:'+1 (202) 555-0123'}),{avatar_sex:'female',job:'Engineer',phone:'+12025550123'})
  assert.deepEqual(normalizeProfilePatch({avatar_sex:null,job:' ',phone:''}),{avatar_sex:null,job:null,phone:null})
  assert.equal(normalizeProfilePatch({job:'e\u0301'}).job,'é')
  assert.equal(Object.isFrozen(normalizeProfilePatch({avatar_sex:'male'})),true)
})
for (const patch of [{avatar_sex:'other'},{avatar_sex:true},{job:'x'.repeat(161)},{job:'bad\u0000value'},{job:'bad\u202evalue'},
  {phone:'2025550123'},{phone:'+99912345678'},{phone:'+12025550123 ext 1'},{phone:'call +12025550123'},{phone:'+12025550123456789'},
  {user_id:'foreign'},{version:'2'},{created_at:'today'},{updated_at:'today'},{status:'ACTIVE'},{role:'admin'},{job:'x',phone:undefined},{}]) {
  test('closed patch rejects invalid/system input '+Object.keys(patch).join(','),()=>assert.throws(()=>normalizeProfilePatch(patch)))
}
test('accessors, inherited fields and symbol properties are refused before evaluation',()=>{
  let touched=false
  assert.throws(()=>normalizeProfilePatch(Object.defineProperty({},'job',{get(){touched=true;return 'x'},enumerable:true})))
  assert.equal(touched,false)
  assert.throws(()=>normalizeProfilePatch(Object.assign(Object.create({role:'admin'}),{job:'x'})))
  assert.throws(()=>normalizeProfilePatch({job:'x',[Symbol('foreign')]:'x'}))
})
