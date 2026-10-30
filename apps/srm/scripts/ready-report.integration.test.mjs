import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import pg from 'pg'
import http from 'node:http'
import {createSrmCompanyClassifier} from '../src/server/company-classification.ts'
import {srmProviderSourcePolicy} from '../src/server/provider-source-transport.ts'
import {randomUUID} from 'node:crypto'
import {supplierBusinessFixture} from './supplier-delegated-business.integration.test.mjs'
import {withSupplierTelemetry} from '../src/server/supplier-telemetry.ts'
import {createSrmNativeCompanyLookup} from '../src/server/supplier-native-company.ts'
import {createSrmCorporateSourceStore,CORPORATE_PUBLICATION_VERSION} from '../src/server/corporate-source-store.ts'
import {createSrmReadyCompanyRead} from '../src/server/ready-report-read.ts'
import {createSrmCompanyCardRead} from '../src/server/supplier-company-read.ts'
import {emptyCard} from '../src/demo/fixture.ts'
import {createPeerOperationSigner} from '@profitia/platform-contracts/peer-operation'
import {withSrmPeerXRay} from '../src/server/peer-xray.ts'
import {supplierHttpFailure} from '../src/server/supplier-acquisition-http.ts'
import {PREPARED_REPORT_RULES,PREPARED_REPORT_VERSION,prepareCompanyReport} from '../src/server/ready-report.ts'
import {calculateFinancialIndicators,FINANCIAL_INDICATOR_INPUT_CODES} from '../src/server/financial-indicators.ts'
import {mapMgbiGeneralRecords} from '../src/server/mgbi-general.ts'
import {mapMgbiFinancialRecords} from '../src/server/mgbi-financial.ts'
import {createSrmSupplierNativeWork} from '../src/server/supplier-request-work.ts'
import {createSrmSupplierSourceLink} from '../src/server/supplier-source-link.ts'
import {createSrmSupplierNativeWorkStore} from '../src/server/supplier-native-work-store.ts'
import {isOperationDenied} from '@profitia/platform-contracts/operation-context'
import {captureFreshFunctions,freshReportReleasePlan} from './fresh-report-release.mjs'
import {captureFreshPostfetchFunctions,freshPostfetchReleasePlan} from './fresh-postfetch-release.mjs'

const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8')
test('ready report native Source and current HUMAN read preserve complete financial output, tenant history and rollback',t=>supplierBusinessFixture(t,true,async f=>{
 const {owner,controlled,humanOptions,sourceOptions,baseBinding,A,B,U,NIP,FOREGROUND,own,hash}=f
 const readMainInventory=async()=>{const c=await f.servicePool.connect();try{return (await c.query('SELECT srm.financial_inventory_descriptor() descriptor')).rows[0].descriptor}finally{c.release()}};
 const inventoryBefore=(await owner.query('SELECT * FROM srm.financial_inventory_installation')).rows;
 assert.equal(inventoryBefore[0].runtime_role,f.inventoryRole);assert.notEqual(f.inventoryRole,f.EXECUTOR);
 const legacyUrl=new URL(process.env.SRM_OPERATION_TEST_OWNER_URL);legacyUrl.pathname='/'+baseBinding.databaseName;legacyUrl.username=f.inventoryRole;legacyUrl.password='isolated_ci_only';
 const legacy=new pg.Client({connectionString:legacyUrl.toString()});await legacy.connect();
 let originalInventory;
 try{originalInventory=(await legacy.query('SELECT srm.financial_inventory_descriptor() descriptor')).rows[0].descriptor}finally{await legacy.end()}
 assert(originalInventory);assert.equal(originalInventory.schemaDigest,hash(own('023-financial-inventory-work.sql')));
 assert.equal(await readMainInventory(),null);
 const sourceRole='srm_company_publication_runtime',shape=read('../src/server/ready-report-shape.json')
 const digest=hash(own('024-ready-report-history.sql')+own('025-ready-report-history.sql')+shape+JSON.stringify(PREPARED_REPORT_RULES))
 await owner.query('BEGIN;SET LOCAL ROLE profitia_ingestion_owner')
 try{await owner.query('GRANT EXECUTE ON FUNCTION profitia_srm_catalog.valid_shape(jsonb,jsonb,jsonb,integer),profitia_srm_catalog.unique_keys(json,integer),profitia_srm_catalog.immutable() TO profitia_access_owner');await owner.query('COMMIT')}catch(e){await owner.query('ROLLBACK');throw e}
 await controlled(async()=>{
  console.info('READY_PREDECESSORS',JSON.stringify((await owner.query("SELECT proname,md5(prosrc) digest FROM pg_proc WHERE oid IN('srm.current_supplier_work(uuid,uuid,text)'::regprocedure,'srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text)'::regprocedure,'srm.supplier_business_phase(uuid,text,uuid,text[])'::regprocedure) ORDER BY proname")).rows))
  await owner.query(own('024-ready-report-history.sql'));await owner.query(own('025-ready-report-history.sql'));await owner.query(own('026-ready-company-work.sql'))
  await owner.query("INSERT INTO srm.ready_company_work_installation SELECT true,$1,$2,$3,service_id FROM profitia_services.runtime_bindings WHERE login_role=$3",[hash(own('026-ready-company-work.sql')),'a'.repeat(40),f.EXECUTOR])
  await owner.query('INSERT INTO srm.ready_report_installation(version,schema_digest,field_schema,rules,source_ref) VALUES($1,$2,$3,$4,$5)',[PREPARED_REPORT_VERSION,digest,shape,JSON.stringify(PREPARED_REPORT_RULES),'a'.repeat(40)])
  await owner.query(`GRANT SELECT,INSERT ON srm.ready_company_reports TO ${sourceRole};GRANT SELECT ON srm.ready_company_reports TO ${FOREGROUND};
   GRANT EXECUTE ON FUNCTION srm.ready_report_descriptor(),srm.publish_ready_report(text,uuid,text,text,text) TO ${sourceRole};
   GRANT EXECUTE ON FUNCTION srm.register_ready_report_read(uuid,uuid,text,text,uuid,jsonb) TO ${FOREGROUND}`)
  await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW','supplier.report.read','supplier_report')",[randomUUID(),A,U])
 })
 await t.test('main receiver has its own inventory binding while the pilot installation and ordinary descriptor remain unchanged',async()=>{
  assert.deepEqual((await owner.query('SELECT * FROM srm.financial_inventory_installation')).rows,inventoryBefore);
  const actual=new pg.Client({connectionString:legacyUrl.toString()});await actual.connect();
  try{assert.deepEqual((await actual.query('SELECT srm.financial_inventory_descriptor() descriptor')).rows[0].descriptor,originalInventory)}finally{await actual.end()}
  assert.equal((await readMainInventory()).schemaDigest,hash(own('023-financial-inventory-work.sql')));
 });
 const url=new URL(process.env.SRM_OPERATION_TEST_OWNER_URL);url.pathname='/'+baseBinding.databaseName;url.username=sourceRole;url.password='isolated_ci_only'
 const pool=new pg.Pool({connectionString:url.toString(),max:2}),auditPool=new pg.Pool({connectionString:url.toString(),max:1})
 const publicationQueries=[];
 pool.on('connect',client=>{const query=client.query.bind(client);client.query=(sql,args,...rest)=>query(sql,args,...rest).then(result=>{publicationQueries.push({sql,rows:structuredClone(result.rows)});return result}).catch(error=>{console.error('ISOLATED_CORPORATE_SQL_FAILURE',JSON.stringify({code:error.code,message:error.message,query:typeof sql==='string'?sql.slice(0,150):'native-query'}));throw error})});
 try{
  const application={...sourceOptions.application,appId:'srm-corporate-source',deploymentId:'synthetic-company-publication',configurationVersion:'corporate-v1'}
  const source=createSrmCorporateSourceStore({application,binding:{...sourceOptions.binding,applicationId:application.appId,role:sourceRole,deploymentId:application.deploymentId,configurationVersion:application.configurationVersion},pool,auditPool,
   publicationSchemaDigest:hash(own('004-corporate-source.sql')+own('005-corporate-source-access.sql')+read('../src/server/corporate-source-shape.json')),readyReportSchemaDigest:digest})
  const at=new Date().toISOString(),KRS='0000000001'
  const general=mapMgbiGeneralRecords([{id:'a'.repeat(24),identifiers:{pl_nip:NIP,pl_krs:KRS},content:{current_excerpt:{
   naglowekA:{numerKRS:KRS,dataRejestracjiWKRS:'2001-01-01'},dane:{dzial1:{danePodmiotu:{nazwa:'Synthetic READY company',formaPrawna:'SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ'}}}}}}],{type:'NIP',value:NIP},at).section
  const financial=mapMgbiFinancialRecords([{id:'b'.repeat(24),identifiers:{pl_nip:NIP,pl_krs:KRS},document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31',is_ias_compliant:false},
   content:{schema:{name:'JednostkaInnaWZlotych'},standardized_fields:{bs:{a_ta_cfy:'100',a_ca_cfy:'60',lae_lapfl_stl_cfy:'20',lae_lapfl_cfy:'40'},pala:{nrfs_cfy:'200',npl_cfy:'10',plfoa_cfy:'15'}}}}],{type:'NIP',value:NIP},at,1,general.data.registryHistory)
  const packet={version:CORPORATE_PUBLICATION_VERSION,nip:NIP,general,financial:financial.section,facts:financial.facts,preserveGeneral:false}
  await t.test('FRESH writes both original private sections in one Work with current authorization and provenance',async()=>{
   const accepted=await f.parent(A,NIP),selection={requestId:accepted.requestId,organisationId:A,command:accepted.command}
   const work=createSrmSupplierNativeWork({...f.workOptions,workSchemaDigest:hash(f.core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))})
   const store=createSrmSupplierNativeWorkStore({work,namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),readyCompanyWorkBoundaryDigest:hash(own('026-ready-company-work.sql'))})
   await store.register(selection)
   const before=(await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE event->>'requestWork' IS NOT NULL")).rows[0].n
   const stored=await store.companySections(selection,{envelope:general,errorCode:null},{envelope:financial.section,errorCode:financial.errorCode,facts:financial.facts})
   assert(stored.generalSnapshotId);assert(stored.financialSnapshotId)
   const events=(await owner.query("SELECT phase,event FROM profitia_access.security_events WHERE event->'requestWork'->>'unitId'='SRM_STORE_COMPANY' ORDER BY event_id")).rows
   assert.deepEqual(events.map(e=>e.phase),['INTENT','OUTCOME']);assert(events.every(e=>e.event.decision==='ALLOW'))
   assert.equal((await owner.query("SELECT count(*)::int n FROM srm.source_snapshots WHERE organization_id=$1 AND id=ANY($2::uuid[])",[A,[stored.generalSnapshotId,stored.financialSnapshotId]])).rows[0].n,2)
  })
  await t.test('composite financial INSERT uses the existing statement guard without changing row policy, ACL or provenance',async()=>{
   const before=(await owner.query("SELECT pg_get_functiondef(oid) definition,proacl::text acl,proowner,prosecdef,proconfig FROM pg_proc WHERE oid='srm.financial_statement_target()'::regprocedure")).rows[0]
   const policies=(await owner.query("SELECT * FROM pg_policies WHERE schemaname='srm' AND tablename='financial_facts' ORDER BY policyname")).rows
   const functionBackup=await captureFreshFunctions(owner)
   const facts=Array.from({length:40},(_,i)=>financial.facts.map(f=>({...f,periodStart:(1980+i)+'-01-01',periodEnd:(1980+i)+'-12-31'}))).flat()
   const timings=[]
   const config={...f.workOptions,workSchemaDigest:hash(f.core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))}
   const work=createSrmSupplierNativeWork(config)
   const store=createSrmSupplierNativeWorkStore({work,namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),readyCompanyWorkBoundaryDigest:hash(own('026-ready-company-work.sql'))})
   for(const optimized of [false,true]){
    if(optimized)await controlled(()=>owner.query(own('028-fresh-report-performance.sql')))
    const accepted=await f.parent(A,NIP),selection={requestId:accepted.requestId,organisationId:A,command:accepted.command}
    const registered=await store.registerAndCache(selection)
    assert.equal(registered.lookup.requestId,selection.requestId)
    assert.equal(Object.hasOwn(registered,'cache'),optimized,'old SQL must retain the separate cache Work, not invent a cache miss')
    let timing;const logger=console.info
    console.info=value=>{try{const x=JSON.parse(value);if(x.event==='srm_supplier_timing')timing=x}catch{logger(value)}}
    let stored
    try{await withSupplierTelemetry('search',async()=>{
     stored=await store.companySections(selection,{envelope:general,errorCode:null},{envelope:financial.section,errorCode:financial.errorCode,facts})
     return Response.json({ok:true})
    })}finally{console.info=logger}
    assert.equal((await owner.query('SELECT count(*)::int n FROM srm.financial_facts WHERE snapshot_id=$1',[stored.financialSnapshotId])).rows[0].n,facts.length)
    timings.push({optimized,facts:facts.length,insertMs:timing.stages.FINANCIAL_FACTS_INSERT.totalMs,sql:timing.stages.E1_SQL.count})
    const sentinel=Error('rollback isolated statement probe')
    let target
    await assert.rejects(work.run(selection,'SRM_STORE_COMPANY',{probe:optimized},async(_context,client)=>{
     await client.query("SELECT set_config('profitia.srm.financial.snapshot',$1,true)",[stored.financialSnapshotId])
     target=(await client.query('SELECT srm.financial_statement_target() target')).rows[0].target
     for(const foreign of [stored.generalSnapshotId,randomUUID()]){
      await client.query("SELECT set_config('profitia.srm.financial.snapshot',$1,true)",[foreign])
      assert.equal((await client.query('SELECT srm.financial_statement_target() target')).rows[0].target,null)
     }
     throw sentinel
    }),isOperationDenied)
    assert.equal(target===null,!optimized)
   }
   const after=(await owner.query("SELECT proacl::text acl,proowner,prosecdef,proconfig FROM pg_proc WHERE oid='srm.financial_statement_target()'::regprocedure")).rows[0]
   for(const key of Object.keys(after))assert.deepEqual(after[key],before[key],key)
   assert.deepEqual((await owner.query("SELECT * FROM pg_policies WHERE schemaname='srm' AND tablename='financial_facts' ORDER BY policyname")).rows,policies)
   console.info('FRESH_FINANCIAL_STATEMENT_COMPARISON',JSON.stringify(timings))
   console.info('FRESH_SQL_FUNCTION_DIGESTS',JSON.stringify((await owner.query("SELECT oid::regprocedure::text id,md5(pg_get_functiondef(oid)) digest FROM pg_proc WHERE oid=ANY(ARRAY['srm.financial_statement_target()'::regprocedure,'srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text)'::regprocedure,'srm.ready_company_work_descriptor()'::regprocedure]) ORDER BY 1")).rows))
   const optimizedFunctions=await captureFreshFunctions(owner)
   const rollback=freshReportReleasePlan({mode:'rollback',sourceSha:'a'.repeat(40),previousSha:'b'.repeat(40),backup:functionBackup})
   assert(rollback.statements.findIndex(s=>s.text.startsWith('REVOKE '))>rollback.statements.findIndex(s=>s.text.startsWith('UPDATE profitia_ingestion.')))
   const beforeRollback=await f.counts()
   await controlled(async()=>{
    for(const statement of rollback.freshStatements)await owner.query(statement.text,statement.values)
    assert.deepEqual(await captureFreshFunctions(owner),functionBackup)
    await owner.query(own('028-fresh-report-performance.sql'))
    assert.deepEqual(await captureFreshFunctions(owner),optimizedFunctions)
   })
   assert.deepEqual(await f.counts(),beforeRollback)
  })
  await t.test('revocation inside the consolidated FRESH Work rolls back both sections together',async()=>{
   const accepted=await f.parent(A,NIP),selection={requestId:accepted.requestId,organisationId:A,command:accepted.command}
   const config={...f.workOptions,workSchemaDigest:hash(f.core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))}
   const ordinary=createSrmSupplierNativeWorkStore({work:createSrmSupplierNativeWork(config),namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql'))})
   await ordinary.register(selection)
   let checks=0
   const revoked={...config.clerk,users:{getUser:async(...args)=>({...await config.clerk.users.getUser(...args),banned:++checks===2})}}
   const store=createSrmSupplierNativeWorkStore({work:createSrmSupplierNativeWork({...config,clerk:revoked}),namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),readyCompanyWorkBoundaryDigest:hash(own('026-ready-company-work.sql'))})
   const before=await f.counts()
   await assert.rejects(store.companySections(selection,{envelope:general,errorCode:null},{envelope:financial.section,errorCode:financial.errorCode,facts:financial.facts}),isOperationDenied)
   assert.equal(checks,2);assert.deepEqual(await f.counts(),before)
  })
  await t.test('postfetch composition preserves policies, rollback and all tenant data on revocation',async()=>{
   const names=['srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text)','srm.ready_company_work_descriptor()'];
   const inspect=async()=>(await owner.query('SELECT oid::regprocedure::text id,pg_get_functiondef(oid) definition,proacl::text acl,proowner,prosecdef,proconfig FROM pg_proc WHERE oid=ANY($1::regprocedure[]) ORDER BY 1',[names])).rows;
   const backup=await captureFreshPostfetchFunctions(owner),beforeFunctions=await inspect(),policies=(await owner.query("SELECT * FROM pg_policies WHERE schemaname='srm' ORDER BY tablename,policyname")).rows;
   await assert.rejects(owner.query(own('029-fresh-postfetch-work.sql')),e=>e.code==='42501');
   await controlled(async()=>{await owner.query('SAVEPOINT candidate');await owner.query(own('029-fresh-postfetch-work.sql'));await owner.query('ROLLBACK TO SAVEPOINT candidate');assert.deepEqual(await inspect(),beforeFunctions);await owner.query(own('029-fresh-postfetch-work.sql'))});
   const afterFunctions=await inspect();
   for(let i=0;i<afterFunctions.length;i++)for(const key of ['acl','proowner','prosecdef','proconfig'])assert.deepEqual(afterFunctions[i][key],beforeFunctions[i][key]);
   assert.deepEqual((await owner.query("SELECT * FROM pg_policies WHERE schemaname='srm' ORDER BY tablename,policyname")).rows,policies);
   assert.deepEqual((await owner.query('SELECT * FROM srm.financial_inventory_installation')).rows,inventoryBefore);
   console.info('POSTFETCH_FUNCTIONS',JSON.stringify((await owner.query('SELECT oid::regprocedure::text id,md5(pg_get_functiondef(oid)) digest FROM pg_proc WHERE oid=ANY($1::regprocedure[]) ORDER BY 1',[names])).rows));
   const wp={id:'e'.repeat(24),identifiers:{pl_nip:NIP,pl_krs:KRS},content:{current_excerpt:{naglowekA:{numerKRS:KRS,dataRejestracjiWKRS:'2001-01-01'},dane:{dzial1:{danePodmiotu:{nazwa:'Synthetic postfetch',formaPrawna:'SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ'}}}}}};
   const rdf={id:'f'.repeat(24),identifiers:{pl_nip:NIP,pl_krs:KRS},document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31',is_ias_compliant:false},content:{schema:{name:'JednostkaInnaWZlotych',version:'1-2'},standardized_fields:{bs:{a_ta_cfy:'100',a_ca_cfy:'60',lae_lapfl_stl_cfy:'20'},pala:{nrfs_cfy:'200',npl_cfy:'10'}}}};
   const g={...mapMgbiGeneralRecords([wp],{type:'NIP',value:NIP},at),rawResponse:{pages:[{count:1,results:[wp]}],recordCount:1}};
   const fin={...mapMgbiFinancialRecords([rdf],{type:'NIP',value:NIP},at,1,g.section.data.registryHistory),rawResponse:{pages:[{count:1,results:[rdf]}],recordCount:1}};
   const config={...f.workOptions,workSchemaDigest:hash(f.core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))};
   const work=createSrmSupplierNativeWork(config),makeStore=selectedWork=>createSrmSupplierNativeWorkStore({work:selectedWork,namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),readyCompanyWorkBoundaryDigest:hash(own('026-ready-company-work.sql'))});
   const privateCounts=async()=>(await owner.query('SELECT (SELECT count(*)::int FROM srm.mgbi_source_archives) archives,(SELECT count(*)::int FROM srm.financial_source_documents) documents,(SELECT count(*)::int FROM srm.source_snapshots) snapshots,(SELECT count(*)::int FROM srm.financial_facts) facts,(SELECT count(*)::int FROM srm.provider_attempts) attempts')).rows[0];
   const store=makeStore(work),accepted=await f.parent(A,NIP),selection={requestId:accepted.requestId,organisationId:A,command:accepted.command};
   await store.register(selection);
   let checks=0;
   const revoked={...config.clerk,users:{getUser:async(...args)=>({...await config.clerk.users.getUser(...args),banned:++checks===2})}};
   const before=await privateCounts();await assert.rejects(makeStore(createSrmSupplierNativeWork({...config,clerk:revoked})).freshCompany(selection,g,fin),isOperationDenied);
   assert.equal(checks,2);assert.deepEqual(await privateCounts(),before);
   const stored=await store.freshCompany(selection,g,fin);assert(stored?.generalSnapshotId);assert(stored?.financialSnapshotId);assert.equal(stored.documents.length,1);assert.equal(stored.financial.rawResponse,undefined,'Archived provider pages are not copied into the prepared return value');
   const stable=await privateCounts();
   await assert.rejects(store.freshCompany({...selection,organisationId:B},g,fin),isOperationDenied);assert.deepEqual(await privateCounts(),stable);
   let examined=false;
   await assert.rejects(work.run(selection,'SRM_STORE_COMPANY',{probe:'postfetch fences'},async(_context,c)=>{
    for(const table of ['mgbi_source_archives','financial_source_documents','msr_sources','msr_projections'])for(const mode of ['READ','WRITE']){
     assert.equal((await c.query('SELECT srm.native_supplier_row($1,$2::uuid,NULL,NULL,NULL,$3,$4,$5) allowed',[table,B,NIP,'financial',mode])).rows[0].allowed,false);
     assert.equal((await c.query('SELECT srm.native_supplier_row($1,$2::uuid,NULL,NULL,NULL,$3,$4,$5) allowed',[table,A,'5260250274','financial',mode])).rows[0].allowed,false);
    }
    for(const table of ['msr_sources','msr_projections','catalog_companies'])assert.equal((await c.query('SELECT srm.native_supplier_row($1,$2::uuid,NULL,NULL,NULL,$3,$4,$5) allowed',[table,A,NIP,'financial','WRITE'])).rows[0].allowed,false);
    examined=true;throw Error('isolated row fence rollback');
   }),isOperationDenied);assert(examined);assert.deepEqual(await privateCounts(),stable);
   const rollback=freshPostfetchReleasePlan({mode:'rollback',sourceSha:'a'.repeat(40),previousSha:'b'.repeat(40),backup});
   const install=freshPostfetchReleasePlan({mode:'install-bind',sourceSha:'a'.repeat(40),previousSha:'b'.repeat(40),backup});
   for(const plan of [install,rollback]){
    assert.equal(plan.statements.filter(s=>s.text.startsWith('UPDATE profitia_')).length,3);
    assert(plan.statements.findIndex(s=>s.text.startsWith('REVOKE '))>plan.statements.findIndex(s=>s.text.startsWith('UPDATE profitia_ingestion.')));
   }
   await controlled(async()=>{for(const stmt of rollback.freshStatements)await owner.query(stmt.text,stmt.values);assert.deepEqual(await inspect(),beforeFunctions);for(const stmt of install.freshStatements)await owner.query(stmt.text,stmt.values);assert.deepEqual(await inspect(),afterFunctions)});
   assert.deepEqual(await privateCounts(),stable);
  });
  await t.test('CEIDG classification uses the report command and native Source without private JDG or company snapshot writes',async()=>{
   let hits=0,mode='EMPTY'
   const server=http.createServer((request,response)=>{
    hits++;assert.equal(new URL(request.url,'http://local').searchParams.get('nip'),NIP)
    response.statusCode=mode==='EMPTY'?204:mode==='OUTAGE'?503:mode==='REDIRECT'?301:200
    if(mode==='REDIRECT')response.setHeader('location','https://dane.biznes.gov.pl/')
    response.setHeader('content-type','application/json');response.end(mode==='JDG'?JSON.stringify({firma:[{id:'synthetic',nazwa:'PRIVATE BUSINESS',wlasciciel:{nip:NIP,imie:'PRIVATE PERSON'}}]}):undefined)
   })
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port
   const policy=srmProviderSourcePolicy('CEIDG'),id=randomUUID(),role=sourceOptions.binding.role
   await owner.query('BEGIN;SET LOCAL ROLE profitia_ingestion_owner')
   try{
    await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",Object.values(policy.source))
    await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),role,policy.source.id])
    await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'srm-provider-source',$2,'SOURCE_TRANSACTION',100,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),policy.source.id])
    await owner.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,'classification-provider-v1',$5,'LOCAL_SYNTHETIC_HTTP',$6::jsonb,8192,1048576,20000,'UPSTREAM_ATTEMPT_ADMISSION',30,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[id,role,policy.source.id,policy.resourceId,origin,JSON.stringify(policy.basePathRules)])
    await owner.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,'[]'::jsonb,1048576,'SERVER_HEADERS','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '1 hour','SYNTHETIC_ONLY')",[id,JSON.stringify(policy.pathRules)])
    await owner.query('COMMIT')
   }catch(e){await owner.query('ROLLBACK');server.close();throw e}
   const classifier=createSrmCompanyClassifier({work:{...f.workOptions,workSchemaDigest:hash(f.core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))},source:f.source,
    apiKey:'synthetic-ceidg-token',provider:{...sourceOptions,syntheticOrigin:origin,external:{configurationVersion:'classification-provider-v1',schemaDigest:hash(f.core('009-external-call-admission.sql')),nativeSchemaDigest:hash(f.core('012-native-external-transport.sql')),maximumResponseBytes:1048576}}})
   try{
    for(const [selected,expected]of [['EMPTY','NOT_JDG'],['JDG','JDG'],['OUTAGE','UNAVAILABLE'],['REDIRECT','UNAVAILABLE']]){
     mode=selected;const accepted=await f.parent(A,NIP),selection={requestId:accepted.requestId,organisationId:A,command:accepted.command},before=await f.counts(),calls=hits
     assert.equal(await classifier.classify(selection,new AbortController().signal),expected);assert.equal(hits,calls+1)
     assert.deepEqual(await f.counts(),before)
     const key=(await owner.query('SELECT delivery_key FROM profitia_jobs.dispatches WHERE request_id=$1',[selection.requestId])).rows[0].delivery_key;
     const committed=await f.source.read(selection.command,key);assert(committed);
     await assert.rejects(f.source.read(selection.command,'0'.repeat(64)),isOperationDenied);
     await assert.rejects(f.source.read({...selection.command,organisationId:B},key));
     if(selected==='EMPTY'){
      const sourceCount=async()=>(await owner.query('SELECT (SELECT count(*)::int FROM profitia_ingestion.effects) effects,(SELECT count(*)::int FROM profitia_ingestion.security_events) audit')).rows[0];
      let accountReads=0;const clerk={...f.workOptions.clerk,users:{getUser:async(...args)=>{accountReads++;return f.workOptions.clerk.users.getUser(...args)}}};
      const prior=await sourceCount(),link=createSrmSupplierSourceLink({work:{...f.workOptions,clerk,workSchemaDigest:hash(f.core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))},namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),source:f.source});
      assert.deepEqual((await link.registerAndAdmit(selection)).sourceRequest,committed);assert.deepEqual(await sourceCount(),prior);assert.equal(accountReads,2,'Only registration entry/outcome reads remain; confirmed delivery does not repeat dispatch admission');
      await owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED' WHERE login_role=$1",[role]);
      try{await assert.rejects(f.source.read(selection.command,key),isOperationDenied);await assert.rejects(link.registerAndAdmit(selection),isOperationDenied)}finally{await owner.query("UPDATE profitia_ingestion.grants SET status='ACTIVE' WHERE login_role=$1",[role])}
      assert.deepEqual(await sourceCount(),prior);
     }
     if(selected==='REDIRECT'){
      const row=(await owner.query("SELECT status,http_status,response_digest FROM profitia_external_call.calls WHERE source_id=$1 ORDER BY created_at DESC LIMIT 1",[policy.source.id])).rows[0]
      assert.deepEqual(row,{status:'UNVERIFIED',http_status:null,response_digest:null})
     }
    }
   }finally{await new Promise(resolve=>server.close(resolve))}
  })
  let prepared
  await t.test('the original corporate publication atomically prepares one public report without private document storage',async()=>{
   publicationQueries.length=0;
   await source.publish(packet,hash('ready-source:'+randomUUID()),{documents:[],onPrepared:value=>{prepared=value}})
   assert(prepared);assert.equal(prepared.nip,NIP)
   const rows=(await owner.query('SELECT * FROM srm.ready_company_reports WHERE nip=$1',[NIP])).rows
   assert.equal(rows.length,1);assert.equal(rows[0].body_json.report.kys.reportAvailable,false)
   assert(!rows[0].body_text.includes('scanner_documents'))
   assert((await owner.query("SELECT count(*)::int n FROM profitia_ingestion.security_events WHERE decision_id=(SELECT decision_id FROM profitia_srm_catalog.publications WHERE effect_id=$1) AND phase='OUTCOME' AND event->>'decision'='ALLOW'",[rows[0].publication_effect])).rows[0].n===1)
   assert(!publicationQueries.some(q=>q.sql.includes('FROM srm.catalog_financial_facts')),'brand-new publication must not reread facts');
   const stored=(await owner.query('SELECT nip,general_json,general_sha256,general_source_snapshot_id,financial_json,financial_sha256,financial_checked_at,financial_source_snapshot_id FROM srm.catalog_companies WHERE nip=$1',[NIP])).rows[0];
   const returning=publicationQueries.find(q=>q.sql.includes('RETURNING nip, general_json'));
   assert.deepEqual(returning.rows,[stored]);
   const facts=(await owner.query(`SELECT metric_code AS "metricCode",period_start::text AS "periodStart",period_end::text AS "periodEnd",statement_scope AS "statementScope",amount::text AS amount,source_amount::text AS "sourceAmount",currency_code AS "currencyCode",unit_code AS "unitCode",source_path AS "sourcePath",validation_status AS "validationStatus",normalization_rule AS "normalizationRule",source_snapshot_id::text AS "sourceSnapshotId" FROM srm.catalog_financial_facts WHERE nip=$1`,[NIP])).rows;
   const key=f=>JSON.stringify([f.metricCode,f.periodStart,f.periodEnd,f.statementScope]);
   assert.deepEqual(publicationQueries.find(q=>q.sql.includes('RETURNING metric_code')).rows.sort((a,b)=>key(a).localeCompare(key(b))),[...facts].sort((a,b)=>key(a).localeCompare(key(b))));
   const indicators=calculateFinancialIndicators(NIP,financial.section.data,facts.filter(f=>FINANCIAL_INDICATOR_INPUT_CODES.includes(f.metricCode)));
   assert.deepEqual(prepared,prepareCompanyReport({general:stored.general_json,row:{...stored,facts,indicators,kys:null},documents:[],sources:{generalHash:stored.general_sha256,financialHash:stored.financial_sha256,generalEffectId:stored.general_source_snapshot_id,financialEffectId:stored.financial_source_snapshot_id}}));
  })
  await t.test('an existing publication retains the authoritative complete-facts read',async()=>{
   publicationQueries.length=0;
   await source.publish(packet,hash('ready-existing-source:'+randomUUID()),{documents:[],onPrepared:value=>{prepared=value}});
   assert(prepared);assert(publicationQueries.some(q=>q.sql.includes('FROM srm.catalog_financial_facts')));
   assert(publicationQueries.some(q=>q.sql.includes('FROM srm.catalog_companies c WHERE c.nip=$1')));
   assert(!publicationQueries.some(q=>q.sql.includes('RETURNING metric_code')));
  })
  await t.test('concurrent first publications reuse only the winning insert and preserve the losing publication read',async()=>{
   const racingNip='1234563218',racing=JSON.parse(JSON.stringify(packet).replaceAll(NIP,racingNip));
   assert.equal((await owner.query('SELECT count(*)::int n FROM srm.catalog_companies WHERE nip=$1',[racingNip])).rows[0].n,0);
   publicationQueries.length=0;const reports=[];
   await Promise.all([0,1].map(i=>source.publish(racing,hash('racing-first-source:'+i+randomUUID()),{documents:[],onPrepared:r=>{reports.push(r)}})));
   assert.equal(reports.length,2);assert(reports.every(r=>r.nip===racingNip));
   const claims=publicationQueries.filter(q=>q.sql.startsWith('INSERT INTO srm.catalog_companies(nip)'));
   assert.deepEqual(claims.map(q=>q.rows.length).sort(),[0,1]);
   assert.equal(publicationQueries.filter(q=>q.sql.includes('RETURNING metric_code')).length,1);
   assert.equal(publicationQueries.filter(q=>q.sql.includes('FROM srm.catalog_companies c WHERE c.nip=$1')).length,1);
   assert.equal((await owner.query('SELECT count(*)::int n FROM srm.catalog_financial_facts WHERE nip=$1',[racingNip])).rows[0].n,financial.facts.length);
  })
  let sdk=0,sessions=0,accounts=0,banAtOutcome=false
  const original=humanOptions.clerk
  const clerk={authenticateRequest:async(...args)=>{sdk++;return original.authenticateRequest(...args)},sessions:{getSession:async(...args)=>{sessions++;return original.sessions.getSession(...args)}},users:{getUser:async(...args)=>{accounts++;const user=await original.users.getUser(...args);return {...user,banned:banAtOutcome&&accounts%2===0}}}}
  const {requestLedger,commandBoundaryDigest,...base}=humanOptions
  const ready=createSrmReadyCompanyRead({...base,clerk,application:{...base.application,operations:['supplier.report.read']}},digest,'s'.repeat(40))
  const request=()=>new Request('http://localhost:3400/api/xray/search',{method:'POST',headers:{origin:'http://localhost:3400'}})
  const counts=async()=>(await owner.query('SELECT (SELECT count(*)::int FROM srm.ready_report_reads) reads,(SELECT count(*)::int FROM srm.lookup_requests) lookups,(SELECT count(*)::int FROM srm.source_snapshots) snapshots,(SELECT coalesce(sum(accepted_count),0)::int FROM profitia_requests.policies) quota')).rows[0]
  let first
  await t.test('READY uses one SDK authentication, two fresh session/account checks, one Root and no Work or refresh charge',async()=>{
   const before=await counts(),work=(await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE event->>'operation'='job.execute'")).rows[0].n
   let telemetry
   const logger=console.info
   console.info=value=>{try{const parsed=JSON.parse(value);if(parsed.event==='srm_supplier_timing')telemetry=parsed}catch{}}
   try{await withSupplierTelemetry('search',async()=>{first=await ready.read(request(),A,NIP);return first.response})}finally{console.info=logger}
   console.info('READY_LOCAL_E1_COUNTS',JSON.stringify({sql:telemetry?.stages?.E1_SQL?.count,work:telemetry?.work?.length,accounts,sessions,sdk}))
   assert.equal(first.known,true);assert(first.response)
   const body=await first.response.json();assert.equal(body.identity.nip,NIP);assert.equal(body.metadata.nip,NIP)
   assert(body.metadata.financial.scanner);assert(body.metadata.locationSubject.supplierId);assert.match(body.metadata.preferenceScope,/^[a-f0-9]{64}$/)
   assert.deepEqual(body.metadata.financial.periods,prepared.report.financial.periods)
   assert.deepEqual([sdk,sessions,accounts],[1,2,2])
   const after=await counts();assert.equal(after.reads,before.reads+1);assert.equal(after.lookups,before.lookups+1);assert.equal(after.snapshots,before.snapshots);assert.equal(after.quota,before.quota)
   assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE event->>'operation'='job.execute'")).rows[0].n,work)
   assert.equal((await owner.query('SELECT count(*)::int n FROM srm.ready_report_read_outcomes')).rows[0].n,1)
  })
  await t.test('AppShell uses the same prepared READY reader with current identity, rollback and tenant fences',async()=>{
   const caller='https://dev-sg2.spendguru.app',receiver='https://srm-development-runtime.onrender.com'
   const policy={environment:'development',callerApplicationId:'spendguru',receiverApplicationId:'srm',sourceOrigin:caller,targetOrigin:receiver,
    keyId:'synthetic-ready-peer',key:new Uint8Array(32).fill(7),routes:[{method:'POST',path:'/api/xray/search',maximumRequestBytes:2048,requireIdempotencyKey:true}],internalOrigins:[]}
   let revoked=false,revokeDuring=false,accounts=0,sessions=0,sdk=0
   const peerClerk={...original,authenticateRequest:async(...args)=>{
    sdk++
    const state=await original.authenticateRequest(...args),auth=state.toAuth()
    return {status:state.status,isAuthenticated:state.isAuthenticated,toAuth:()=>({...auth,sessionClaims:{...auth.sessionClaims,azp:caller}})}
   },sessions:{getSession:async id=>{sessions++;return original.sessions.getSession(id)}},users:{getUser:async id=>({...await original.users.getUser(id),banned:revoked||revokeDuring&&++accounts===2})}}
   // Count both current account observations independently of their result.
   const getUser=peerClerk.users.getUser
   peerClerk.users.getUser=async id=>{if(!revokeDuring)accounts++;return getUser(id)}
   const projection=createSrmReadyCompanyRead({...base,clerk:peerClerk,
    identity:{...base.identity,authorizedParties:[caller,receiver],requestBoundary:{publicOrigins:[caller,receiver],internalOrigins:['http://0.0.0.0:10000']}},
    application:{...base.application,operations:['supplier.report.read']}},digest,'synthetic-ready-peer-secret-longer-than-32')
   const incoming=()=>createPeerOperationSigner(policy)(new Request(receiver+'/api/xray/search',{method:'POST',headers:{authorization:'Bearer synthetic-only',
     'content-type':'application/json','idempotency-key':'peer-projection-'+randomUUID()},body:JSON.stringify({identifier:NIP})}))
   const run=org=>withSrmPeerXRay(async request=>{
    try{const prepared=await projection.read(request,org,NIP);assert(prepared.response);const {metadata,...card}=await prepared.response.json();return Response.json({entityType:'COMPANY',card,metadata})}
    catch(error){return supplierHttpFailure(error)}
   },{TARGET_ENVIRONMENT:'development',PROFITIA_AUTH_PROVIDER:'clerk',RENDER_SERVICE_ID:'srv-db1vu6gm7kps73d0e3r0',
    PROFITIA_XRAY_PEER_VERSION:'1.0.0',PROFITIA_XRAY_PEER_KEY_ID:policy.keyId,PROFITIA_XRAY_PEER_KEY:Buffer.from(policy.key).toString('base64url')})
   const before=await counts(),response=await run(A)(await incoming())
   assert.equal(response.status,200);assert.equal((await response.json()).data.card.identity.nip,NIP)
   assert.deepEqual({sdk,sessions,accounts},{sdk:1,sessions:2,accounts:2})
   const after=await counts();assert.equal(after.reads,before.reads+1);assert.equal(after.lookups,before.lookups+1)
   assert.equal(after.snapshots,before.snapshots);assert.equal(after.quota,before.quota)
   accounts=0;revokeDuring=true
   const during=await run(A)(await incoming());assert.equal(during.status,401);assert(!Object.hasOwn(await during.json(),'data'))
   assert.deepEqual(await counts(),after);revokeDuring=false
   revoked=true
   const revokedResponse=await run(A)(await incoming());assert.equal(revokedResponse.status,401);assert(!Object.hasOwn(await revokedResponse.json(),'data'))
   revoked=false
   const foreignResponse=await run('33333333-3333-4333-8333-333333333333')(await incoming())
   assert.equal(foreignResponse.status,403);assert(!Object.hasOwn(await foreignResponse.json(),'data'))
   assert.deepEqual(await counts(),after)
  })
  await t.test('complete native FRESH pipeline prepares the report once and the next READY opening performs no Work',async()=>{
   const selectedNip='5260250274',accepted=await f.parent(A,selectedNip)
   const syntheticOrigin=(await owner.query("SELECT origin FROM profitia_external_call.policies WHERE resource_id='srm-provider:mgbi' LIMIT 1")).rows[0].origin
   const external={configurationVersion:'company-provider-v1',schemaDigest:hash(f.core('009-external-call-admission.sql')),nativeSchemaDigest:hash(f.core('012-native-external-transport.sql')),maximumResponseBytes:1048576}
   const native=createSrmNativeCompanyLookup({companySourcePolicy:'MGBI_ONLY',work:{...f.workOptions,workSchemaDigest:hash(f.core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))},
    namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),financialInventoryBoundaryDigest:hash(own('023-financial-inventory-work.sql')),readyCompanyWorkBoundaryDigest:hash(own('026-ready-company-work.sql')),source:f.source,
    corporate:{application,binding:{...sourceOptions.binding,applicationId:application.appId,role:sourceRole,deploymentId:application.deploymentId,configurationVersion:application.configurationVersion},pool,auditPool,
      publicationSchemaDigest:hash(own('004-corporate-source.sql')+own('005-corporate-source-access.sql')+read('../src/server/corporate-source-shape.json')),readyReportSchemaDigest:digest},
    mgbi:{apiKey:'synthetic-native-company-key',authScheme:'raw',source:{...sourceOptions,external,syntheticOrigin},msrExternal:{...external,maximumResponseBytes:20*1024*1024}}})
   const card=await native.run({requestId:accepted.requestId,organisationId:A,command:accepted.command})
   assert.equal(card.identity.nip,selectedNip);assert(card.financial.data)
   const units=(await owner.query("SELECT event->'requestWork'->>'unitId' unit FROM profitia_access.security_events WHERE event->'requestWork'->>'requestId'=$1 AND phase='OUTCOME' ORDER BY event_id",[accepted.requestId])).rows.map(r=>r.unit)
   assert.deepEqual(units,['SRM_REGISTER_LOOKUP','SRM_STORE_COMPANY']);assert(!units.includes('SRM_STORE_GENERAL'));assert(!units.includes('SRM_STORE_FINANCIAL'));assert(!units.includes('SRM_RECORD_INTEREST'))
   assert.equal(units.filter(unit=>unit==='SRM_CACHE_READ').length,0,'registration reads the cache once; no cache or indicator reconstruction Work')
   const before=(await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE event->>'operation'='job.execute'")).rows[0].n
   const result=await ready.read(request(),A,selectedNip);assert(result.response)
   const output=await result.response.json();assert(output.metadata.financial.scanner);assert(output.metadata.financial.history.length)
   assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE event->>'operation'='job.execute'")).rows[0].n,before)
   console.info('READY_FRESH_LOCAL_UNITS',JSON.stringify(units))
  })
  await t.test('a retained current catalogue upgrades through original Source without HTTP, downloads or new private snapshots',async()=>{
   const warmNip='1130089950',warmKrs='0000000002',checkedAt=new Date().toISOString();
   const warmGeneral=mapMgbiGeneralRecords([{id:'c'.repeat(24),identifiers:{pl_nip:warmNip,pl_krs:warmKrs},content:{current_excerpt:{naglowekA:{numerKRS:warmKrs,dataRejestracjiWKRS:'2001-01-01'},dane:{dzial1:{danePodmiotu:{nazwa:'Synthetic retained company',formaPrawna:'SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ'}}}}}}],{type:'NIP',value:warmNip},checkedAt).section;
   const warmFinancial=mapMgbiFinancialRecords([{id:'d'.repeat(24),identifiers:{pl_nip:warmNip,pl_krs:warmKrs},document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31',is_ias_compliant:false},content:{schema:{name:'JednostkaInnaWZlotych'},standardized_fields:{bs:{a_ta_cfy:'100',a_ca_cfy:'60',lae_lapfl_stl_cfy:'20',lae_lapfl_cfy:'40'},pala:{nrfs_cfy:'200',npl_cfy:'10',plfoa_cfy:'15'}}}}],{type:'NIP',value:warmNip},checkedAt,1,warmGeneral.data.registryHistory);
   const corporateOptions={application,binding:{...sourceOptions.binding,applicationId:application.appId,role:sourceRole,deploymentId:application.deploymentId,configurationVersion:application.configurationVersion},pool,auditPool,
    publicationSchemaDigest:hash(own('004-corporate-source.sql')+own('005-corporate-source-access.sql')+read('../src/server/corporate-source-shape.json'))};
   const legacySource=createSrmCorporateSourceStore(corporateOptions);
   await legacySource.publish({version:CORPORATE_PUBLICATION_VERSION,nip:warmNip,general:warmGeneral,financial:warmFinancial.section,facts:warmFinancial.facts,preserveGeneral:false},hash('retained-before-upgrade:'+randomUUID()));
   assert.equal((await owner.query('SELECT count(*)::int n FROM srm.ready_company_reports WHERE nip=$1',[warmNip])).rows[0].n,0);
   const retainedCatalog=(await owner.query('SELECT * FROM srm.catalog_companies WHERE nip=$1',[warmNip])).rows;
   const retainedFacts=(await owner.query('SELECT * FROM srm.catalog_financial_facts WHERE nip=$1 ORDER BY metric_code,period_start',[warmNip])).rows;
   const snapshots=(await owner.query('SELECT count(*)::int n FROM srm.source_snapshots')).rows[0].n;
   const calls=(await owner.query('SELECT count(*)::int n FROM profitia_external_call.calls')).rows[0].n;
   const accepted=await f.parent(A,warmNip),selected={requestId:accepted.requestId,organisationId:A,command:accepted.command};
   const external={configurationVersion:'company-provider-v1',schemaDigest:hash(f.core('009-external-call-admission.sql')),nativeSchemaDigest:hash(f.core('012-native-external-transport.sql')),maximumResponseBytes:1048576};
   const syntheticOrigin=(await owner.query("SELECT origin FROM profitia_external_call.policies WHERE resource_id='srm-provider:mgbi' LIMIT 1")).rows[0].origin;
   const native=createSrmNativeCompanyLookup({companySourcePolicy:'MGBI_ONLY',work:{...f.workOptions,workSchemaDigest:hash(f.core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))},namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),
    financialInventoryBoundaryDigest:hash(own('023-financial-inventory-work.sql')),readyCompanyWorkBoundaryDigest:hash(own('026-ready-company-work.sql')),source:f.source,corporate:{...corporateOptions,readyReportSchemaDigest:digest},
    mgbi:{apiKey:'synthetic-retained-key',authScheme:'raw',source:{...sourceOptions,external,syntheticOrigin},msrExternal:{...external,maximumResponseBytes:20*1024*1024}}});
   await native.run(selected);
   assert.deepEqual((await owner.query('SELECT * FROM srm.catalog_companies WHERE nip=$1',[warmNip])).rows,retainedCatalog);
   assert.deepEqual((await owner.query('SELECT * FROM srm.catalog_financial_facts WHERE nip=$1 ORDER BY metric_code,period_start',[warmNip])).rows,retainedFacts);
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_external_call.calls')).rows[0].n,calls);
   assert.equal((await owner.query('SELECT count(*)::int n FROM srm.source_snapshots')).rows[0].n,snapshots);
   const units=(await owner.query("SELECT event->'requestWork'->>'unitId' unit FROM profitia_access.security_events WHERE event->'requestWork'->>'requestId'=$1 AND phase='OUTCOME' ORDER BY event_id",[accepted.requestId])).rows.map(r=>r.unit);
   assert.deepEqual(units,['SRM_REGISTER_LOOKUP','SRM_PREPARE_DOCUMENTS']);
   const released=await ready.read(request(),A,warmNip);assert(released.response);const report=await released.response.json();
   assert.equal(report.identity.nip,warmNip);assert(report.metadata.financial.history.some(series=>series.code==='CURRENT_RATIO'&&series.points.some(point=>point.value==='3.000000')));
   const altered=structuredClone(warmGeneral);altered.data.legalName='Different unretained company';
   const sourceEffects=(await owner.query('SELECT count(*)::int n FROM profitia_ingestion.effects')).rows[0].n;
   const upgradeSource=createSrmCorporateSourceStore({...corporateOptions,readyReportSchemaDigest:digest});
   await assert.rejects(upgradeSource.publish({version:CORPORATE_PUBLICATION_VERSION,nip:warmNip,general:altered,financial:warmFinancial.section,facts:[],preserveGeneral:true},
    hash('refuse-retained-mutation:'+randomUUID()),{documents:[],retainCurrentCatalog:true}),isOperationDenied);
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_ingestion.effects')).rows[0].n,sourceEffects);
   assert.deepEqual((await owner.query('SELECT * FROM srm.catalog_companies WHERE nip=$1',[warmNip])).rows,retainedCatalog);
   console.info('READY_RETAINED_WARMUP_UNITS',JSON.stringify(units));
  });
  await t.test('account revocation before disclosure rolls back local selection history and withholds every report field',async()=>{
   const before=await counts();banAtOutcome=true
   await assert.rejects(ready.read(request(),A,NIP),isOperationDenied)
   assert.deepEqual(await counts(),before);banAtOutcome=false
  })
  await t.test('a Source revision between entry and disclosure cannot release a mixed prepared report',async()=>{
   let checks=0
   const changed=structuredClone(packet);changed.general.data.registeredAddress='Synthetic changed registered address'
   const racing={...base,clerk:{...original,users:{getUser:async(...args)=>{
     if(++checks===2)await source.publish(changed,hash('ready-racing-source:'+randomUUID()),{documents:[]})
     return original.users.getUser(...args)
    }}},application:{...base.application,operations:['supplier.report.read']}}
   const reader=createSrmReadyCompanyRead(racing,digest,'s'.repeat(40)),before=await counts()
   await assert.rejects(reader.read(request(),A,NIP),error=>isOperationDenied(error)&&error.reasonCode==='RESOURCE_VERSION_CONFLICT')
   assert.deepEqual(await counts(),before);assert.equal(checks,2)
   assert((await owner.query('SELECT count(*)::int n FROM srm.ready_company_reports WHERE nip=$1',[NIP])).rows[0].n>=2)
  })
  await t.test('module membership without the standard report read grant cannot read another organization',async()=>{
   const before=await counts();await assert.rejects(ready.read(request(),B,NIP),isOperationDenied);assert.deepEqual(await counts(),before)
  })
  await t.test('an explicit supplier DENY still overrides standard shared module read access',async()=>{
   const id=randomUUID();await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,resource_id,feature) VALUES($1,'srm',$2,$3,'DENY','supplier.report.read',$4,'supplier_report')",[id,A,U,'supplier-report:COMPANY:'+NIP]))
   const before=await counts();await assert.rejects(ready.read(request(),A,NIP),isOperationDenied);assert.deepEqual(await counts(),before)
   await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[id]))
  })
  await t.test('unadmitted SQL cannot fabricate metadata history or a current read from GUCs alone',async()=>{
   const client=await f.pool.connect()
   try{await assert.rejects(client.query('SELECT srm.register_ready_report_read($1,$2,$3,$4,$5,$6)',[A,U,NIP,'a'.repeat(64),randomUUID(),'null']))}finally{client.release()}
  })
 }finally{await pool.end();await auditPool.end()}
},{companySourcePolicy:'MGBI_ONLY',privateAcquisition:true}))
