import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {supplierWorkspaceFixture} from './fixtures/supplier-workspace-postgres.mjs';
test('workspace native authority uses canonical Root, actual transactions and the existing RLS master',async t=>{
 const f=await supplierWorkspaceFixture();
 try{
  await t.test('installation gives no runtime execution privilege or organization enrollment',async()=>{
   assert.deepEqual(f.noImplicitGrant,{granted:false,policies:0});
   await assert.rejects(f.execute(),e=>e.reasonCode==='PERMISSION_DENIED');
   assert.equal(await f.count(),0);
  });
  await f.enrol();
  await t.test('write and fresh same-organization member read share one persistent master',async()=>{
   const created=await f.execute({operation:'supplier.catalog.write',payload:{command:'SUPPLIER_CREATE',data:{supplierId:f.S,nip:'5272443955',name:'Synthetic A'}}});
   assert.equal(created.result.value.rows.length,1);
   const read=await f.execute({user:f.V});
   assert.equal(read.result.value.rows[0].id,f.S);
   assert.equal(read.result.value.descriptor.organisationId,f.A);
   assert.equal(read.result.value.descriptor.actorAccountId,f.V);
   assert.deepEqual(read.clerk.calls,['sdk','session','user','session','user']);
  });
  await t.test('foreign actor cannot select the other organization even with an existing id',async()=>{
   await assert.rejects(f.execute({user:f.W,org:f.A,payload:{kind:'SUPPLIER_CARD',supplierId:f.S}}));
   await f.enrol(f.B);
   const read=await f.execute({user:f.W,org:f.B});
   assert.deepEqual(read.result.value.rows,[]);
   assert.equal(await f.count(),1);
  });
  await t.test('forged GUCs and ordinary direct master writes do not acquire the closed path',async()=>{
   const c=await f.pool.connect();
   try{
    await c.query('BEGIN');
    await c.query("SELECT set_config('srm.organization_id',$1,true),set_config('profitia.organisation_id',$1,true),set_config('profitia.user_id',$2,true),set_config('profitia.supplier_workspace.scope',$3,true)",[f.A,f.U,randomUUID()]);
    assert.equal((await c.query('SELECT profitia_supplier_workspace.descriptor() AS d')).rows[0].d,null);
    await assert.rejects(c.query("INSERT INTO srm.suppliers(organization_id,nip) VALUES($1,'5213390341')",[f.A]),e=>e.code==='42501');
    await c.query('ROLLBACK');
   }finally{c.release()}
   assert.equal(await f.count(),1);
  });
  await t.test('wrong exact schema or source refuses a native lease',async()=>{
   for(const k of ['wrongSchema','wrongSource'])await assert.rejects(f.execute({[k]:true}),e=>e.reasonCode==='POLICY_UNAVAILABLE');
  });
  await t.test('domain input substitution cannot borrow a genuine intent',async()=>{
   await assert.rejects(f.execute({payload:{kind:'SUPPLIERS'},forgePayload:{command:'SUPPLIER_CREATE',data:{supplierId:randomUUID(),nip:'5213390341',name:'Forbidden'}}}));
   assert.equal(await f.count(),1);
  });
  await t.test('provider revocation after domain SQL rolls back the write before disclosure',async()=>{
   let reached=false;
   await assert.rejects(f.execute({operation:'supplier.catalog.write',payload:{command:'SUPPLIER_CREATE',data:{supplierId:randomUUID(),nip:'5213390341',name:'Revoke'}},
    afterDomain:({clerk})=>{reached=true;clerk.active=false}}));
   assert.equal(reached,true);assert.equal(await f.count(),1);
  });
  await t.test('failed canonical OUTCOME leaves no committed domain effect',async()=>{
   await assert.rejects(f.execute({operation:'supplier.catalog.write',payload:{command:'SUPPLIER_CREATE',data:{supplierId:randomUUID(),nip:'5213390341',name:'Audit rollback'}},failOutcome:true}));
   assert.equal(await f.count(),1);
  });

  await t.test('native scope cannot cross a connection or be replayed in a later transaction',async()=>{
   let marker;
   await f.execute({afterDomain:async({client})=>{
    marker=(await client.query("SELECT current_setting('profitia.supplier_workspace.scope') AS marker")).rows[0].marker;
    const c=await f.pool.connect();try{
     await c.query('BEGIN');await c.query("SELECT set_config('profitia.supplier_workspace.scope',$1,true)",[marker]);
     assert.equal((await c.query('SELECT profitia_supplier_workspace.descriptor() AS d')).rows[0].d,null);
     await c.query('ROLLBACK');
    }finally{c.release()}
   }});
   const c=await f.pool.connect();try{
    await c.query('BEGIN');await c.query("SELECT set_config('profitia.supplier_workspace.scope',$1,true)",[marker]);
    assert.equal((await c.query('SELECT profitia_supplier_workspace.descriptor() AS d')).rows[0].d,null);
    await c.query('ROLLBACK');
   }finally{c.release()}
  });
  await t.test('assignment WRITE cannot borrow catalogue WRITE even when the member has both grants',async()=>{
   let reached=false;
   await assert.rejects(f.execute({operation:'supplier.assignment.write',payload:{command:'MEMBERSHIP_ADD',data:{}},
    afterDomain:async({client})=>{reached=true;await client.query('SELECT srm.workspace_test_crosswrite($1,$2)',[f.A,f.S])}}));
   assert.equal(reached,true);assert.equal((await f.execute({user:f.V})).result.value.rows[0].name,'Synthetic A');
  });
  await t.test('READ unit cannot promote a separately granted write operation',async()=>{
   await assert.rejects(f.execute({afterDomain:({client})=>client.query('SELECT srm.workspace_test_crosswrite($1,$2)',[f.A,f.S])}));
   assert.equal(await f.count(),1);
  });
  await t.test('SQL authority expires after the effect and refuses COMMIT',async()=>{
   await f.controlled(c=>c.query("UPDATE profitia_access.memberships SET expires_at=clock_timestamp()+interval '500 milliseconds' WHERE organisation_id=$1 AND user_id=$2",[f.A,f.U]));
   let reached=false;
   await assert.rejects(f.execute({operation:'supplier.catalog.write',payload:{command:'SUPPLIER_CREATE',data:{supplierId:randomUUID(),nip:'5213390341',name:'Expiry'}},
    afterDomain:async()=>{reached=true;await new Promise(r=>setTimeout(r,600))}}));
   assert.equal(reached,true);assert.equal(await f.count(),1);
   await f.controlled(c=>c.query("UPDATE profitia_access.memberships SET expires_at=clock_timestamp()+interval '1 hour' WHERE organisation_id=$1 AND user_id=$2",[f.A,f.U]));
  });
  await t.test('an explicit read DENY overrides the organization feature grant and card disclosure',async()=>{
   await f.deny('supplier.adp-status.read');
   await assert.rejects(f.execute({payload:{kind:'SUPPLIER_CARD',supplierId:f.S}}),e=>e.reasonCode==='EXPLICIT_DENY');
   const other=await f.execute({user:f.V});
   assert.equal(other.result.value.rows[0].id,f.S);
  });
 }finally{await f.close()}
});
