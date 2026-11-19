import {createHash,randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'

const service='srv-dapa3tid0e5s73f8bc5g'
const fail=()=>{throw Object.assign(Error('Quality owner preparation unavailable'),{code:'OWNER_BOOTSTRAP_PREPARATION_INVALID'})}
const require=v=>{if(!v)fail()}
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v)
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v
const literal=v=>"'"+String(v).replaceAll("'","''")+"'"
function exact(o,fields){
 require(o&&Object.getPrototypeOf(o)===Object.prototype&&Reflect.ownKeys(o).every(k=>typeof k==='string')
  &&Object.values(Object.getOwnPropertyDescriptors(o)).every(d=>Object.hasOwn(d,'value'))
  &&Object.keys(o).sort().join(',')===[...fields].sort().join(','))
}
const profiles=Object.freeze({
 canonical:Object.freeze({owner:'profitia_access_owner',database:'platform_private',project:'spring-bread-28217539',branch:'br-sparkling-term-b99l107x',installation:'profitia_access.installation'}),
 product:Object.freeze({owner:'profitia_ingestion_owner',database:'neondb',project:'autumn-waterfall-65938876',branch:'br-dry-hall-b294222f',installation:'profitia_ingestion.installation'}),
 evidence:Object.freeze({owner:'sg2_assistant_history_owner',database:'neondb',project:'autumn-waterfall-65938876',branch:'br-dry-hall-b294222f',installation:'sg2_assistant_history.installation'})
})
function membership(value){
 require(Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype&&value.length>=1&&value.length<=2
  &&Reflect.ownKeys(value).length===value.length+1
  &&Reflect.ownKeys(value).every(k=>k==='length'||typeof k==='string'&&/^[01]$/.test(k))
  &&Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>Object.hasOwn(d,'value')))
 const rows=value.map(v=>{
  exact(v,['oid','grantor','admin','inherit','set'])
  require(Number.isSafeInteger(v.oid)&&v.oid>0&&['cloud_admin','neondb_owner'].includes(v.grantor)
   &&v.admin===(v.grantor==='cloud_admin')&&v.inherit===false&&v.set===false)
  return {...v}
 }).sort((a,b)=>a.oid-b.oid)
 require(rows.filter(r=>r.grantor==='cloud_admin').length===1&&new Set(rows.map(r=>r.grantor)).size===rows.length)
 return rows
}
function snapshot(role){
 return "SELECT jsonb_agg(jsonb_build_object('oid',m.oid::bigint,'grantor',g.rolname,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.oid) FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid JOIN pg_catalog.pg_roles u ON u.oid=m.member JOIN pg_catalog.pg_roles g ON g.oid=m.grantor WHERE r.rolname="+literal(role)+" AND u.rolname='neondb_owner'"
}
function envelope({profile,expectedMembership,decisionSha,expiresAt,operation,body,publisherRole,now}){
 const p=profiles[profile],rows=membership(expectedMembership)
 require(p&&sha(decisionSha)&&Number.isFinite(now)&&now>=0&&stamp(expiresAt)&&Date.parse(expiresAt)>now&&Date.parse(expiresAt)<=now+15*60000)
 const publisherRoles={canonical:'aqc_development_canonical_publisher',product:'aqc_development_product_publisher'}
 require(publisherRole===undefined||publisherRole===publisherRoles[profile])
 const roleBootstrap=publisherRole===undefined?[]:[
  "DO $aqc_publisher_role$ BEGIN IF NOT pg_catalog.has_database_privilege(session_user,current_database(),'CREATE') OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=session_user AND rolcreaterole) THEN RAISE EXCEPTION 'PUBLISHER_INSTALLATION_OWNER_REQUIRED';END IF;IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname="+literal(publisherRole)+") THEN RAISE EXCEPTION 'PUBLISHER_ROLE_ALREADY_EXISTS';END IF;END $aqc_publisher_role$",
  "CREATE ROLE "+publisherRole+" NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2 VALID UNTIL '2026-11-27T23:59:59Z'"
 ]
 const until=expiresAt
 const nonce=randomUUID(),expected=literal(JSON.stringify(rows))+'::jsonb'
 const guard="DO $aqc_owner$ DECLARE got jsonb; BEGIN IF session_user<>'neondb_owner' OR current_user<>'neondb_owner' OR current_database()<>"+literal(p.database)
  +" OR current_setting('server_version_num')::integer<160000 OR current_setting('aqc.owner_tx_nonce',true) IS DISTINCT FROM "+literal(nonce)
  +" OR clock_timestamp()>="+literal(until)+"::timestamptz THEN RAISE EXCEPTION 'OWNER_BOOTSTRAP_BINDING_REJECTED'; END IF; SELECT ("+snapshot(p.owner)+") INTO got; IF got IS DISTINCT FROM "+expected
  +" OR pg_has_role(session_user,"+literal(p.owner)+",'SET') THEN RAISE EXCEPTION 'OWNER_MEMBERSHIP_BASELINE_CHANGED'; END IF; END $aqc_owner$"
 const statements=[
  "SET LOCAL search_path=pg_catalog,pg_temp","SET LOCAL lock_timeout='5s'","SET LOCAL statement_timeout='20s'",
  "SET LOCAL idle_in_transaction_session_timeout='30s'","SET LOCAL aqc.owner_tx_nonce="+literal(nonce),guard,
   ...roleBootstrap,
  "GRANT "+p.owner+" TO neondb_owner WITH ADMIN FALSE,INHERIT FALSE,SET TRUE GRANTED BY neondb_owner",
  ...(publisherRole===undefined?[]:["CREATE SCHEMA profitia_quality_release AUTHORIZATION "+p.owner]),
   "SET LOCAL ROLE "+p.owner,
  "DO $aqc_target$ BEGIN IF NOT EXISTS(SELECT 1 FROM "+p.installation+" WHERE singleton AND environment='development' AND project_id="+literal(p.project)+" AND branch_id="+literal(p.branch)+") THEN RAISE EXCEPTION 'OWNER_DATABASE_BINDING_REJECTED'; END IF; END $aqc_target$",
  body,"SET LOCAL ROLE NONE",
  rows.some(r=>r.grantor==='neondb_owner')
   ?"GRANT "+p.owner+" TO neondb_owner WITH ADMIN FALSE,INHERIT FALSE,SET FALSE GRANTED BY neondb_owner"
   :"REVOKE "+p.owner+" FROM neondb_owner GRANTED BY neondb_owner",
  guard
 ]
 const plan={schemaVersion:'AQC_OWNER_BOOTSTRAP_PREPARATION_V1',operation,profile,ownerRole:p.owner,database:p.database,decisionSha,
  expiresAt:until,requiresSeparateOwnerAuthorization:true,requiresOneAtomicTransaction:true,restoresExactMembershipBeforeCommit:true,
  statementsSha256:createHash('sha256').update(JSON.stringify(statements)).digest('hex'),paidRepairsEnabled:false,promotionEnabled:false}
 Object.defineProperty(plan,'statements',{value:Object.freeze(statements),enumerable:false})
 return Object.freeze(plan)
}
/** Engineering preparation only. This module has no database connection or
 * executor, and a prepared plan is not owner authority. Execute its complete
 * statements only through a single reviewed atomic transaction after owner GO.
 * SET LOCAL nonce makes an accidental autocommit sequence stop before GRANT.
 * Only the actor's own edge changes; cloud_admin and every baseline OID/option
 * must be identical again before COMMIT. No arbitrary SQL callback is accepted. */
function hostBindings(options,now,recovery){
 exact(options,['profile','expectedMembership','decisionSha','expiresAt','fromSourceSha','toSourceSha'])
 require(['canonical','product'].includes(options.profile)&&sha(options.fromSourceSha)&&sha(options.toSourceSha)&&options.fromSourceSha!==options.toSourceSha)
 const live=recovery?'':"status='ACTIVE' AND expires_at>clock_timestamp() AND ";
 const from=literal(options.fromSourceSha),to=literal(options.toSourceSha),fromFinder=literal(service+':'+options.fromSourceSha),toFinder=literal(service+':'+options.toSourceSha)
 let body
 if(options.profile==='canonical'){
  body=`DO $aqc_bindings$ DECLARE before_rows jsonb;after_rows jsonb;n integer;BEGIN
   PERFORM 1 FROM profitia_services.runtime_bindings WHERE login_role IN('sg2_benchmark_dispatch_development_runtime','sg2_insights_report_development_e1') ORDER BY login_role FOR UPDATE;
   PERFORM 1 FROM profitia_e1_authority.source_components WHERE component_id='sg2-insights-report-development' FOR UPDATE;
   IF (SELECT count(*) FROM profitia_services.runtime_bindings WHERE ${live} ((login_role='sg2_benchmark_dispatch_development_runtime' AND deployment_id=${fromFinder}) OR (login_role='sg2_insights_report_development_e1' AND deployment_id=${from})))<>2
    OR (SELECT count(*) FROM profitia_e1_authority.source_components WHERE component_id='sg2-insights-report-development' AND ${live}deployment_id=${from})<>1 THEN RAISE EXCEPTION 'HOST_BINDING_BASE_CHANGED';END IF;
   SELECT jsonb_build_object('services',(SELECT jsonb_agg(to_jsonb(t)-'deployment_id'-'version' ORDER BY login_role) FROM profitia_services.runtime_bindings t WHERE login_role IN('sg2_benchmark_dispatch_development_runtime','sg2_insights_report_development_e1')),
    'source',(SELECT to_jsonb(t)-'deployment_id'-'version' FROM profitia_e1_authority.source_components t WHERE component_id='sg2-insights-report-development')) INTO before_rows;
   UPDATE profitia_services.runtime_bindings SET deployment_id=CASE login_role WHEN 'sg2_benchmark_dispatch_development_runtime' THEN ${toFinder} ELSE ${to} END WHERE login_role IN('sg2_benchmark_dispatch_development_runtime','sg2_insights_report_development_e1');
   GET DIAGNOSTICS n=ROW_COUNT;IF n<>2 THEN RAISE EXCEPTION 'HOST_BINDING_COUNT_CHANGED';END IF;
   UPDATE profitia_e1_authority.source_components SET deployment_id=${to} WHERE component_id='sg2-insights-report-development';GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'HOST_BINDING_COUNT_CHANGED';END IF;
   SELECT jsonb_build_object('services',(SELECT jsonb_agg(to_jsonb(t)-'deployment_id'-'version' ORDER BY login_role) FROM profitia_services.runtime_bindings t WHERE login_role IN('sg2_benchmark_dispatch_development_runtime','sg2_insights_report_development_e1')),
    'source',(SELECT to_jsonb(t)-'deployment_id'-'version' FROM profitia_e1_authority.source_components t WHERE component_id='sg2-insights-report-development')) INTO after_rows;
   IF before_rows IS DISTINCT FROM after_rows THEN RAISE EXCEPTION 'HOST_BINDING_METADATA_CHANGED';END IF;END $aqc_bindings$`
 }else{
  body=`DO $aqc_bindings$ DECLARE before_rows jsonb;after_rows jsonb;n integer;BEGIN
   PERFORM 1 FROM profitia_ingestion.runtime_bindings WHERE login_role IN('sg2_benchmark_source_development_runtime','sg2_insights_report_development_composer','sg2_insights_report_development_counter') ORDER BY login_role FOR UPDATE;
   IF (SELECT count(*) FROM profitia_ingestion.runtime_bindings WHERE ${live} ((login_role='sg2_benchmark_source_development_runtime' AND deployment_id=${fromFinder}) OR (login_role IN('sg2_insights_report_development_composer','sg2_insights_report_development_counter') AND deployment_id=${from})))<>3 THEN RAISE EXCEPTION 'HOST_BINDING_BASE_CHANGED';END IF;
   SELECT jsonb_agg(to_jsonb(t)-'deployment_id'-'version' ORDER BY login_role) INTO before_rows FROM profitia_ingestion.runtime_bindings t WHERE login_role IN('sg2_benchmark_source_development_runtime','sg2_insights_report_development_composer','sg2_insights_report_development_counter');
   UPDATE profitia_ingestion.runtime_bindings SET deployment_id=CASE login_role WHEN 'sg2_benchmark_source_development_runtime' THEN ${toFinder} ELSE ${to} END WHERE login_role IN('sg2_benchmark_source_development_runtime','sg2_insights_report_development_composer','sg2_insights_report_development_counter');
   GET DIAGNOSTICS n=ROW_COUNT;IF n<>3 THEN RAISE EXCEPTION 'HOST_BINDING_COUNT_CHANGED';END IF;
   SELECT jsonb_agg(to_jsonb(t)-'deployment_id'-'version' ORDER BY login_role) INTO after_rows FROM profitia_ingestion.runtime_bindings t WHERE login_role IN('sg2_benchmark_source_development_runtime','sg2_insights_report_development_composer','sg2_insights_report_development_counter');
   IF before_rows IS DISTINCT FROM after_rows THEN RAISE EXCEPTION 'HOST_BINDING_METADATA_CHANGED';END IF;END $aqc_bindings$`
 }
 return envelope({...options,operation:recovery?'RESTORE_HOST_BINDINGS':'RENEW_HOST_BINDINGS',body,now})
}

export function prepareQualityHostBindingTransaction(options,now=Date.now()){
 return hostBindings(options,now,false)
}
/** Recovery changes the same six deployment descriptors only. Expired or
 * revoked rights remain expired or revoked; a failed release must not require
 * renewed access, a fresh source grant or an enabled paid pilot to restore LKG. */
export function prepareQualityHostBindingRecoveryTransaction(options,now=Date.now()){
 return hostBindings(options,now,true)
}

function hashes(value){
 require(Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype&&value.length===2
  &&Reflect.ownKeys(value).length===3&&Reflect.ownKeys(value).every(k=>['0','1','length'].includes(k))
  &&Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>Object.hasOwn(d,'value')))
 require(value.every(hash)&&value[0]!==value[1])
 return [...value].sort()
}
/** One reviewed pair of new synthetic inputs only. No conversation text,
 * command/encryption key, licence, epoch or spending installation is changed.
 * Revocation remains possible after the QA window expires. */
export function prepareQualityControlledQaTransaction(options,now=Date.now()){
 exact(options,['profile','action','expectedMembership','decisionSha','expiresAt','schemaDigest','storageGeneration',
  'serviceId','accountId','organisationId','grantId','inputSha256','validUntil','authorisedUntil'])
 require(['canonical','evidence'].includes(options.profile)&&['ACTIVATE','REVOKE'].includes(options.action)
  &&hash(options.schemaDigest)&&[options.storageGeneration,options.serviceId,options.accountId,options.organisationId,options.grantId].every(uuid)
  &&stamp(options.validUntil)&&stamp(options.authorisedUntil)&&Date.parse(options.validUntil)<=Date.parse(options.authorisedUntil))
 if(options.action==='ACTIVATE')require(Date.parse(options.validUntil)>now&&Date.parse(options.validUntil)<=now+168*3600000)
 const inputs=hashes(options.inputSha256),v=Object.fromEntries(['schemaDigest','storageGeneration','serviceId','accountId','organisationId','grantId','validUntil'].map(k=>[k,literal(options[k])]))
 const schema=options.profile==='canonical'?'profitia_assistant_quality_access':'sg2_assistant_quality_evidence'
 const activate=options.action==='ACTIVATE',source=literal('CIC_QUALITY_CONTROLLED_OWNER:'+options.decisionSha)
 const installationCheck="schema_digest="+v.schemaDigest+" AND storage_generation="+v.storageGeneration+"::uuid"
 const original="SELECT to_jsonb(t)-'enabled' FROM "+schema+".installation t WHERE singleton"
 let body="DO $aqc_controlled$ DECLARE before_i jsonb;after_i jsonb;n integer;BEGIN "
  +"PERFORM 1 FROM "+schema+".installation WHERE singleton FOR UPDATE;"
  +"IF (SELECT count(*) FROM "+schema+".installation WHERE singleton AND "+installationCheck
  +(options.profile==='evidence'?" AND test_account_id="+v.accountId+"::uuid":"")+")<>1 THEN RAISE EXCEPTION 'QA_INSTALLATION_BASE_CHANGED';END IF;"
  +"SELECT ("+original+") INTO before_i;"
 if(options.profile==='canonical'){
  body+="LOCK TABLE profitia_assistant_quality_access.purpose_grants,profitia_assistant_quality_access.accepted_inputs IN EXCLUSIVE MODE;"
  if(activate){
   body+="IF (SELECT enabled FROM "+schema+".installation WHERE singleton)"
    +" OR EXISTS(SELECT 1 FROM "+schema+".purpose_grants) OR EXISTS(SELECT 1 FROM "+schema+".accepted_inputs)"
    +" OR "+v.validUntil+"::timestamptz<=clock_timestamp() OR "+v.validUntil+"::timestamptz>clock_timestamp()+interval '168 hours'"
    +" OR NOT EXISTS(SELECT 1 FROM profitia_access.accounts WHERE user_id="+v.accountId+"::uuid AND status='ACTIVE')"
    +" OR NOT EXISTS(SELECT 1 FROM profitia_access.memberships m JOIN profitia_access.organisations o USING(organisation_id)"
    +" WHERE m.user_id="+v.accountId+"::uuid AND m.organisation_id="+v.organisationId+"::uuid AND m.status='ACTIVE' AND o.status='ACTIVE' AND m.expires_at>clock_timestamp())"
    +" OR NOT EXISTS(SELECT 1 FROM profitia_access.product_grants WHERE application_id='spendguru' AND organisation_id="+v.organisationId+"::uuid"
    +" AND product='SPENDGURU' AND status='ACTIVE' AND expires_at>clock_timestamp() AND features @> ARRAY['assistant'])"
    +" OR (SELECT count(*) FROM "+schema+".credentials WHERE login_role IN('sg2_private_development_runtime','sg2_assistant_quality_authority') AND service_id="+v.serviceId+"::uuid)<>2"
    +" THEN RAISE EXCEPTION 'QA_CONTROLLED_BASE_CHANGED';END IF;"
    +"INSERT INTO "+schema+".purpose_grants(grant_id,service_id,account_id,organisation_id,enabled,expires_at,data_mode,source_ref)"
    +" VALUES("+v.grantId+"::uuid,"+v.serviceId+"::uuid,"+v.accountId+"::uuid,"+v.organisationId+"::uuid,true,"+v.validUntil+"::timestamptz,'CONTROLLED_ACCEPTANCE',"+source+");"
    +"INSERT INTO "+schema+".accepted_inputs(grant_id,input_sha256,enabled,source_scopes,source_ref) VALUES"
    +inputs.map(h=>"("+v.grantId+"::uuid,"+literal(h)+",true,'[]'::jsonb,"+source+")").join(',')+";"
  }else{
   body+="IF NOT EXISTS(SELECT 1 FROM "+schema+".purpose_grants WHERE grant_id="+v.grantId+"::uuid"
    +" AND service_id="+v.serviceId+"::uuid AND account_id="+v.accountId+"::uuid AND organisation_id="+v.organisationId+"::uuid"
    +" AND expires_at="+v.validUntil+"::timestamptz AND data_mode='CONTROLLED_ACCEPTANCE' AND source_ref="+source+")"
    +" OR EXISTS(SELECT 1 FROM "+schema+".purpose_grants WHERE enabled AND grant_id<>"+v.grantId+"::uuid)"
    +" OR (SELECT count(*) FROM "+schema+".accepted_inputs WHERE grant_id="+v.grantId+"::uuid AND input_sha256 IN("
    +inputs.map(literal).join(',')+") AND source_scopes='[]'::jsonb AND source_ref="+source+")<>2"
    +" OR (SELECT count(*) FROM "+schema+".accepted_inputs WHERE grant_id="+v.grantId+"::uuid)<>2"
    +" THEN RAISE EXCEPTION 'QA_CONTROLLED_BASE_CHANGED';END IF;"
    +"UPDATE "+schema+".accepted_inputs SET enabled=false WHERE grant_id="+v.grantId+"::uuid;"
    +"UPDATE "+schema+".purpose_grants SET enabled=false,version=version+CASE WHEN enabled THEN 1 ELSE 0 END WHERE grant_id="+v.grantId+"::uuid;"
  }
 }else{
  if(activate)body+="IF (SELECT enabled FROM "+schema+".installation WHERE singleton)"
   +" OR EXISTS(SELECT 1 FROM "+schema+".evidence)"
   +" OR "+v.validUntil+"::timestamptz<=clock_timestamp() OR "+v.validUntil+"::timestamptz>clock_timestamp()+interval '168 hours'"
   +" OR (SELECT count(*) FROM "+schema+".credentials WHERE role_name IN('sg2_assistant_quality_capture','sg2_assistant_quality_reader') AND service_id="+v.serviceId+"::uuid)<>2"
   +" THEN RAISE EXCEPTION 'QA_CONTROLLED_BASE_CHANGED';END IF;"
 }
 body+="UPDATE "+schema+".installation SET enabled="+(activate?'true':'false')+" WHERE singleton AND "+installationCheck+";"
  +"GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'QA_INSTALLATION_BASE_CHANGED';END IF;"
  +"SELECT ("+original+") INTO after_i;IF before_i IS DISTINCT FROM after_i THEN RAISE EXCEPTION 'QA_INSTALLATION_METADATA_CHANGED';END IF;"
 if(activate&&options.profile==='canonical')body+="IF (SELECT count(*) FROM "+schema+".purpose_grants WHERE enabled)<>1"
  +" OR (SELECT count(*) FROM "+schema+".accepted_inputs WHERE enabled)<>2 THEN RAISE EXCEPTION 'QA_CONTROLLED_COUNT_CHANGED';END IF;"
 body+="END $aqc_controlled$"
 return envelope({...options,operation:activate?'ACTIVATE_TWO_CONTROLLED_INPUTS':'REVOKE_TWO_CONTROLLED_INPUTS',body,now})
}

/** Preparation only. The two new NOLOGIN roles and disabled CAS policies require
 * a separate exact owner decision. Fixed migration bytes enter the original
 * atomic membership-restoration envelope; no SQL callback/path is accepted. */
export function prepareQualityPublisherCasInstallation(options,now=Date.now()){
 exact(options,['profile','expectedMembership','decisionSha','expiresAt'])
 const sources={"canonical":{"file":"004-publisher-canonical.sql","role":"aqc_development_canonical_publisher","sha256":"5c4b926f473ce2f6efb2135c12a220d3d26839184123fdcce1461e0baa005632"},"product":{"file":"005-publisher-product.sql","role":"aqc_development_product_publisher","sha256":"9b309f09f1c99e2c6213816a048903791fa8a86ea2cbecf11c8d01854c66114d"}}
 const spec=sources[options.profile];require(spec)
 const body=readFileSync(new URL('../migrations/'+spec.file,import.meta.url),'utf8')
 require(createHash('sha256').update(body).digest('hex')===spec.sha256)
 return envelope({...options,operation:'INSTALL_DISABLED_PUBLISHER_CAS',publisherRole:spec.role,body,now})
}
