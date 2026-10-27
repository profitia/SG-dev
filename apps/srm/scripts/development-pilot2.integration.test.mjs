import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import {randomUUID} from 'node:crypto'
import {supplierBusinessFixture} from './supplier-delegated-business.integration.test.mjs'
import {createSrmSupplierNativeWork} from '../src/server/supplier-request-work.ts'
import {createSrmSupplierNativeWorkStore} from '../src/server/supplier-native-work-store.ts'
import {createSrmSupplierSourceLink} from '../src/server/supplier-source-link.ts'
import {developmentPilot2RegistryPlan} from './development-pilot2-installation.mjs'
import {createDevelopmentKrsProjection} from '../src/server/development-pilot2-runtime.ts'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const role='srm_private_development_jobs',deployment='srv-db1vu6gm7kps73d0e3r0:'+ 'a'.repeat(40)+':srm-jobs'

test('main KRS receiver commits genuine delegated General and retains tenant, revocation and provenance fences',{
 skip:!process.env.SRM_OPERATION_TEST_OWNER_URL},async t=>{
 let databaseName,createdRole=false
 t.after(async()=>{
  const root=new pg.Client({connectionString:process.env.SRM_OPERATION_TEST_OWNER_URL});await root.connect()
  try{
   if(databaseName){assert.match(databaseName,/^srm_service_business_[a-f0-9]{32}$/);await root.query('DROP DATABASE '+databaseName+' WITH(FORCE)')}
   if(createdRole)await root.query('DROP ROLE '+role)
  }finally{await root.end()}
 })
 await supplierBusinessFixture(t,true,async f=>{
  databaseName=f.baseBinding.databaseName
  const existing=(await f.owner.query('SELECT rolcanlogin,rolsuper,rolbypassrls,rolinherit,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=$1',[role])).rows[0]
  if(existing)assert.deepEqual(existing,{rolcanlogin:true,rolsuper:false,rolbypassrls:false,rolinherit:false,rolcreaterole:false,rolcreatedb:false})
  else{await f.owner.query(`CREATE ROLE ${role} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT 4`);createdRole=true}
  await f.owner.query('GRANT CONNECT ON DATABASE '+databaseName+' TO '+role)
  await f.controlled(async()=>{
   await f.owner.query(f.own('022-pilot2-registry-envelope.sql'))
   await f.owner.query("INSERT INTO srm.pilot2_registry_envelope_installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[f.hash(f.own('022-pilot2-registry-envelope.sql'))])
   await f.owner.query("INSERT INTO profitia_access.runtime_bindings VALUES($1,'srm-jobs','ACTIVE')",[role])
   await f.owner.query(`INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at)
    VALUES($1,$2,'47049035-a163-51cc-9ba5-3b455669d864','PLATFORM_INTERNAL',$3,'jobs-v1','ACTIVE','SYNTHETIC_ONLY',clock_timestamp()+interval '1 hour')`,[role,randomUUID(),deployment])
   await f.owner.query(`INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,resource_id,effect,status,source_ref,expires_at)
    SELECT gen_random_uuid(),$1,binding_id,organisation_id,resource_id,effect,status,'SYNTHETIC_ONLY',expires_at
    FROM profitia_jobs.execution_grants WHERE login_role=$2`,[role,f.EXECUTOR])
  })
  // Clone only the already reviewed ordinary executor's explicit object ACLs.
  const acl=(await f.owner.query(`SELECT format('GRANT USAGE ON SCHEMA %I TO %I',n.nspname,$1::text) command FROM pg_namespace n
    CROSS JOIN LATERAL aclexplode(n.nspacl)a WHERE a.grantee=$2::regrole AND a.privilege_type='USAGE'
   UNION ALL SELECT format('GRANT EXECUTE ON FUNCTION %s TO %I',p.oid::regprocedure,$1::text) FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(p.proacl)a WHERE a.grantee=$2::regrole AND a.privilege_type='EXECUTE'
   UNION ALL SELECT format('GRANT %s ON TABLE %s TO %I',a.privilege_type,c.oid::regclass,$1::text) FROM pg_class c
    CROSS JOIN LATERAL aclexplode(c.relacl)a WHERE a.grantee=$2::regrole`,[role,f.EXECUTOR])).rows
  for(const r of acl)await f.owner.query(r.command)
  // The live migration must refuse any other database/project. Change only
  // this disposable fixture's technical identity for the installation, then
  // restore it before executing its genuine synthetic HUMAN/Work contracts.
  await assert.rejects(f.controlled(()=>f.owner.query(f.own('024-development-pilot2-receiver.sql'))))
  await f.controlled(async()=>{
   await f.owner.query("UPDATE profitia_access.installation SET project_id='spring-bread-28217539',branch_id='br-sparkling-term-b99l107x'")
   await f.owner.query(f.own('024-development-pilot2-receiver.sql'))
   await f.owner.query("UPDATE profitia_access.installation SET project_id='isolated-srm-service-project',branch_id='isolated-srm-service-branch'")
  })
  const url=new URL(process.env.SRM_OPERATION_TEST_OWNER_URL);url.username=role;url.pathname='/'+databaseName
  const pool=new pg.Pool({connectionString:url.href,max:2}),audit=new pg.Pool({connectionString:url.href,max:1})
  try{
   const options={...f.workOptions,pool,auditPool:audit,application:{...f.workOptions.application,deploymentId:deployment},
    binding:{...f.workOptions.binding,role,service:{...f.workOptions.binding.service,deploymentId:deployment}},
    workSchemaDigest:f.hash(f.core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:f.hash(f.own('008-supplier-native-work.sql'))}
   const work=createSrmSupplierNativeWork(options)
   const store=createSrmSupplierNativeWorkStore({work,namedInterestBoundaryDigest:f.hash(f.own('003-named-supplier-interest.sql')),
    registryEnvelopeBoundaryDigest:f.hash(f.own('022-pilot2-registry-envelope.sql'))})
   const link=createSrmSupplierSourceLink({work:options,namedInterestBoundaryDigest:f.hash(f.own('003-named-supplier-interest.sql')),source:f.source})
   const accepted=await f.parent(),selection={requestId:accepted.requestId,organisationId:accepted.organisationId,command:accepted.command}
   await link.registerAndAdmit(selection)
   const at=new Date().toISOString(),ref='KRS:0000000001:'+ 'b'.repeat(64)
   const general={status:'SUCCESS',source:{provider:'KRS',model:'OdpisAktualny',recordId:ref},retrievedAt:at,effectiveAt:null,warnings:[],
    data:{nip:f.NIP,krs:'0000000001',legalName:'SYNTHETIC_ONLY',legalForm:null,regon:null,registeredAddress:null,
     registeredAt:null,mainPkd:null,registrationStatus:'ACTIVE',registrySource:{provider:'KRS',evidenceRef:ref,retrievedAt:at,coverage:'PROGRESSIVE'}}}
   await store.section(selection,'general',general,null)
   const row=(await f.owner.query('SELECT s.organization_id,s.pilot2_registry_envelope FROM srm.source_snapshots s JOIN srm.provider_attempts a ON a.id=s.attempt_id AND a.organization_id=s.organization_id WHERE a.request_id=$1',[accepted.requestId])).rows[0]
   assert.equal(row.organization_id,f.A);assert.deepEqual(row.pilot2_registry_envelope,general)
   const before=await f.counts()
   await assert.rejects(store.section({...selection,organisationId:f.B},'general',general,null))
   await f.controlled(()=>f.owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[f.A,f.U]))
   await assert.rejects(store.section(selection,'general',general,null))
   assert.deepEqual(await f.counts(),before,'Denied attempts cannot alter committed ownership/history')
   await f.controlled(async()=>{
    await f.owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[f.A,f.U])
    await f.owner.query("UPDATE profitia_access.applications SET fixed_organisation_id=$1 WHERE application_id='srm'",[f.A])
    await f.owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW','supplier.report.read','supplier_report')",[randomUUID(),f.A,f.U])
   })
   const projection=createDevelopmentKrsProjection({...f.humanOptions,
    application:{...f.humanOptions.application,profileId:'PORR_SUITE',organisationId:f.A}})
   const publicValue={selection:{general,history:{version:'KRS_CONTINUITY_V1',currentKrs:'0000000001',members:[],links:[],unlinkedKrs:[]},
    identity:{status:'VERIFIED',identity:{nip:f.NIP},selectedKrs:'0000000001',evidenceRef:ref}}}
   const request=new Request('http://localhost:3400/api/xray/search',{method:'POST',headers:{origin:'http://localhost:3400'}})
   const sourceBefore=await f.sourceCounts()
   assert.deepEqual(await projection(request,f.NIP,publicValue),publicValue)
   const audited=(await f.owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' AND event->>'operation'='supplier.report.read' ORDER BY recorded_at DESC LIMIT 1")).rows[0].event
   assert.equal(audited.reasonCode,'SUCCEEDED');assert.equal(audited.resourceId,'supplier-report:COMPANY:'+f.NIP)
   await f.controlled(()=>f.owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[f.A,f.U]))
   await assert.rejects(projection(request,f.NIP,publicValue))
   assert.deepEqual(await f.sourceCounts(),sourceBefore,'Final protected projection cannot acquire provider data')
  }finally{await pool.end();await audit.end()}
 })
})

test('registry plan has no effects and adds only one ordinary public Source with explicit owner approval',()=>{
 const plan=developmentPilot2RegistryPlan('a'.repeat(40))
 assert.equal(plan.role,'srm_development_krs_source');assert.equal(plan.remoteExecutionApproved,false)
 assert.equal(plan.requiresExplicitOwnerAccessApproval,true)
 for(const sha of ['main','A'.repeat(40),'a'.repeat(39)])assert.throws(()=>developmentPilot2RegistryPlan(sha))
 assert.equal(plan.existingBudgetsChanged,false);assert.equal(plan.existingBindingsChanged,false);assert.equal(plan.paidProviderAllowanceAdded,false)
})

test('selective adoption pins current source and preserves every previous receipt and UI byte',()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.developmentPilot2Adoption
 const hash=v=>createHash('sha256').update(v).digest('hex')
 const prior=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(prior),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(prior)))assert.deepEqual(receipt[k],v,k)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(fs.readFileSync(new URL('../'+file,import.meta.url))),digest,file)
 for(const[file,digest]of Object.entries(a.preservedUiDigests)){
  assert.equal(hash(execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/'+file])),digest)
  assert.equal(hash(fs.readFileSync(new URL('../'+file,import.meta.url))),digest,file)
 }
 assert.equal(a.humanEntitlementsChanged,false);assert.equal(a.sharedE1ContractChanged,false);assert.equal(a.stagingMutation,false)
 assert.equal(a.maximumNewLicensedOriginalsPerRequest,1)
})
