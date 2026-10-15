import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {contract, root, migrationManifest} from './staging-migrate.mjs';
import {digest, assertRestorePoint} from '../../../scripts/governance/srm-release-lifecycle.mjs';
const fail=(ok,message)=>{if(!ok)throw Error(message);};
export const ledgerManifest=()=>migrationManifest().map(({version,checksum})=>({version,checksum}));
export function runtimeMigrations(sha,git=(args)=>spawnSync('git',args,{cwd:root,encoding:'utf8'})) {
  fail(/^[a-f0-9]{40}$/.test(sha),'Full runtime SHA required');
  const names=git(['ls-tree','--name-only',sha,'apps/srm/db/migrations/']);
  fail(names.status===0,'Historical migration inventory unavailable');
  return names.stdout.trim().split('\n').filter(Boolean).sort().map((p,i)=>{
    fail(new RegExp('/'+String(i+1).padStart(4,'0')+'_[a-z0-9_]+\\.sql$').test(p),'Historical migration sequence invalid');
    const r=git(['show',sha+':'+p]);fail(r.status===0,'Historical migration unavailable');
    return {version:p.split('/').at(-1).slice(0,-4),checksum:createHash('sha256').update(r.stdout).digest('hex')};
  });
}
export function prepareRollbackPlan(state,candidateSha,migrations=ledgerManifest(),mode='promote') {
  const point=mode==='rollback'||state.release?.phase!=='VERIFIED' ? state.release?.lastKnownGood?.restorePoint : state.baseline?.restorePoint;
  if(mode==='rollback')candidateSha=point?.candidateSha;
  const source=state.release?.sourceProof?.sha===point?.sha ? state.release.sourceProof : state.release?.manifest?.rollbackPlan?.developmentSourceProof;
  const plan={schemaVersion:'1.0',candidateSha,restorePoint:structuredClone(point),schemaMigrations:migrations,...(source?{developmentSourceProof:source}:{})};
  assertRestorePoint(plan,contract);
  return plan;
}
export function assertRuntimeSchema(runtime,full,sha,c=contract) {
  fail(Array.isArray(runtime)&&runtime.length>0&&runtime.length<=full.length&&digest(runtime)===digest(full.slice(0,runtime.length)),'Rollback historical migration prefix mismatch');
  if(runtime.length===full.length)return true;
  fail(c.rollback.compatibilityEdges?.some(e=>e.runtimeSha===sha&&e.runtimeMigrationsDigest===digest(runtime)&&e.schemaMigrationsDigest===digest(full)&&e.isolatedPostgresTestRequired===true),'No reviewed rollback schema compatibility edge');
  return true;
}
export function configurationFingerprint(service,values) {
  const selected=Object.fromEntries(['id','ownerId','environmentId','repo','branch','rootDir','autoDeploy','autoDeployTrigger','type','serviceDetails'].map(k=>[k,service[k]]));
  return createHash('sha256').update(JSON.stringify([selected,Object.entries(values).sort(([a],[b])=>a.localeCompare(b))])).digest('hex');
}
// The job uses the retained successful build. It fails itself on a byte mismatch;
// the controller observes its provider status, never trusts caller-supplied SHA.
export function artifactCommand(point,approvalId) {
  fail(/^[a-f0-9]{40}$/.test(point.sha)&&/^[a-f0-9]{64}$/.test(point.artifact?.digest)&&/^[A-Za-z0-9_-]{1,150}$/.test(approvalId),'Bounded artifact job identity required');
  const js=`const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');if(process.env.RENDER_GIT_COMMIT!==${JSON.stringify(point.sha)})throw Error('Wrong artifact source');const root=path.resolve('apps/srm/.next/standalone'),entries=[];let bytes=0;function walk(dir){for(const name of fs.readdirSync(dir).sort()){const p=path.join(dir,name),s=fs.lstatSync(p),r=path.relative(root,p);if(s.isDirectory())walk(p);else if(s.isSymbolicLink())entries.push([r,'link',fs.readlinkSync(p)]);else if(s.isFile()){bytes+=s.size;if(bytes>1073741824||entries.length>20000)throw Error('Artifact bounds exceeded');entries.push([r,'file',crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]);}}}walk(root);if(crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex')!==${JSON.stringify(point.artifact.digest)})throw Error('Artifact digest mismatch');console.log('SRM_ROLLBACK_ARTIFACT_VERIFIED '+${JSON.stringify(approvalId)});`;
  return 'timeout 120s node -e '+"'"+js.replaceAll("'","'\\''")+"'";
}
