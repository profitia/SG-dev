import test from 'node:test'
import assert from 'node:assert/strict'
import {currentE1Fixture,U,A} from '../../../packages/platform-contracts/test/fixtures/current-e1-authority-postgres.mjs'
import {createAuthorizer as hubAuthorizer} from '../src/auth.mjs'
import {createAuthorizer as newsfeedAuthorizer} from '../../newsfeed-runtime/src/auth.mjs'
import {createRepository} from '../../newsfeed-runtime/src/repository.mjs'
test('SYNTHETIC_ONLY: both accepted backend authorizers use the same current E1 producer and protect CRUD by observation ID',async t=>{
 const f=await currentE1Fixture(),original=globalThis.fetch;globalThis.fetch=f.transport;t.after(async()=>{globalThis.fetch=original;await f.close()})
 const config=i=>({...f.bindings[i],runtimeRole:f.bindings[i].role,identityIssuer:f.issuer,authorizedParties:[f.origin],requiredProduct:'SPENDGURU',deploymentId:'SYNTHETIC_ONLY',configurationVersion:'fixture-v1'})
 const hub=await hubAuthorizer(config(1),f.db(1),{clerkClient:f.client,currentAuthority:true}),nf=await newsfeedAuthorizer(config(2),f.db(2),{clerkClient:f.client,currentAuthority:true}),repo=createRepository(config(2),f.db(2))
 assert.equal(await hub.ready(),true);assert.equal(await nf.ready(),true)
 const request=f.request(),args={request,organisationId:A,resourceId:'newsfeed-observations',write:true}
 const observation=await nf.execute(args,(c,tx)=>repo.create(tx,c,{name:'SYNTHETIC_ONLY',subjectKind:'topic',subject:'fixture',request:{contractVersion:'1.0.0',family:'news-discovery',provider:'newsapi',operation:'search',criteria:{mode:'articles',text:'SYNTHETIC_ONLY'}}}))
 assert.equal(observation.ownerUserId,U)
 assert.equal((await nf.execute({...args,resourceId:observation.id,write:false},(c,tx)=>repo.get(tx,c,observation.id))).id,observation.id)
 assert.equal((await nf.execute({...args,resourceId:observation.id},(c,tx)=>repo.update(tx,c,observation.id,{version:1,name:'changed'}))).version,2)
 await assert.rejects(nf.execute({...args,resourceId:observation.id,request:f.request('SYNTHETIC_B'),write:false},(c,tx)=>repo.get(tx,c,observation.id)),{code:'OBSERVATION_NOT_FOUND'})
 assert.equal(await hub.execute({request,organisationId:A,resourceId:'source-hub-private'},async(c,tx)=>(await tx.query('SELECT profitia_e1_receiver.scope_allows($1,$2::uuid,$3::uuid) AS allowed',[c.applicationId,c.organisationId,c.actorId])).rows[0].allowed),true)
 await f.asOwner(0,c=>c.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U]))
 for(const [auth,resourceId] of[[hub,'source-hub-private'],[nf,observation.id]])await assert.rejects(auth.execute({request,organisationId:A,resourceId},()=>{throw Error('MUST_NOT_EXECUTE')}))
 assert.equal(f.clerkState.calls.filter(x=>x==='sdk').length,f.transportState.calls)
})
