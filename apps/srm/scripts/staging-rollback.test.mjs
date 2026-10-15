import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
import {prepareRollbackPlan,runtimeMigrations,assertRuntimeSchema,ledgerManifest,artifactCommand,configurationFingerprint} from './staging-rollback.mjs';
import {contract,migrationManifest,runMigrations} from './staging-migrate.mjs';
import {assertRestorePoint,digest,claimRelease} from '../../../scripts/governance/srm-release-lifecycle.mjs';
import {operations} from '../../../scripts/governance/srm-release-lifecycle.mjs';
import {createProvider,manifestFrom} from './staging-lifecycle.mjs';
// Synthetic provider fixture; immutable source/migration bytes come from Git.
const oldSha=contract.rollback.compatibilityEdges[0].runtimeSha;
const journal={schemaVersion:'1.0',projectKey:'SRM',targetEnvironment:'staging',generation:10,release:{phase:'VERIFIED',approvalId:'synthetic-before',owner:'github-run:1',sourceProof:{sha:oldSha}},baseline:{sha:oldSha,deployId:'dep-synthetic',restorePoint:{status:'VERIFIED',candidateSha:'4f2b9b3797f6210e6c1af98af6a69abfd9c48391',sha:oldSha,serviceId:'srv-db496b3tqb8s73eh5sfg',deployId:'dep-synthetic',artifact:{sourceSha:oldSha,algorithm:'sha256-sorted-path-type-content-v1',digest:'a'.repeat(64),jobId:'job-synthetic'},configuration:{fingerprint:'b'.repeat(64),algorithm:'sha256-selected-service-config-and-sorted-resolved-env-pairs-v1',unchangedAfterMeasurement:true},database:{projectId:contract.neon.projectId,databaseName:'srm_app',sourceBranchId:contract.neon.branchId,recoveryBranchId:'br-backup',restoreRehearsalBranchId:'br-rehearsal',restoreRehearsalParentId:'br-backup',restoreRehearsalVerified:true,parentLsn:'0/ABCD',automaticSchemaOrDataRollbackAllowed:false,inventories:{migrations:ledgerManifest().slice(0,16)}}}}};
const example=()=>{const s=structuredClone(journal);s.baseline.restorePoint.verifiedAt=new Date().toISOString();return s;};
test('recorded LKG binds full schema and exact reviewed additive edge',()=>{
  const s=example(),p=prepareRollbackPlan(s,s.baseline.restorePoint.candidateSha);
  assert.equal(assertRestorePoint(p,contract),true);
  assert.equal(assertRuntimeSchema(runtimeMigrations(p.restorePoint.sha),p.schemaMigrations,p.restorePoint.sha),true);
});
for(const [label,mutate] of [
  ['expired',p=>p.restorePoint.verifiedAt='2000-01-01'],
  ['future',p=>p.restorePoint.verifiedAt='2099-01-01'],
  ['wrong service',p=>p.restorePoint.serviceId=contract.development.renderServiceId],
  ['wrong branch',p=>p.restorePoint.database.sourceBranchId='br-nameless-bar-b1wlhjhx'],
  ['PMOS database',p=>p.restorePoint.database.databaseName='srm_pmos'],
  ['missing artifact',p=>delete p.restorePoint.artifact],
  ['changed config',p=>p.restorePoint.configuration.unchangedAfterMeasurement=false],
  ['unrehearsed recovery',p=>p.restorePoint.database.restoreRehearsalVerified=false],
  ['wrong backup parent',p=>p.restorePoint.database.restoreRehearsalParentId=contract.neon.branchId],
  ['unknown schema',p=>p.schemaMigrations.push({version:'0019_unsafe',checksum:'f'.repeat(64)})],
  ['checksum drift',p=>p.schemaMigrations[0].checksum='e'.repeat(64)],
  ['candidate drift',p=>p.candidateSha='e'.repeat(40)],
])test('LKG gate rejects '+label,()=>{const s=example(),p=prepareRollbackPlan(s,s.baseline.restorePoint.candidateSha);mutate(p);assert.throws(()=>assertRestorePoint(p,contract));});
test('arbitrary old runtime SHA does not acquire a schema-prefix exception',()=>{
  const p=prepareRollbackPlan(example(),journal.baseline.restorePoint.candidateSha);
  assert.throws(()=>assertRuntimeSchema(p.schemaMigrations.slice(0,16),p.schemaMigrations,'f'.repeat(40)),/reviewed/);
  const altered=structuredClone(p.schemaMigrations);altered[16].checksum='f'.repeat(64);
  assert.throws(()=>assertRuntimeSchema(p.schemaMigrations.slice(0,16),altered,p.restorePoint.sha),/reviewed/);
});
test('rollback handoff requires stopped executor, exact reviewed journal and preserves interrupted evidence',()=>{
  const s=example();s.release.phase='PROVISIONING';s.release.lastKnownGood=s.baseline;
  const a={approvalId:'separate-protected-rollback',mode:'rollback',rollbackSchemaCompatible:true,supersedes:{journalDigest:digest(s),generation:s.generation,approvalId:s.release.approvalId,owner:s.release.owner}};
  const m={sha:s.baseline.sha,rollbackPlan:{restorePoint:s.baseline.restorePoint}};
  assert.throws(()=>claimRelease(s,a,m,'github-run:999',false),/stopped-release/);
  const next=claimRelease(s,a,m,'github-run:999',true);
  assert.deepEqual(next.interruptedReleases.at(-1),s.release);assert.equal(next.generation,s.generation+1);
  assert.equal(next.release.approvalId,a.approvalId);assert.deepEqual(s,JSON.parse(JSON.stringify(s)));
  for(const field of ['generation','journalDigest','approvalId','owner']) {
    const bad=structuredClone(a);bad.supersedes[field]='wrong';assert.throws(()=>claimRelease(s,bad,m,'github-run:999',true));
  }
});
test('artifact verifier checks actual sorted file bytes and exact runtime SHA',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'srm-artifact-fixture-'));
  try {
    const artifact=path.join(dir,'apps/srm/.next/standalone');fs.mkdirSync(artifact,{recursive:true});fs.writeFileSync(path.join(artifact,'one.txt'),'fixture bytes');
    const p=prepareRollbackPlan(example(),journal.baseline.restorePoint.candidateSha).restorePoint;
    const command=artifactCommand(p,'synthetic-approval');
    const js=command.slice(command.indexOf("'")+1,-1).replaceAll("'\\''","'");
    const run=(sha)=>spawnSync('node',['-e',js],{cwd:dir,env:{...process.env,RENDER_GIT_COMMIT:sha},encoding:'utf8'});
    assert.notEqual(run('e'.repeat(40)).status,0);assert.match(run(p.sha).stderr,/Artifact digest mismatch/);
    const crypto=createRequire(import.meta.url)('node:crypto');p.artifact.digest=crypto.createHash('sha256').update(JSON.stringify([['one.txt','file',crypto.createHash('sha256').update('fixture bytes').digest('hex')]])).digest('hex');
    const good=artifactCommand(p,'synthetic-approval'),program=good.slice(good.indexOf("'")+1,-1).replaceAll("'\\''","'");
    assert.equal(spawnSync('node',['-e',program],{cwd:dir,env:{...process.env,RENDER_GIT_COMMIT:p.sha}}).status,0);
    fs.writeFileSync(path.join(artifact,'one.txt'),'changed');assert.notEqual(spawnSync('node',['-e',program],{cwd:dir,env:{...process.env,RENDER_GIT_COMMIT:p.sha}}).status,0);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('configuration fingerprint detects secret drift without publishing secrets',()=>{
  const a=configurationFingerprint({id:'srv-fixture'},{KEY:'synthetic-only'});
  assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,configurationFingerprint({id:'srv-fixture'},{KEY:'changed'}));
});
function retainedProviderFixture(response='live') {
  const plan=prepareRollbackPlan(example(),journal.baseline.restorePoint.candidateSha),sha=plan.restorePoint.sha;
  const m={...manifestFrom({repositoryId:contract.repositoryId,approvedMainAncestor:true,ciPassed:true},sha),rollbackPlan:plan};
  const a={schemaVersion:'2.0',projectKey:'SRM',targetEnvironment:'staging',stagingDeploymentAuthorized:true,stagingMutationsAllowed:true,productionMutationsAllowed:false,manifest:m,releaseSha:sha,manifestDigest:digest(m),repository:contract.repository,repositoryId:contract.repositoryId,renderWorkspaceId:contract.render.workspaceId,renderProjectId:contract.render.projectId,renderEnvironmentId:contract.render.environmentId,neonProjectId:contract.neon.projectId,neonBranchId:contract.neon.branchId,neonEndpointId:contract.neon.endpointId,databaseName:'srm_app',approvalId:'synthetic-rollback',approvedBy:'synthetic',costOwner:'synthetic',expiresAt:new Date(Date.now()+3600000).toISOString(),operations,mode:'rollback',rollbackSchemaCompatible:true,budget:{renderPlan:contract.render.plan,renderInstances:1,renderMonthlyComputeUsd:7,neonMaxCu:8,neonExistingEndpointOnly:true,providerEntitlementsAccepted:true,storageEgressBuildCostsAccepted:true,maxDeploymentAttempts:3}};
  const srv={id:plan.restorePoint.serviceId,name:contract.render.serviceName,ownerId:contract.render.workspaceId,environmentId:contract.render.environmentId,repo:'https://github.com/'+contract.repository,autoDeployTrigger:'off',branch:'main',rootDir:'',type:'web_service',suspended:'not_suspended',serviceDetails:{region:contract.render.region,plan:contract.render.plan,runtime:'node',numInstances:1,healthCheckPath:contract.render.healthCheckPath,previews:{generation:'off'},envSpecificDetails:{buildCommand:contract.render.buildCommand,startCommand:contract.render.startCommand}}};
  const calls=[],rows=[{deploy:{id:'dep-old',status:'deactivated',commit:{id:sha}}},{deploy:{id:'dep-current',status:'live',commit:{id:plan.candidateSha}}}];let fences=0;
  const fetcher=async(url,options)=>{calls.push({url,method:options.method,body:options.body});if(options.method==='GET')return new Response(JSON.stringify(rows));if(response==='ambiguous')throw new TypeError('synthetic connection lost');return new Response(JSON.stringify({id:'dep-rollback',status:'live',commit:{id:response==='wrong'?'f'.repeat(40):sha}}),{status:201});};
  const p=createProvider({RENDER_API_KEY:'synthetic'},a,m,'github-run:999',fetcher,()=>{fences++;});
  return {p,srv,m,calls,rows,get fences(){return fences;}};
}
test('provider adapter uses native retained deployment ID, never rebuilds the old commit',async()=>{
  const f=retainedProviderFixture(),r=await f.p.deploy({services:[f.srv]},f.m);
  const writes=f.calls.filter(c=>c.method==='POST');assert.equal(writes.length,1);
  assert.equal(writes[0].url,'https://api.render.com/v1/services/'+f.srv.id+'/rollback');
  assert.deepEqual(JSON.parse(writes[0].body),{deployId:f.m.rollbackPlan.restorePoint.deployId});
  assert.equal(r.strategy,'RENDER_RETAINED_DEPLOYMENT');assert.equal(f.fences,1);
});
test('native rollback rejects a wrong actual provider SHA',async()=>{
  const f=retainedProviderFixture('wrong');await assert.rejects(f.p.deploy({services:[f.srv]},f.m),/acknowledgement/);
});
test('ambiguous native rollback is issued once and an existing INTENT is not recoverable without an observed effect',async()=>{
  const f=retainedProviderFixture('ambiguous');await assert.rejects(f.p.deploy({services:[f.srv]},f.m));assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  const observed=await f.p.observe('deploy',{databases:[],services:[f.srv],liveDeploy:{status:'live',commit:{id:f.m.rollbackPlan.candidateSha}}},{release:{steps:{deploy:{status:'INTENT'}}}},f.m,{mode:'rollback'});
  assert.equal(observed.complete,false);assert.equal(observed.recoverable,false);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});
test('native rollback rejects concurrent foreign deployments before mutation',async()=>{
  const f=retainedProviderFixture();f.rows.push({deploy:{id:'dep-concurrent',status:'build_in_progress',commit:{id:'f'.repeat(40)}}});
  await assert.rejects(f.p.deploy({services:[f.srv]},f.m),/Concurrent/);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
});
test('isolated PostgreSQL: historical LKG persistence code survives full additive schema without data rollback',{skip:!process.env.SRM_MIGRATION_TEST_URL},async()=>{
  const u=new URL(process.env.SRM_MIGRATION_TEST_URL);
  assert.ok(['localhost','127.0.0.1'].includes(u.hostname)&&u.pathname==='/srm_migration_test');
  const c=new pg.Client({connectionString:u.toString()});await c.connect();
  const org='00000000-0000-4000-8000-000000000008';
  try {
    await c.query('DROP SCHEMA IF EXISTS srm CASCADE');await c.query('DROP ROLE IF EXISTS srm_app_runtime');
    await c.query('CREATE ROLE srm_app_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    for(const m of migrationManifest().slice(0,16)){await c.query(m.sql);await c.query('INSERT INTO srm.schema_migrations(version,checksum_sha256) VALUES($1,$2)',[m.version,m.checksum]);}
    await c.query('GRANT USAGE ON SCHEMA srm TO srm_app_runtime');
    await c.query('GRANT SELECT,INSERT,UPDATE ON srm.lookup_requests TO srm_app_runtime');
    await c.query("INSERT INTO srm.organizations(id,slug) VALUES($1,'rollback-fixture')",[org]);
    const sha=contract.rollback.compatibilityEdges[0].runtimeSha;
    const r=spawnSync('git',['show',sha+':apps/srm/scripts/staging-lifecycle.mjs'],{encoding:'utf8'});assert.equal(r.status,0);
    const match=r.stdout.match(/export async function runPersistenceProbe\([\s\S]*?\n}\n(?=export async function persistenceProbe)/);assert.ok(match);
    const helper=r.stdout.match(/const createProbeId = \(x\) => \{[\s\S]*?\n};/);assert.ok(helper);
    const old=vm.runInNewContext('(()=>{const fail=(ok,m)=>{if(!ok)throw Error(m)};'+helper[0]+match[0].replace('export ','')+';return runPersistenceProbe})()',{digest});
    await c.query('SET ROLE srm_app_runtime');await old(c,org,'synthetic-old-runtime',true);await c.query('RESET ROLE');
    const rows=await c.query('SELECT * FROM srm.lookup_requests ORDER BY id');
    await runMigrations(c);assert.equal((await c.query('SELECT count(*)::int n FROM srm.schema_migrations')).rows[0].n,18);
    assert.deepEqual((await c.query('SELECT * FROM srm.lookup_requests ORDER BY id')).rows,rows.rows);
    await c.query('SET ROLE srm_app_runtime');await old(c,org,'synthetic-old-runtime');await old(c,org,'synthetic-post-upgrade',true);await c.query('RESET ROLE');
    assert.equal((await c.query('SELECT count(*)::int n FROM srm.lookup_requests')).rows[0].n,2);
    const flags=(await c.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='srm.msr_projections'::regclass")).rows[0];assert.deepEqual(flags,{relrowsecurity:true,relforcerowsecurity:true});
    assert.deepEqual((await c.query('SELECT version,checksum_sha256 AS checksum FROM srm.schema_migrations ORDER BY version')).rows,ledgerManifest());
  } finally {await c.query('RESET ROLE').catch(()=>{});await c.query('DROP SCHEMA IF EXISTS srm CASCADE');await c.query('DROP ROLE IF EXISTS srm_app_runtime');await c.end();}
});
