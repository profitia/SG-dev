import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID} from 'node:crypto'
import {supplierBusinessFixture} from './supplier-delegated-business.integration.test.mjs'
import {createReportAdmissionStore,reportAdmissionSchemaUrl} from '@profitia/platform-contracts/report-admission'
import {createSrmSupplierSourceLink} from '../src/server/supplier-source-link.ts'
import {createSrmSupplierNativeWork} from '../src/server/supplier-request-work.ts'
import {createSrmNativePgDriver} from '../src/server/native-pg-driver.ts'
import {createPrivateOperationHost} from '@profitia/platform-contracts/private-operation-host'
import {OPERATION_CONTRACT,isOperationDenied} from '@profitia/platform-contracts/operation-context'
import {createSrmReportAdmissionRuntime,prepareSrmReportAdmission} from '../src/server/report-admission-runtime.ts'
import {createSrmPrivateOperationHost} from '../src/server/private-operation-host.ts'

test('real ordinary report admission freezes only the exact human command; current technical Work, RLS and audit remain mandatory',t=>supplierBusinessFixture(t,true,async f=>{
 const sql=fs.readFileSync(new URL(reportAdmissionSchemaUrl),'utf8'),schemaDigest=f.hash(sql)
 await f.owner.query(`GRANT CREATE ON DATABASE ${f.baseBinding.databaseName} TO profitia_access_owner`)
 await f.controlled(async()=>{
  await f.owner.query(sql)
  await f.owner.query("INSERT INTO profitia_report_admission.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[schemaDigest])
  await f.owner.query('INSERT INTO profitia_report_admission.receivers VALUES($1,$2,true)',[f.FOREGROUND,f.EXECUTOR])
  await f.owner.query("INSERT INTO profitia_request_work.policies(application_id,unit_id,access_mode,status,source_ref,expires_at) VALUES('srm','FORM_REPORT_ADMISSION','WRITE','ACTIVE','SYNTHETIC_ONLY',clock_timestamp()+interval '1 hour')")
  for(const role of[f.FOREGROUND,f.EXECUTOR])await f.owner.query(`GRANT USAGE ON SCHEMA profitia_report_admission TO ${role};GRANT EXECUTE ON FUNCTION profitia_report_admission.runtime_descriptor(),profitia_report_admission.read(uuid,text),profitia_report_admission.start(uuid,text) TO ${role}`)
  await f.owner.query(`GRANT EXECUTE ON FUNCTION profitia_report_admission.issue(uuid,text,text),profitia_report_admission.bind_job(uuid,text,uuid),profitia_report_admission.append_job_intent(uuid,text,jsonb) TO ${f.EXECUTOR};GRANT EXECUTE ON FUNCTION profitia_report_admission.bind_human(uuid,text,text,text,text) TO ${f.FOREGROUND}`)
  for(const op of['supplier.report.read','supplier.report.project'])await f.owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW',$4,'supplier_report')",[randomUUID(),f.A,f.U,op])
 })
 await f.owner.query(`REVOKE CREATE ON DATABASE ${f.baseBinding.databaseName} FROM profitia_access_owner`)
 const {executionMode,...base}=f.workOptions
 const workOptions={...base,workSchemaDigest:f.hash(f.core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:f.hash(f.own('008-supplier-native-work.sql')),reportAdmission:{schemaDigest}}
 const link=createSrmSupplierSourceLink({work:workOptions,namedInterestBoundaryDigest:f.hash(f.own('003-named-supplier-interest.sql')),source:f.source})
 const accepted=await f.parent(),selection={requestId:accepted.requestId,organisationId:accepted.organisationId,command:accepted.command}
 const before=await f.counts(),sourceBefore=await f.sourceCounts()
 const grant=await prepareSrmReportAdmission(workOptions,selection)
 const prepared={admission:grant}
 assert.deepEqual(await f.counts(),before,'Preparing must not create suppliers, lookups or Financial snapshots')
 assert.deepEqual(await f.sourceCounts(),sourceBefore,'No Source delivery or paid acquisition before Search')
 const store=createReportAdmissionStore({binding:f.baseBinding,schemaDigest})
 const query=async(sql,args)=>{const c=await f.pool.connect();try{return await c.query(sql,args)}finally{c.release()}}
 await store.load(query,prepared.admission.token)
 const admitted=createSrmReportAdmissionRuntime({config:{...f.humanOptions,provider:'clerk'},pool:f.pool,api:{}})
 let clerkCalls=0
 f.clerk.users.getUser=async()=>{clerkCalls++;throw Error('No online Clerk reads after admission')}
 f.clerk.sessions.getSession=async()=>{clerkCalls++;throw Error('No online Clerk reads after admission')}
 f.clerk.authenticateRequest=async()=>{clerkCalls++;throw Error('No online Clerk reads after admission')}
 const work=createSrmSupplierNativeWork(workOptions),request=new Request('http://localhost:3400/api/xray/search',{method:'POST',headers:{origin:'http://localhost:3400','X-SRM-Report-Admission':prepared.admission.token}})
 await f.controlled(async()=>{
  await f.owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[f.A,f.U])
  await f.owner.query("UPDATE profitia_access.accounts SET status='DISABLED' WHERE user_id=$1",[f.U])
 })
 await admitted.run(request,async()=>{const started=await link.registerAndAdmit(selection,'KEEP');assert.equal(started.sourceStatus,'CONFIRMED')})
 let ran=0
 await admitted.run(request,()=>work.run(selection,'SRM_CACHE_READ',null,async(context,client)=>{
  assert.equal(context.subjectUserId,f.U);assert.equal(context.organisationId,f.A)
  assert.equal((await client.query("SELECT current_setting('srm.organization_id') org")).rows[0].org,f.A);ran++
 }))
 assert.equal(ran,1);assert.equal(clerkCalls,0)
 await assert.rejects(work.run(selection,'SRM_CACHE_READ',null,async()=>{}),isOperationDenied)
 const host=createSrmPrivateOperationHost({...f.humanOptions,requestLedger:undefined,application:{...f.humanOptions.application,operations:['supplier.report.read']},
  reportAdmission:{schemaDigest},
  readResources:async({request})=>({resource:{id:request.resourceId,type:'supplier_report',dataClass:'SHARED_KNOWLEDGE',environment:'development',ownerOrganisationId:null,ownerUserId:null,version:'fixture',projectionVersion:'fixture',approvedSharedProjection:true}}),projectOutput:v=>v})
 const operation={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.report.read',organisationId:f.A,resourceId:'supplier-report:COMPANY:'+f.NIP,payload:{nip:f.NIP},request}
 assert.equal((await admitted.run(request,()=>host.execute(operation,()=>({safe:true})))).value.safe,true)
 await assert.rejects(admitted.run(request,()=>host.execute({...operation,resourceId:'supplier-report:COMPANY:'+f.OTHER_NIP},()=>assert.fail())),isOperationDenied)
 await assert.rejects(admitted.run(request,()=>work.run({...selection,organisationId:f.B},'SRM_CACHE_READ',null,async()=>assert.fail())),isOperationDenied)
 await assert.rejects(store.load(query,prepared.admission.token.slice(0,-1)+(prepared.admission.token.endsWith('0')?'1':'0')),isOperationDenied)
 await f.controlled(()=>f.owner.query("UPDATE profitia_report_admission.receivers SET enabled=false WHERE foreground_role=$1",[f.FOREGROUND]))
 await assert.rejects(admitted.run(request,()=>work.run(selection,'SRM_CACHE_READ',null,async()=>assert.fail())),isOperationDenied)
 await f.controlled(()=>f.owner.query('UPDATE profitia_report_admission.receivers SET enabled=true WHERE foreground_role=$1',[f.FOREGROUND]))
 assert.equal((await admitted.run(request,()=>host.execute(operation,()=>({safe:true})))).value.safe,true)
 const previousStatus=(await f.owner.query('SELECT status FROM profitia_jobs.dispatches WHERE job_id=$1',[selection.requestId])).rows[0].status
 await f.controlled(()=>f.owner.query("UPDATE profitia_jobs.dispatches SET status='CANCELLED' WHERE job_id=$1",[selection.requestId]))
 await assert.rejects(admitted.run(request,()=>work.run(selection,'SRM_CACHE_READ',null,async()=>assert.fail())),isOperationDenied)
 await f.controlled(()=>f.owner.query("UPDATE profitia_jobs.dispatches SET status=$2 WHERE job_id=$1",[selection.requestId,previousStatus]))
 await f.controlled(()=>f.owner.query("UPDATE profitia_report_admission.admissions SET created_at=clock_timestamp()-interval '5 minutes',ready_until=clock_timestamp()-interval '4 minutes',expires_at=clock_timestamp()-interval '3 minutes' WHERE request_id=$1",[selection.requestId]))
 await assert.rejects(admitted.run(request,()=>work.run(selection,'SRM_CACHE_READ',null,async()=>assert.fail())),isOperationDenied)
 assert.equal(clerkCalls,0)
}))
