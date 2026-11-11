import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {firstPartyFixture,U,V,A,B} from './fixtures/first-party-source-postgres.mjs';
import {operationPayloadDigest,isOperationDenied} from '../src/operation-context.mjs';
import {createRecurringSigner,createRecurringOperationHost,recurringSchemaDigest} from '../current-e1-authority/recurring.mjs';
const load=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
test('SYNTHETIC_ONLY: current central private recurrence, SERVICE identity and SQL receiver isolation',async t=>{
 const f=await firstPartyFixture();try{
  await f.asOwner(0,async q=>{
   await q.query(load('../current-e1-authority/migrations/012-recurring-authority.sql'));
   await q.query('INSERT INTO profitia_e1_authority.recurring_installation VALUES(true,$1)',[recurringSchemaDigest('authority')]);
   await q.query('GRANT EXECUTE ON FUNCTION profitia_e1_authority.recurring_ready(),profitia_e1_authority.recurring_consent(text,jsonb,jsonb),profitia_e1_authority.recurring_identity(text,text,jsonb),profitia_e1_authority.issue_recurring(text,text,text,jsonb,jsonb,jsonb) TO identity_b1_runtime');
   await q.query("INSERT INTO profitia_e1_authority.recurring_executors(component_id,key_id,owner_application_id,operation,status,source_ref,expires_at) VALUES($1,'synthetic-key',$2,'newsfeed.monitor.execute','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[f.components.report.id,f.apps[2]]);
  });
  await f.asOwner(2,async q=>{
   await q.query(load('../current-e1-authority/migrations/013-recurring-receiver.sql'));
   await q.query('INSERT INTO profitia_e1_receiver.recurring_installation VALUES(true,$1)',[recurringSchemaDigest('receiver')]);
   await q.query('GRANT EXECUTE ON FUNCTION profitia_e1_receiver.recurring_descriptor(),profitia_e1_receiver.recurring_challenge(jsonb,text),profitia_e1_receiver.recurring_accept(jsonb),profitia_e1_receiver.recurring_scope(uuid,uuid,uuid,bigint,text),profitia_e1_receiver.recurring_audit(jsonb) TO newsfeed_development_runtime');
   await q.query('CREATE SCHEMA synthetic_recurring AUTHORIZATION profitia_access_owner');await q.query('GRANT USAGE ON SCHEMA synthetic_recurring TO newsfeed_development_runtime');
   await q.query('CREATE TABLE synthetic_recurring.effects(job_id uuid PRIMARY KEY,org uuid NOT NULL,owner_id uuid NOT NULL,resource uuid NOT NULL,version bigint NOT NULL)');
   await q.query('ALTER TABLE synthetic_recurring.effects ENABLE ROW LEVEL SECURITY');await q.query('ALTER TABLE synthetic_recurring.effects FORCE ROW LEVEL SECURITY');
   await q.query('CREATE POLICY owner ON synthetic_recurring.effects TO profitia_access_owner USING(true) WITH CHECK(true)');
   await q.query("CREATE POLICY bound_service ON synthetic_recurring.effects FOR INSERT TO newsfeed_development_runtime WITH CHECK(profitia_e1_receiver.recurring_scope(org,owner_id,resource,version,'EFFECT'))");
   await q.query('GRANT INSERT ON synthetic_recurring.effects TO newsfeed_development_runtime');
  });
  const instant=Date.now(),slot=new Date(Math.floor(instant/60000)*60000).toISOString(),date=slot.slice(0,10),time=slot.slice(11,16);
  const schedule={frequency:'DAILY',timeZone:'UTC',localTime:time,startDate:date,endDate:null,weekdays:[],monthDay:null,dstPolicy:'SKIP_NONEXISTENT_EARLIEST_REPEAT'};
  const resource=randomUUID(),delegationId=randomUUID(),definitionDigest='a'.repeat(64);
  const command={delegationId,organisationId:A,operation:'newsfeed.monitor.execute',resourceId:resource,resourceVersion:'1',definitionDigest,schedule,enabled:true};
  const challenge={binding:f.bindings[2],nonce:'b'.repeat(64),transactionId:'1',organisationId:A,operation:'personal.list.write',resourceId:resource,requestDigest:operationPayloadDigest(command)};
  assert.equal(await f.authority.recurringReady(),true);
  const consent=await f.authority.recurringConsent(new Request(f.authorityOrigin+'/v1/e1/recurring/consent',{method:'POST',headers:{authorization:'Bearer SYNTHETIC_A'}}),{applicationId:f.apps[2],challenge,command,requestOrigin:f.origin});
  assert.equal(JSON.parse(consent.payload).status,'ACTIVE');
  let afterInitial=null,latestProof=null;const calls=[];
  const transport=async(url,options)=>{
   assert.equal(url,f.authorityOrigin+'/v1/e1/recurring/authorize');assert.equal(options.headers.authorization,undefined);
   const input=JSON.parse(options.body);calls.push(input);
   try{latestProof=await f.authority.authorizeRecurring(new Request(url,{method:'POST',headers:options.headers}),input);if(input.previous===null&&afterInitial)await afterInitial();return Response.json(latestProof)}catch(e){return Response.json({error:e.reasonCode},{status:403})}
  };
  const signer=createRecurringSigner({environment:'development',authorityOrigin:f.authorityOrigin,componentId:f.components.report.id,keyId:'synthetic-key',privateKey:f.components.report.key.privateKey});
  const application={...f.application(2),identityIssuer:'urn:profitia:database-service-runtime:v1',operations:['newsfeed.monitor.execute']};
  const host=createRecurringOperationHost({application,binding:f.bindings[2],independentQuery:f.db(2).query,transact:f.db(2).transact,signer,fetch:transport,
   readResource:async(_q,p)=>({id:p.request.resourceId,type:'private_recurring_job',dataClass:'USER_IN_ORGANISATION_PRIVATE',environment:'development',ownerOrganisationId:p.state.recurringDelegation.organisationId,ownerUserId:p.state.recurringDelegation.ownerUserId,version:p.state.recurringDelegation.resourceVersion,projectionVersion:'synthetic-recurring-v1'})});
  const input=()=>({operation:'newsfeed.monitor.execute',organisationId:A,resourceId:randomUUID(),payload:{delegationId,resourceId:resource,resourceVersion:'1',definitionDigest,leaseId:randomUUID(),claimedAt:new Date().toISOString(),slotAt:slot,scheduleSlot:date+'T'+time+'@UTC',phase:'EFFECT'}});
  const execute=(i,owner=U,org=A)=>host.execute(i,async(ctx,tx)=>{assert.equal(ctx.actorKind,'SERVICE');assert.equal(ctx.actorId,f.serviceId);assert.equal(ctx.subjectUserId,U);await tx.query('INSERT INTO synthetic_recurring.effects VALUES($1,$2,$3,$4,1)',[i.resourceId,org,owner,resource]);return{recorded:true}});
  await t.test('SERVICE observes actual account without a fabricated session and commits a bound row',async()=>{
   const sessionCalls=f.clerkState.calls.filter(x=>x==='session').length;const value=await execute(input());assert.equal(value.recorded,true);assert.equal(calls.length,2);assert.equal(f.clerkState.calls.filter(x=>x==='session').length,sessionCalls);
  });
  await t.test('SQL denies a different private owner and organisation',async()=>{await assert.rejects(execute(input(),V));await assert.rejects(execute(input(),U,B))});
  await t.test('transaction proof cannot replay in another SQL transaction',async()=>{
   await assert.rejects(f.db(2).transact(async({query})=>query('SELECT profitia_e1_receiver.recurring_accept($1::jsonb)',[JSON.stringify(latestProof)])));
  });
  for(const [label,sql,restore] of [
   ['membership',"UPDATE profitia_access.memberships SET status='REVOKED' WHERE organisation_id=$1 AND user_id=$2","UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2"],
   ['permission',"UPDATE profitia_access.permission_grants SET effect='DENY' WHERE organisation_id=$1 AND user_id=$2 AND application_id='"+f.apps[2]+"' AND operation='personal.list.write'","UPDATE profitia_access.permission_grants SET effect='ALLOW' WHERE organisation_id=$1 AND user_id=$2 AND application_id='"+f.apps[2]+"' AND operation='personal.list.write'"]
  ]){
   await t.test(label+' revocation rolls back a staged private effect',async()=>{
    const i=input();afterInitial=()=>f.asOwner(0,q=>q.query(sql,[A,U]));await assert.rejects(execute(i));afterInitial=null;
    assert.equal((await f.databases[2].query('SELECT count(*) FROM synthetic_recurring.effects WHERE job_id=$1',[i.resourceId])).rows[0].count,'0');
    await f.asOwner(0,q=>q.query(restore,[A,U]));
   });
  }
  await t.test('key revocation is observed before commit',async()=>{const i=input();afterInitial=()=>f.asOwner(0,q=>q.query("UPDATE profitia_e1_authority.source_components SET status='REVOKED' WHERE component_id=$1",[f.components.report.id]));await assert.rejects(execute(i));afterInitial=null;assert.equal((await f.databases[2].query('SELECT count(*) FROM synthetic_recurring.effects WHERE job_id=$1',[i.resourceId])).rows[0].count,'0')});
 }finally{await f.close()}
});

