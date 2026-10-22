// Disposable PostgreSQL16 only, via the existing canonical local/Docker fixture.
// No DATABASE_URL, Neon, provider, live account or production time control.
import {postgresFixture} from './identity-profile-postgres.mjs'
import fs from 'node:fs'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import pg from '../../../../apps/architecture-lab/node_modules/pg/lib/index.js'
import {createPrivateOperationHost} from '../../src/private-operation-host.mjs'
import {createSupplierLocationAdmission,supplierLocationAdmissionSchemaDigest} from '../../src/supplier-location.mjs'
import {OPERATION_CONTRACT,operationPayloadDigest} from '../../src/operation-context.mjs'
const hash=v=>createHash('sha256').update(v).digest('hex')
const source=n=>fs.readFileSync(new URL('../../migrations/access/'+n,import.meta.url),'utf8')
const files=['002-module-scope.sql','003-module-audit.sql','005-service-read.sql','006-request-reservation.sql','007-delegated-jobs.sql','010-external-request-admission.sql','011-request-continuation.sql','013-supplier-delegation.sql','014-delegated-private-phases.sql','015-delegated-private-inspection.sql','016-delegated-native-work.sql','017-additional-request-operations.sql','019-supplier-location-operations.sql']
const tables=['profitia_modules.installation','profitia_modules.audit_installation','profitia_services.installation','profitia_requests.installation','profitia_jobs.installation','profitia_requests.external_installation','profitia_request_phases.installation','profitia_supplier_jobs.installation','profitia_delegated_phases.installation','profitia_request_inspection.installation','profitia_request_work.installation','profitia_requests.operation_installation','profitia_requests.location_installation']
export async function supplierLocationFixture(){
 const f=await postgresFixture(),admin=f.admin,pools=[],audits=[]
 const A=randomUUID(),B=randomUUID(),U=randomUUID(),V=randomUUID(),S=randomUUID(),foreignSupplier=randomUUID(),key=randomBytes(32),future=()=>new Date(Date.now()+3600000).toISOString()
 const roles=['p1_foreground','p1_second_executor'],issuer='https://p1.fixture.test'
 const controlled=async run=>{await admin.query('BEGIN;SET LOCAL ROLE profitia_access_owner');try{const v=await run(admin);await admin.query('COMMIT');return v}catch(e){await admin.query('ROLLBACK');throw e}}
 try{
  await admin.query('RESET ROLE')
  await controlled(async c=>{
   await c.query("UPDATE profitia_access.applications SET status='DISABLED'")
   for(let i=0;i<files.length;i++){const sql=source(files[i]);await c.query(sql);if(i===0)await c.query("INSERT INTO profitia_modules.installation VALUES(true,'1.0.0',$1)",[hash(sql)]);else await c.query(`INSERT INTO ${tables[i]} VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')`,[hash(sql)])}
   await c.query('SAVEPOINT p1_installation_probe')
   await c.query(source('020-supplier-location-admission.sql'))
   await c.query('ROLLBACK TO SAVEPOINT p1_installation_probe')
   if((await c.query("SELECT to_regclass('profitia_requests.location_admission_installation') AS relation")).rows[0].relation!==null)throw Error('Partial migration survived rollback')
   await c.query(source('020-supplier-location-admission.sql'))
   await c.query("INSERT INTO profitia_requests.location_admission_installation VALUES(true,'1.0.0',$1,'SYNTHETIC_P1_NOT_RELEASE')",[await supplierLocationAdmissionSchemaDigest()])
  })
  for(const role of roles)await admin.query(`CREATE ROLE ${role} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
  await controlled(async c=>{
   for(const user of[U,V]){
    await c.query("INSERT INTO profitia_access.accounts VALUES($1,'ACTIVE',1)",[user])
    await c.query("INSERT INTO profitia_access.external_identities VALUES($1,$2,$3,$4,'ACTIVE',1,'SYNTHETIC_ONLY',$5)",[randomUUID(),issuer,'subject-'+user,user,future()])
   }
   for(const org of[A,B]){
    await c.query("INSERT INTO profitia_access.organisations VALUES($1,'ACTIVE',1)",[org])
    for(const user of[U,V])await c.query("INSERT INTO profitia_access.memberships VALUES($1,$2,'ACTIVE',1,'SYNTHETIC_ONLY',$3)",[org,user,future()])
   }
   for(const[role,app]of roles.map((r,i)=>[r,'p1-app-'+i])){
    await c.query("INSERT INTO profitia_access.applications VALUES($1,'ACTIVE',NULL)",[app])
    await c.query("INSERT INTO profitia_access.runtime_bindings VALUES($1,$2,'ACTIVE')",[role,app])
    await c.query("INSERT INTO profitia_requests.location_admission_receivers VALUES($1,true,$2)",[role,key])
    await c.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES($1,'supplier_report',$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[app,randomUUID(),future()])
    for(const org of[A,B])await c.query("INSERT INTO profitia_access.product_grants VALUES($1,$2,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE',1,'EXPLICIT_OFFER','SYNTHETIC_ONLY',$3)",[app,org,future()])
    // Curated APIs; no runtime table DML and no access to key/config tables.
    await c.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests TO ${role};
     GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_access,profitia_modules TO ${role};
     GRANT EXECUTE ON FUNCTION profitia_requests.runtime_descriptor(),profitia_requests.external_runtime_descriptor(),profitia_requests.operation_runtime_descriptor(),profitia_requests.location_runtime_descriptor(),profitia_requests.location_admission_descriptor(),profitia_requests.bind_location_admission(jsonb,text),profitia_requests.bind_location_scope(text,uuid,uuid,text,text,jsonb),profitia_requests.location_admission_policy(text,uuid,uuid,text),profitia_requests.policy(text,uuid,uuid,text),profitia_requests.reserve(text,uuid,uuid,text,text,text,text,uuid,uuid,bigint),profitia_requests.accept(text,uuid,uuid),profitia_requests.location_bound_current(text,uuid,uuid,text),profitia_requests.location_access(text,uuid,uuid,text) TO ${role}`)
   }
   await c.query(`CREATE SCHEMA p1_domain;
    CREATE TABLE p1_domain.suppliers(organisation_id uuid NOT NULL,supplier_id uuid NOT NULL,version integer NOT NULL,source_version text NOT NULL DEFAULT 'v1',PRIMARY KEY(organisation_id,supplier_id));
    CREATE TABLE p1_domain.locations(organisation_id uuid NOT NULL,supplier_id uuid NOT NULL,location_id uuid NOT NULL,created_by uuid NOT NULL,edited_by uuid NOT NULL,version integer NOT NULL,label text NOT NULL,active boolean NOT NULL DEFAULT true,PRIMARY KEY(organisation_id,supplier_id,location_id),FOREIGN KEY(organisation_id,supplier_id) REFERENCES p1_domain.suppliers);
    ALTER TABLE p1_domain.suppliers ENABLE ROW LEVEL SECURITY;ALTER TABLE p1_domain.suppliers FORCE ROW LEVEL SECURITY;
    ALTER TABLE p1_domain.locations ENABLE ROW LEVEL SECURITY;ALTER TABLE p1_domain.locations FORCE ROW LEVEL SECURITY;
    CREATE POLICY owner ON p1_domain.suppliers TO profitia_access_owner USING(true) WITH CHECK(true);
    CREATE POLICY owner ON p1_domain.locations TO profitia_access_owner USING(true) WITH CHECK(true);
    CREATE FUNCTION p1_domain.current_parent(p_org uuid,p_supplier uuid,p_user uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
     DECLARE v integer;d jsonb;BEGIN d:=profitia_access.runtime_descriptor();IF NOT profitia_access.scope_allows(d->>'applicationId',p_org,p_user) THEN RETURN NULL;END IF;
      SELECT version INTO v FROM p1_domain.suppliers WHERE organisation_id=p_org AND supplier_id=p_supplier FOR SHARE;
      IF NOT FOUND THEN RETURN NULL; END IF;RETURN jsonb_build_object('supplierId',p_supplier,'organisationId',p_org,'collectionId','supplier-locations:'||p_supplier,'version',v::text);END $fn$;
    CREATE FUNCTION p1_domain.current_source(p_org uuid,p_supplier uuid,p_user uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
     DECLARE v text;d jsonb;BEGIN d:=profitia_access.runtime_descriptor();IF NOT profitia_access.scope_allows(d->>'applicationId',p_org,p_user) THEN RETURN NULL;END IF;
      SELECT source_version INTO v FROM p1_domain.suppliers WHERE organisation_id=p_org AND supplier_id=p_supplier FOR SHARE;
      IF NOT FOUND THEN RETURN NULL; END IF;RETURN jsonb_build_object('version',v,'exists',true);END $fn$;
    CREATE FUNCTION p1_domain.current_child(p_org uuid,p_supplier uuid,p_location uuid,p_user uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
     DECLARE r p1_domain.locations%ROWTYPE;d jsonb;BEGIN d:=profitia_access.runtime_descriptor();IF NOT profitia_access.scope_allows(d->>'applicationId',p_org,p_user) THEN RETURN NULL;END IF;
      SELECT * INTO r FROM p1_domain.locations WHERE organisation_id=p_org AND supplier_id=p_supplier AND location_id=p_location FOR UPDATE;
      RETURN jsonb_build_object('exists',FOUND,'version',coalesce(r.version,0)::text);END $fn$;
    CREATE FUNCTION p1_domain.mutate(p_org uuid,p_supplier uuid,p_location uuid,p_user uuid,p_action text,p_expected bigint,p_label text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
     DECLARE a jsonb;BEGIN
      a:=current_setting('profitia.location.admission',true)::jsonb;
      IF NOT profitia_requests.location_access('supplier.location.write',p_org,p_user,p_location::text)
       OR NOT profitia_requests.location_bound_current('supplier.location.write',p_org,p_user,p_location::text)
       OR a->>'action' IS DISTINCT FROM p_action OR a->'parent'->>'supplierId' IS DISTINCT FROM p_supplier::text
       OR a->'evidence'->>'commandDigest' IS DISTINCT FROM encode(sha256(convert_to('{"label":'||to_json(p_label)::text||'}','UTF8')),'hex') THEN RAISE EXCEPTION 'Domain command denied' USING ERRCODE='42501';END IF;
      IF p_action='CREATE' AND p_expected IS NULL THEN INSERT INTO p1_domain.locations VALUES(p_org,p_supplier,p_location,p_user,p_user,1,p_label,true);
      ELSIF p_action IN('UPDATE','DEACTIVATE') THEN UPDATE p1_domain.locations SET label=p_label,edited_by=p_user,version=version+1,active=p_action<>'DEACTIVATE' WHERE organisation_id=p_org AND supplier_id=p_supplier AND location_id=p_location AND version=p_expected;
       IF NOT FOUND THEN RAISE EXCEPTION 'Domain CAS conflict' USING ERRCODE='PT409';END IF;
      ELSE RAISE EXCEPTION 'Domain action denied' USING ERRCODE='42501';END IF;
     END $fn$;
    CREATE FUNCTION p1_domain.visible(p_org uuid,p_supplier uuid,p_user uuid) RETURNS SETOF p1_domain.locations LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
     BEGIN IF NOT profitia_requests.location_access('supplier.location.read',p_org,p_user,'supplier-locations:'||p_supplier) THEN RAISE EXCEPTION 'Read denied' USING ERRCODE='42501';END IF;
      RETURN QUERY SELECT * FROM p1_domain.locations WHERE organisation_id=p_org AND supplier_id=p_supplier;END $fn$;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA p1_domain FROM PUBLIC;`)
   await c.query('INSERT INTO p1_domain.suppliers(organisation_id,supplier_id,version) VALUES($1,$2,1),($3,$4,1)',[A,S,B,foreignSupplier])
   for(const role of roles)await c.query(`GRANT USAGE ON SCHEMA p1_domain TO ${role};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA p1_domain TO ${role}`)
  })
  const binding=i=>({applicationId:'p1-app-'+i,environment:'development',projectId:f.binding.projectId,branchId:f.binding.branchId,databaseName:f.config.database,role:roles[i],schemaDigest:f.binding.schemaDigest})
  const readParent=async({query,actor,request})=>(await query('SELECT p1_domain.current_parent($1,$2,$3) AS parent',[request.organisationId,request.payload.supplierId,actor.actorId])).rows[0].parent
  const admission=i=>({schemaDigest:hash(source('020-supplier-location-admission.sql')),proofKey:key,readParent})
  const port=i=>createSupplierLocationAdmission({binding:binding(i),...admission(i)})
  for(const role of roles){const pool=new pg.Pool({...f.config,user:role,max:8});pools.push(pool);audits.push(new pg.Pool({...f.config,user:role,max:3}))}
  const grant=async(op,{user=U,org=A,resource='supplier-locations:'+S,effect='ALLOW',app=0}={})=>controlled(c=>c.query("INSERT INTO profitia_access.permission_grants VALUES($1,$2,$3,$4,$5,$6,'supplier_report',$7)",[randomUUID(),'p1-app-'+app,org,user,effect,op,resource]))
  const policy=async(op,{org=A,app=0,mode='ROLLING_24H',capacity=100}={})=>controlled(async c=>{const id=randomUUID();await c.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity,quota_mode) VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_P1',now()-interval '1 day',now()+interval '2 days',now()+interval '2 days',$5,$6)",[id,'p1-app-'+app,org,op,capacity,mode]);return id})
  const input=({user=U,org=A,supplier=S,action='CREATE',idempotencyKey='p1_key_'+randomUUID().replaceAll('-',''),locationId,expectedVersion=null,label='SYNTHETIC_MANUAL',app=0,sourceVersion='v1'}={})=>{
   const sync=action==='SYNC',id=sync?'supplier-locations:'+supplier:locationId??port(app).locationId({organisationId:org,userId:user,supplierId:supplier,idempotencyKey})
   return {contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:sync?'supplier.location.sync':'supplier.location.write',organisationId:org,resourceId:id,idempotencyKey,request:{user},payload:{action,supplierId:supplier,locationId:sync?null:id,addressVersion:sync?null:'1',expectedVersion:sync?sourceVersion:expectedVersion,command:sync?{sources:[{id:'p1-report',version:sourceVersion}]}:{label}}}
  }
  const host=({operation='supplier.location.write',app=0,legacy=false,failOutcome=false,failAudit=false,isolation,overrideReadParent,wrongDigest=false}={})=>{
   const pool=pools[app],audit=audits[app]
   const transact=async(run,limits)=>{const c=await pool.connect();let closed=false,timer;try{await c.query('BEGIN'+(isolation?' ISOLATION LEVEL '+isolation:''));const query=async(sql,args)=>{if(closed)throw Error('Transaction closed');if(failAudit&&sql.includes('append_audit')&&JSON.parse(args?.[0]??'{}').phase==='OUTCOME')throw Error('SYNTHETIC_OUTCOME_AUDIT_FAILURE');const result=await c.query(sql,args);if(closed)throw Error('Transaction closed');return result};const result=await Promise.race([run({query,transaction:c}),new Promise((_,reject)=>{timer=setTimeout(()=>{closed=true;reject(Error('Transaction deadline'))},limits.timeoutMs)})]);await c.query('COMMIT');return result}catch(e){closed=true;await c.query('ROLLBACK');throw e}finally{closed=true;clearTimeout(timer);c.release()}}
   const sdk=({resolveBinding})=>async request=>{const b=await resolveBinding({environment:'development',issuer,subject:'subject-'+request.user});return b?{kind:'HUMAN',actorId:b.userId,userId:b.userId,proofRef:'SYNTHETIC_VERIFIED_BOUNDARY',issuer,audience:'p1-app-'+app,environment:'development',expiresAt:b.expiresAt}:null}
   return createPrivateOperationHost({application:{appId:'p1-app-'+app,profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',environment:'development',deploymentId:'synthetic-only',configurationVersion:'p1-local',identityIssuer:issuer,organisationId:null,operations:[operation,'supplier.report.read'],features:['supplier_report']},binding:binding(app),module:{id:'supplier_report',schemaDigest:hash(source('002-module-scope.sql')),auditSchemaDigest:hash(source('003-module-audit.sql'))},
    requestLedger:{schemaDigest:hash(source('006-request-reservation.sql')),externalSchemaDigest:hash(source('010-external-request-admission.sql')),operationSchemaDigest:hash(source('017-additional-request-operations.sql')),locationSchemaDigest:hash(source('019-supplier-location-operations.sql'))},
    ...legacy?{}:{locationAdmission:{...admission(app),...wrongDigest?{schemaDigest:'f'.repeat(64)}:{},...overrideReadParent?{readParent:overrideReadParent}:{}}},
    independentQuery:audit.query.bind(audit),transact,createAuthenticator:sdk,
    readResources:async({query,actor,request})=>{
     const sync=operation==='supplier.location.sync',r=sync?(await query('SELECT p1_domain.current_source($1,$2,$3) AS source',[request.organisationId,request.payload.supplierId,actor.actorId])).rows[0].source:(await query('SELECT p1_domain.current_child($1,$2,$3,$4) AS child',[request.organisationId,request.payload.supplierId,request.resourceId,actor.actorId])).rows[0].child
     const e={supplierId:request.payload.supplierId,locationId:sync?null:request.resourceId,group:sync?'ALL':'USER_LOCATIONS',origin:sync?'COLLECTION':'MANUAL',addressVersion:sync?null:'1',targetVersion:r.version,exists:r.exists,serverAssignedId:!sync,commandDigest:operationPayloadDigest(request.payload.command),executorApplicationId:null,sources:sync?[{kind:'MGBI',accepted:true,entityType:'COMPANY',retentionUntil:null,resource:{id:'p1-report',type:'supplier_report',dataClass:'SHARED_KNOWLEDGE',environment:'development',ownerOrganisationId:null,ownerUserId:null,version:r.version,projectionVersion:'source-v1',approvedSharedProjection:true}}]:[]}
     return{resource:{id:request.resourceId,type:sync?'supplier_location_sync_request':'supplier_location',dataClass:sync?'OPERATION_AUDIT':'ORGANISATION_PRIVATE',environment:'development',ownerOrganisationId:request.organisationId,ownerUserId:sync?actor.actorId:null,version:r.version,projectionVersion:sync?'location-sync-v1':'location-write-v1',supplierLocation:e}}
    },projectOutput:value=>{if(failOutcome)throw Error('SYNTHETIC_OUTPUT_ROLLBACK');return value}})
  }
  const execute=(h,i,{fail=false}={})=>h.execute(i,async(ctx,c)=>{if(i.operation==='supplier.location.write')await c.query('SELECT p1_domain.mutate($1,$2,$3,$4,$5,$6,$7)',[ctx.organisationId,i.payload.supplierId,ctx.resourceId,ctx.actorId,i.payload.action,i.payload.expectedVersion,i.payload.command.label]);if(fail)throw Error('SYNTHETIC_BUSINESS_ROLLBACK');return{requestId:ctx.requestReservation.requestId,status:'ACCEPTED'}})
  return{...f,A,B,U,V,S,foreignSupplier,roles,key,binding,port,admission,readParent,controlled,grant,policy,input,host,execute,pools,audits,
   setSourceVersion:version=>controlled(c=>c.query('UPDATE p1_domain.suppliers SET source_version=$1,version=version+1 WHERE organisation_id=$2 AND supplier_id=$3',[version,A,S])),
   async close(){for(const p of[...pools,...audits])await p.end();await f.close()}}
 }catch(e){for(const p of[...pools,...audits])await p.end();await f.close();throw e}
}
