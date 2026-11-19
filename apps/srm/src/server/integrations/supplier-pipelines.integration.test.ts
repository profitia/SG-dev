/** Native PostgreSQL domain-schema fixture, not live SRM/Identity/E1 acceptance. */
import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
const BASE_FIXTURE="CREATE ROLE profitia_access_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;\nCREATE ROLE scp_a LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;\nCREATE ROLE scp_b LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;\nCREATE SCHEMA srm AUTHORIZATION profitia_access_owner;\nCREATE TABLE srm.private_installation(singleton boolean PRIMARY KEY DEFAULT true);\nCREATE TABLE srm.organizations(id uuid PRIMARY KEY);\nCREATE TABLE srm.suppliers(organization_id uuid NOT NULL REFERENCES srm.organizations(id),id uuid NOT NULL DEFAULT gen_random_uuid(),\n nip text CHECK(nip IS NULL OR nip~'^[0-9]{10}$'),krs text CHECK(krs IS NULL OR krs~'^[0-9]{10}$'),display_name text,\n created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),\n PRIMARY KEY(organization_id,id),CHECK(nip IS NOT NULL OR krs IS NOT NULL));\nCREATE UNIQUE INDEX suppliers_nip_per_org ON srm.suppliers(organization_id,nip) WHERE nip IS NOT NULL;\nALTER TABLE srm.suppliers OWNER TO profitia_access_owner;\nALTER TABLE srm.organizations OWNER TO profitia_access_owner;\nALTER TABLE srm.private_installation OWNER TO profitia_access_owner;\nINSERT INTO srm.organizations VALUES('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');";
const BRIDGE_FIXTURE="CREATE SCHEMA profitia_supplier_workspace;\n-- TEST-ONLY native-login mapping; not an implementation of production E1.\nCREATE FUNCTION profitia_supplier_workspace.scope_allows(o uuid,m text,a uuid) RETURNS boolean\nLANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$\n SELECT m IN('READ','WRITE') AND\n ((session_user='scp_a' AND o='10000000-0000-4000-8000-000000000001'::uuid AND a='20000000-0000-4000-8000-000000000001'::uuid)\n OR(session_user='scp_b' AND o='10000000-0000-4000-8000-000000000002'::uuid AND a='20000000-0000-4000-8000-000000000002'::uuid));$f$;\nCREATE FUNCTION profitia_supplier_workspace.member_allowed(o uuid,a uuid) RETURNS boolean LANGUAGE sql STABLE AS $f$\n SELECT (o='10000000-0000-4000-8000-000000000001'::uuid AND a='20000000-0000-4000-8000-000000000001'::uuid)\n OR(o='10000000-0000-4000-8000-000000000002'::uuid AND a='20000000-0000-4000-8000-000000000002'::uuid);$f$;\nGRANT USAGE ON SCHEMA profitia_supplier_workspace TO profitia_access_owner,scp_a,scp_b;\nALTER TABLE srm.suppliers ENABLE ROW LEVEL SECURITY;ALTER TABLE srm.suppliers FORCE ROW LEVEL SECURITY;\nCREATE POLICY fixture_master_scope ON srm.suppliers\n USING(profitia_supplier_workspace.scope_allows(organization_id,'READ',nullif(current_setting('profitia.user_id',true),'')::uuid))\n WITH CHECK(profitia_supplier_workspace.scope_allows(organization_id,'WRITE',nullif(current_setting('profitia.user_id',true),'')::uuid));\nGRANT USAGE ON SCHEMA srm TO scp_a,scp_b;\nGRANT SELECT ON srm.organizations,srm.private_installation TO profitia_access_owner,scp_a,scp_b;";
const container=process.env.SUPPLIER_PIPELINES_TEST_CONTAINER;
const enabled=!!container;
const cases=(name:string,fn:()=>void|Promise<void>)=>test(name,{skip:!enabled},fn);
const orgA='10000000-0000-4000-8000-000000000001',orgB='10000000-0000-4000-8000-000000000002';
const actorA='20000000-0000-4000-8000-000000000001',actorB='20000000-0000-4000-8000-000000000002';
const id=(n:number)=>'30000000-0000-4000-8000-'+String(n).padStart(12,'0');
const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
function sql(input:string):string {
 return execFileSync('docker',['exec','-i',container!,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','platform_private','-Atq'],{input,encoding:'utf8',maxBuffer:4*1024*1024}).trim();
}
function session(input:string,role='scp_a',actor=actorA):string {
 return sql('BEGIN;SET SESSION AUTHORIZATION '+role+";SELECT set_config('profitia.user_id',"+quote(actor)+',true);'+input+';ROLLBACK;');
}
function assertFails(input:string,pattern:RegExp):void {
 assert.throws(()=>session(input),e=>e instanceof Error&&pattern.test(String((e as {stderr?:unknown}).stderr??e.message)));
}
const membership=(pipeline:number,stage:number,supplier=1,organisation=orgA)=>"INSERT INTO srm.supplier_pipeline_memberships(organization_id,supplier_id,pipeline_id,kind,stage_id,created_by_account_id,updated_by_account_id) VALUES("+[organisation,id(supplier),id(pipeline),pipeline<14?'CATEGORY':'SUPPLIER',id(stage),actorA,actorA].map(quote).join(',')+');';
before(()=>{
 if(!enabled)return;
 assert.match(container!,/^srm-scp-e1-[a-z0-9-]{1,48}$/);
 const inspected=JSON.parse(execFileSync('docker',['inspect',container!],{encoding:'utf8'}))[0];
 assert.equal(inspected.Config.Labels['profitia.projectKey'],'SRM');
 assert.equal(inspected.Config.Labels['profitia.taskId'],'SRM-BSDC-SCP-E1-20261119');
 assert.equal(inspected.HostConfig.NetworkMode,'none');assert.deepEqual(inspected.HostConfig.PortBindings??{},{});
 assert.equal(sql("SELECT current_database()||':'||(current_setting('server_version_num')::integer/10000)"),'platform_private:16');
 sql(BASE_FIXTURE);
 const source=readFileSync(new URL('../../../db/private-store/supplier-pipelines-v1.sql',import.meta.url),'utf8');
 assert.throws(()=>sql("BEGIN;SET LOCAL ROLE profitia_access_owner;SELECT set_config('profitia.install.source_sha',repeat('a',40),true);SELECT set_config('profitia.install.schema_digest',repeat('b',64),true);"+source+'COMMIT;'),e=>e instanceof Error&&/Accepted Supplier Workspace bridge/.test(String((e as {stderr?:unknown}).stderr??e.message)));
 assert.equal(sql("SELECT to_regclass('srm.supplier_workspace_profiles') IS NULL"),'t');
 sql(BRIDGE_FIXTURE);
 sql("BEGIN;SET LOCAL ROLE profitia_access_owner;SELECT set_config('profitia.install.source_sha',repeat('a',40),true);SELECT set_config('profitia.install.schema_digest',repeat('b',64),true);"+source+'COMMIT;');
 // Local fixture DML grants below exercise native constraints/FORCE RLS.
 // They are not product grants or an accepted production authority bridge.
 sql('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA srm TO scp_a,scp_b;GRANT EXECUTE ON FUNCTION srm.workspace_valid_nip(text) TO scp_a,scp_b;');
 const seeds:string[]=[];
 for(const [org,n]of [[orgA,1],[orgA,2],[orgA,3],[orgA,4],[orgB,5]] as const){
  const nip=n===3?'NULL':quote(n===2?'5250007738':n===4?'8567346215':'5260250274');
  seeds.push("INSERT INTO srm.suppliers(organization_id,id,nip,krs,display_name) VALUES("+quote(org)+','+quote(id(n))+','+nip+','+(n===3?quote('0000000001'):'NULL')+','+quote('Synthetic '+n)+');');
 }
 seeds.push("INSERT INTO srm.supplier_categories(organization_id,id,name,created_by_account_id,updated_by_account_id) VALUES"+
  [[orgA,id(101),'Asfalt',actorA,actorA],[orgA,id(102),'Beton',actorA,actorA],[orgB,id(103),'Asfalt',actorB,actorB]].map(row=>'('+row.map(quote).join(',')+')').join(',')+';');
 for(const p of [11,12,13,14,15,16]){
  const org=p===16?orgB:orgA,actor=p===16?actorB:actorA,kind=p<14||p===16?'CATEGORY':'SUPPLIER';
  const category=kind==='SUPPLIER'?'NULL':quote(id(p===12?102:p===16?103:101));
  seeds.push("INSERT INTO srm.supplier_pipelines(organization_id,id,kind,name,category_id,created_by_account_id,updated_by_account_id) VALUES("+[quote(org),quote(id(p)),quote(kind),quote('Process '+p),category,quote(actor),quote(actor)].join(',')+');');
  for(const pos of [0,1])seeds.push("INSERT INTO srm.supplier_pipeline_stages(organization_id,pipeline_id,id,name,stage_order) VALUES("+[quote(org),quote(id(p)),quote(id(p*10+pos)),quote(pos?'Oferta':'Nowy'),String(pos)].join(',')+');');
 }
 sql(seeds.join('\n'));
});
cases('native schema: all new tenant tables enforce FORCE RLS and no runtime grants are in the source',()=>{
 assert.equal(sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='srm' AND c.relname IN('supplier_workspace_profiles','supplier_categories','supplier_category_links','supplier_pipelines','supplier_pipeline_stages','supplier_pipeline_memberships','supplier_workspace_events','supplier_workspace_receipts') AND c.relrowsecurity AND c.relforcerowsecurity"),'8');
 const source=readFileSync(new URL('../../../db/private-store/supplier-pipelines-v1.sql',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\bGRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|EXECUTE)\b/);
});
cases('native schema: formal NIP validation preserves old KRS-only master records',()=>{
 assert.match(session("SELECT srm.workspace_valid_nip('5260250274'),srm.workspace_valid_nip('5260250275'),srm.workspace_valid_nip('0000000000')"),/t\|f\|f/);
 assert.equal(sql("SELECT count(*) FROM srm.suppliers WHERE nip IS NULL AND krs='0000000001'"),'1');
 assertFails(membership(11,110,3),/SCP:INVALID_NIP/);
});
cases('native schema: independent CATEGORY processes do not require card categories',()=>{
 const out=session(membership(11,110)+membership(12,120)+membership(13,130)+
 "UPDATE srm.supplier_pipeline_memberships SET stage_id="+quote(id(111))+",version=version+1 WHERE pipeline_id="+quote(id(11))+
 ";SELECT (SELECT count(*) FROM srm.supplier_pipeline_memberships)||':'||(SELECT count(*) FROM srm.supplier_category_links)||':'||(SELECT stage_id FROM srm.supplier_pipeline_memberships WHERE pipeline_id="+quote(id(12))+')');
 assert.match(out,/3:0:30000000-0000-4000-8000-000000000120/);
});
cases('native schema: SUPPLIER uniqueness permits zero, one and re-entry, but rejects a parallel second process',()=>{
 assertFails(membership(14,140)+membership(15,150),/supplier_membership_one_supplier_process/);
 const out=session(membership(14,140)+"UPDATE srm.supplier_pipeline_memberships SET ended_at=clock_timestamp(),end_reason='ENDED',version=version+1 WHERE pipeline_id="+quote(id(14))+';'+membership(15,150)+
 "SELECT count(*) FILTER(WHERE ended_at IS NULL)||':'||count(*) FROM srm.supplier_pipeline_memberships");
 assert.match(out,/1:2/);
});
cases('native schema: same supplier cannot be active twice in the same CATEGORY process',()=>{
 assertFails(membership(11,110)+membership(11,111),/supplier_membership_active_per_process/);
});
cases('native schema: foreign category, supplier and stage links are rejected',()=>{
 assertFails("INSERT INTO srm.supplier_category_links(organization_id,supplier_id,category_id,created_by_account_id) VALUES("+[orgA,id(1),id(103),actorA].map(quote).join(',')+')',/foreign key|violates/);
 assertFails(membership(11,160),/SCP:NOT_FOUND|foreign key/);
 assertFails(membership(11,110,5),/SCP:INVALID_NIP|foreign key/);
});
cases('native schema: copied kind cannot bypass SUPPLIER uniqueness',()=>{
 assertFails("INSERT INTO srm.supplier_pipeline_memberships(organization_id,supplier_id,pipeline_id,kind,stage_id,created_by_account_id,updated_by_account_id) VALUES("+[orgA,id(1),id(14),'CATEGORY',id(140),actorA,actorA].map(quote).join(',')+')',/SCP:NOT_FOUND|foreign key/);
});
cases('native schema: name uniqueness includes archived categories and Unicode compatibility spaces',()=>{
 assertFails("INSERT INTO srm.supplier_categories(organization_id,name,created_by_account_id,updated_by_account_id) VALUES("+quote(orgA)+",'　',"+quote(actorA)+','+quote(actorA)+')',/check constraint|violates/);
 assertFails("INSERT INTO srm.supplier_categories(organization_id,name,archived_at,created_by_account_id,updated_by_account_id) VALUES("+quote(orgA)+",'  ＡSFALT  ',clock_timestamp(),"+quote(actorA)+','+quote(actorA)+')',/unique|duplicate/);
});
cases('native schema: stage ordering can be atomically swapped with deferred uniqueness',()=>{
 const result=session("UPDATE srm.supplier_pipeline_stages SET stage_order=1-stage_order WHERE pipeline_id="+quote(id(11))+";SET CONSTRAINTS ALL IMMEDIATE;SELECT stage_order FROM srm.supplier_pipeline_stages WHERE id="+quote(id(110)));
 assert.match(result,/\n1$/);
});
cases('native schema: deleted/archived targets and an unrelated relationship owner are rejected',()=>{
 assertFails("UPDATE srm.supplier_pipeline_stages SET deleted_at=clock_timestamp(),stage_order=NULL WHERE id="+quote(id(110))+';'+membership(11,110),/SCP:RECORD_ARCHIVED/);
 assertFails("UPDATE srm.supplier_pipelines SET archived_at=clock_timestamp() WHERE id="+quote(id(11))+';'+membership(11,110),/SCP:RECORD_ARCHIVED/);
 assertFails("INSERT INTO srm.supplier_workspace_profiles(organization_id,supplier_id,relationship_owner_account_id,created_by_account_id,updated_by_account_id) VALUES("+[orgA,id(1),actorB,actorA,actorA].map(quote).join(',')+')',/SCP:FIELD_INVALID/);
});
cases('native schema: native-login fixture rejects organisation/actor GUC substitution',()=>{
 assert.match(session("SELECT set_config('srm.organization_id',"+quote(orgB)+",true);SELECT count(*) FROM srm.supplier_pipelines WHERE organization_id="+quote(orgB)),/\n0$/);
 assert.match(session("SELECT set_config('profitia.user_id',"+quote(actorB)+",true);SELECT count(*) FROM srm.supplier_pipelines"),/\n0$/);
 assert.match(session("SELECT count(*) FROM srm.supplier_pipelines",'scp_b',actorB),/\n1$/);
});
cases('native schema: event and replay rows have no UPDATE or DELETE policy',()=>{
 const event="INSERT INTO srm.supplier_workspace_events(organization_id,actor_account_id,command_id,action) VALUES("+[orgA,actorA,'test_12345678','SUPPLIER_CREATE'].map(quote).join(',')+');';
 const out=session(event+"UPDATE srm.supplier_workspace_events SET action='SUPPLIER_UPDATE';DELETE FROM srm.supplier_workspace_events;SELECT count(*) FROM srm.supplier_workspace_events");
 assert.match(out,/\n1$/);
});
function parallel(sqlText:string):Promise<{code:number;out:string;err:string}> {
 return new Promise(resolve=>{
  const p=spawn('docker',['exec','-i',container!,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','platform_private','-Atq']);
  let out='',err='';p.stdout.on('data',c=>{out+=c});p.stderr.on('data',c=>{err+=c});p.on('close',code=>resolve({code:code??1,out,err}));p.stdin.end(sqlText);
 });
}
cases('native schema: concurrent sessions cannot create two active SUPPLIER assignments',async()=>{
 const prefix="BEGIN;SET SESSION AUTHORIZATION scp_a;SELECT set_config('profitia.user_id',"+quote(actorA)+",true);";
 const results=await Promise.all([parallel(prefix+membership(14,140,4)+'SELECT pg_sleep(0.2);COMMIT;'),parallel(prefix+membership(15,150,4)+'SELECT pg_sleep(0.2);COMMIT;')]);
 assert.equal(results.filter(r=>r.code===0).length,1);
 assert.match(results.find(r=>r.code!==0)!.err,/supplier_membership_one_supplier_process/);
 assert.equal(sql("SELECT count(*) FROM srm.supplier_pipeline_memberships WHERE supplier_id="+quote(id(4))+" AND ended_at IS NULL"),'1');
});
