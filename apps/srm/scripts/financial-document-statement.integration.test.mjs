// Disposable local SQL replay only; never a cloud migration or live benchmark.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {supplierBusinessFixture} from './supplier-delegated-business.integration.test.mjs';
import {createSrmSupplierNativeWork} from '../src/server/supplier-request-work.ts';
import {createSrmSupplierNativeWorkStore} from '../src/server/supplier-native-work-store.ts';
import {mapMgbiGeneralRecords} from '../src/server/mgbi-general.ts';
import {mapMgbiFinancialRecords} from '../src/server/mgbi-financial.ts';
import {projectFinancialDocuments,persistFinancialDocuments,prepareFreshFinancialDocuments} from '../src/server/financial-documents.ts';
import {fetchMgbiPages,readPreparedMgbiPages,saveMgbiArchive} from '../src/server/mgbi-archive.ts';
import {bindOrganizationTransaction,withOrganization,withNativeCompanyStoreTransaction} from '../src/server/db.ts';
import {captureFinancialDocumentPolicies,documentStatementPolicyPlan} from './financial-document-statement-release.mjs';
import {isOperationDenied} from '@profitia/platform-contracts/operation-context';
const ident=x=>'\"'+x.replaceAll('\"','\"\"')+'\"';
const selectedPolicies=['inspected_update_fence','native_work_insert','native_work_read','native_work_update','private_operation_fence'];
test('ready report document statement guard preserves same-NIP tenant isolation, Source writes and original fallback',t=>supplierBusinessFixture(t,true,async f=>{
 const {owner,controlled,own,core,hash,A,B,NIP}=f;
 await owner.query('BEGIN;SET LOCAL ROLE profitia_ingestion_owner');try{await owner.query('GRANT EXECUTE ON FUNCTION profitia_srm_catalog.valid_shape(jsonb,jsonb,jsonb,integer),profitia_srm_catalog.unique_keys(json,integer),profitia_srm_catalog.immutable() TO profitia_access_owner');await owner.query('COMMIT')}catch(e){await owner.query('ROLLBACK');throw e}
 await controlled(async()=>{
  for(const path of ['024-ready-report-history.sql','025-ready-report-history.sql','026-ready-company-work.sql'])await owner.query(own(path));
  await owner.query('INSERT INTO srm.ready_company_work_installation SELECT true,$1,$2,$3,service_id FROM profitia_services.runtime_bindings WHERE login_role=$3',[hash(own('026-ready-company-work.sql')),'a'.repeat(40),f.EXECUTOR]);
  for(const path of ['028-fresh-report-performance.sql','029-fresh-postfetch-work.sql'])await owner.query(own(path));
 });
 const at=new Date().toISOString(),KRS='0000000001';
 const sourcePages=async records=>fetchMgbiPages(new URL('https://api.mgbi.pl/records'),{},new AbortController().signal,
  async()=>Response.json({count:records.length,results:records}));
 const gRecord={id:'a'.repeat(24),identifiers:{pl_nip:NIP,pl_krs:KRS},content:{current_excerpt:{naglowekA:{numerKRS:KRS,dataRejestracjiWKRS:'2001-01-01'},dane:{dzial1:{danePodmiotu:{nazwa:'Synthetic local RLS document probe',formaPrawna:'SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ'}}}}}};
 const gp=await sourcePages([gRecord]);assert.equal(gp.errorCode,null);
 const g={...mapMgbiGeneralRecords(gp.records,{type:'NIP',value:NIP},at),rawResponse:{pages:gp.pages,recordCount:1}};
 const records=Array.from({length:24},(_,i)=>({id:(i+1).toString(16).padStart(24,'0'),identifiers:{pl_nip:NIP,pl_krs:KRS},files:[],document:{type:'financial_statement',period_from_date:`${2000+i}-01-01`,period_to_date:`${2000+i}-12-31`,is_ias_compliant:false},content:{schema:{name:'JednostkaInnaWZlotych'},extracted_fields:{'Bilans.Aktywa.KwotaA':'100','RZiS.RZiSKalk.A.KwotaA':'200'},standardized_fields:{bs:{a_ta_cfy:'100',a_ca_cfy:'60',lae_lapfl_stl_cfy:'20',lae_lapfl_cfy:'40'},pala:{nrfs_cfy:'200',npl_cfy:'10',plfoa_cfy:'15'}}}}));
 const fp=await sourcePages(records);assert.equal(fp.errorCode,null);
 const financial={...mapMgbiFinancialRecords(fp.records,{type:'NIP',value:NIP},at,1,g.section.data.registryHistory),rawResponse:{pages:fp.pages,recordCount:records.length}};
 const work=createSrmSupplierNativeWork({...f.workOptions,workSchemaDigest:hash(core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))});
 const store=createSrmSupplierNativeWorkStore({work,namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),readyCompanyWorkBoundaryDigest:hash(own('026-ready-company-work.sql'))});
 const accepted=await f.parent(A,NIP),selection={requestId:accepted.requestId,organisationId:A,command:accepted.command};
 await store.registerAndCache(selection);const storedA=await store.freshCompany(selection,g,financial);assert(storedA);
 const acceptedB=await f.parent(B,NIP),selectionB={requestId:acceptedB.requestId,organisationId:B,command:acceptedB.command};await store.registerAndCache(selectionB);assert(await store.freshCompany(selectionB,g,financial));
 await t.test('reader-owned immutable pages preserve exact private archive data in both independently authorized tenants',async()=>{
  const prepared=readPreparedMgbiPages(fp.pages,records.length);assert(prepared);
  assert.equal(prepared.payload,JSON.stringify({pages:[{count:records.length,results:records}]}));
  const archives=(await owner.query("SELECT organization_id,payload_sha256,payload_json=$1::jsonb AS matches FROM srm.mgbi_source_archives WHERE nip=$2 AND model='pl-krs-rdf-record' ORDER BY organization_id",[prepared.payload,NIP])).rows;
  assert.equal(archives.length,2);assert.deepEqual(archives.map(row=>row.organization_id).sort(),[A,B].sort());
  assert(archives.every(row=>row.matches&&row.payload_sha256===prepared.digest));
 });
 const documents=(await owner.query('SELECT document_json FROM srm.financial_source_documents WHERE organization_id=$1 AND nip=$2 ORDER BY record_id',[A,NIP])).rows.map(r=>r.document_json),archiveChecksum=(await owner.query("SELECT payload_jsonb_sha256 FROM srm.mgbi_source_archives WHERE organization_id=$1 AND nip=$2 AND model='pl-krs-rdf-record'",[A,NIP])).rows[0].payload_jsonb_sha256;
 const policies=(await owner.query("SELECT * FROM pg_policies WHERE schemaname='srm' AND tablename='financial_source_documents' ORDER BY policyname")).rows;
 const backup=await captureFinancialDocumentPolicies(owner);assert.equal(documentStatementPolicyPlan({mode:'install',backup}).statements.length,2);
 await t.test('wrong operator and policy drift cannot install or leave a partial policy change',async()=>{
  await assert.rejects(owner.query(own('032-document-statement-guard.sql')),e=>e.code==='42501');
  await assert.rejects(controlled(async()=>{await owner.query('ALTER POLICY native_work_read ON srm.financial_source_documents USING(false)');await owner.query(own('032-document-statement-guard.sql'));}),e=>e.code==='42501');
  assert.deepEqual((await owner.query("SELECT * FROM pg_policies WHERE schemaname='srm' AND tablename='financial_source_documents' ORDER BY policyname")).rows,policies);
 });
 const results=[],freshWrites=[],contextProofs=[];
 const actualPool=f.workOptions.pool,connect=actualPool.connect.bind(actualPool);
 actualPool.connect=async()=>{const client=await connect(),query=client.query.bind(client),release=client.release.bind(client);client.query=(...args)=>{const at=performance.now(),result=query(...args);if(typeof args[0]==='string'&&args[0].includes('FROM pg_roles')&&args[0].includes('organization_exists'))return result.then(r=>{contextProofs.push({sqlMs:performance.now()-at});return r});if(typeof args[0]==='string'&&args[0].startsWith('WITH written AS (INSERT INTO srm.financial_source_documents'))return result.then(r=>{freshWrites.push({sqlMs:performance.now()-at,rows:r.rowCount});return r});return result};client.release=(...args)=>{client.query=query;client.release=release;return release(...args)};return client};

 for(const optimized of [false,true]){
  if(optimized)await controlled(()=>owner.query(own('032-document-statement-guard.sql')));
  for(let i=0;i<5;i++)await work.run(selection,'SRM_STORE_COMPANY',{probe:'LOCAL_DOCUMENT_STATEMENT',optimized,i},async(_context,client)=>{
   const started=performance.now();const result=await client.query('EXPLAIN (ANALYZE,FORMAT JSON) SELECT record_id,document_json::text FROM srm.financial_source_documents WHERE organization_id=$1 AND nip=$2 AND record_id=ANY($3::text[]) ORDER BY record_id',[A,NIP,records.map(r=>r.id)]);
      const plan=result.rows[0]['QUERY PLAN'][0];assert.equal(plan.Plan['Actual Rows'],24);
   const foreign=await client.query('SELECT record_id FROM srm.financial_source_documents WHERE organization_id=$1 AND nip=$2',[B,NIP]);assert.equal(foreign.rowCount,0);
   const wrongNip=await client.query('SELECT record_id FROM srm.financial_source_documents WHERE organization_id=$1 AND nip=$2',[A,'5272443955']);assert.equal(wrongNip.rowCount,0);
   const visible=(await client.query('SELECT organization_id FROM srm.financial_source_documents')).rows;assert(visible.length>=24&&visible.every(r=>r.organization_id===A),'Existing other-tenant rows must stay invisible');
   let writeMs;const measured={query:async(...args)=>{const at=performance.now();const r=await client.query(...args);writeMs=performance.now()-at;return r}};
   await persistFinancialDocuments(measured,A,NIP,documents,archiveChecksum,undefined,rows=>{assert.equal(rows.length,0,'Identical documents remain unchanged')});
   results.push({writeMs,optimized,iteration:i,sqlExecutionMs:plan['Execution Time'],queryPlusNegativeChecksMs:performance.now()-started,plan});
  });
 }
 // Restore original guards, then compare real new-document FRESH writes.
 await controlled(async()=>{for(const p of policies.filter(x=>selectedPolicies.includes(x.policyname))){await owner.query('ALTER POLICY '+ident(p.policyname)+' ON srm.financial_source_documents'+(p.qual?' USING ('+p.qual+')':'')+(p.with_check?' WITH CHECK ('+p.with_check+')':''));}});
 freshWrites.length=0;
 for(const optimized of [false,true]){
  if(optimized)await controlled(()=>owner.query(own('032-document-statement-guard.sql')));
  for(let trial=0;trial<3;trial++){
   const newRecords=records.map((r,i)=>({...r,id:(1000+(optimized?100:0)+trial*24+i).toString(16).padStart(24,'0')}));
   const value={...mapMgbiFinancialRecords(newRecords,{type:'NIP',value:NIP},at,1,g.section.data.registryHistory),rawResponse:{pages:[{count:24,results:newRecords}],recordCount:24}};
   const accepted=await f.parent(A,NIP),selected={requestId:accepted.requestId,organisationId:A,command:accepted.command};await store.registerAndCache(selected);
   const before=freshWrites.length,proofs=contextProofs.length;assert(await store.freshCompany(selected,g,value));assert.equal(freshWrites.length,before+1);const checked=contextProofs.slice(proofs);assert.equal(checked.length,2,'One complete current native context check before and after the company action');Object.assign(freshWrites.at(-1),{optimized,trial,companyContextChecks:checked.length,companyContextSqlMs:checked.reduce((n,p)=>n+p.sqlMs,0)});assert.equal(freshWrites.at(-1).rows,24);
  }
 }
 actualPool.connect=connect;
 const after=(await owner.query("SELECT * FROM pg_policies WHERE schemaname='srm' AND tablename='financial_source_documents' ORDER BY policyname")).rows;
 console.log('DOCUMENT_STATEMENT_POLICY_DIGESTS',JSON.stringify(after.map(p=>({policyname:p.policyname,digest:createHash('md5').update((p.qual??'')+'\n'+(p.with_check??'')).digest('hex')}))));
 await t.test('reapplying the optional migration fails closed and preserves the complete installed policy set',async()=>{
  await assert.rejects(controlled(()=>owner.query(own('032-document-statement-guard.sql'))),e=>e.code==='42501');
  assert.deepEqual((await owner.query("SELECT * FROM pg_policies WHERE schemaname='srm' AND tablename='financial_source_documents' ORDER BY policyname")).rows,after);
 });
 for(const p of policies){const actual=after.find(x=>x.policyname===p.policyname);assert.deepEqual({...actual,qual:p.qual,with_check:p.with_check},p);if(!selectedPolicies.includes(p.policyname))assert.deepEqual(actual,p);}

 await t.test('complete policy rollback and reinstallation preserve every role, expression and unrelated policy',async()=>{
  const restore=documentStatementPolicyPlan({mode:'restore',backup});
  await controlled(async()=>{for(const sql of restore.statements)await owner.query(sql)});
  assert.deepEqual((await owner.query("SELECT * FROM pg_policies WHERE schemaname='srm' AND tablename='financial_source_documents' ORDER BY policyname")).rows,policies);
  await controlled(async()=>{for(const sql of documentStatementPolicyPlan({mode:'install',backup}).statements)await owner.query(sql)});
  assert.deepEqual((await owner.query("SELECT * FROM pg_policies WHERE schemaname='srm' AND tablename='financial_source_documents' ORDER BY policyname")).rows,after);
  await assert.rejects(controlled(async()=>{await owner.query('ALTER POLICY native_work_read ON srm.financial_source_documents USING(false)');for(const sql of restore.statements)await owner.query(sql)}),e=>e.code==='42501');
  assert.deepEqual((await owner.query("SELECT * FROM pg_policies WHERE schemaname='srm' AND tablename='financial_source_documents' ORDER BY policyname")).rows,after);
 });
 await t.test('original READ Work retains its current per-row fallback after optimization',async()=>{
  await work.run(selection,'SRM_READ_DOCUMENTS',{probe:'UNCHANGED_LEGACY_READ'},async(_ctx,c)=>{const rows=(await c.query('SELECT organization_id FROM srm.financial_source_documents WHERE record_id=ANY($1::text[])',[records.map(r=>r.id)])).rows;assert.equal(rows.length,24);assert(rows.every(r=>r.organization_id===A));});
 });
 for(const [setting,value] of [['srm.organization_id',B],['profitia.native_work.scope','[]']])await t.test('company transaction refuses changed '+setting+' and rolls back actual prepared documents',async()=>{
  const accepted=await f.parent(A,NIP),selected={requestId:accepted.requestId,organisationId:A,command:accepted.command};await store.registerAndCache(selected);
  const state=async()=>(await owner.query("SELECT jsonb_build_object('documents',(SELECT jsonb_agg(to_jsonb(d) ORDER BY organization_id,nip,record_id) FROM srm.financial_source_documents d),'archives',(SELECT jsonb_agg(to_jsonb(a) ORDER BY organization_id,nip,model) FROM srm.mgbi_source_archives a)) state")).rows[0].state;
  const before=await state(),newRecords=records.map((r,i)=>({...r,id:(7000+(setting==='srm.organization_id'?0:100)+i).toString(16).padStart(24,'0')})),pages=[{count:24,results:newRecords}];let prepared=false;
  await assert.rejects(work.run(selected,'SRM_STORE_COMPANY',{probe:'COMPANY_CONTEXT_ROLLBACK',setting},async(context,client)=>{
   await withNativeCompanyStoreTransaction(A,async scoped=>{
    await withOrganization(A,async current=>{
     assert.equal(current,client);
     assert.equal((await current.query('SELECT record_id FROM srm.financial_source_documents WHERE organization_id=$1 AND nip=$2',[B,NIP])).rowCount,0);
     assert.equal((await current.query('SELECT record_id FROM srm.financial_source_documents WHERE organization_id=$1 AND nip=$2',[A,'5272443955'])).rowCount,0);
     assert((await current.query('SELECT organization_id FROM srm.financial_source_documents')).rows.every(row=>row.organization_id===A));
    },scoped);
    let archive;await saveMgbiArchive(A,NIP,'pl-krs-rdf-record',pages,24,at,selected.requestId,scoped,value=>{archive=value});
    assert.equal((await withOrganization(A,current=>prepareFreshFinancialDocuments(current,A,NIP,pages,archive),scoped)).length,24);prepared=true;
    await client.query('SELECT set_config($1,$2,true)',[setting,value]);
   },bindOrganizationTransaction(A,client,context));
  }));
  assert.equal(prepared,true,'The current SQL boundary must withhold already prepared effects');assert.deepEqual(await state(),before);
 });
 await t.test('Clerk revocation at Work outcome withholds output and rolls back all newly written documents, facts and archives',async()=>{
  const accepted=await f.parent(A,NIP),selected={requestId:accepted.requestId,organisationId:A,command:accepted.command};await store.registerAndCache(selected);
  const state=async()=>(await owner.query("SELECT jsonb_build_object('documents',(SELECT count(*) FROM srm.financial_source_documents),'facts',(SELECT count(*) FROM srm.financial_facts),'snapshots',(SELECT count(*) FROM srm.source_snapshots),'archives',(SELECT jsonb_agg(to_jsonb(a) ORDER BY organization_id,nip,model) FROM srm.mgbi_source_archives a)) state")).rows[0].state;
  const before=await state();let checks=0;
  const revokedClerk={...f.workOptions.clerk,users:{getUser:async(...args)=>({...await f.workOptions.clerk.users.getUser(...args),banned:++checks===2})}};
  const revokedWork=createSrmSupplierNativeWork({...f.workOptions,clerk:revokedClerk,workSchemaDigest:hash(core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))});
  const revoked=createSrmSupplierNativeWorkStore({work:revokedWork,namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),readyCompanyWorkBoundaryDigest:hash(own('026-ready-company-work.sql'))});
  const newRecords=records.map((r,i)=>({...r,id:(5000+i).toString(16).padStart(24,'0')})),owned=await sourcePages(newRecords);assert(readPreparedMgbiPages(owned.pages,24));const value={...mapMgbiFinancialRecords(owned.records,{type:'NIP',value:NIP},at,1,g.section.data.registryHistory),rawResponse:{pages:owned.pages,recordCount:24}};
  await assert.rejects(revoked.freshCompany(selected,g,value),isOperationDenied);assert.equal(checks,2);assert.deepEqual(await state(),before);
 });
 console.log('LOCAL_DOC_FRESH_WRITES',JSON.stringify(freshWrites));console.log('LOCAL_DOC_STATEMENT_SQL',JSON.stringify(results.map(({plan,...x})=>x)));
},{companySourcePolicy:'MGBI_ONLY',privateAcquisition:true}));
