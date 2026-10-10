import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import pg from "pg";
import {githubResponse,githubMetadata,reportDiagnostic,childDiagnostic,diagnosticError,ReleaseDiagnosticError,createGithubRequester,createGithubRequestMetrics,githubRequestIdentity} from "./release-diagnostics.mjs";
import {prepareResume,assertResumeFence} from "./resume-staging.mjs";
import {manifestFrom} from "./staging-lifecycle.mjs";
import {digest,operations} from "../../../scripts/governance/srm-release-lifecycle.mjs";
import {
  contract,
  migrationManifest,
  assertAuthorization,
  assertMigrationDestination,
  inspectLedger,
  runMigrations,
  initializationConfig,
  promotionExecutorEnvironment,
} from "./staging-migrate.mjs";
import {
  buildPlan,
  verifyPasswordSmoke,
  assertRenderService,
  assertDispatchTarget,
  selectReusableDeploy,
  inspectProductDatabase,
} from "./promote-staging.mjs";
const sha = "a".repeat(40);
const githubBase = 'https://api.github.com/repos/profitia/SG-dev';
function readRecoveryFixture(responses, settings={}) {
  let time=100000;const calls=[],pauses=[],events=[];
  const request=createGithubRequester(async(url,options)=>{
    calls.push({url,method:options.method});const r=responses.shift();
    if(r instanceof Error)throw r;
    return new Response(JSON.stringify(r?.body??{commit:{sha}}),{status:r?.status??200,headers:{'x-github-request-id':'ABCD:1234',...r?.headers}});
  },{authorizationExpiresAt:new Date(time+3600000).toISOString(),now:()=>time,pause:async ms=>{pauses.push(ms);time+=ms;},random:()=>0,emit:d=>events.push(d),...settings});
  return {request,calls,pauses,events,advance(ms){time+=ms;}};
}
for(const status of [500,502,503,504])test('known GET recovers transient GitHub '+status+' preserving exact request identity',async()=>{
  const f=readRecoveryFixture([{status},{status:200}]);const url=githubBase+'/branches/main';
  assert.equal((await f.request(url,{method:'GET'},'github-rest')).commit.sha,sha);
  assert.deepEqual(f.calls,[{url,method:'GET'},{url,method:'GET'}]);assert.deepEqual(f.pauses,[250]);
  assert.equal(f.events[0].endpoint,'authority-branch');assert.equal(f.events[0].retryDecision,'GET_ONLY_BACKOFF');
  assert.equal(f.events[1].retryDecision,'RECOVERED');assert.equal(f.events[1].attemptNumber,2);
});
test('persistent read 502 terminates within attempt budget with precise forwarded diagnostics',async()=>{
  const f=readRecoveryFixture(Array.from({length:3},()=>({status:502})));
  await assert.rejects(f.request(githubBase+'/branches/main',{method:'GET'},'github-rest'),e=>{
    const d=childDiagnostic('SRM_RELEASE_DIAGNOSTIC '+JSON.stringify(e.diagnostic));
    assert.equal(d.httpMethod,'GET');assert.equal(d.endpoint,'authority-branch');assert.equal(d.requestType,'READ_ONLY');
    assert.equal(d.providerEffectCertainty,'NO_MUTATION');assert.equal(d.requestId,'ABCD:1234');
    assert.equal(d.retryDecision,'STOP_ATTEMPT_LIMIT');assert.equal(d.attemptNumber,3);return true;
  });assert.equal(f.calls.length,3);assert.deepEqual(f.pauses,[250,500]);
});
for(const error of [Object.assign(Error('private timeout'),{name:'TimeoutError'}),Object.assign(TypeError('private connection'),{cause:{code:'ECONNRESET'}})])
test('known read safely recovers network '+error.name,async()=>{
  const f=readRecoveryFixture([error,{status:200}]);await f.request(githubBase+'/branches/main',{method:'GET'},'github-rest');
  assert.equal(f.calls.length,2);assert.equal(f.events[0].networkRetrySafe,true);assert.ok(!JSON.stringify(f.events).includes('private'));
});
test('unclassified local error never becomes network retry permission',async()=>{
  const f=readRecoveryFixture([TypeError('private programming error')]);await assert.rejects(f.request(githubBase+'/branches/main',{method:'GET'},'github-rest'),e=>e.diagnostic.retryDecision==='STOP_NOT_RETRYABLE');assert.equal(f.calls.length,1);
});
for(const [status,headers,expected] of [
  [429,{'retry-after':'2'},2000], [502,{'retry-after':'Thu, 01 Jan 1970 00:02:00 GMT'},20000],
  [403,{'x-ratelimit-remaining':'0','x-ratelimit-reset':'102'},3000], [429,{},60000],
  [502,{'x-poll-interval':'300'},300000],
])test('GitHub server delay is respected for '+status+' '+JSON.stringify(headers),async()=>{
  const f=readRecoveryFixture([{status,headers},{status:200}]);await f.request(githubBase+'/branches/main',{method:'GET'},'github-rest');assert.deepEqual(f.pauses,[expected]);
});
test('secondary rate limit backoff increases exponentially',async()=>{
  const f=readRecoveryFixture([{status:429},{status:429},{status:200}]);await f.request(githubBase+'/branches/main',{method:'GET'},'github-rest');assert.deepEqual(f.pauses,[60000,120000]);
});
test('rate limit cooldown also fences another endpoint and a subsequent write',async()=>{
  const f=readRecoveryFixture([{status:429,headers:{'retry-after':'2'}},{status:200}],{attemptLimit:1});
  await assert.rejects(f.request(githubBase+'/branches/main',{method:'GET'},'github-rest'));
  await f.request(githubBase+'/pulls',{method:'POST',body:'sensitive'},'github-rest');assert.deepEqual(f.pauses,[2000]);assert.equal(f.calls.length,2);
});
test('successful polling guidance is retained for the same exact endpoint',async()=>{
  const f=readRecoveryFixture([{status:200,headers:{'x-poll-interval':'300'}},{status:200}]);
  for(let i=0;i<2;i++)await f.request(githubBase+'/branches/main',{method:'GET'},'github-rest');assert.deepEqual(f.pauses,[300000]);
});
for(const headers of [{'retry-after':'invalid'},{'x-poll-interval':'invalid'},{'x-ratelimit-remaining':'0'}])
test('unsafe retry guidance fails closed '+JSON.stringify(headers),async()=>{
  const f=readRecoveryFixture([{status:429,headers}]);await assert.rejects(f.request(githubBase+'/branches/main',{method:'GET'},'github-rest'),e=>e.diagnostic.retryDecision==='STOP_RETRY_GUIDANCE');assert.equal(f.calls.length,1);
});
for(const status of [401,403,404])test('ordinary GitHub '+status+' is never treated as transient',async()=>{
  const f=readRecoveryFixture([{status}]);await assert.rejects(f.request(githubBase+'/branches/main',{method:'GET'},'github-rest',{missingIsError:true}),e=>e.diagnostic.retryDecision==='STOP_NOT_RETRYABLE');assert.equal(f.calls.length,1);assert.deepEqual(f.pauses,[]);
});
test('unknown endpoint or wrong repository never receives read retry authority or leaks URL',async()=>{
  for(const url of [githubBase+'/unknown?token=private','https://api.github.com/repos/foreign/SG-dev/branches/main']){
    const f=readRecoveryFixture([{status:502}]);await assert.rejects(f.request(url,{method:'GET'},'github-rest'),e=>{
      assert.equal(e.diagnostic.endpoint,'unrecognized');assert.equal(e.diagnostic.retryEligibility,'INELIGIBLE');assert.ok(!JSON.stringify(e.diagnostic).match(/private|foreign|https/));return true;
    });assert.equal(f.calls.length,1);
  }
});
for(const [method,path] of [['POST','/pulls'],['PATCH','/environments/srm-staging/variables/SRM_RELEASE_BINDING_RECEIPT'],['PUT','/pulls/234/merge'],['DELETE','/git/refs']])
test('ambiguous write '+method+' 502 is never repeated',async()=>{
  const f=readRecoveryFixture([{status:502,body:{message:'credential=private',payload:'sensitive'}}]);
  await assert.rejects(f.request(githubBase+path,{method,body:'sensitive'},'github-rest'),e=>{
    assert.equal(e.diagnostic.requestType,'MUTATION');assert.equal(e.diagnostic.providerEffectCertainty,'AMBIGUOUS');assert.equal(e.diagnostic.retryDecision,'STOP_AMBIGUOUS_WRITE');assert.equal(e.diagnostic.attemptLimit,1);
    assert.ok(!JSON.stringify(e.diagnostic).match(/credential|private|sensitive/));return true;
  });assert.equal(f.calls.length,1);assert.deepEqual(f.pauses,[]);
});
test('GraphQL mutation timeout never retries or appears read-only',async()=>{
  const f=readRecoveryFixture([Object.assign(Error('private'),{name:'TimeoutError'})]);await assert.rejects(f.request('https://api.github.com/graphql',{method:'POST',body:'private'},'createCommitOnBranch'),e=>e.diagnostic.retryDecision==='STOP_AMBIGUOUS_WRITE'&&e.diagnostic.endpoint==='commit-mutation');assert.equal(f.calls.length,1);
});
test('authorization window cannot be extended to fit mandatory delay',async()=>{
  const f=readRecoveryFixture([{status:502,headers:{'retry-after':'2'}}],{authorizationExpiresAt:new Date(101000).toISOString()});
  await assert.rejects(f.request(githubBase+'/branches/main',{method:'GET'},'github-rest'),e=>e.diagnostic.retryDecision==='STOP_AUTHORIZATION_WINDOW');assert.equal(f.calls.length,1);assert.deepEqual(f.pauses,[]);
});
test('authorization is checked again after pause and before any next read or write',async()=>{
  let time=100000,calls=0;const r=createGithubRequester(async()=>{calls++;return new Response('{}',{status:502});},{authorizationExpiresAt:new Date(101000).toISOString(),now:()=>time,pause:async()=>{time=101000;},random:()=>0,emit:()=>{}});
  await assert.rejects(r(githubBase+'/branches/main',{method:'GET'},'github-rest'),e=>e.diagnostic.retryDecision==='STOP_AUTHORIZATION_EXPIRED');
  await assert.rejects(r(githubBase+'/pulls',{method:'POST'},'github-rest'),e=>e.diagnostic.retryDecision==='STOP_AUTHORIZATION_EXPIRED');assert.equal(calls,1);
});
for(const settings of [{readDeadlineMs:200},{executionDeadlineMs:200}])test('configured deadline bounds recovery '+JSON.stringify(settings),async()=>{
  const f=readRecoveryFixture([{status:502}],settings);await assert.rejects(f.request(githubBase+'/branches/main',{method:'GET'},'github-rest'),e=>e.diagnostic.retryDecision==='STOP_TIME_LIMIT');assert.equal(f.calls.length,1);
});
test('shared additional-read retry budget cannot reset on the next operation',async()=>{
  const f=readRecoveryFixture([{status:502},{status:200},{status:502}],{retryBudget:1});await f.request(githubBase+'/branches/main',{method:'GET'},'github-rest');
  await assert.rejects(f.request(githubBase+'/pulls?state=all',{method:'GET'},'github-rest'),e=>e.diagnostic.retryDecision==='STOP_RETRY_BUDGET');assert.equal(f.calls.length,3);
});
test('jitter is injected, bounded and does not shorten server minimum',async()=>{
  const f=readRecoveryFixture([{status:502},{status:200}],{random:()=>0.5});await f.request(githubBase+'/branches/main',{method:'GET'},'github-rest');assert.deepEqual(f.pauses,[375]);
});
test('acknowledgement owner receives a single attempt with explicit deferral',async()=>{
  const f=readRecoveryFixture([{status:502}]);await assert.rejects(f.request(githubBase+'/git/ref/heads/srm-publication-'+ 'a'.repeat(24),{method:'GET'},'read-publication-branch',{missingIsError:true,acknowledgementManaged:true}),e=>e.diagnostic.retryDecision==='DEFER_TO_ACKNOWLEDGEMENT');assert.equal(f.calls.length,1);assert.deepEqual(f.pauses,[]);
});
for(const settings of [{attemptLimit:6},{retryBudget:21},{readDeadlineMs:1800001},{executionDeadlineMs:3600001}])test('retry configuration fails closed beyond hard limits '+JSON.stringify(settings),()=>{
  assert.throws(()=>readRecoveryFixture([],settings),/INVALID_RETRY_BOUNDS/);
});
test('endpoint identifiers do not contain variable names, SHAs or personal/provider payloads',()=>{
  const i=githubRequestIdentity(githubBase+'/commits/'+sha+'/check-runs?token=private','GET');assert.equal(i.endpoint,'commit-checks');assert.ok(!JSON.stringify(i).includes(sha));
});
test('retry diagnostics retain only the observed journal generation and original approval identity',async()=>{
  const f=readRecoveryFixture([{status:502},{status:200}],{diagnosticContext:()=>({generation:65,approvalId:'SRM-STAGING-38027365352-1',token:'private'})});
  await f.request(githubBase+'/branches/main',{method:'GET'},'github-rest');assert.equal(f.events[0].generation,65);assert.equal(f.events[1].approvalId,'SRM-STAGING-38027365352-1');assert.ok(!JSON.stringify(f.events).includes('private'));
});
test('a blocked write preflight remains NOT_SENT and never appears as ambiguous provider effect',async()=>{
  const f=readRecoveryFixture([new ReleaseDiagnosticError({stage:'github-write-preflight',category:'RELEASE_GATE',requestReachedGitHub:'NOT_SENT',message:'Independent governance preflight blocked'})]);
  await assert.rejects(f.request(githubBase+'/pulls',{method:'POST'},'github-rest'),e=>{
    assert.equal(e.diagnostic.stage,'github-write-preflight');assert.equal(e.diagnostic.requestReachedGitHub,'NOT_SENT');assert.equal(e.diagnostic.retryDecision,'STOP_NOT_RETRYABLE');assert.equal(e.diagnostic.providerEffectCertainty,'UNKNOWN');return true;
  });assert.equal(f.calls.length,1);
});
test('null missing-response polling guidance survives before a subsequent exact read',async()=>{
  const f=readRecoveryFixture([{status:404,headers:{'x-poll-interval':'300'}},{status:200}]);
  assert.equal(await f.request(githubBase+'/branches/main',{method:'GET'},'github-rest'),null);
  await f.request(githubBase+'/branches/main',{method:'GET'},'github-rest');assert.deepEqual(f.pauses,[300000]);
});
test('acknowledgement caller deadline also bounds adapter cooldown waits',async()=>{
  const f=readRecoveryFixture([{status:404,headers:{'x-poll-interval':'300'}},{status:200}]);
  assert.equal(await f.request(githubBase+'/branches/main',{method:'GET'},'github-rest'),null);
  await assert.rejects(f.request(githubBase+'/branches/main',{method:'GET'},'github-rest',{acknowledgementManaged:true,deadlineAt:200000}),e=>e.diagnostic.retryDecision==='STOP_TIME_LIMIT');
  assert.equal(f.calls.length,1);assert.deepEqual(f.pauses,[]);
});
test('non-JSON transient response recovers safely; successful invalid JSON fails mapping without retry',async()=>{
  for(const status of [200,502]){
    let calls=0;const r=createGithubRequester(async()=>{calls++;return calls===1 ? new Response('private payload',{status}) : new Response('{}');},{authorizationExpiresAt:new Date(3600000).toISOString(),now:()=>100000,pause:async()=>{},emit:()=>{}});
    if(status===502){await r(githubBase+'/branches/main',{method:'GET'},'github-rest');assert.equal(calls,2);}
    else await assert.rejects(r(githubBase+'/branches/main',{method:'GET'},'github-rest'),e=>e.diagnostic.category==='INVALID_JSON'&&e.diagnostic.retryDecision==='STOP_NOT_RETRYABLE'&&!JSON.stringify(e.diagnostic).includes('private'));
  }
});
test('successful GitHub request metadata stays out of canonical payloads',async()=>{
  const body={ref:'refs/heads/srm-publication-'+ 'a'.repeat(24),object:{type:'commit',sha}};
  const result=await githubResponse(async()=>new Response(JSON.stringify(body),{status:201,headers:{'x-github-request-id':'ABCD:5678'}}),'https://api.github.com/repos/profitia/SG-dev/git/refs',{method:'POST'},'create-publication-branch');
  assert.deepEqual(result,body);assert.equal(githubMetadata(result).httpStatus,201);assert.equal(githubMetadata(result).requestId,'ABCD:5678');
  assert.equal(digest(result),digest(body));
});
test('typed GET 404 preserves actual HTTP identity only when explicitly requested',async()=>{
  const fetcher=async()=>new Response(JSON.stringify({message:'Not Found',secret:'do-not-log'}),{status:404,headers:{'x-github-request-id':'ABCD:5678'}});
  assert.equal(await githubResponse(fetcher,'https://api.github.com/exact-ref',{method:'GET'},'read-publication-branch'),null);
  await assert.rejects(githubResponse(fetcher,'https://api.github.com/exact-ref',{method:'GET'},'read-publication-branch',{missingIsError:true}),e=>{
    assert.equal(e.diagnostic.httpStatus,404);assert.equal(e.diagnostic.requestId,'ABCD:5678');assert.ok(!JSON.stringify(e.diagnostic).includes('do-not-log'));return true;
  });
});
test('GitHub HTTP-date retry guidance uses an injected clock and safe metadata',async()=>{
  await assert.rejects(githubResponse(async()=>new Response(JSON.stringify({message:'rate limit exceeded',token:'do-not-log'}),{status:429,headers:{'retry-after':'Thu, 01 Jan 1970 00:02:00 GMT','x-poll-interval':'300','x-github-request-id':'ABCD:1234'}}),'https://api.github.com/exact-ref',{method:'GET'},'read-publication-branch',{missingIsError:true,now:()=>100000}),e=>{
    assert.equal(e.diagnostic.retryAfterMs,20000);assert.equal(e.diagnostic.pollIntervalMs,300000);assert.equal(e.diagnostic.category,'RATE_LIMITED');
    assert.ok(!JSON.stringify(e.diagnostic).includes('do-not-log'));return true;
  });
});
for(const interval of ['invalid','-1','1.5','9007199254740991'])test('malformed or overflowing GitHub polling guidance fails closed: '+interval,async()=>{
  await assert.rejects(githubResponse(async()=>new Response(JSON.stringify({message:'Not Found'}),{status:404,headers:{'x-poll-interval':interval}}),'https://api.github.com/exact-ref',{method:'GET'},'read-publication-branch',{missingIsError:true}),e=>{
    assert.equal(e.diagnostic.retryGuidanceInvalid,true);assert.equal(e.diagnostic.pollIntervalMs,undefined);return true;
  });
});
test('resumable acknowledgement timing is allowlisted through child diagnostics',()=>{
  const d=diagnosticError(new ReleaseDiagnosticError({category:'HTTP_REJECTION',httpStatus:404,retryDecision:'STOP_AUTHORIZATION_WINDOW',acknowledgementDeadlineAt:200000,retryNotBeforeAt:400000,authorization:'secret-value'})).diagnostic;
  const forwarded=childDiagnostic('SRM_RELEASE_DIAGNOSTIC '+JSON.stringify(d));
  assert.equal(forwarded.retryDecision,'STOP_AUTHORIZATION_WINDOW');assert.equal(forwarded.acknowledgementDeadlineAt,200000);assert.equal(forwarded.retryNotBeforeAt,400000);
  assert.ok(!JSON.stringify(forwarded).includes('secret-value'));
});
test('complete diagnostic schema survives child forwarding without secret values',()=>{
  const before=console.error;let logged;console.error=s=>{logged=s;};
  try {
    const d=reportDiagnostic(new ReleaseDiagnosticError({stage:'publication-branch-acknowledgement',operation:'verify-publication-branch',category:'HTTP_REJECTION',httpStatus:404,requestId:'ABCD:5678',attemptNumber:5,attemptLimit:5,expectedSha:sha,branch:'srm-publication-'+ 'a'.repeat(24),generation:38,approvalId:'SRM-STAGING-37939780926-1',providerEffectObserved:'CREATION_ACKNOWLEDGED',retryDecision:'STOP_ATTEMPT_LIMIT',token:'do-not-log',message:'password=do-not-log'}));
    for(const field of ['publicationStage','githubOperation','httpStatus','githubRequestId','failureCategory','attemptNumber','attemptLimit','expectedSha','observedSha','branch','journalGeneration','releaseApprovalId','providerEffectObserved','retryDecision'])assert.ok(Object.hasOwn(d,field),field);
    assert.equal(d.observedSha,'NOT_OBSERVED');assert.ok(!logged.includes('do-not-log'));
    const forwarded=reportDiagnostic(new ReleaseDiagnosticError(childDiagnostic(logged)));assert.equal(forwarded.httpStatus,404);assert.equal(forwarded.githubRequestId,'ABCD:5678');assert.equal(forwarded.attemptNumber,5);
    const unknown=reportDiagnostic(Error('token=do-not-log'));assert.equal(unknown.httpStatus,'UNKNOWN');assert.equal(unknown.githubRequestId,'UNKNOWN');assert.equal(unknown.providerEffectObserved,'UNKNOWN');assert.equal(unknown.retryDecision,'NOT_EVALUATED');assert.ok(!logged.includes('do-not-log'));
  } finally {console.error=before;}
});
test("HTTP and GraphQL diagnostics retain request identity but never sensitive payloads",async()=>{
  const response=(status,body)=>({status,ok:status===200,headers:new Headers({'x-github-request-id':'ABCD:1234'}),json:async()=>body});
  for(const [status,body,category] of [[403,{message:'Resource not accessible by integration',token:'private'},'HTTP_REJECTION'],[200,{errors:[{type:'UNPROCESSABLE',path:['createCommitOnBranch'],message:'Invalid input postgresql://private:password@host',extensions:{token:'private'}}]},'GRAPHQL_REJECTION']]){
    await assert.rejects(githubResponse(async()=>response(status,body),'https://api.github.com/graphql',{method:'POST',body:'sensitive'},'createCommitOnBranch'),e=>{
      assert.equal(e.diagnostic.httpStatus,status);assert.equal(e.diagnostic.requestId,'ABCD:1234');assert.equal(e.diagnostic.category,category);
      assert.equal(e.diagnostic.requestReachedGitHub,'HTTP_RESPONSE');assert.ok(!JSON.stringify(e.diagnostic).match(/private|password|postgresql/));return true;
    });
  }
  await assert.rejects(githubResponse(async()=>{throw Object.assign(Error('secret connection string'),{name:'TimeoutError'});},'https://api.github.com/graphql',{method:'POST'},'createCommitOnBranch'),e=>{assert.equal(e.diagnostic.requestReachedGitHub,'UNKNOWN');return true;});
  const e=diagnosticError(Error('password=private'),{stage:'publication',approvalId:'SRM-STAGING-TEST',token:'private'});
  const forwarded=childDiagnostic('untrusted stderr private\nSRM_RELEASE_DIAGNOSTIC '+JSON.stringify({...e.diagnostic,token:'private',message:'private'}));
  assert.ok(!JSON.stringify(forwarded).includes('private'));assert.equal(forwarded.approvalId,'SRM-STAGING-TEST');
  assert.equal(childDiagnostic('untrusted stderr'),null);assert.ok(e instanceof ReleaseDiagnosticError);
});
function resumeFixture(now=Date.now()) {
  const m=manifestFrom({repositoryId:contract.repositoryId,approvedMainAncestor:true,ciPassed:true,developmentLiveSha:sha},sha);
  const a={schemaVersion:'2.0',projectKey:'SRM',repository:contract.repository,repositoryId:contract.repositoryId,targetEnvironment:'staging',stagingDeploymentAuthorized:true,stagingMutationsAllowed:true,productionMutationsAllowed:false,mode:'promote',releaseSha:sha,manifest:m,manifestDigest:digest(m),approvalId:'SRM-STAGING-123-1',approvedBy:'profitia',costOwner:'Profit.ia',expiresAt:new Date(now-1000).toISOString(),renderWorkspaceId:contract.render.workspaceId,renderProjectId:contract.render.projectId,renderEnvironmentId:contract.render.environmentId,neonProjectId:contract.neon.projectId,neonBranchId:contract.neon.branchId,neonEndpointId:contract.neon.endpointId,databaseName:'srm_app',operations,budget:{renderPlan:contract.render.plan,renderInstances:1,renderMonthlyComputeUsd:7,neonMaxCu:8,neonExistingEndpointOnly:true,providerEntitlementsAccepted:true,storageEgressBuildCostsAccepted:true,maxDeploymentAttempts:3}};
  const state=JSON.parse(JSON.stringify({schemaVersion:'1.0',projectKey:'SRM',targetEnvironment:'staging',generation:35,release:{approvalId:a.approvalId,manifest:m,manifestDigest:a.manifestDigest,authorizationDigest:digest({...a,expiresAt:undefined}),authorization:{...a,manifest:undefined},mode:'promote',phase:'PROVISIONING',owner:'github-run:123',steps:{'github-environment':{status:'DONE'},'github-bindings':{status:'INTENT'}}}}));
  return {state,input:{approvalId:a.approvalId,manifestDigest:a.manifestDigest,sha,actor:'profitia',costOwner:'Profit.ia',renewal:'YES'},run:{id:123,status:'completed',repository:{id:contract.repositoryId,full_name:contract.repository}},now};
}
test("explicit bounded renewal preserves release identity, scope, steps and ownership fence",()=>{
  const f=resumeFixture(),before=structuredClone(f.state),p=prepareResume(f.state,f.input,f.run,f.now);
  assert.equal(p.authorization.approvalId,f.input.approvalId);assert.equal(p.authorization.manifestDigest,f.input.manifestDigest);
  assert.equal(Date.parse(p.authorization.expiresAt)-f.now,3600000);assert.deepEqual(f.state,before);assertResumeFence(f.state,p);
  assert.throws(()=>assertResumeFence({...f.state,generation:36},p),/journal changed/);
  assert.throws(()=>assertResumeFence({...f.state,release:{...f.state.release,owner:'github-run:999'}},p));
});
for(const [name,change] of [
  ['expired approval without explicit renewal',f=>f.input.renewal='NO'],
  ['new approval identity',f=>f.input.approvalId='SRM-STAGING-999-1'],
  ['wrong manifest',f=>f.input.manifestDigest='0'.repeat(64)],
  ['wrong application SHA',f=>f.input.sha='b'.repeat(40)],
  ['previous executor still running',f=>f.run.status='in_progress'],
  ['different previous executor',f=>f.run.id=999],
  ['cross project',f=>f.state.projectKey='SG2'],
  ['Production',f=>f.state.targetEnvironment='production'],
  ['different owner',f=>f.input.actor='other'],
  ['changed cost owner',f=>f.input.costOwner='other'],
  ['changed operations',f=>f.state.release.authorization.operations=['deploy']],
  ['already completed release',f=>f.state.release.phase='VERIFIED'],
])test('resume refuses '+name,()=>{const f=resumeFixture();change(f);assert.throws(()=>prepareResume(f.state,f.input,f.run,f.now));});
test('workflow retains failed diagnostics and explicit protected resume gates',()=>{
  const w=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'../../../.github/workflows/srm-ci.yml'),'utf8');
  for(const token of ['resume_approval_id:','resume_manifest_digest:','resume_authorization_renewal:','environment: srm-staging','assertResumeFence(','if: always()','/tmp/srm-staging-diagnostic.json','--resume-fence'])assert.ok(w.includes(token),token);
});
const approval = () => ({
  schemaVersion: "1.0",
  projectKey: "SRM",
  repository: contract.repository,
  targetEnvironment: "staging",
  stagingDeploymentAuthorized: true,
  productionMutationsAllowed: false,
  releaseSha: sha,
  neonProjectId: contract.neon.projectId,
  neonBranchId: contract.neon.branchId,
  databaseName: "srm_app",
  approvalId: "SRM-STAGING-EXPLICIT-TEST",
  approvedBy: "test-only",
  costOwner: "test-only",
  operations: ["deploy", "migrate"],
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
});
const evidence = () => ({
  repositoryId: contract.repositoryId,
  approvedMainAncestor: true,
  ciPassed: true,
  developmentLiveSha: sha,
  neonProjectId: contract.neon.projectId,
  neonBranchId: contract.neon.branchId,
  databaseName: "srm_app",
  databaseExists: false,
  runtimeRoleReady: false,
  organizationReady: false,
  secretsIsolated: false,
  githubProtected: false,
  service: null,
});

// Copy real modules into a disposable fixture root; production routing gains no override.
async function isolatedTopologyPromotion(t, active = false) {
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "srm-promotion-topology-test-"));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  for (const relative of ["apps/srm/scripts", "apps/srm/deployment", "apps/srm/db/migrations", "scripts/governance"]) {
    fs.cpSync(path.join(sourceRoot, relative), path.join(temporaryRoot, relative), { recursive: true });
  }
  fs.symlinkSync(path.join(sourceRoot, "apps/srm/node_modules"), path.join(temporaryRoot, "apps/srm/node_modules"), "dir");
  const topology = JSON.parse(fs.readFileSync(path.join(sourceRoot, "Canon/registries/srm-environment-topology-v1.json"), "utf8"));
  topology.environments.staging = {
  "status": "RESERVED",
  "activationStatus": "NOT_ONBOARDED",
  "github": {
    "environmentName": "srm-staging",
    "environmentId": null,
    "exclusiveProjectKey": "SRM",
    "status": "NOT_PROVISIONED"
  },
  "render": {
    "workspaceId": "tea-d7lps8rbc2fs73cn80dg",
    "projectId": "prj-dapbd3hsrm7s73es53fg",
    "environmentId": "evm-dapbdbbbc2fs73f4g7gg",
    "providerLabel": "Staging",
    "networkIsolation": "ENABLED",
    "services": {}
  },
  "neon": {
    "projectId": "snowy-breeze-40315151",
    "branchId": "br-broad-butterfly-b11t4v01",
    "branchName": "Staging",
    "parentBranchId": "br-nameless-bar-b1wlhjhx",
    "branchState": "ready",
    "branchProtected": false,
    "applicationDatabaseName": null,
    "applicationDatabaseStatus": "NOT_CREATED"
  },
  "domains": [],
  "deploymentPolicy": "NOT_ACTIVATED"
};
  if (active) {
    const stage = topology.environments.staging;
    stage.status = "ACTIVE";
    stage.verificationStatus = "VERIFIED";
    stage.github.environmentId = 1234;
    stage.neon.databaseId = 4321;
    stage.render.services.runtime = { serviceId: "srv-synthetic" };
  }
  const target = path.join(temporaryRoot, "Canon/registries/srm-environment-topology-v1.json");
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, JSON.stringify(topology));
  return import(pathToFileURL(path.join(temporaryRoot, "apps/srm/scripts/promote-staging.mjs")).href);
}

test("deterministic RESERVED first-deployment simulation lists all pending gates and never writes", async (t) => {
  const {buildPlan} = await isolatedTopologyPromotion(t);
  const a = buildPlan(evidence(), { sha });
  assert.equal(a.stagingMutated, false);
  assert.ok(a.blockers.includes("S0_EXACT_PROVIDER_ONBOARDING"));
  assert.ok(a.blockers.includes("FIRST_SERVICE_CREATION_WITH_PINNED_SOURCE"));
  assert.deepEqual(a, buildPlan(evidence(), { sha }));
});
for (const [key, value] of Object.entries({
  projectKey: "SG2",
  repository: "profitia/other",
  targetEnvironment: "production",
  stagingDeploymentAuthorized: false,
  productionMutationsAllowed: true,
  releaseSha: "b".repeat(40),
  neonProjectId: "bold-breeze-68888550",
  neonBranchId: "br-nameless-bar-b1wlhjhx",
  databaseName: "srm_pmos",
  approvedBy: null,
  costOwner: null,
  operations: ["rollback"],
  expiresAt: "2000-01-01",
}))
  test("authorization rejects " + key, () =>
    assert.throws(() =>
      assertAuthorization({ ...approval(), [key]: value }, sha, "deploy"),
    ),
  );
test("explicit authorization validates but cannot bypass RESERVED", () => {
  assert.doesNotThrow(() => assertAuthorization(approval(), sha, "deploy"));
  assert.throws(
    () =>
      buildPlan(evidence(), { sha, authorization: approval(), apply: true }),
    /Deployment-time gate/,
  );
});
for (const [key, value] of Object.entries({
  repositoryId: 0,
  approvedMainAncestor: false,
  ciPassed: false,
  developmentLiveSha: "b".repeat(40),
  neonProjectId: "wrong",
  neonBranchId: contract.development.branchId,
  databaseName: "srm_pmos",
}))
  test("promotion rejects " + key, () =>
    assert.throws(() => buildPlan({ ...evidence(), [key]: value }, { sha })),
  );
for (const [key, value] of Object.entries({
  ownerId: "wrong",
  environmentId: "production",
  repo: "https://github.com/profitia/other",
  autoDeployTrigger: "commit",
  branch: "staging",
}))
  test("Render routing rejects " + key, () => {
    const service = {
      id: "srv-test",
      ownerId: contract.render.workspaceId,
      environmentId: contract.render.environmentId,
      repo: "https://github.com/" + contract.repository,
      autoDeployTrigger: "off",
      branch: "main",
      [key]: value,
    };
    assert.throws(() => buildPlan({ ...evidence(), service }, { sha }));
  });
const migrationEnv = () => ({
  TARGET_ENVIRONMENT: "staging",
  SRM_NEON_PROJECT_ID: contract.neon.projectId,
  SRM_NEON_BRANCH_ID: contract.neon.branchId,
  SRM_APP_DIRECT_URL:
    "postgresql://neondb_owner:test-only@" +
    contract.neon.directHost +
    "/srm_app?sslmode=require",
});
test("exact Staging migration destination accepted", () =>
  assert.doesNotThrow(() => assertMigrationDestination(migrationEnv())));
for (const [key, value] of Object.entries({
  TARGET_ENVIRONMENT: "development",
  SRM_NEON_PROJECT_ID: "bold-breeze-68888550",
  SRM_NEON_BRANCH_ID: contract.development.branchId,
  SRM_APP_DIRECT_URL:
    "postgresql://neondb_owner:test-only@" +
    contract.development.directHost +
    "/srm_app?sslmode=require",
}))
  test("migration rejects " + key, () =>
    assert.throws(() =>
      assertMigrationDestination({ ...migrationEnv(), [key]: value }),
    ),
  );
for (const dest of [
  "postgresql://neondb_owner:test-only@" +
    contract.neon.directHost.replace(".", "-pooler.") +
    "/srm_app?sslmode=require",
  "postgresql://neondb_owner:test-only@" +
    contract.neon.directHost +
    "/srm_pmos?sslmode=require",
  "postgresql://srm_app_runtime:test-only@" +
    contract.neon.directHost +
    "/srm_app?sslmode=require",
])
  test(
    "migration refuses pooler, PMOS or runtime role " + dest.split("@")[1],
    () =>
      assert.throws(() =>
        assertMigrationDestination({
          ...migrationEnv(),
          SRM_APP_DIRECT_URL: dest,
        }),
      ),
  );
test("checksums and contiguous prefix support exact idempotent retry", () => {
  const ms = migrationManifest();
  assert.equal(ms.at(-1).version, "0012_verified_cogs_cost_magnitude");
  const rows = ms.map((m) => ({
    version: m.version,
    checksum_sha256: m.checksum,
  }));
  assert.deepEqual(inspectLedger(rows), []);
  assert.equal(inspectLedger(rows.slice(0, 5)).length, ms.length - 5);
  assert.throws(() => inspectLedger(rows.slice(1)), /prefix/);
  assert.throws(
    () =>
      inspectLedger([
        { version: rows[0].version, checksum_sha256: "0".repeat(64) },
      ]),
    /drift/,
  );
  assert.throws(
    () =>
      inspectLedger([
        { version: "9999_foreign", checksum_sha256: "0".repeat(64) },
      ]),
    /Unknown/,
  );
});
test("SQL failure rolls the transaction back", async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes("current_database"))
        return { rows: [{ name: "srm_app" }] };
      if (sql.includes("to_regclass")) return { rows: [{ ledger: null }] };
      if (sql.includes("pg_namespace")) return { rows: [{ exists: false }] };
      if (sql.startsWith("CREATE")) throw new Error("test SQL failure");
      return { rows: [] };
    },
  };
  await assert.rejects(runMigrations(client), /test SQL failure/);
  assert.equal(queries.at(-1), "ROLLBACK");
  assert.ok(!queries.includes("COMMIT"));
});
test("read-only migration inspection cannot run DDL", async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      return {
        rows: sql.includes("current_database")
          ? [{ name: "srm_app" }]
          : sql.includes("to_regclass")
            ? [{ ledger: null }]
            : sql.includes("pg_namespace")
              ? [{ exists: false }]
              : [],
      };
    },
  };
  const r = await runMigrations(client, { dryRun: true });
  assert.equal(r.applied.length, 0);
  assert.equal(queries[0], "BEGIN READ ONLY");
  assert.equal(queries.at(-1), "ROLLBACK");
  assert.ok(
    !queries.some((q) => q.startsWith("CREATE") || q.startsWith("INSERT")),
  );
});
test("ordinary push cannot enter Staging jobs; manual jobs require explicit authorization and pre-environment guard", () => {
  const workflow = fs.readFileSync(
    new URL("../../../.github/workflows/srm-ci.yml", import.meta.url),
    "utf8",
  );
  assert.ok(!workflow.includes("trigger_deploy"));
  assert.ok(
    workflow.includes(
      "if: github.event_name == 'workflow_dispatch' && inputs.staging_deployment_authorized == 'YES'",
    ),
  );
  assert.ok(workflow.includes("needs: srm-staging-guard"));
  assert.ok(workflow.includes("assertDispatchTarget();"));
  assert.ok(workflow.includes("environment: srm-staging"));
  assert.ok(workflow.includes("needs: srm-build"));
});
test("missing authorization fails before any provider call", () => {
  const r = spawnSync(
    process.execPath,
    ["scripts/promote-staging.mjs", "--apply", "--sha", sha],
    {
      cwd: new URL("..", import.meta.url),
      env: { PATH: process.env.PATH },
      encoding: "utf8",
    },
  );
  assert.notEqual(r.status, 0);
  assert.ok(r.stderr.includes("failed closed"));
});
test(
  "real local Postgres: first initialization, retry and checksum drift",
  { skip: !process.env.SRM_MIGRATION_TEST_URL },
  async () => {
    const u = new URL(process.env.SRM_MIGRATION_TEST_URL);
    if (
      !["localhost", "127.0.0.1"].includes(u.hostname) ||
      u.pathname != "/srm_migration_test"
    )
      throw new Error(
        "Migration integration test requires isolated localhost srm_migration_test",
      );
    const c = new pg.Client({ connectionString: u.toString() });
    await c.connect();
    try {
      await c.query("DROP SCHEMA IF EXISTS srm CASCADE");
      await c.query("DROP ROLE IF EXISTS srm_app_runtime");
      const initialize = initializationConfig({
        SRM_STAGING_ORGANIZATION_ID: "00000000-0000-4000-8000-000000000008",
        SRM_APP_DATABASE_PASSWORD: "isolated-local-only-password-at-least-32",
      });
      const faulty = {
        query: (sql, params) =>
          c.query(
            sql.includes("CREATE TABLE srm.catalog_financial_indicators")
              ? "SELECT 1/0"
              : sql,
            params,
          ),
      };
      await assert.rejects(runMigrations(faulty, { initialize }));
      assert.equal(
        (
          await c.query(
            "SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='srm') AS exists",
          )
        ).rows[0].exists,
        false,
      );
      assert.equal(
        (
          await c.query(
            "SELECT count(*)::int AS n FROM pg_roles WHERE rolname='srm_app_runtime'",
          )
        ).rows[0].n,
        0,
      );
      let r = await runMigrations(c, { initialize });
      assert.equal(r.applied.length, migrationManifest().length);
      r = await runMigrations(c);
      assert.equal(r.applied.length, 0);
      const tables = await c.query(
        "SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='srm' AND c.relkind='r' AND c.relname<>'schema_migrations' AND c.relrowsecurity AND c.relforcerowsecurity",
      );
      assert.equal(tables.rows[0].count, 15);
      const role = (
        await c.query(
          "SELECT rolcanlogin,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='srm_app_runtime'",
        )
      ).rows[0];
      assert.equal(role.rolcanlogin, true);
      assert.equal(role.rolsuper, false);
      assert.equal(role.rolbypassrls, false);
      await c.query("SET ROLE srm_app_runtime");
      assert.equal(
        (await c.query("SELECT count(*)::int AS n FROM srm.organizations"))
          .rows[0].n,
        0,
      );
      await c.query("SELECT set_config('srm.organization_id',$1,false)", [
        initialize.organizationId,
      ]);
      assert.equal(
        (await c.query("SELECT count(*)::int AS n FROM srm.organizations"))
          .rows[0].n,
        1,
      );
      await c.query(
        "SELECT set_config('srm.organization_id','00000000-0000-4000-8000-000000000009',false)",
      );
      assert.equal(
        (await c.query("SELECT count(*)::int AS n FROM srm.organizations"))
          .rows[0].n,
        0,
      );
      await c.query("RESET ROLE");
      await c.query(
        "UPDATE srm.schema_migrations SET checksum_sha256=repeat('0',64) WHERE version='0001_xray_foundation'",
      );
      await assert.rejects(runMigrations(c), /drift/);
    } finally {
      await c.end();
    }
  },
);

for (const suffix of [
  "&host=evil.example",
  "&sslmode=disable",
  "&options=-c%20search_path%3Devil",
  "#fragment",
])
  test("migration refuses URL override " + suffix, () =>
    assert.throws(() =>
      assertMigrationDestination({
        ...migrationEnv(),
        SRM_APP_DIRECT_URL: migrationEnv().SRM_APP_DIRECT_URL + suffix,
      }),
    ),
  );
test("initialization refuses absent, Development tenant and weak secret", () => {
  assert.throws(() => initializationConfig({}));
  assert.throws(() =>
    initializationConfig({
      SRM_STAGING_ORGANIZATION_ID: "00000000-0000-4000-8000-000000000008",
      SRM_APP_DATABASE_PASSWORD: "short",
    }),
  );
  assert.throws(() =>
    initializationConfig({
      SRM_STAGING_ORGANIZATION_ID: "00000000-0000-4000-8000-000000000008",
      SRM_APP_DATABASE_PASSWORD: "test-only-at-least-32-characters-password",
      SRM_DEVELOPMENT_ORGANIZATION_ID: "00000000-0000-4000-8000-000000000001",
    }),
  );
});
test("rollback approval does not bypass RESERVED or fabricate Development provenance", () => {
  const e = { ...evidence(), developmentLiveSha: "b".repeat(40) };
  const a = {
    ...approval(),
    operations: ["rollback"],
    rollbackSchemaCompatible: true,
  };
  const plan = buildPlan(e, { sha, rollback: true });
  assert.equal(plan.manifest.developmentLiveSha, e.developmentLiveSha);
  assert.throws(
    () => buildPlan(e, { sha, authorization: a, rollback: true, apply: true }),
    /Deployment-time gate/,
  );
});

test("password smoke uses real form protocol and verifies denial, invalid password, secure session and page", async () => {
  const calls = [];
  const url = "https://srm-staging-test.onrender.com";
  const stub = async (u, init = {}) => {
    calls.push([u, init]);
    if (u.endsWith("/report-data")) return new Response("{}", { status: 401 });
    if (u.endsWith("/login")) {
      assert.ok(init.body instanceof URLSearchParams);
      const valid = init.body.get("password") === "isolated-test-secret";
      return new Response(null, {
        status: 303,
        headers: {
          location: url + (valid ? "/" : "/login?error=invalid"),
          ...(valid
            ? {
                "set-cookie":
                  "srm_demo_session=test; HttpOnly; Secure; SameSite=Lax; Path=/",
              }
            : {}),
        },
      });
    }
    assert.equal(init.headers.cookie, "srm_demo_session=test");
    return new Response("page");
  };
  const result = await verifyPasswordSmoke(url, "isolated-test-secret", stub);
  assert.equal(result.secureCookie, "PASS");
  assert.equal(calls.length, 4);
});
test("password smoke rejects a public API before attempting login", async () => {
  let n = 0;
  await assert.rejects(
    verifyPasswordSmoke("https://staging.test", "test", async () => {
      n++;
      return new Response("{}");
    }),
    /Unauthenticated/,
  );
  assert.equal(n, 1);
});
test("CLI simulation never calls providers and cannot combine with apply", () => {
  const cwd = new URL("..", import.meta.url);
  const args = ["scripts/promote-staging.mjs", "--simulate", "--sha", sha];
  const r = spawnSync(process.execPath, args, {
    cwd,
    env: { PATH: process.env.PATH },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout);
  assert.equal(p.mode, "SIMULATION_SYNTHETIC_EVIDENCE");
  assert.equal(p.releaseProvenance, "NOT_VERIFIED");
  assert.equal(p.stagingMutated, false);
  assert.notEqual(p.readiness, "READY");
  assert.notEqual(
    spawnSync(process.execPath, [...args, "--apply"], {
      cwd,
      env: { PATH: process.env.PATH },
    }).status,
    0,
  );
});

const serviceFixture = () => ({
  id: "srv-test",
  ownerId: contract.render.workspaceId,
  environmentId: contract.render.environmentId,
  repo: "https://github.com/" + contract.repository,
  autoDeployTrigger: "off",
  branch: "main",
  rootDir: contract.render.rootDir,
  type: "web_service",
  serviceDetails: {
    region: contract.render.region,
    plan: contract.render.plan,
    runtime: "node",
    numInstances: contract.render.numInstances,
    healthCheckPath: contract.render.healthCheckPath,
    envSpecificDetails: {
      buildCommand: contract.render.buildCommand,
      startCommand: contract.render.startCommand,
    },
    previews: { generation: "off" },
  },
});
test("exact Render runtime contract is accepted", () =>
  assert.doesNotThrow(() => assertRenderService(serviceFixture())));
for (const [field, value] of Object.entries({
  region: "oregon",
  plan: "free",
  runtime: "docker",
  numInstances: 2,
  healthCheckPath: "/wrong",
}))
  test("Render contract rejects " + field, () => {
    const s = serviceFixture();
    s.serviceDetails[field] = value;
    assert.throws(() => assertRenderService(s));
  });
test("Render contract rejects altered build, start, root directory and previews", () => {
  for (const field of ["buildCommand", "startCommand"]) {
    const s = serviceFixture();
    s.serviceDetails.envSpecificDetails[field] = "wrong";
    assert.throws(() => assertRenderService(s));
  }
  const s = serviceFixture();
  s.rootDir = "apps/sg2";
  assert.throws(() => assertRenderService(s));
  const p = serviceFixture();
  p.serviceDetails.previews.generation = "automatic";
  assert.throws(() => assertRenderService(p));
});

test("RESERVED cannot enter a protected deployment job even with a forged environment response", async (t) => {
  const {assertDispatchTarget} = await isolatedTopologyPromotion(t);
  assert.throws(() => assertDispatchTarget({id:1,protection_rules:[{type:"required_reviewers"}]}), /Canonical first onboarding/);
});
test("ACTIVE fixture accepts its exact protected GitHub environment", async (t) => {
  const {assertDispatchTarget} = await isolatedTopologyPromotion(t,true);
  assert.doesNotThrow(() => assertDispatchTarget({id:1234,name:"srm-staging",protection_rules:[{type:"required_reviewers",prevent_self_review:true,reviewers:[{type:"User",reviewer:{id:123,login:"synthetic"}}]}],deployment_branch_policy:{custom_branch_policies:true,protected_branches:false}}));
});
test("ACTIVE fixture rejects forged protected GitHub identity", async (t) => {
  const {assertDispatchTarget} = await isolatedTopologyPromotion(t,true);
  assert.throws(() => assertDispatchTarget({id:1,protection_rules:[{type:"required_reviewers"}]}), /Exact protected GitHub environment/);
});
test("dispatch rejects empty review rules and self-review on another environment ID", async (t) => {
  const {assertDispatchTarget} = await isolatedTopologyPromotion(t,true);
  const ge={id:1234,name:"srm-staging",protection_rules:[{type:"required_reviewers",prevent_self_review:false,reviewers:[{type:"User",reviewer:{id:275643368,login:"profitia"}}]}],deployment_branch_policy:{custom_branch_policies:true,protected_branches:false}};
  assert.throws(()=>assertDispatchTarget(ge),/only for the existing/);
  ge.protection_rules[0].prevent_self_review=true;
  ge.protection_rules[0].reviewers=[];
  assert.throws(()=>assertDispatchTarget(ge),/Required reviewer/);
});
test("promotion reports the actual permitted executor and rejects foreign or local hosts", () => {
  assert.equal(
    promotionExecutorEnvironment({
      GITHUB_ACTIONS: "true",
      GITHUB_REF: "refs/heads/main",
      GITHUB_REPOSITORY: contract.repository,
      GITHUB_WORKFLOW: "SRM CI",
      GITHUB_JOB: "srm-staging-promote",
    }),
    "github-actions",
  );
  assert.equal(
    promotionExecutorEnvironment({
      CODESPACES: "true",
      CODESPACE_NAME: "test-only",
      PMOS_PROJECT_NAME: "SRM",
      PMOS_WORKSPACE_NAME: "SG-dev Codespaces SRM",
    }),
    "codespaces",
  );
  assert.throws(() => promotionExecutorEnvironment({}));
  assert.throws(() =>
    promotionExecutorEnvironment({
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "profitia/other",
      GITHUB_WORKFLOW: "SRM CI",
      GITHUB_JOB: "srm-staging-promote",
    }),
  );
  assert.throws(() =>
    promotionExecutorEnvironment({
      CODESPACES: "true",
      CODESPACE_NAME: "test-only",
      PMOS_PROJECT_NAME: "SG2",
      PMOS_WORKSPACE_NAME: "SG-dev Codespaces SRM",
    }),
  );
});

test("organization variable alone is not proof of database readiness", async () => {
  assert.deepEqual(
    await inspectProductDatabase(false, {
      SRM_STAGING_ORGANIZATION_ID: "test-only",
    }),
    {
      status: "BINDING_PENDING",
      runtimeRoleReady: false,
      organizationReady: false,
    },
  );
  assert.equal(
    (await inspectProductDatabase(true, {})).organizationReady,
    false,
  );
});
test("metadata inspection validates destination before connecting", async () => {
  let connected = false;
  await assert.rejects(
    inspectProductDatabase(
      true,
      { ...migrationEnv(), SRM_NEON_BRANCH_ID: contract.development.branchId },
      () => {
        connected = true;
        return {};
      },
    ),
  );
  assert.equal(connected, false);
});
test("metadata proof is read-only and checks actual role privileges and tenant record", async () => {
  const sqls = [];
  const c = {
    async connect() {},
    async end() {},
    async query(sql) {
      sqls.push(sql);
      return {
        rows: sql.includes("current_database")
          ? [{ name: "srm_app" }]
          : sql.includes("rolcanlogin")
            ? [
                {
                  rolcanlogin: true,
                  rolsuper: false,
                  rolbypassrls: false,
                  rolcreatedb: false,
                  rolcreaterole: false,
                  rolreplication: false,
                },
              ]
            : sql.includes("to_regclass")
              ? [{ table_name: "srm.organizations" }]
              : sql.startsWith("SELECT id FROM")
                ? [{ id: "test-only" }]
                : [],
      };
    },
  };
  const r = await inspectProductDatabase(
    true,
    {
      ...migrationEnv(),
      SRM_STAGING_ORGANIZATION_ID: "00000000-0000-4000-8000-000000000008",
    },
    () => c,
  );
  assert.equal(r.status, "READ_ONLY_VERIFIED");
  assert.equal(r.runtimeRoleReady, true);
  assert.equal(r.organizationReady, true);
  assert.equal(sqls[0], "BEGIN READ ONLY");
  assert.equal(sqls.at(-1), "ROLLBACK");
  assert.ok(
    !sqls.some((s) => /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|GRANT)\b/.test(s)),
  );
});

test("rollback creates a new deployment rather than reusing a deactivated old SHA", () => {
  assert.equal(
    selectReusableDeploy(
      [{ id: "old", status: "deactivated", commit: { id: sha } }],
      sha,
    ),
    null,
  );
  assert.equal(
    selectReusableDeploy(
      [{ id: "failed", status: "build_failed", commit: { id: sha } }],
      sha,
    ),
    null,
  );
});
test("retry reuses only matching live/inflight deployment and blocks unknown state", () => {
  const d = { id: "pending", status: "build_in_progress", commit: { id: sha } };
  assert.equal(selectReusableDeploy([{ deploy: d }], sha), d);
  assert.equal(
    selectReusableDeploy([{ ...d, commit: { id: "b".repeat(40) } }], sha),
    null,
  );
  assert.throws(
    () => selectReusableDeploy([{ ...d, status: "unknown" }], sha),
    /Unknown/,
  );
});

test('per-request metrics record actual attempts and safe endpoint identity without payloads',async()=>{
  const observed=[];const f=readRecoveryFixture([{status:502,body:{message:'private credential'}},{status:200,body:{token:'private-token'}}],{onRequest:d=>observed.push(d)});
  await f.request(githubBase+'/git/matching-refs/heads/srm-publication-'+ 'a'.repeat(24),{method:'GET',headers:{Authorization:'private-secret'}},'read-publication-branch');
  assert.deepEqual(observed.map(x=>x.httpStatus),[502,200]);assert.deepEqual(observed.map(x=>x.attemptNumber),[1,2]);
  assert.ok(observed.every(x=>x.endpoint==='publication-ref-inventory'&&x.requestType==='READ_ONLY'&&x.durationMs===0));
  assert.ok(!JSON.stringify(observed).match(/private|credential|Authorization|https/));
});
test('network request metrics include the attempted read before a successful retry',async()=>{
  const observed=[];const f=readRecoveryFixture([Object.assign(Error('secret'),{name:'TimeoutError'}),{status:200}],{onRequest:d=>observed.push(d)});
  await f.request(githubBase+'/branches/main',{method:'GET'},'github-rest');
  assert.equal(observed.length,2);assert.equal(observed[0].category,'NETWORK_TIMEOUT');assert.equal(observed[1].httpStatus,200);
  assert.ok(!JSON.stringify(observed).includes('secret'));
});


test('GitHub request metrics retain exact safe attempt counts and detached evidence',async()=>{
  const metrics=createGithubRequestMetrics();
  const f=readRecoveryFixture([{status:502,body:{secret:'never-store'}},{status:200}],{onRequest:d=>metrics.record(d)});
  await f.request('https://api.github.com/repos/profitia/SG-dev/git/matching-refs/heads/srm-publication-'+ 'a'.repeat(24),{method:'GET'},'github-rest');
  const result=metrics.read();assert.equal(result.attempts,2);assert.equal(result.endpoints[0].retriedAttempts,1);
  assert.deepEqual(result.endpoints[0].statuses,{'200':1,'502':1});
  assert.ok(!JSON.stringify(result).includes('never-store'));result.endpoints[0].attempts=99;
  assert.equal(metrics.read().attempts,2);
});
test('request metric keys cannot contain secret URLs or payloads',()=>{
  const metrics=createGithubRequestMetrics();
  metrics.record({httpMethod:'GET',endpoint:'https://secret.example/key',requestType:'READ_ONLY',authorization:'private'});
  assert.equal(metrics.read().attempts,0);
  metrics.record({httpMethod:'GET',endpoint:'publication-ref',requestType:'READ_ONLY',durationMs:7,attemptNumber:1,body:{private:'secret'}});
  assert.equal(metrics.read().endpoints[0].networkFailures,1);assert.equal(metrics.read().endpoints[0].durationMs,7);
  assert.ok(!JSON.stringify(metrics.read()).includes('secret'));
});
