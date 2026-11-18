import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const base='/workspaces/sgdev-tasks/platform-knowledge-stage2-technical-20261117';
const mode=process.argv[2]??'prepare';
if(mode==='prepare'){console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED',release:'__PK_DEPLOYED_SOURCE_SHA__',queries:0,secretRead:false}));process.exit(0);}
assert.ok(['trial','install'].includes(mode));
const {executionGuard,root,release}=await import('./pk-r6-execution-guard.mjs');const {go}=executionGuard();
const sha=x=>createHash('sha256').update(x).digest('hex');
const reviewed=fs.readFileSync(base+'/r6-active-execution-inputs/identity-owner-install-r6.sql','utf8');
assert.equal(sha(reviewed),'__PK_IDENTITY_SQL_SHA256__');
const sql=fs.readFileSync(root+'/packages/platform-contracts/current-e1-authority/migrations/015-knowledge-authority.sql','utf8');
assert.equal(sha(sql),'2122522771623b8becc5cd46b12aa87fd7d9f9a8e5fea82194335913458c630a');
const at=reviewed.indexOf(sql);assert.ok(at>0);assert.equal(reviewed.lastIndexOf(sql),at);
const prefix=reviewed.slice(0,at),rest=reviewed.slice(at+sql.length),split=rest.lastIndexOf('SET LOCAL ROLE NONE;\nGRANT profitia_access_owner');assert.ok(split>0);
const payload=rest.slice(0,split),restore=rest.slice(split);assert.ok(restore.endsWith('COMMIT;\n'));
assert.equal(go.identityOwnerSqlSha256,sha(reviewed));
const credentials=base+'/private-execution/migration-connections.json';assert.equal(fs.statSync(credentials).mode&0o077,0);
const uri=JSON.parse(fs.readFileSync(credentials)).PK_CENTRAL_DATABASE_URL;const url=new URL(uri);
assert.equal(decodeURIComponent(url.username),'neondb_owner');assert.equal(url.hostname,'ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech');assert.equal(url.pathname,'/platform_private');assert.equal(url.searchParams.get('sslmode'),'verify-full');
const ownerGo=JSON.parse(fs.readFileSync(base+'/evidence/owner-execution-continuation-go.json'));assert.equal(ownerGo.status,'OWNER_GO_RECEIVED');assert.ok(Date.now()<Date.parse(ownerGo.validUntil));
const journalPath=base+'/evidence/central-owner-operation-journal.json';const journal=fs.existsSync(journalPath)?JSON.parse(fs.readFileSync(journalPath)):{decisionId:ownerGo.decisionId,operations:[]};
assert.ok(journal.operations.length<24);assert.ok(journal.operations.every(o=>['ROLLED_BACK_VERIFIED','COMMITTED_VERIFIED','RECONCILED_ROLLED_BACK','RECONCILED_COMMITTED'].includes(o.phase)),'PRIOR_OPERATION_RECONCILIATION_REQUIRED');
const require=createRequire(root+'/apps/platform-knowledge-runtime/package.json');const {Client}=require('pg');
const {installKnowledgeSchema}=await import(root+'/packages/platform-contracts/current-e1-authority/install-knowledge.mjs');
const client=new Client({connectionString:uri,connectionTimeoutMillis:10000,statement_timeout:120000});
let op,commitIssued=false,installation,inside;
const save=()=>{fs.writeFileSync(journalPath,JSON.stringify(journal,null,2)+'\n',{mode:0o600});fs.chmodSync(journalPath,0o600);};
try{
 await client.connect();assert.equal(client.connection.stream.authorized,true);
 const beforeMemberships=(await client.query("SELECT grantor::text,admin_option,inherit_option,set_option FROM pg_auth_members WHERE roleid='profitia_access_owner'::regrole AND member='neondb_owner'::regrole ORDER BY grantor")).rows;assert.equal(beforeMemberships.length,2);assert(beforeMemberships.every(x=>x.set_option===false));
 op={approvalRef:go.approvalRef,beforeMemberships,number:journal.operations.length+1,mode,phase:'STARTED',startedAt:new Date().toISOString(),release};journal.operations.push(op);save();
 await client.query(prefix);
 installation=await installKnowledgeSchema({side:'authority',approvedSha256:'2122522771623b8becc5cd46b12aa87fd7d9f9a8e5fea82194335913458c630a',query:(...args)=>client.query(...args)});
 await client.query(payload);
 inside=(await client.query("SELECT current_user AS executor,(SELECT count(*)::int FROM profitia_access.applications WHERE application_id IN ('platform-knowledge-development-api','platform-knowledge-development-worker') AND status='ACTIVE' AND fixed_organisation_id IS NULL) AS applications,(SELECT count(*)::int FROM profitia_e1_authority.knowledge_receivers WHERE source_ref=$1 AND status='ACTIVE') AS receivers,(SELECT count(*)::int FROM profitia_e1_authority.knowledge_grants WHERE source_ref=$1 AND user_id='092c2d9f-a84b-4c18-b3d6-e172a61399b8'::uuid AND effect='ALLOW' AND status='ACTIVE') AS grants",['ARCH-PK-STAGE2-TECHNICAL-GO-20261117@'+release])).rows[0];
 assert.equal(inside.executor,'profitia_access_owner');assert.equal(inside.applications,2);assert.equal(inside.receivers,2);assert.equal(inside.grants,11);
 commitIssued=mode==='install';await client.query(mode==='trial'?restore.replace(/COMMIT;\n$/,'ROLLBACK;\n'):restore);
 const after=(await client.query("SELECT current_user AS effective_role,session_user AS session_login,pg_has_role(session_user,'profitia_access_owner','SET') AS owner_set_allowed,to_regclass('profitia_e1_authority.knowledge_receivers')::text AS receivers_table")).rows[0];
 const afterMemberships=(await client.query("SELECT grantor::text,admin_option,inherit_option,set_option FROM pg_auth_members WHERE roleid='profitia_access_owner'::regrole AND member='neondb_owner'::regrole ORDER BY grantor")).rows;assert.deepEqual(afterMemberships,op.beforeMemberships);op.afterMemberships=afterMemberships;
 assert.equal(after.effective_role,'neondb_owner');assert.equal(after.owner_set_allowed,false);assert.equal(after.receivers_table,mode==='trial'?null:'profitia_e1_authority.knowledge_receivers');
 op.phase=mode==='trial'?'ROLLED_BACK_VERIFIED':'COMMITTED_VERIFIED';op.completedAt=new Date().toISOString();op.insideReadback=inside;op.afterReadback=after;op.installer=installation;save();
 console.log(JSON.stringify({status:'PASS',mode,operationNumber:op.number,phase:op.phase,inside,after,centralOwnerSetRestored:true}));
}catch(error){
 await client.query('ROLLBACK').catch(()=>{});
 if(op){op.phase=commitIssued?'UNKNOWN_RECONCILIATION_REQUIRED':'FAILED_ROLLBACK_REQUIRED_VERIFICATION';op.errorName=error.name;op.errorCode=error.code??null;save();}
 console.error(JSON.stringify({status:'FAILED',mode,errorName:error.name,errorCode:error.code??null,commitMayHaveBeenIssued:commitIssued}));process.exitCode=1;
}finally{await client.end().catch(()=>{});}
