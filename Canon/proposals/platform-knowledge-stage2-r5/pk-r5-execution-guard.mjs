import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';
export const base='/workspaces/sgdev-tasks/platform-knowledge-stage2-technical-20261117',root='/tmp/pk-root-producer-current-main-20261118',release='2706f13a5fb37a45daf4aea7be5e9d88ee7e4024';
export const hash=x=>createHash('sha256').update(x).digest('hex');
export function executionGuard(){
 const go=JSON.parse(fs.readFileSync(base+'/evidence/owner-r5-execution-go.json'));
 assert.equal(go.status,'APPROVED');assert.equal(go.taskId,'ARCH-PK-STAGE2-TECHNICAL-CONT-20261117');assert.equal(go.release,release);assert.match(go.reviewSha,/^[a-f0-9]{40}$/);assert.equal(go.hostConversationId,'01a1e7fb-aa2e-7501-b3d7-5f42be90cb14');assert.equal(go.approvalSource,'DIRECT_HUMAN_REPLY_IN_CURRENT_CHAT');assert.equal(go.approvalRef,'https://github.com/profitia/SG-dev/blob/'+go.reviewSha+'/Canon/evidence/2026-11-18-platform-knowledge-stage2-srm-root-release-r5.md');assert(Date.now()<Date.parse(go.validUntil));assert(Date.parse(go.validUntil)<=Date.parse('2026-11-24T23:59:00Z'));
 const review=(name)=>execFileSync('git',['show',go.reviewSha+':Canon/proposals/platform-knowledge-stage2-r5/'+name],{cwd:root,maxBuffer:8*1024*1024});
 const approved=JSON.parse(review('execution-asset-digests.json'));assert.equal(approved.release,release);
 const bindings={'pk-r5-execution-guard.mjs':'pk-r5-execution-guard.mjs','execute-reviewed-identity-r5.mjs':'execute-reviewed-identity-r5.mjs','execute-reviewed-product-r5.mjs':'execute-reviewed-product-r5.mjs','identity-release-pin-r5-envelope.mjs':'accepted-main-tools/identity-release-pin-r5-envelope.mjs','native-identity-release-pin-r5.py':'accepted-main-tools/native-identity-release-pin-r5.py'};
 for(const[publicName,localName]of Object.entries(bindings)){const actual=fs.readFileSync(base+'/'+localName);assert.equal(hash(actual),approved.files[publicName],publicName);assert.equal(hash(review(publicName)),approved.files[publicName],publicName);}
 const gate=JSON.parse(fs.readFileSync(base+'/evidence/runtime-release-accepted-and-ci-pass.json'));
 assert.equal(gate.status,'PASS');assert.equal(gate.releaseSha,release);assert.equal(gate.sourceAccepted,true);assert.equal(gate.requiredReleaseCi,'PASS');assert.equal(gate.resultingMainCi,'PASS');
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024}).trim();
 assert.equal(git('rev-parse','HEAD'),release);assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 git('fetch','--quiet','origin','main');git('merge-base','--is-ancestor',release,'origin/main');
 const manifest=JSON.parse(fs.readFileSync(root+'/apps/architecture-lab/knowledge-source.json'));assert.equal(Object.keys(manifest.sourceDigests).length,460);
 assert.equal(git('diff','--name-only',release,'origin/main','--',...Object.keys(manifest.sourceDigests)),'');
 for(const [name,digest]of Object.entries(manifest.sourceDigests)){const p=root+'/'+name,s=fs.lstatSync(p);assert(s.isFile()&&!s.isSymbolicLink()&&!(s.mode&0o111));assert.equal(hash(fs.readFileSync(p)),digest,name);}
 return{go,gate,actualAcceptedMain:git('rev-parse','origin/main')};
}
