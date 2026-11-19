import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {supplierBusinessFixture} from './supplier-delegated-business.integration.test.mjs'
import {createSrmCachedSupplierIdentityRead} from '../src/server/supplier-cached-identity.ts'
import pg from 'pg'
import fs from 'node:fs'
import {createSrmCorporateSourceStore,CORPORATE_PUBLICATION_VERSION} from '../src/server/corporate-source-store.ts'
import {mapMgbiGeneralRecords} from '../src/server/mgbi-general.ts'
import {mapMgbiFinancialRecords} from '../src/server/mgbi-financial.ts'
import {isOperationDenied} from '@profitia/platform-contracts/operation-context'

test('cached supplier identity native current HUMAN read refuses changed versions and revoked users',t=>supplierBusinessFixture(t,true,async f=>{
 const {owner,controlled,humanOptions,A,B,U,NIP,own,core,hash}=f
 await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW','supplier.report.read','supplier_report')",[randomUUID(),A,U]))
 const sourceRole='srm_company_publication_runtime',url=new URL(process.env.SRM_OPERATION_TEST_OWNER_URL)
 url.pathname='/'+f.baseBinding.databaseName;url.username=sourceRole;url.password='isolated_ci_only'
 const pool=new pg.Pool({connectionString:url.toString(),max:2}),auditPool=new pg.Pool({connectionString:url.toString(),max:1})
 try{
 const application={...f.sourceOptions.application,appId:'srm-corporate-source',deploymentId:'synthetic-company-publication',configurationVersion:'corporate-v1'}
 const source=createSrmCorporateSourceStore({application,binding:{...f.sourceOptions.binding,applicationId:application.appId,role:sourceRole,deploymentId:application.deploymentId,configurationVersion:application.configurationVersion},pool,auditPool,
  publicationSchemaDigest:hash(own('004-corporate-source.sql')+own('005-corporate-source-access.sql')+fs.readFileSync(new URL('../src/server/corporate-source-shape.json',import.meta.url),'utf8'))})
 async function publish(name){
  const at=new Date().toISOString(),krs='0000000001'
  const general=mapMgbiGeneralRecords([{id:'a'.repeat(24),identifiers:{pl_nip:NIP,pl_krs:krs},content:{current_excerpt:{naglowekA:{numerKRS:krs,dataRejestracjiWKRS:'2001-01-01'},dane:{dzial1:{danePodmiotu:{nazwa:name,formaPrawna:'SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ'}}}}}}],{type:'NIP',value:NIP},at).section
  const financial=mapMgbiFinancialRecords([{id:'b'.repeat(24),identifiers:{pl_nip:NIP,pl_krs:krs},document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31',is_ias_compliant:false},content:{schema:{name:'JednostkaInnaWZlotych'},standardized_fields:{bs:{a_ta_cfy:'100'},pala:{nrfs_cfy:'200'}}}}],{type:'NIP',value:NIP},at,1,general.data.registryHistory)
  await source.publish({version:CORPORATE_PUBLICATION_VERSION,nip:NIP,general,financial:financial.section,facts:financial.facts,preserveGeneral:false},hash('cached-identity-source:'+randomUUID()))
 }
 await publish('Synthetic confirmed supplier')
 const {requestLedger:_ledger,commandBoundaryDigest:_boundary,...base}=humanOptions
 const options=clerk=>({...base,clerk,application:{...base.application,operations:['supplier.report.read']}})
 const request=()=>new Request(base.identity.authorizedParties[0]+'/api/xray/presentation/registry-selection',{method:'POST',headers:{origin:base.identity.authorizedParties[0],'content-type':'application/json'},body:JSON.stringify({nip:NIP})})
 await t.test('actual native catalog publication has a minimal current read without acquisitions',async()=>{
  const before=await f.counts(),reader=createSrmCachedSupplierIdentityRead(options(base.clerk))
  const response=await reader.read(request(),A,NIP),value=await response.json()
  assert.equal(response.status,200);assert.equal(value.nip,NIP);assert.equal(value.name,'Synthetic confirmed supplier');assert.match(value.selectionRef,/^[a-f0-9]{64}$/)
  assert.deepEqual(Object.keys(value).sort(),['krs','locality','name','nip','selectionRef']);assert.deepEqual(await f.counts(),before)
  await assert.rejects(reader.read(request(),B,NIP),isOperationDenied)
 })
 await t.test('current account revocation after H1 prevents the response',async()=>{
  let reads=0;const clerk={...base.clerk,users:{getUser:async id=>({...await base.clerk.users.getUser(id),banned:++reads>1})}}
  await assert.rejects(createSrmCachedSupplierIdentityRead(options(clerk)).read(request(),A,NIP),e=>isOperationDenied(e)&&e.reasonCode==='UNVERIFIED_IDENTITY')
  assert.equal(reads,2)
 })
 await t.test('a real native publication between H1 and H2 invalidates the selected version',async()=>{
  let reads=0;const clerk={...base.clerk,users:{getUser:async id=>{if(++reads===2)await publish('Synthetic changed supplier');return base.clerk.users.getUser(id)}}}
  await assert.rejects(createSrmCachedSupplierIdentityRead(options(clerk)).read(request(),A,NIP),e=>isOperationDenied(e)&&e.reasonCode==='RESOURCE_VERSION_CONFLICT')
  assert.equal(reads,2)
 })
 }finally{await pool.end();await auditPool.end()}
}))
