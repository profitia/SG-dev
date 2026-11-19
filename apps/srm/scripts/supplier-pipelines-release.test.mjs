import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {supplierPipelinesReleasePlan,supplierWorkspaceRuntimeFunctions} from './supplier-pipelines-release.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
function sources(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'supplier-pipelines-plan-'));
 const base='apps/srm/',paths=['packages/platform-contracts/migrations/access/supplier-workspace-v1.sql',base+'db/private-store/supplier-pipelines-v1.sql',base+'db/private-store/supplier-pipelines-commands-v1.sql'];
 for(const [i,file]of paths.entries()){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),'synthetic exact source '+i);}
 const target={contractId:'srm.supplier-pipelines',contractVersion:'1.0.0',targetEnvironment:'development',binding:{serviceId:'srv-db1vu6gm7kps73d0e3r0',projectId:'spring-bread-28217539',branchId:'br-sparkling-term-b99l107x',databaseName:'platform_private',schema:'srm',runtimeRole:'srm_private_development_runtime'},...Object.fromEntries(['accessSchemaSource','schemaSource','commandsSource'].map((key,i)=>[key,{path:paths[i],sha256:hash(fs.readFileSync(path.join(root,paths[i])))}]))};
 const targetFile=path.join(root,base+'deployment/supplier-pipelines-targets.json');fs.mkdirSync(path.dirname(targetFile),{recursive:true});const save=()=>fs.writeFileSync(targetFile,JSON.stringify(target));save();
 return {root,target,save,paths,close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('release plan binds all three exact inputs and requires the separate controlled install and exact-SHA GO',()=>{
 const f=sources();try{const p=supplierPipelinesReleasePlan({repositoryRoot:f.root});assert.equal(p.orderedMigrations.length,3);assert.deepEqual(p.runtimeRights.execute,[...supplierWorkspaceRuntimeFunctions]);assert.deepEqual(p.runtimeRights.newTableDml,[]);assert.equal(p.changedDataOrRoles,false);assert.equal(p.e2Started,false);assert(p.releasePreconditions.includes('SEPARATE_EXACT_SHA_DEVELOPMENT_GO'));assert.equal(p.recovery.destructiveSchemaRemoval,false);}finally{f.close()}
});
test('release plan refuses changed SQL, another database/role/environment and unlisted paths',()=>{
 const f=sources();try{fs.appendFileSync(path.join(f.root,f.paths[1]),' changed');assert.throws(()=>supplierPipelinesReleasePlan({repositoryRoot:f.root}),/SOURCE_DIGEST_MISMATCH/);f.target.schemaSource.sha256=hash(fs.readFileSync(path.join(f.root,f.paths[1])));for(const key of ['databaseName','runtimeRole','branchId','serviceId']){const old=f.target.binding[key];f.target.binding[key]='other';f.save();assert.throws(()=>supplierPipelinesReleasePlan({repositoryRoot:f.root}),/BINDING_REQUIRED/);f.target.binding[key]=old;}f.target.commandsSource.path='../../other.sql';f.save();assert.throws(()=>supplierPipelinesReleasePlan({repositoryRoot:f.root}),/SOURCE_DIGEST_MISMATCH/);}finally{f.close()}
});
