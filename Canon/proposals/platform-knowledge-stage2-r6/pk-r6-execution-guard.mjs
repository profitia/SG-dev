import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';
export const base='/workspaces/sgdev-tasks/platform-knowledge-stage2-technical-20261117',sourceFreeze='65b0e573f270ded93bfda088a88e736abc45f56a',release='__PK_DEPLOYED_SOURCE_SHA__';
export const root=base+'/worktrees/pk-r6-runtime-'+release;
export const hash=x=>createHash('sha256').update(x).digest('hex');
export function renderReviewedTemplate(bytes,selectedSha,sqlSha){
 assert.match(selectedSha,/^[a-f0-9]{40}$/);assert.match(sqlSha,/^[a-f0-9]{64}$/);
 return Buffer.from(bytes.toString().split('__PK_'+'DEPLOYED_SOURCE_SHA__').join(selectedSha).split('__PK_'+'IDENTITY_SQL_SHA256__').join(sqlSha));
}
export function executionGuard(){
 assert.match(release,/^[a-f0-9]{40}$/,'REVIEWED_RUNTIME_TRANSPORT_MUST_BE_SELECTED');
 const go=JSON.parse(fs.readFileSync(base+'/evidence/owner-r6-execution-go.json'));
 assert.equal(go.status,'APPROVED');assert.equal(go.taskId,'ARCH-PK-STAGE2-TECHNICAL-CONT-20261117');assert.equal(go.sourceFreeze,sourceFreeze);assert.equal(go.mechanicalRuntimeTransportAuthorized,true);assert.equal(go.policyProposalSha,'e105a31c8f9047f51cc8fd9b41b74afcbd565747');assert.equal(go.policyReviewedTransportSha,'627f4bfa43b073c3228bbf8293f7fe4b82f88af2');
 assert.match(go.reviewSha,/^[a-f0-9]{40}$/);assert.equal(go.hostConversationId,'01a1e7fb-aa2e-7501-b3d7-5f42be90cb14');assert.equal(go.approvalSource,'DIRECT_HUMAN_REPLY_IN_CURRENT_CHAT');assert.equal(go.approvalRef,'https://github.com/profitia/SG-dev/blob/'+go.reviewSha+'/Canon/evidence/2026-11-18-platform-knowledge-stage2-acg-composition-release-r6.md');assert(Date.now()<Date.parse(go.validUntil));assert(Date.parse(go.validUntil)<=Date.parse('2026-11-24T23:59:00Z'));
 const selection=JSON.parse(fs.readFileSync(base+'/evidence/r6-runtime-release-selection.json'));
 assert.equal(selection.status,'EXACT_CI_VALIDATED_TRANSPORT_SELECTED');assert.equal(selection.sourceFreeze,sourceFreeze);assert.equal(selection.release,release);assert.equal(selection.approvalRef,go.approvalRef);
 const review=name=>execFileSync('git',['show',go.reviewSha+':Canon/proposals/platform-knowledge-stage2-r6/'+name],{cwd:root,maxBuffer:8*1024*1024});
 const approved=JSON.parse(review('execution-asset-digests.json'));assert.equal(approved.sourceFreeze,sourceFreeze);assert.equal(approved.runtimeReleaseSelection,'EXACT_CI_VALIDATED_IDENTICAL_TRANSPORT_ONLY');
 const sqlTemplate=review('identity-owner-install-r6.sql');assert.equal(hash(sqlTemplate),approved.files['identity-owner-install-r6.sql']);
 const sqlBytes=renderReviewedTemplate(sqlTemplate,release,'0'.repeat(64)),sqlSha=hash(sqlBytes);assert.equal(selection.identityOwnerSqlSha256,sqlSha);
 const bindings={'pk-r6-execution-guard.mjs':'pk-r6-execution-guard.mjs','execute-reviewed-identity-r6.mjs':'execute-reviewed-identity-r6.mjs','execute-reviewed-product-r6.mjs':'execute-reviewed-product-r6.mjs','identity-release-pin-r6-envelope.mjs':'accepted-main-tools/identity-release-pin-r6-envelope.mjs','native-identity-release-pin-r6.py':'accepted-main-tools/native-identity-release-pin-r6.py'};
 for(const[publicName,localName]of Object.entries(bindings)){const template=review(publicName);assert.equal(hash(template),approved.files[publicName],publicName);assert.deepEqual(fs.readFileSync(base+'/'+localName),renderReviewedTemplate(template,release,sqlSha),publicName);}
 assert.deepEqual(fs.readFileSync(base+'/r6-active-execution-inputs/identity-owner-install-r6.sql'),sqlBytes);
 const gateBytes=fs.readFileSync(base+'/evidence/runtime-release-accepted-and-ci-pass.json'),gate=JSON.parse(gateBytes);assert.equal(hash(gateBytes),selection.gateSha256);
 assert.equal(gate.status,'PASS');assert.equal(gate.releaseSha,release);assert.equal(gate.approvedSourceFreeze,sourceFreeze);assert.equal(gate.sourceAccepted,true);assert.equal(gate.requiredReleaseCi,'PASS');assert.equal(gate.resultingMainCi,'PASS');assert.equal(gate.sourceCiValidatedSha,release);assert.equal(gate.sourceProofCandidateSha,release);assert.match(gate.sourceProofControlSha,/^[a-f0-9]{40}$/);assert.match(gate.sourceProofOriginalArtifactSha256,/^[a-f0-9]{64}$/);assert.match(gate.resultingMainProofOriginalArtifactSha256,/^[a-f0-9]{64}$/);
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024}).trim();
 assert.equal(fs.realpathSync(root),root);assert.equal(git('rev-parse','HEAD'),release);assert.equal(git('status','--porcelain','--untracked-files=no'),'');git('merge-base','--is-ancestor',sourceFreeze,release);git('merge-base','--is-ancestor',gate.sourceProofControlSha,release);
 git('fetch','--quiet','origin','main');git('merge-base','--is-ancestor',release,'origin/main');git('merge-base','--is-ancestor',gate.resultingMainValidatedSha,'origin/main');git('merge-base','--is-ancestor',go.policyProposalSha,'origin/main');git('merge-base','--is-ancestor',go.policyReviewedTransportSha,'origin/main');
 const cohort=JSON.parse(review('closed-source-review.json'));assert.equal(cohort.sourceSha,sourceFreeze);assert.equal(Object.keys(cohort.entries).length,145);
 for(const[name,e]of Object.entries(cohort.entries)){assert.equal(git('ls-tree',release,'--',name),e.mode+' blob '+e.sha+'\t'+name);assert.equal(git('hash-object','--no-filters','--',name),e.sha);}
 const policy=JSON.parse(review('approved-policy-inputs.json'));assert.equal(policy.originalPolicyProposal,go.policyProposalSha);
 for(const[name,h]of Object.entries(policy.ownedPolicyFiles)){assert.equal(hash(fs.readFileSync(root+'/'+name)),h);assert.equal(hash(execFileSync('git',['show','origin/main:'+name],{cwd:root,maxBuffer:8*1024*1024})),h);}
 const manifest=JSON.parse(fs.readFileSync(root+'/apps/architecture-lab/knowledge-source.json'));assert.equal(hash(fs.readFileSync(root+'/apps/architecture-lab/knowledge-source.json')),'7bde334dda3ec7068d3cb532ccd8a94f3477cea707abe250431ee16c3b044bf4');assert.equal(Object.keys(manifest.sourceDigests).length,478);
 assert.equal(git('diff','--name-only',release,'origin/main','--',...Object.keys(manifest.sourceDigests)),'');
 for(const[name,digest]of Object.entries(manifest.sourceDigests)){const p=root+'/'+name,s=fs.lstatSync(p);assert(s.isFile()&&!s.isSymbolicLink()&&!(s.mode&0o111));assert.equal(hash(fs.readFileSync(p)),digest,name);}
 return{go:{...go,release,identityOwnerSqlSha256:sqlSha},selection,gate,actualAcceptedMain:git('rev-parse','origin/main')};
}
