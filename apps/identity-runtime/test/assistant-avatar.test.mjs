import test from 'node:test'
import assert from 'node:assert/strict'
import { configuration } from './fixtures.mjs'
import { createAssistantAvatarSurface } from '../dist/src/assistant-avatar.js'
import { accountTransactions } from '../dist/src/account-provisioning.js'
import { createHttpHandler } from '../dist/src/http-handler.js'
import { createNodeServer } from '../dist/src/node-server.js'
import { createIdentityProvisioner } from '../../../packages/platform-contracts/src/identity-provisioning.mjs'
import { postgresFixture, clerkFixture } from '../../../packages/platform-contracts/test/fixtures/identity-profile-postgres.mjs'

test('avatar HTTP surface uses verified E1 account, ordinary SQL and closed projection', async t => {
  const db = await postgresFixture(); t.after(() => db.close())
  const a=clerkFixture(),b=clerkFixture('user_synthetic_b')
  const cfg=configuration({applicationId:db.binding.applicationId})
  const raw=a.client.users.getUser
  a.client.users.getUser=async id=>({...await raw(id),primaryEmailAddressId:'primary',emailAddresses:[{id:'primary',verification:{status:a.unverified?'unverified':'verified'}}]})
  await createIdentityProvisioner(db.options(a)).ensureAccount(a.request('POST'))
  await createIdentityProvisioner(db.options(b)).ensureAccount(b.request('POST'))
  // Exercise the production pg transaction adapter, not the fixture shortcut.
  const surface=createAssistantAvatarSurface({...db.options(a),transact:accountTransactions(db.pool),configuration:cfg,deploymentId:'fixture',configurationVersion:'fixture'})
  const handler=createHttpHandler({configuration:cfg},{},surface)
  const request=(method='GET',body,headers={})=>new Request(cfg.origin+'/v1/account/assistant-avatar',{method,headers:{authorization:'Bearer synthetic-fixture',...(method==='POST'?{origin:cfg.origin,'content-type':'application/json'}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const initialResponse=await handler(request())
  assert.equal(initialResponse.status,200)
  const initial=await initialResponse.json()
  assert.equal(initial.avatarSex,null)
  const response=await handler(request('POST',{expectedVersion:initial.version,avatarSex:'male'}))
  assert.equal(response.status,200);const saved=await response.json()
  assert.equal(saved.avatarSex,'male');assert.deepEqual(Object.keys(saved).sort(),['avatarSex','userId','version'])
  assert.equal(response.headers.get('cache-control'),'private, no-store')
  assert.equal(response.headers.get('access-control-allow-origin'),null)
  assert.equal((await handler(request('POST',{expectedVersion:initial.version,avatarSex:'female'}))).status,409)
  const initialized=await handler(request('POST',{expectedVersion:null,avatarSex:'female'}))
  assert.equal(initialized.status,200);assert.equal((await initialized.json()).avatarSex,'male')
  for(const value of [{userId:'foreign',avatarSex:'female',expectedVersion:saved.version},{avatarSex:'other',expectedVersion:saved.version},{avatarSex:'female',expectedVersion:'0'},{avatarSex:'female',expectedVersion:'9223372036854775808'},{}])assert.equal((await handler(request('POST',value))).status,400)
  for(const method of ['PUT','PATCH','DELETE'])assert.equal((await handler(request(method))).status,405)
  assert.equal((await handler(request('POST',{expectedVersion:saved.version,avatarSex:'female'},{origin:cfg.targets.sg2.origin}))).status,403)
  a.origin=cfg.targets.sg2.origin
  assert.equal((await handler(request())).status,200)
  assert.notEqual((await handler(request('POST',{expectedVersion:saved.version,avatarSex:'female'}))).status,200)
  a.origin=cfg.origin;a.active=false;assert.notEqual((await handler(request())).status,200);a.active=true
  a.unverified=true;assert.notEqual((await handler(request())).status,200);a.unverified=false
  // A real HTTP receiver admits the new canonical path, without new CORS or
  // client-controlled routing. The same surface is used by the production main.
  const server=createNodeServer(cfg.origin,handler)
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  try {
    const {request:send}=await import('node:http')
    const body=await new Promise((resolve,reject)=>{const req=send({host:'127.0.0.1',port:server.address().port,path:'/v1/account/assistant-avatar',headers:{host:new URL(cfg.origin).host,authorization:'Bearer synthetic-fixture'}},res=>{let text='';res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,value:JSON.parse(text)}))});req.on('error',reject);req.end()})
    assert.equal(body.status,200);assert.equal(body.value.avatarSex,'male')
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
})
