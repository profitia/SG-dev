import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const contract = JSON.parse(readFileSync(new URL('../deployment/staging-contract.json', import.meta.url), 'utf8'));
export function migrationManifest() {
  const dir = new URL('../db/migrations/', import.meta.url);
  const files = readdirSync(dir).filter(f=>f.endsWith('.sql')).sort();
  if (!files.length || files[0] !== '0001_xray_foundation.sql') throw new Error('Migration foundation missing');
  return files.map((file,index)=>{
    if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(file) || Number(file.slice(0,4))!==index+1) throw new Error('Migration sequence is invalid');
    const sql=readFileSync(new URL(file,dir),'utf8');
    return {version:file.slice(0,-4),checksum:createHash('sha256').update(sql).digest('hex'),sql};
  });
}
export function assertAuthorization(value,sha,operation,now=Date.now()) {
  if (!value || value.schemaVersion!=='1.0' || value.projectKey!=='SRM' || value.targetEnvironment!=='staging' || value.stagingDeploymentAuthorized!==true || value.productionMutationsAllowed!==false) throw new Error('Explicit SRM Staging authorization required');
  if (!/^[a-f0-9]{40}$/.test(sha??'') || value.releaseSha!==sha || value.repository!==contract.repository || value.neonProjectId!==contract.neon.projectId || value.neonBranchId!==contract.neon.branchId || value.databaseName!=='srm_app') throw new Error('Authorization identity or approved revision mismatch');
  if (!value.approvalId || !value.approvedBy || !value.costOwner || !Array.isArray(value.operations) || !value.operations.includes(operation) || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt)<=now || Date.parse(value.expiresAt)-now>24*60*60_000) throw new Error('Approval missing, expired or operation not authorized');
}
export function assertMigrationDestination(env) {
  if (env.TARGET_ENVIRONMENT!=='staging' || env.SRM_NEON_PROJECT_ID!==contract.neon.projectId || env.SRM_NEON_BRANCH_ID!==contract.neon.branchId) throw new Error('Staging project/branch identity mismatch');
  const u=new URL(env.SRM_APP_DIRECT_URL??'');
  if (u.hostname!==contract.neon.directHost || u.pathname!=='/srm_app' || u.username!=='neondb_owner' || u.searchParams.get('sslmode')!=='require') throw new Error('Exact Staging direct owner connection required');
}
export function fullPreflight({sha,taskId,approvalId,snapshotPath,target}) {
  const run=(args)=>spawnSync('git',args,{cwd:root,encoding:'utf8'});
  if(run(['fetch','origin','refs/heads/main:refs/remotes/origin/main']).status!==0)throw new Error('Authority refresh failed');
  if(run(['rev-parse','HEAD']).stdout.trim()!==sha || run(['merge-base','--is-ancestor',sha,'origin/main']).status!==0 || run(['status','--porcelain']).stdout.trim())throw new Error('Approved clean main revision must be checked out');
  const p=spawnSync('node',['scripts/governance/governance-preflight.mjs','--project','SRM','--target-environment','staging','--task-id',taskId,'--title','SRM explicit Staging promotion','--workspace','SG-dev Codespaces SRM','--execution-environment','codespaces','--scope',approvalId,'--host-conversation-unavailable','--provider-snapshot',snapshotPath,'--target',target],{cwd:root,encoding:'utf8'});
  const result=JSON.parse(p.stdout||'{}');
  if(p.status!==0 || result.verdict!=='PASS')throw new Error('Full governance preflight blocked: '+(result.blockingGates??[]).join(','));
  return result;
}
export function inspectLedger(rows,manifest=migrationManifest()) {
  if (!Array.isArray(rows)) throw new Error('Invalid migration ledger');
  const map=new Map(rows.map(r=>[r.version,r.checksum_sha256]));
  if(map.size!==rows.length)throw new Error('Duplicate migration ledger entry');
  for(const [version,checksum]of map){const m=manifest.find(m=>m.version===version);if(!m||m.checksum!==checksum)throw new Error('Unknown migration or checksum drift: '+version);}
  let missing=false;
  for(const m of manifest){if(!map.has(m.version))missing=true;else if(missing)throw new Error('Migration ledger is not a contiguous prefix');}
  return manifest.filter(m=>!map.has(m.version));
}
export async function runMigrations(client,{dryRun=false}={}) {
  await client.query(dryRun?'BEGIN READ ONLY':'BEGIN');
  try{
    const identity=await client.query('SELECT current_database() AS name');
    if(!['srm_app','srm_migration_test'].includes(identity.rows[0]?.name))throw new Error('Product database identity mismatch');
    if(!dryRun)await client.query("SELECT pg_advisory_xact_lock(hashtext('srm-xray-migration'))");
    const ledger=(await client.query("SELECT to_regclass('srm.schema_migrations') AS ledger")).rows[0]?.ledger;
    const rows=ledger?(await client.query('SELECT version,checksum_sha256 FROM srm.schema_migrations ORDER BY version')).rows:[];
    if(!ledger && (await client.query("SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='srm') AS exists")).rows[0]?.exists)throw new Error('Unledgered SRM schema cannot be adopted');
    const pending=inspectLedger(rows);
    for(const m of pending){if(!dryRun){await client.query(m.sql);await client.query('INSERT INTO srm.schema_migrations(version,checksum_sha256) VALUES ($1,$2)',[m.version,m.checksum]);}}
    await client.query(dryRun?'ROLLBACK':'COMMIT');
    return {pending:pending.map(m=>m.version),applied:dryRun?[]:pending.map(m=>m.version),dryRun};
  }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}
}
async function main(){
  const args=process.argv.slice(2);const value=k=>args[args.indexOf(k)+1];
  if(args.includes('--plan')){console.log(JSON.stringify({mode:'OFFLINE_NO_CONNECTION',migrations:migrationManifest().map(({version,checksum})=>({version,checksum})),stagingMutated:false},null,2));return;}
  if(!args.includes('--apply'))throw new Error('Use --plan or explicit --apply');
  const sha=value('--sha');const approval=JSON.parse(readFileSync(value('--authorization'),'utf8'));
  assertAuthorization(approval,sha,'migrate');assertMigrationDestination(process.env);
  fullPreflight({sha,taskId:approval.approvalId,approvalId:approval.approvalId,snapshotPath:value('--provider-snapshot'),target:'apps/srm/scripts/staging-migrate.mjs'});
  const client=new pg.Client({connectionString:process.env.SRM_APP_DIRECT_URL});try{await client.connect();console.log(JSON.stringify(await runMigrations(client)));}finally{await client.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('SRM Staging migration failed closed; no connection strings logged.');process.exitCode=1;});
