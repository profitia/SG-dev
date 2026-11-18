// Inherited, explicitly authorized Identity expectedSourceSha release metadata only.
// The approved six-key activation plan and its three immutable helpers remain unchanged.
import fs from 'node:fs';import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{executionGuard,base,release}from'../pk-r6-execution-guard.mjs';
const mode=process.argv[2]??'prepare',serviceId='srv-dbcse6jrjlhs73eib3sg',key='IDENTITY_RUNTIME_EXPECTED_SOURCE_SHA',lkg='f78f5867064c96f4497e13bcd53c97af2da2e07a';
if(mode==='prepare'){console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED',mode,serviceId,key,release,liveCalls:0,credentialRead:false}));process.exit(0);}
assert(['set','restore'].includes(mode));const{go,gate}=executionGuard();
const ready=JSON.parse(fs.readFileSync(base+'/evidence/r2-predeployment-readback.json'));assert.equal(ready.release,release);
for(const k of ['requiredCiPass','sourceAdmissionPass','productMigrationPass','identityMigrationPass','grantsAndBindingsPass','nativeOwnerMembershipRestored'])assert.equal(ready[k],true,k);
const originalApprovalRef='https://github.com/profitia/SG-dev/blob/4153178f65cf99fe014fe02e798c130f26210353/Canon/evidence/2026-11-17-platform-knowledge-stage2-technical.md';
const original=execFileSync('git',['show','4153178f65cf99fe014fe02e798c130f26210353:Canon/evidence/2026-11-17-platform-knowledge-stage2-technical.md'],{cwd:base+'/current-authority-architecture',encoding:'utf8'});
assert(original.includes('dokładny expectedSourceSha Identity'));
const planBytes=fs.readFileSync(base+'/evidence/render-native-execution-plan.json');const{hash}=await import('../pk-r6-execution-guard.mjs');assert.equal(hash(planBytes),go.renderNativeExecutionPlanSha256);const plan=JSON.parse(planBytes);const item=plan.services[serviceId];assert.equal(plan.release,release);assert.equal(item.expectedLiveSha,lkg);
const baseline=JSON.parse(fs.readFileSync(base+'/evidence/r4-identity-public-pin-readonly.json'));assert.equal(baseline.serviceId,serviceId);assert.equal(baseline.value,lkg);
const file=base+'/evidence/r5-identity-release-pin-'+mode+'.json';assert(!fs.existsSync(file),'PRIOR_PIN_ATTEMPT_REQUIRES_PROVIDER_RECONCILIATION');
const choices=[{id:item.expectedLiveDeployId,sha:lkg}];
if(mode==='restore'){
 assert.equal(go.recoveryAuthorized,true);const own=JSON.parse(fs.readFileSync(base+'/evidence/native-render-'+serviceId+'-deploy.json'));assert.equal(own.release,release);assert.equal(own.approvalRef,go.approvalRef);assert.equal(own.status,'EXACT_RELEASE_DEPLOY_ACCEPTED_NOT_YET_LIVE');choices.push({id:own.deployId,sha:release});
 const prior=JSON.parse(fs.readFileSync(base+'/evidence/r5-identity-release-pin-set.json'));assert.equal(prior.status,'CONFIG_SAVED_WITHOUT_DEPLOY');assert.equal(prior.value,release);
}
const e={mode,taskId:go.taskId,serviceId,workspaceId:go.workspaceId,key,release,originalApprovalRef,approvalRef:go.approvalRef,expectedValue:mode==='set'?lkg:release,value:mode==='set'?release:lkg,expectedLiveChoices:choices,startedAt:new Date().toISOString(),status:'STARTED_OUTCOME_UNKNOWN',journal:file.split('/').at(-1)};
fs.writeFileSync(file,JSON.stringify(e,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify(e));
