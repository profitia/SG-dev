// SYNTHETIC ONLY. Actual native Root/SQL and SRM receiver; no live URL/accounts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {parseWorkspaceCommand,parseWorkspaceRead,operationForCommand,operationForRead} from '../src/server/supplier-pipelines-contract.ts';
const producer=process.env.SRM_WORKSPACE_FIXTURE_ROOT??fileURLToPath(new URL('../../../',import.meta.url));
const fixtureFile=path.join(producer,'packages/platform-contracts/test/fixtures/supplier-workspace-postgres.mjs');
if(!fs.existsSync(fixtureFile))throw Error('Exact Supplier Workspace producer fixture required; no fixture-free acceptance');
const {supplierWorkspaceFixture}=await import(pathToFileURL(fixtureFile).href);
const schema=fs.readFileSync(new URL('../db/private-store/supplier-pipelines-v1.sql',import.meta.url),'utf8');
const receiver=fs.readFileSync(new URL('../db/private-store/supplier-pipelines-commands-v1.sql',import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const nipFor=n=>{for(;;n++){const nine=String(990000000+n).slice(-9),sum=[6,5,7,2,3,4,5,6,7].reduce((a,w,i)=>a+w*Number(nine[i]),0)%11;if(sum!==10)return nine+sum;}};
async function businessFixture(){
 const f=await supplierWorkspaceFixture();
 try{
  await f.controlled(async c=>{
   await c.query("SELECT set_config('profitia.install.source_sha',$1,true),set_config('profitia.install.schema_digest',$2,true),set_config('profitia.install.commands_digest',$3,true)",['b'.repeat(40),hash(schema),hash(receiver)]);
   await c.query(schema);await c.query(receiver);
  });
  await f.enrol();
  return f;
 }catch(e){await f.close();throw e}
}
test('SRM closed receiver persists the accepted catalogue and independent process lifecycle',async t=>{
 const f=await businessFixture();
 let serial=0;
 const invoke=async(payload,user=f.U,org=f.A)=>{
  const write=Object.hasOwn(payload,'command'),operation=write?operationForCommand(payload.command):operationForRead(payload);
  return(await f.execute({payload,operation,user,org})).result.value;
 };
 const write=(command,data,{key='srm_fixture_'+(++serial),user=f.U,org=f.A}={})=>invoke(parseWorkspaceCommand({contractVersion:'1.0.0',idempotencyKey:key,command,data}),user,org);
 const read=(query,user=f.U,org=f.A)=>invoke(parseWorkspaceRead(query),user,org);
 const ok=r=>{assert.equal(r.ok,true,JSON.stringify(r));return r.result};
 const bad=(r,code,status)=>{assert.equal(r.ok,false,JSON.stringify(r));assert.equal(r.code,code);if(status)assert.equal(r.status,status)};
 let supplier,asphalt,concrete,supplierProcess,otherSupplierProcess,asphalt2,catA,catB,asphaltMember,concreteMember,supplierMember;
 try{
  await t.test('required NIP, same normalized identity, duplicate link and second-member persistent read',async()=>{
   const n=nipFor(1);
   supplier=ok(await write('SUPPLIER_CREATE',{nip:n.slice(0,3)+'-'+n.slice(3),displayName:'Synthetic  Supplier  A',contacts:[{name:'Synthetic Contact',email:'fixture@example.test'}],relationshipOwnerAccountId:f.V}));
   assert.equal(supplier.version,1);
   const duplicate=await write('SUPPLIER_CREATE',{nip:n,displayName:'SYNTHETIC S.A.'});
   bad(duplicate,'DUPLICATE_NIP',409);assert.equal(duplicate.existingSupplier.supplierId,supplier.supplierId);
   const card=ok(await read({kind:'SUPPLIER_CARD',supplierId:supplier.supplierId},f.V));
   assert.equal(card.displayName,'Synthetic Supplier A');assert.equal(card.relationshipOwner.accountId,f.V);
   assert.equal(card.adp.status,'UNKNOWN');assert.equal(card.adp.validUntil,undefined);assert.equal(card.contacts.length,1);
   const found=ok(await read({kind:'SUPPLIER_BY_NIP',nip:n},f.V));assert.equal(found.supplierId,supplier.supplierId);
   assert.throws(()=>parseWorkspaceCommand({contractVersion:'1.0.0',idempotencyKey:'invalid_nip',command:'SUPPLIER_CREATE',data:{nip:'',displayName:'x'}}),e=>e.code==='NIP_REQUIRED');
   assert.throws(()=>parseWorkspaceCommand({contractVersion:'1.0.0',idempotencyKey:'invalid_nip',command:'SUPPLIER_CREATE',data:{nip:n.slice(0,9)+(Number(n[9])+1)%10,displayName:'x'}}),e=>e.code==='INVALID_NIP');
  });
  await t.test('category definitions and separate named processes do not tag the supplier automatically',async()=>{
   catA=ok(await write('CATEGORY_CREATE',{name:'Synthetic Asfalt'}));catB=ok(await write('CATEGORY_CREATE',{name:'Synthetic Beton'}));
   const create=(name,kind,categoryId)=>write('PIPELINE_CREATE',{name,kind,...categoryId?{categoryId}:{},stages:[{name:'Nowy'},{name:'W trakcie'},{name:'Gotowy'}]});
   asphalt=ok(await create('Asfalt qualification','CATEGORY',catA.categoryId));
   asphalt2=ok(await create('Asfalt framework','CATEGORY',catA.categoryId));
   concrete=ok(await create('Beton','CATEGORY',catB.categoryId));
   supplierProcess=ok(await create('Supplier qualification','SUPPLIER'));
   otherSupplierProcess=ok(await create('Supplier onboarding','SUPPLIER'));
   asphaltMember=ok(await write('MEMBERSHIP_ADD',{pipelineId:asphalt.pipelineId,supplierId:supplier.supplierId,stageId:asphalt.stages[0].stageId,expectedPipelineVersion:1}));
   concreteMember=ok(await write('MEMBERSHIP_ADD',{pipelineId:concrete.pipelineId,supplierId:supplier.supplierId,stageId:concrete.stages[0].stageId,expectedPipelineVersion:1}));
   ok(await write('MEMBERSHIP_ADD',{pipelineId:asphalt2.pipelineId,supplierId:supplier.supplierId,stageId:asphalt2.stages[0].stageId,expectedPipelineVersion:1}));
   supplierMember=ok(await write('MEMBERSHIP_ADD',{pipelineId:supplierProcess.pipelineId,supplierId:supplier.supplierId,stageId:supplierProcess.stages[0].stageId,expectedPipelineVersion:1}));
   bad(await write('MEMBERSHIP_ADD',{pipelineId:otherSupplierProcess.pipelineId,supplierId:supplier.supplierId,stageId:otherSupplierProcess.stages[0].stageId,expectedPipelineVersion:1}),'ACTIVE_SUPPLIER_ASSIGNMENT_EXISTS',409);
   const card=ok(await read({kind:'SUPPLIER_CARD',supplierId:supplier.supplierId}));assert.equal(card.cardCategories.length,0);assert.equal(card.memberships.length,4);
   const moved=ok(await write('MEMBERSHIP_MOVE',{membershipId:asphaltMember.membershipId,stageId:asphalt.stages[1].stageId,expectedVersion:1,expectedPipelineVersion:2}));
   assert.equal(moved.stageId,asphalt.stages[1].stageId);
   const after=ok(await read({kind:'SUPPLIER_CARD',supplierId:supplier.supplierId},f.V));
   assert.equal(after.memberships.find(x=>x.membershipId===concreteMember.membershipId).stageId,concrete.stages[0].stageId);
   assert.equal(ok(await read({kind:'PIPELINE',pipelineId:concrete.pipelineId})).version,2);
  });
  await t.test('explicit transfer and uncertain-result retry preserve one active supplier process',async()=>{
   const key='atomic_transfer_'+randomUUID().replaceAll('-','');
   const data={supplierId:supplier.supplierId,sourceMembershipId:supplierMember.membershipId,sourceVersion:1,targetPipelineId:otherSupplierProcess.pipelineId,targetStageId:otherSupplierProcess.stages[1].stageId,expectedTargetVersion:1};
   const first=await write('SUPPLIER_TRANSFER',data,{key}),result=ok(first);
   const replay=await write('SUPPLIER_TRANSFER',data,{key});assert.equal(replay.replayed,true);assert.deepEqual(replay.result,result);
   bad(await write('SUPPLIER_TRANSFER',{...data,targetStageId:otherSupplierProcess.stages[2].stageId},{key}),'IDEMPOTENCY_CONFLICT',409);
   const card=ok(await read({kind:'SUPPLIER_CARD',supplierId:supplier.supplierId}));
   assert.equal(card.memberships.filter(x=>x.kind==='SUPPLIER'&&!x.endedAt).length,1);
   assert.equal(card.memberships.filter(x=>x.kind==='CATEGORY'&&!x.endedAt).length,3);
  });
  await t.test('card categories are explicit, CAS protected and independent of participation',async()=>{
   const before=ok(await read({kind:'SUPPLIER_CARD',supplierId:supplier.supplierId}));
   const added=ok(await write('SUPPLIER_CATEGORY_ADD',{supplierId:supplier.supplierId,categoryId:catA.categoryId,expectedVersion:before.version}));
   bad(await write('SUPPLIER_CATEGORY_REMOVE',{supplierId:supplier.supplierId,categoryId:catA.categoryId,expectedVersion:before.version}),'VERSION_CONFLICT',409);
   ok(await write('SUPPLIER_CATEGORY_REMOVE',{supplierId:supplier.supplierId,categoryId:catA.categoryId,expectedVersion:added.version}));
   const after=ok(await read({kind:'SUPPLIER_CARD',supplierId:supplier.supplierId}));assert.equal(after.cardCategories.length,0);
   assert.equal(after.memberships.filter(x=>!x.endedAt).length,4);
  });
  await t.test('occupied-stage removal moves exactly four suppliers atomically and preserves another process',async()=>{
   const process=ok(await write('PIPELINE_CREATE',{name:'Four-company removal',kind:'CATEGORY',categoryId:catA.categoryId,stages:[{name:'Source'},{name:'Target'}]}));
   let version=1;
   for(let i=0;i<4;i++){
    const a=ok(await write('SUPPLIER_CREATE',{nip:nipFor(100+i*10),displayName:'Synthetic batch '+i}));
    version=ok(await write('MEMBERSHIP_ADD',{pipelineId:process.pipelineId,supplierId:a.supplierId,stageId:process.stages[0].stageId,expectedPipelineVersion:version})).pipelineVersion;
   }
   bad(await write('STAGE_REMOVE',{pipelineId:process.pipelineId,stageId:process.stages[0].stageId,targetStageId:process.stages[1].stageId,expectedPipelineVersion:version,expectedCount:3}),'PIPELINE_CHANGED',409);
   const removed=ok(await write('STAGE_REMOVE',{pipelineId:process.pipelineId,stageId:process.stages[0].stageId,targetStageId:process.stages[1].stageId,expectedPipelineVersion:version,expectedCount:4}));
   assert.equal(removed.movedCount,4);
   const page=ok(await read({kind:'PIPELINE',pipelineId:process.pipelineId}));assert.equal(page.stages.length,1);assert.equal(page.activeCount,4);assert.equal(page.memberships.items.length,4);
   assert(page.memberships.items.every(x=>x.stageId===process.stages[1].stageId));
   bad(await write('STAGE_REMOVE',{pipelineId:process.pipelineId,stageId:process.stages[1].stageId,expectedPipelineVersion:page.version,expectedCount:4,targetStageId:process.stages[0].stageId}),'LAST_STAGE',409);
   assert.equal(ok(await read({kind:'PIPELINE',pipelineId:concrete.pipelineId})).version,2);
  });
  await t.test('archival and restoration preserve history without reactivating participants',async()=>{
   const before=ok(await read({kind:'SUPPLIER_CARD',supplierId:supplier.supplierId}));
   const archive=ok(await write('SUPPLIER_ARCHIVE',{supplierId:supplier.supplierId,expectedVersion:before.version,expectedCount:4}));
   const archived=ok(await read({kind:'SUPPLIER_CARD',supplierId:supplier.supplierId}));assert.equal(archived.lifecycle,'ARCHIVED');assert.equal(archived.memberships.filter(x=>!x.endedAt).length,0);
   const restored=ok(await write('SUPPLIER_RESTORE',{supplierId:supplier.supplierId,expectedVersion:archive.version}));assert.equal(restored.lifecycle,'ACTIVE');
   const after=ok(await read({kind:'SUPPLIER_CARD',supplierId:supplier.supplierId}));assert.equal(after.memberships.filter(x=>!x.endedAt).length,0);
   const history=ok(await read({kind:'HISTORY',supplierId:supplier.supplierId}));assert(history.items.some(x=>x.action==='SUPPLIER_TRANSFER'));assert(history.items.some(x=>x.action==='SUPPLIER_ARCHIVE'));
  });
  await t.test('same-NIP racing writes by two members create one master without renaming it',async()=>{
   const n=nipFor(800),responses=await Promise.all([write('SUPPLIER_CREATE',{nip:n,displayName:'Synthetic race A'}),write('SUPPLIER_CREATE',{nip:n,displayName:'Synthetic race B'},{user:f.V})]);
   assert.equal(responses.filter(x=>x.ok).length,1);assert.equal(responses.filter(x=>x.code==='DUPLICATE_NIP').length,1);
   const first=responses.find(x=>x.ok).result,duplicate=responses.find(x=>!x.ok);assert.equal(duplicate.existingSupplier.supplierId,first.supplierId);
   const card=ok(await read({kind:'SUPPLIER_CARD',supplierId:first.supplierId}));assert(['Synthetic race A','Synthetic race B'].includes(card.displayName));
  });
  await t.test('tenant isolation covers lookup, cards and foreign category/stage references',async()=>{
   await f.enrol(f.B);const n=nipFor(1);
   const own=ok(await write('SUPPLIER_CREATE',{nip:n,displayName:'Synthetic B'},{user:f.W,org:f.B}));
   assert.notEqual(own.supplierId,supplier.supplierId);
   assert.equal(ok(await read({kind:'SUPPLIER_BY_NIP',nip:n},f.W,f.B)).supplierId,own.supplierId);
   bad(await read({kind:'SUPPLIER_CARD',supplierId:supplier.supplierId},f.W,f.B),'NOT_FOUND',404);
   bad(await write('PIPELINE_CREATE',{name:'Cross tenant',kind:'CATEGORY',categoryId:catA.categoryId,stages:[{name:'x'}]},{user:f.W,org:f.B}),'NOT_FOUND',404);
   await assert.rejects(read({kind:'SUPPLIER_CARD',supplierId:supplier.supplierId},f.W,f.A));
  });

  await t.test('NIP edits recognize another existing company before confirmation and use optimistic versions',async()=>{
   let a=ok(await read({kind:'SUPPLIER_CARD',supplierId:supplier.supplierId}));
   const other=ok(await write('SUPPLIER_CREATE',{nip:nipFor(950),displayName:'Synthetic existing edit target'}));
   const conflict=await write('SUPPLIER_UPDATE',{supplierId:supplier.supplierId,expectedVersion:a.version,nip:nipFor(950)});
   bad(conflict,'DUPLICATE_NIP',409);assert.equal(conflict.existingSupplier.supplierId,other.supplierId);
   bad(await write('SUPPLIER_UPDATE',{supplierId:supplier.supplierId,expectedVersion:a.version,nip:nipFor(980)}),'FIELD_INVALID',422);
   const changed=ok(await write('SUPPLIER_UPDATE',{supplierId:supplier.supplierId,expectedVersion:a.version,nip:nipFor(980),confirmIdentifierChange:true}));
   assert.equal(ok(await read({kind:'SUPPLIER_CARD',supplierId:supplier.supplierId})).nipNormalized,nipFor(980));
   bad(await write('SUPPLIER_UPDATE',{supplierId:supplier.supplierId,expectedVersion:a.version,displayName:'Stale edit'}),'VERSION_CONFLICT',409);
   const races=await Promise.all([write('SUPPLIER_UPDATE',{supplierId:supplier.supplierId,expectedVersion:changed.version,displayName:'Concurrent A'}),write('SUPPLIER_UPDATE',{supplierId:supplier.supplierId,expectedVersion:changed.version,displayName:'Concurrent B'},{user:f.V})]);
   assert.equal(races.filter(x=>x.ok).length,1);assert.equal(races.filter(x=>x.code==='VERSION_CONFLICT').length,1);
   assert.throws(()=>parseWorkspaceCommand({contractVersion:'1.0.0',idempotencyKey:'absent_nip',command:'SUPPLIER_CREATE',data:{displayName:'x'}}),e=>e.code==='NIP_REQUIRED'&&Boolean(e.fieldErrors.nip));
  });
  await t.test('stage reordering, archived categories and process restoration preserve the accepted lifecycle',async()=>{
   const category=ok(await write('CATEGORY_CREATE',{name:'Synthetic lifecycle category'}));
   let p=ok(await write('PIPELINE_CREATE',{name:'Synthetic lifecycle process',kind:'CATEGORY',categoryId:category.categoryId,stages:[{name:'First'},{name:'Second'}]}));
   p=ok(await write('STAGES_UPDATE',{pipelineId:p.pipelineId,expectedVersion:p.version,stages:[{stageId:p.stages[0].stageId,name:'Second',order:1},{stageId:p.stages[1].stageId,name:'First',order:0}]}));
   assert.equal(p.stages[0].stageId,p.stages.find(x=>x.name==='First').stageId);
   p=ok(await write('STAGE_ADD',{pipelineId:p.pipelineId,expectedVersion:p.version,name:'Middle',order:1}));assert.deepEqual(p.stages.map(x=>x.order),[0,1,2]);
   const catArchived=ok(await write('CATEGORY_ARCHIVE',{categoryId:category.categoryId,expectedVersion:category.version}));
   bad(await write('PIPELINE_CREATE',{name:'Archived category creation',kind:'CATEGORY',categoryId:category.categoryId,stages:[{name:'First'}]}),'RECORD_ARCHIVED',409);
   const membership=ok(await write('MEMBERSHIP_ADD',{pipelineId:p.pipelineId,supplierId:supplier.supplierId,stageId:p.stages[0].stageId,expectedPipelineVersion:p.version}));
   let board=ok(await read({kind:'PIPELINE',pipelineId:p.pipelineId}));
   ok(await write('PIPELINE_ARCHIVE',{pipelineId:p.pipelineId,expectedVersion:board.version,expectedCount:1}));
   const archived=ok(await read({kind:'PIPELINE',pipelineId:p.pipelineId}));assert.equal(archived.lifecycle,'ARCHIVED');assert.equal(archived.activeCount,0);
   ok(await write('PIPELINE_RESTORE',{pipelineId:p.pipelineId,expectedVersion:archived.version}));
   assert.equal(ok(await read({kind:'PIPELINE',pipelineId:p.pipelineId})).activeCount,0);
   const card=ok(await read({kind:'SUPPLIER_CARD',supplierId:supplier.supplierId}));
   assert(card.memberships.find(x=>x.membershipId===membership.membershipId).endedAt);
   ok(await write('CATEGORY_RESTORE',{categoryId:category.categoryId,expectedVersion:catArchived.version}));
  });



  await t.test('catalogue searches normalized NIP, name and explicit controlled category',async()=>{
   const s=ok(await write('SUPPLIER_CREATE',{nip:nipFor(2900),displayName:'Synthetic Search Company'}));
   const category=ok(await write('CATEGORY_CREATE',{name:'Synthetic search category'}));
   const found=ok(await read({kind:'CATEGORIES',q:'search category'}));assert(found.items.some(x=>x.categoryId===category.categoryId));
   assert(!ok(await read({kind:'SUPPLIERS',categoryId:category.categoryId})).items.some(x=>x.supplierId===s.supplierId));
   ok(await write('SUPPLIER_CATEGORY_ADD',{supplierId:s.supplierId,categoryId:category.categoryId,expectedVersion:1}));
   assert(ok(await read({kind:'SUPPLIERS',categoryId:category.categoryId})).items.some(x=>x.supplierId===s.supplierId));
   assert(ok(await read({kind:'SUPPLIERS',q:'search company'})).items.some(x=>x.supplierId===s.supplierId));
   const nip=nipFor(2900);assert(ok(await read({kind:'SUPPLIERS',q:nip.slice(0,3)+'-'+nip.slice(3,6)+' '+nip.slice(6)})).items.some(x=>x.supplierId===s.supplierId));
  });
  await t.test('concurrent assignments to two supplier processes preserve zero-or-one active membership',async()=>{
   const supplier=ok(await write('SUPPLIER_CREATE',{nip:nipFor(2950),displayName:'Synthetic membership race'}));
   const processes=[];for(let i=0;i<2;i++)processes.push(ok(await write('PIPELINE_CREATE',{name:'Membership race '+i,kind:'SUPPLIER',stages:[{name:'First'}]})));
   const raced=await Promise.all(processes.map((p,i)=>write('MEMBERSHIP_ADD',{supplierId:supplier.supplierId,pipelineId:p.pipelineId,stageId:p.stages[0].stageId,expectedPipelineVersion:1},{user:i?f.V:f.U})));
   assert.equal(raced.filter(x=>x.ok).length,1);assert.equal(raced.filter(x=>x.code==='ACTIVE_SUPPLIER_ASSIGNMENT_EXISTS').length,1);
   assert.equal(ok(await read({kind:'SUPPLIER_CARD',supplierId:supplier.supplierId})).memberships.filter(x=>!x.endedAt&&x.kind==='SUPPLIER').length,1);
   const boards=await Promise.all(processes.map(p=>read({kind:'PIPELINE',pipelineId:p.pipelineId}).then(ok)));assert.deepEqual(boards.map(x=>x.activeCount).sort(),[0,1]);assert.deepEqual(boards.map(x=>x.version).sort(),[1,2]);
  });
  await t.test('historical KRS-only masters keep identity and support non-identifier edits without inventing a NIP',async()=>{
   const legacy=ok(await write('SUPPLIER_CREATE',{nip:nipFor(2800),displayName:'Synthetic historical KRS only'}));
   // Fixture setup only, using the isolated database administrator. This seeds
   // a pre-existing historical row; it is never an ordinary runtime capability.
   await f.admin.query("BEGIN;SET LOCAL session_replication_role='replica'");
   try{await f.admin.query("UPDATE srm.suppliers SET nip=NULL,krs='0000123456',created_at=clock_timestamp()-interval '1 day' WHERE organization_id=$1 AND id=$2",[f.A,legacy.supplierId]);await f.admin.query('COMMIT')}catch(e){await f.admin.query('ROLLBACK');throw e}
   const before=ok(await read({kind:'SUPPLIER_CARD',supplierId:legacy.supplierId}));assert.equal(before.nipNormalized,null);
   const edited=ok(await write('SUPPLIER_UPDATE',{supplierId:legacy.supplierId,expectedVersion:before.version,contacts:[{name:'Updated historical contact'}]}));
   assert.equal(ok(await read({kind:'SUPPLIER_CARD',supplierId:legacy.supplierId})).nipNormalized,null);
   bad(await write('SUPPLIER_UPDATE',{supplierId:legacy.supplierId,expectedVersion:edited.version,nip:nipFor(2850)}),'FIELD_INVALID',422);
   ok(await write('SUPPLIER_UPDATE',{supplierId:legacy.supplierId,expectedVersion:edited.version,nip:nipFor(2850),confirmIdentifierChange:true}));
   const after=(await f.admin.query("SELECT id,nip,krs FROM srm.suppliers WHERE organization_id=$1 AND id=$2",[f.A,legacy.supplierId])).rows[0];
   assert.equal(after.id,legacy.supplierId);assert.equal(after.nip,nipFor(2850));assert.equal(after.krs,'0000123456');
  });
  await t.test('unknown commit response resumes from one durable receipt without repeating the effect',async()=>{
   const payload=parseWorkspaceCommand({contractVersion:'1.0.0',idempotencyKey:'synthetic_commit_reply_lost',command:'SUPPLIER_CREATE',data:{nip:nipFor(2600),displayName:'Committed reply lost'}});
   await assert.rejects(f.execute({payload,operation:operationForCommand(payload.command),failAfterCommit:true}));
   const found=ok(await read({kind:'SUPPLIER_BY_NIP',nip:nipFor(2600)}));assert(found.supplierId);
   const retried=await invoke(payload);assert.equal(retried.ok,true);assert.equal(retried.replayed,true);assert.equal(retried.result.supplierId,found.supplierId);
   const rows=(await f.admin.query("SELECT count(*)::int AS n,min(root_decision_id::text) AS root FROM srm.supplier_workspace_events WHERE organization_id=$1 AND command_id=$2",[f.A,payload.idempotencyKey])).rows[0];assert.equal(rows.n,1);assert(rows.root);
   const receipt=(await f.admin.query("SELECT root_decision_id::text AS root FROM srm.supplier_workspace_receipts WHERE organization_id=$1 AND actor_account_id=$2 AND idempotency_key=$3",[f.A,f.U,payload.idempotencyKey])).rows[0];assert.equal(receipt.root,rows.root);
  });
  await t.test('sealed schema retains all FORCE RLS tables and immutable native history without direct runtime writes',async()=>{
   const tables=['supplier_workspace_profiles','supplier_categories','supplier_category_links','supplier_pipelines','supplier_pipeline_stages','supplier_pipeline_memberships','supplier_workspace_events','supplier_workspace_receipts'];
   const rows=(await f.admin.query("SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='srm' AND c.relname=ANY($1) ORDER BY c.relname",[tables])).rows;
   assert.equal(rows.length,8);assert(rows.every(x=>x.relrowsecurity&&x.relforcerowsecurity));
   assert.doesNotMatch(schema,/\\bGRANT\\s+(?:SELECT|INSERT|UPDATE|DELETE|EXECUTE)\\b/);
   const policies=(await f.admin.query("SELECT p.polcmd FROM pg_policy p WHERE p.polrelid IN('srm.supplier_workspace_events'::regclass,'srm.supplier_workspace_receipts'::regclass)")).rows;
   assert(policies.length>0);assert(policies.every(x=>!['w','d','*'].includes(x.polcmd)));
   const before=(await f.admin.query("SELECT count(*)::int AS n FROM srm.supplier_workspace_events")).rows[0].n;
   await assert.rejects(f.pool.query("UPDATE srm.supplier_workspace_events SET action='SUPPLIER_UPDATE'"),e=>e.code==='42501');
   await assert.rejects(f.pool.query("DELETE FROM srm.supplier_workspace_receipts"),e=>e.code==='42501');
   assert.equal((await f.admin.query("SELECT count(*)::int AS n FROM srm.supplier_workspace_events")).rows[0].n,before);
  });
  await t.test('category names retain Unicode normalization and archived-name uniqueness through actual commands',async()=>{
   const category=ok(await write('CATEGORY_CREATE',{name:'Native Unicode Category'}));
   const archived=ok(await write('CATEGORY_ARCHIVE',{categoryId:category.categoryId,expectedVersion:category.version}));
   assert.equal(archived.lifecycle,'ARCHIVED');
   const duplicate=await write('CATEGORY_CREATE',{name:'  Ｎative Unicode Category  '});
   bad(duplicate,'FIELD_INVALID');
   assert.throws(()=>parseWorkspaceCommand({contractVersion:'1.0.0',idempotencyKey:'unicode_empty_name',command:'CATEGORY_CREATE',data:{name:'　'}}),e=>e.code==='FIELD_INVALID');
  });
  await t.test('the same supplier cannot obtain a second active membership inside one category process',async()=>{
   const s=ok(await write('SUPPLIER_CREATE',{nip:nipFor(9200),displayName:'Native duplicate category fixture'}));
   const category=ok(await write('CATEGORY_CREATE',{name:'Native duplicate category'}));
   let p=ok(await write('PIPELINE_CREATE',{name:'Native duplicate process',kind:'CATEGORY',categoryId:category.categoryId,stages:[{name:'First'},{name:'Second'}]}));
   ok(await write('MEMBERSHIP_ADD',{pipelineId:p.pipelineId,supplierId:s.supplierId,stageId:p.stages[0].stageId,expectedPipelineVersion:p.version}));
   p=ok(await read({kind:'PIPELINE',pipelineId:p.pipelineId}));
   const duplicate=await write('MEMBERSHIP_ADD',{pipelineId:p.pipelineId,supplierId:s.supplierId,stageId:p.stages[1].stageId,expectedPipelineVersion:p.version});
   assert.equal(duplicate.ok,false);assert.equal(duplicate.status,409);
   assert.equal(ok(await read({kind:'PIPELINE',pipelineId:p.pipelineId})).activeCount,1);
  });
  await t.test('51 representative suppliers paginate without leaking contacts and retain board counts',async()=>{
   const created=[];
   for(let i=0;i<51;i++)created.push(ok(await write('SUPPLIER_CREATE',{nip:nipFor(1300+i*3),displayName:'Pagination fixture '+i,contacts:[{name:'Private contact '+i}]})));
   const first=ok(await read({kind:'SUPPLIERS',q:'Pagination fixture'}));assert.equal(first.items.length,50);assert.equal(first.totalCount,51);assert(first.nextCursor);assert(first.items.every(x=>!Object.hasOwn(x,'contacts')&&!Object.hasOwn(x,'memberships')));
   const second=ok(await read({kind:'SUPPLIERS',q:'Pagination fixture',cursor:first.nextCursor}));assert.equal(second.items.length,1);assert.equal(second.totalCount,51);assert.equal(second.nextCursor,null);
   assert.equal(new Set([...first.items,...second.items].map(x=>x.supplierId)).size,51);
   let p=ok(await write('PIPELINE_CREATE',{name:'Pagination board',kind:'SUPPLIER',stages:[{name:'First'},{name:'Second'}]}));
   for(const s of created)p=await (async()=>{ok(await write('MEMBERSHIP_ADD',{pipelineId:p.pipelineId,supplierId:s.supplierId,stageId:p.stages[0].stageId,expectedPipelineVersion:p.version}));return ok(await read({kind:'PIPELINE',pipelineId:p.pipelineId}));})();
   const board=ok(await read({kind:'PIPELINE',pipelineId:p.pipelineId}));assert.equal(board.activeCount,51);assert.equal(board.stages[0].activeCount,51);assert.equal(board.memberships.items.length,50);assert.equal(board.memberships.totalCount,51);
   const next=ok(await read({kind:'PIPELINE',pipelineId:p.pipelineId,cursor:board.memberships.nextCursor}));assert.equal(next.memberships.items.length,1);assert.equal(next.activeCount,51);
   const payload=parseWorkspaceCommand({contractVersion:'1.0.0',idempotencyKey:'late_bulk_rollback',command:'STAGE_REMOVE',data:{pipelineId:p.pipelineId,stageId:p.stages[0].stageId,expectedPipelineVersion:p.version,expectedCount:51,targetStageId:p.stages[1].stageId}});
   await assert.rejects(f.execute({payload,operation:operationForCommand(payload.command),failOutcome:true}));
   const unchanged=ok(await read({kind:'PIPELINE',pipelineId:p.pipelineId}));assert.equal(unchanged.stages.length,2);assert.equal(unchanged.stages[0].activeCount,51);assert.equal(unchanged.version,p.version);
   const removed=ok(await invoke(payload));assert.equal(removed.movedCount,51);assert.equal(ok(await read({kind:'PIPELINE',pipelineId:p.pipelineId})).stages[0].activeCount,51);
  });
 }finally{await f.close()}
});

test('SRM native HTTP API uses current identity and isolates organizations',async()=>{
 const f=await businessFixture();
 try{await f.enrol(f.B);
   const {registerHooks}=await import('node:module');
   const exports=JSON.parse(fs.readFileSync(path.join(producer,'packages/platform-contracts/package.json'),'utf8')).exports;
   const hooks=registerHooks({resolve(specifier,context,next){
    if(specifier.startsWith('@profitia/platform-contracts/')){
     const sub='./'+specifier.slice('@profitia/platform-contracts/'.length),entry=exports[sub];
     const selected=typeof entry==='string'?entry:entry?.import??entry?.default;
     if(!selected)throw Error('Exact producer export missing '+sub);
     return next(pathToFileURL(path.join(producer,'packages/platform-contracts',selected)).href,context);
    }return next(specifier,context);
   }});
   let server;
   try{
    const {createSupplierPipelinesRuntime}=await import('../src/server/supplier-pipelines-runtime.ts');
    const {createServer}=await import('node:http');
    const runtimes=new Map();
    server=createServer(async(req,res)=>{
     try{
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const body=Buffer.concat(chunks),headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(','):v);
      const request=new Request(origin+req.url,{method:req.method,headers,...body.length?{body,duplex:'half'}:{}});
      const runtime=runtimes.get(req.headers['x-fixture-actor']??'U');
      const response=await runtime.handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
     }catch{res.writeHead(500);res.end('Synthetic harness failure')}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    for(const [label,user,org]of [['U',f.U,f.A],['V',f.V,f.A],['W',f.W,f.B]]){
     const prepared=await f.prepareHost({user,org,publicOrigin:origin});
     const config={provider:'clerk',databaseUrl:'postgres://synthetic-unused',binding:f.binding,module:{id:'supplier_report',schemaDigest:hash(fs.readFileSync(path.join(producer,'packages/platform-contracts/migrations/access/002-module-scope.sql'),'utf8')),auditSchemaDigest:hash(fs.readFileSync(path.join(producer,'packages/platform-contracts/migrations/access/003-module-audit.sql'),'utf8'))},
      identity:{appId:'srm',environment:'development',issuer:prepared.clerk.issuer,authorizedParties:[origin],requestBoundary:{publicOrigins:[origin],internalOrigins:['http://0.0.0.0:10000']}},
      application:{appId:'srm',profileId:'SPENDGURU_SAAS',environment:'development',deploymentId:'SYNTHETIC_ONLY',configurationVersion:'workspace-v1',identityIssuer:prepared.clerk.issuer,organisationId:null,features:['supplier_workspace'],operations:[]}};
     runtimes.set(label,createSupplierPipelinesRuntime({config,pool:f.pool,auditPool:f.auditPool,clerk:prepared.clerk.client,workspace:{schemaDigest:f.schemaDigest,sourceRef:f.sourceRef,configurationVersion:'workspace-v1'}}));
    }
    const call=async(method,suffix,{label='U',org=f.A,data,key='api_fixture_key',originHeader=origin}={})=>{
     const response=await fetch(origin+'/api/adp/v1/'+suffix,{method,headers:{'content-type':'application/json',origin:originHeader,'x-fixture-actor':label,'x-profitia-organisation-id':org},...data?{body:JSON.stringify({contractVersion:'1.0.0',idempotencyKey:key,data})}:{}});
     return {status:response.status,headers:response.headers,body:await response.json()};
    };
    const made=await call('POST','suppliers',{data:{nip:nipFor(2300),displayName:'Native HTTP fixture'}});assert.equal(made.status,201,JSON.stringify(made.body));assert.equal(made.body.contractVersion,'1.0.0');assert(made.headers.get('x-profitia-decision-id'));assert.equal(made.headers.get('cache-control'),'no-store');
    const sid=made.body.result.supplierId;
    const seen=await call('GET','suppliers/'+sid,{label:'V'});assert.equal(seen.status,200,JSON.stringify(seen.body));assert.equal(seen.body.result.supplierId,sid);
    const duplicate=await call('POST','suppliers',{data:{nip:nipFor(2300),displayName:'Another spelling'},key:'api_duplicate_key'});assert.equal(duplicate.status,409);assert.equal(duplicate.body.error.existingSupplier.supplierId,sid);
    const foreign=await call('GET','suppliers/'+sid,{label:'W',org:f.B});assert.equal(foreign.status,404);
    const forged=await call('GET','suppliers/'+sid,{label:'W'});assert.equal(forged.status,403,JSON.stringify(forged.body));assert(!JSON.stringify(forged.body).includes(sid));
    const modified=await call('PATCH','suppliers/'+sid,{label:'W',org:f.B,data:{expectedVersion:1,displayName:'Foreign overwrite'},key:'api_foreign_edit'});assert.equal(modified.status,404);
    const csrf=await call('POST','suppliers',{data:{nip:nipFor(2400),displayName:'CSRF'},originHeader:'https://other.example.test'});assert.equal(csrf.status,403);
    const missing=await call('POST','suppliers',{data:{displayName:'Missing NIP'},key:'api_missing_nip'});assert.equal(missing.status,422);assert.equal(missing.body.error.code,'NIP_REQUIRED');assert(missing.body.error.fieldErrors.nip);
    assert.equal((await call('GET','suppliers/'+sid)).body.result.displayName,'Native HTTP fixture');
   }finally{if(server)await new Promise(resolve=>server.close(resolve));hooks.deregister()}

 }finally{await f.close()}
});
