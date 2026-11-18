// Source and evidence stay in Codespaces. Non-prepare output is consumed only by the bounded native relay, never printed into chat.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import{createHash,createPrivateKey,createPublicKey}from'node:crypto';
const base=path.dirname(new URL(import.meta.url).pathname),task='ARCH-PK-STAGE2-TECHNICAL-CONT-20261117',workspace='tea-d7lps8rbc2fs73cn80dg';
const names={'srv-dbq6n2m7bikc73dmvs8g':'platform-knowledge-development-api','srv-dbq6njec6qcc738fjf50':'platform-knowledge-development-worker','srv-dbcse6jrjlhs73eib3sg':'identity-runtime-development'};
const mode=process.argv[2]??'prepare',serviceId=process.argv[3],hash=x=>createHash('sha256').update(x).digest('hex');
let key=process.argv[4];
if(mode==='prepare'){console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED',workspace,services:names,authentication:'Existing native Render operator session; no token copied to Codespaces; no new login',liveCalls:0,secretRead:false}));process.exit(0);}
try{
 assert(['inspect','set-env','deploy','pause','rollback'].includes(mode));assert(Object.hasOwn(names,serviceId),'EXACT_DEVELOPMENT_SERVICE_REQUIRED');
 const envelope={mode,taskId:task,workspaceId:workspace,serviceId,serviceName:names[serviceId],approvedApiOrigin:'https://api.render.com/v1'};
 if(mode==='inspect'){console.log(JSON.stringify(envelope));process.exit(0);}
 const go=JSON.parse(await fs.readFile(path.join(base,'evidence/owner-r2-execution-go.json'),'utf8'));
 assert.equal(go.taskId,task);assert.equal(go.status,'APPROVED');assert.equal(go.renderAuthenticationMethod,'EXISTING_NATIVE_OPERATOR');assert.equal(go.workspaceId,workspace);assert(/^[a-f0-9]{40}$/.test(go.release));assert(Date.now()<Date.parse(go.validUntil));
 assert.equal(go.renderEnvelopeBuilderSha256,hash(await fs.readFile(new URL(import.meta.url))));
 assert.equal(go.nativeRenderTransportSha256,hash(await fs.readFile(path.join(base,'native-render-operator-relay.py'))));
 assert.equal(go.nativeRenderResultWriterSha256,hash(await fs.readFile(path.join(base,'record-native-render-result.py'))));
 const bytes=await fs.readFile(path.join(base,'evidence/render-native-execution-plan.json'));assert.equal(hash(bytes),go.renderNativeExecutionPlanSha256);
 const plan=JSON.parse(bytes);assert.equal(plan.release,go.release);assert.equal(plan.workspaceId,workspace);const item=plan.services[serviceId];assert(item&&item.targetEnvironment==='development');
 const ready=JSON.parse(await fs.readFile(path.join(base,'evidence/r2-predeployment-readback.json'),'utf8'));assert.equal(ready.release,go.release);
 for(const k of ['requiredCiPass','sourceAdmissionPass','productMigrationPass','identityMigrationPass','grantsAndBindingsPass','nativeOwnerMembershipRestored'])assert.equal(ready[k],true,k);
 Object.assign(envelope,{go,release:go.release,expectedLiveDeployId:item.expectedLiveDeployId,expectedLiveSha:item.expectedLiveSha});
 const recovery=['pause','rollback'].includes(mode);
 envelope.expectedLiveChoices=[{id:item.expectedLiveDeployId,sha:item.expectedLiveSha}];
 if(recovery){
  assert.equal(go.recoveryAuthorized,true);assert.equal(plan.recoveryEnabled,true);
  const prior=async suffix=>{try{return JSON.parse(await fs.readFile(path.join(base,'evidence','native-render-'+serviceId+'-'+suffix+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
  const ownDeploy=await prior('deploy'),ownConfig=await prior('PK_PROCESSING_ENABLED');
  const owned=o=>o&&o.taskId===task&&o.release===go.release&&o.approvalRef===go.approvalRef;
  if(owned(ownDeploy)){assert.equal(ownDeploy.status,'EXACT_RELEASE_DEPLOY_ACCEPTED_NOT_YET_LIVE');assert(/^dep-[a-z0-9]+$/.test(ownDeploy.deployId));envelope.expectedLiveChoices.push({id:ownDeploy.deployId,sha:go.release});}
  if(mode==='pause'){
   assert(['srv-dbq6n2m7bikc73dmvs8g','srv-dbq6njec6qcc738fjf50'].includes(serviceId));
   assert(!key||key==='PK_PROCESSING_ENABLED');key='PK_PROCESSING_ENABLED';
   assert(owned(ownConfig)&&ownConfig.status==='CONFIG_SAVED_WITHOUT_DEPLOY');
   envelope.key=key;envelope.value='false';
  }else{
   assert(owned(ownDeploy),'ONLY_OWN_RELEASE_MAY_BE_ROLLED_BACK');
   if(serviceId!=='srv-dbcse6jrjlhs73eib3sg'){
    const pause=await prior('pause');assert(owned(pause)&&pause.status==='CONFIG_RECOVERY_SAVED_WITHOUT_DEPLOY');
   }
   envelope.targetCommit=item.expectedLiveSha;
  }
 }

 if(mode==='set-env'){
  assert(/^[A-Z][A-Z0-9_]{1,100}$/.test(key??''));assert(Object.hasOwn(item.environment,key));
  assert(!new Set(['OPENAI_API_KEY','CLERK_SECRET_KEY','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','DATABASE_URL','PK_DATABASE_URL','RENDER_API_KEY']).has(key));
  const spec=item.environment[key];envelope.key=key;
  if(spec.kind==='OWNER_STAGED_WORKER_SIGNING_KEY'){
   assert.equal(serviceId,'srv-dbq6njec6qcc738fjf50');assert.equal(key,'PK_E1_WORKER_PRIVATE_KEY');
   const f=path.join(base,'pending-worker-signature-private.pem'),s=await fs.lstat(f);assert(s.isFile()&&!s.isSymbolicLink()&&(s.mode&0o077)===0&&s.size<5000);
   envelope.value=await fs.readFile(f,'utf8');assert.equal(createPublicKey(createPrivateKey(envelope.value)).export({type:'spki',format:'pem'}).toString().trim(),'-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA8UqxljZGZ+eUnoY+mF/vo1fg8S+N+k5rEyxTTIYvdgw=\n-----END PUBLIC KEY-----');
  }else{assert.equal(spec.kind,'PUBLIC_CONFIGURATION');assert.equal(typeof spec.value,'string');assert(!/PRIVATE KEY|sk-proj-/.test(spec.value));envelope.value=spec.value;}
 }
 const journal='native-render-'+serviceId+'-'+(mode==='set-env'?key:mode)+'.json';envelope.journal=journal;
 const intent={taskId:task,release:go.release,serviceId,mode,...(key?{key}:{}),...(mode==='rollback'?{targetCommit:envelope.targetCommit}:{}),status:'STARTED_OUTCOME_UNKNOWN',startedAt:new Date().toISOString(),approvalRef:go.approvalRef};
 await fs.writeFile(path.join(base,'evidence',journal),JSON.stringify(intent)+'\n',{flag:'wx',mode:0o600});
 process.stdout.write(JSON.stringify(envelope));
}catch{process.stderr.write('REVIEWED_RENDER_PRECONDITION_FAILED_NO_SECRET_OUTPUT\n');process.exitCode=1;}
