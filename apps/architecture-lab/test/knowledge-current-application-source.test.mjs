import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createKnowledgeCurrentSourceVerifier,knowledgeReviewedLocalPackages,knowledgeSourcePredecessor,KNOWLEDGE_SOURCE_RECORD} from '../knowledge-source.mjs';
import {ADMISSIONS_PATH} from '../../../scripts/governance/development-execution.mjs';

const repository=fileURLToPath(new URL('../../../',import.meta.url));
const input='apps/sg-runtime/components/procurement-insights/newsfeed.tsx';
const other='apps/sg-runtime/scripts/monitor-benchmark-finder.mjs';
const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(root,...args)=>execFileSync('git',args,{cwd:root,env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const write=(root,p,bytes)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),bytes);};
const commit=root=>{git(root,'add','.');git(root,'-c','user.name=Synthetic fixture','-c','user.email=synthetic@example.invalid','-c','commit.gpgsign=false','commit','--quiet','-m','SYNTHETIC_ONLY source-control test');return git(root,'rev-parse','HEAD');};
function fixture({expired=false,duplicate=false,incomplete=false,missingId=false}={}){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'knowledge-current-input-test-')));
 git(root,'init','--quiet');git(root,'remote','add','origin','https://github.com/profitia/SG-dev.git');
 write(root,input,'accepted old source\n');write(root,other,'unchanged unrelated source\n');
 const base=commit(root);
 write(root,input,'reviewed new source\n');const source=commit(root);
 const entry=p=>({path:p,blob:git(root,'rev-parse',source+':'+p),mode:'100644',status:'modified',projectKey:'SG2',owner:'SG Runtime',surfaceId:'SG2-BASE-001'});
 const record={id:'SYNTHETIC_ONLY:CURRENT_INPUT',taskId:'SYNTHETIC_ONLY',status:'ACTIVE',repository:'profitia/SG-dev',actor:'profitia',targetEnvironment:'development',scope:'SOURCE_VALIDATION_ONLY',approvalRef:'SYNTHETIC_ONLY test fixture, never actual authorization',sourceSha:source,baseSha:base,validFrom:'2000-01-01T00:00:00Z',validUntil:expired?'2001-01-01T00:00:00Z':'2099-01-01T00:00:00Z',files:[entry(input)]};
 if(incomplete)record.files.push(entry(other));
 const unrelated={...record,id:'SYNTHETIC_ONLY:UNRELATED',files:[entry(other)]};
 const records=[record,unrelated];if(duplicate)records.push({...record,id:'SYNTHETIC_ONLY:DUPLICATE'});
 if(missingId)delete unrelated.id;
 git(root,'checkout','--quiet','--detach',base);
 write(root,ADMISSIONS_PATH,JSON.stringify({schemaVersion:'1.0',records}));
 const authority=commit(root);git(root,'update-ref','refs/remotes/origin/main',authority);
 git(root,'-c','user.name=Synthetic fixture','-c','user.email=synthetic@example.invalid','-c','commit.gpgsign=false','merge','--quiet','--no-ff',source,'-m','SYNTHETIC_ONLY compose accepted control and source');
 const verify=()=>createKnowledgeCurrentSourceVerifier(root,[input,other],{governanceRoot:repository});
 return {root,record,verify,read:p=>fs.readFileSync(path.join(root,p))};
}
function run(options,body){const f=fixture(options);try{return body(f);}finally{fs.rmSync(f.root,{recursive:true,force:true});}}

test('actual full source admission authenticates one path despite a disjoint matching record',()=>run({},f=>{
 assert.deepEqual(f.verify()(input,f.read(input)),f.read(input));
 assert.deepEqual(f.verify()(other,f.read(other)),f.read(other));
}));
test('accepted main bytes do not borrow an expired historical source mandate',()=>run({expired:true},f=>{
 assert.deepEqual(f.verify()(other,f.read(other)),f.read(other));
 assert.throws(()=>f.verify()(input,f.read(input)),/EXPIRED/);
}));
test('overlapping admissions, incomplete diffs and malformed IDs fail closed',()=>{
 for(const options of [{duplicate:true},{incomplete:true},{missingId:true}])run(options,f=>assert.throws(()=>f.verify()(input,f.read(input))));
});
test('a callback cannot substitute historical or forged current bytes',()=>run({},f=>{
 assert.throws(()=>f.verify()(input,Buffer.from('accepted old source\n')),/physical input/);
 assert.throws(()=>f.verify()('../outside',Buffer.from('x')),/unwatched/);
}));
test('symlink, executable bit, tracked edits and untracked files are rejected',()=>{
 for(const mutation of [
  f=>fs.chmodSync(path.join(f.root,input),0o755),
  f=>fs.appendFileSync(path.join(f.root,input),'unreviewed'),
  f=>write(f.root,'unreviewed.txt','extra'),
  f=>{fs.unlinkSync(path.join(f.root,input));fs.symlinkSync(path.join(f.root,other),path.join(f.root,input));},
 ])run({},f=>{mutation(f);assert.throws(()=>f.verify()(input,f.read(input)));});
});
test('candidate ledger edits cannot approve a source or erase trusted overlapping records',()=>run({duplicate:true},f=>{
 write(f.root,ADMISSIONS_PATH,JSON.stringify({schemaVersion:'1.0',records:[f.record]}));
 assert.throws(()=>f.verify()(input,f.read(input)),/one complete/);
}));
test('foreign origin and missing authority ref cannot authenticate current inputs',()=>{
 run({},f=>{git(f.root,'remote','set-url','origin','https://example.invalid/untrusted');assert.throws(()=>f.verify(),/independent/);});
 run({},f=>{git(f.root,'update-ref','-d','refs/remotes/origin/main');assert.throws(()=>f.verify());});
});
test('local producer transition is closed to its exact eight reviewed files',()=>{
 const source='cda1f12c3d729c71030031439e94510e356789d6';
 const names=['apps/insights-runtime/package-lock.json','apps/insights-runtime/package.json','apps/insights-runtime/render/report.py','apps/insights-runtime/src/citations.mjs','apps/insights-runtime/src/composer.mjs','apps/insights-runtime/src/renderer.mjs','apps/insights-runtime/tests/citations.test.mjs','apps/sg-runtime/package-lock.json'];
 const record={id:'SG2:SG2-PI-CITATION-SOURCE-PUBLICATION-20261118',sourceSha:source,scope:'SOURCE_VALIDATION_ONLY',status:'ACTIVE',actor:'profitia',files:names.map(p=>({path:p,mode:'100644',blob:git(repository,'rev-parse',source+':'+p)}))};
 const review=knowledgeReviewedLocalPackages(record);assert.deepEqual(Object.keys(review),['@profitia/insights-runtime']);
 for(const change of [
  r=>r.files.pop(),
  r=>r.files.push({...r.files[0]}),
  r=>r.files[0].blob='f'.repeat(40),
  r=>r.sourceSha='f'.repeat(40),
  r=>r.actor='untrusted',
  r=>r.status='REVOKED',
 ]){const altered=structuredClone(record);change(altered);assert.equal(knowledgeReviewedLocalPackages(altered),undefined);}
});
test('synthetic accepted-policy checkout preserves exact receipts and authenticates all current inputs before history',async()=>{
 // This fixture verifies policy semantics only. It is never a real accepted main,
 // source-admission grant, controlled proof, deployment, or business acceptance.
 const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'knowledge-policy-composition-test-')));
 const root=path.join(temporary,'source'),record=JSON.parse(fs.readFileSync(path.join(repository,KNOWLEDGE_SOURCE_RECORD)));
 const policyFiles=['apps/architecture-lab/knowledge-source.mjs','apps/architecture-lab/test/knowledge-current-application-source.test.mjs','scripts/governance/controlled-package-ci.mjs','scripts/governance/controlled-package-ci.test.mjs','scripts/governance/development-execution.mjs','scripts/governance/development-execution.test.mjs'];
 try{
  git(temporary,'clone','--quiet','--shared','--no-checkout',repository,'source');
  git(root,'remote','set-url','origin','https://github.com/profitia/SG-dev.git');
  git(root,'sparse-checkout','init','--no-cone');
  const names=new Set([KNOWLEDGE_SOURCE_RECORD,record.predecessorRecord,...Object.keys(record.sourceDigests),...Object.keys(record.preservedReceipts),...Object.keys(record.retainedSuccessorReceipts),...policyFiles,...['architecture-lab','sg-runtime','srm'].map(app=>'apps/'+app+'/knowledge-source-adoption.json')]);
  execFileSync('git',['sparse-checkout','set','--no-cone','--stdin'],{cwd:root,env,input:[...names].map(p=>'/'+p).join('\n')+'\n',stdio:['pipe','pipe','pipe']});
  git(root,'checkout','--quiet','--detach','c4965a445867601275cbb75dc4de993123414ba2');
  for(const p of policyFiles)write(root,p,fs.readFileSync(path.join(repository,p)));
  const syntheticMain=commit(root);git(root,'update-ref','refs/remotes/origin/main',syntheticMain);
  const read=p=>fs.readFileSync(path.join(root,p));
  const historical=(sha,p)=>execFileSync('git',['cat-file','blob',sha+':'+p],{cwd:root,stdio:['ignore','pipe','pipe']});
  const options={sourceRoot:root,authorityRoot:root,governanceRoot:repository};
  const view=knowledgeSourcePredecessor(read,historical,options);assert(view);
  const c=await import('../../../scripts/governance/controlled-package-ci.mjs');
  assert(c.knowledgeStage2TrustedPredecessor(read,historical,options));
  assert.equal(hash(read(KNOWLEDGE_SOURCE_RECORD)),'7bde334dda3ec7068d3cb532ccd8a94f3477cea707abe250431ee16c3b044bf4');
  for(const [p,digest]of Object.entries({...record.preservedReceipts,...record.retainedSuccessorReceipts})){
   assert.equal(hash(read(p)),digest);assert.equal(hash(historical(record.previousSourceSha,p)),digest);
  }
  const refreshed=Object.entries(record.sourceDigests).filter(([p,digest])=>hash(read(p))!==digest);
  for(const [p]of refreshed)assert.deepEqual(view.previousBytes(p),historical(record.previousSourceSha,p));
  for(const p of ['apps/architecture-lab/knowledge-source.mjs',Object.keys(record.sourceDigests)[0],Object.keys(record.preservedReceipts)[0]]){
   const altered=f=>f===p?Buffer.concat([read(f),Buffer.from('SYNTHETIC_ONLY_FORGERY')]):read(f);
   assert.throws(()=>c.knowledgeStage2TrustedPredecessor(altered,historical,options),p);
   if(p!=='apps/architecture-lab/knowledge-source.mjs')assert.throws(()=>knowledgeSourcePredecessor(altered,historical,options),p);
  }
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});

test('real producer postimages authenticate the full Knowledge and controller history through the eight-file admission',async()=>{
 const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'knowledge-current-producer-test-')));
 const root=path.join(temporary,'source');
 const source='cda1f12c3d729c71030031439e94510e356789d6';
 const base='c4965a445867601275cbb75dc4de993123414ba2';
 const names=['apps/insights-runtime/package-lock.json','apps/insights-runtime/package.json','apps/insights-runtime/render/report.py','apps/insights-runtime/src/citations.mjs','apps/insights-runtime/src/composer.mjs','apps/insights-runtime/src/renderer.mjs','apps/insights-runtime/tests/citations.test.mjs','apps/sg-runtime/package-lock.json'];
 try{
  git(temporary,'clone','--quiet','--shared','--no-checkout',repository,'source');
  git(root,'remote','set-url','origin','https://github.com/profitia/SG-dev.git');
  git(root,'sparse-checkout','init','--no-cone');
  const frozen=JSON.parse(fs.readFileSync(path.join(repository,KNOWLEDGE_SOURCE_RECORD)));
  const policyFiles=['apps/architecture-lab/knowledge-source.mjs','apps/architecture-lab/test/knowledge-current-application-source.test.mjs','scripts/governance/controlled-package-ci.mjs','scripts/governance/development-execution.mjs','scripts/governance/development-execution.test.mjs'];
  const closure=new Set([ADMISSIONS_PATH,...names,KNOWLEDGE_SOURCE_RECORD,frozen.predecessorRecord,...Object.keys(frozen.sourceDigests),...Object.keys(frozen.preservedReceipts),...Object.keys(frozen.retainedSuccessorReceipts),...policyFiles,...['architecture-lab','sg-runtime','srm'].map(app=>'apps/'+app+'/knowledge-source-adoption.json')]);
  execFileSync('git',['sparse-checkout','set','--no-cone','--stdin'],{cwd:root,env,input:[...closure].map(p=>'/'+p).join('\n')+'\n',stdio:['pipe','pipe','pipe']});
  git(root,'checkout','--quiet','--detach',base);
  for(const p of policyFiles)write(root,p,fs.readFileSync(path.join(repository,p)));
  const record={id:'SG2:SG2-PI-CITATION-SOURCE-PUBLICATION-20261118',taskId:'SG2-PI-CITATION-SOURCE-PUBLICATION-20261118',status:'ACTIVE',repository:'profitia/SG-dev',actor:'profitia',targetEnvironment:'development',scope:'SOURCE_VALIDATION_ONLY',approvalRef:'SYNTHETIC_ONLY fixture, not an actual mandate',sourceSha:source,baseSha:'608efe22d4a994d4cdbfcddc111c0dfd4732d698',validFrom:'2000-01-01T00:00:00Z',validUntil:'2099-01-01T00:00:00Z',files:names.map(p=>({path:p,blob:git(root,'rev-parse',source+':'+p),mode:'100644',status:git(root,'--literal-pathspecs','diff','--name-status','608efe22d4a994d4cdbfcddc111c0dfd4732d698',source,'--',p).startsWith('A')?'added':'modified',projectKey:'SG2',owner:p.startsWith('apps/insights-runtime/')?'Insights Domain':'SG Runtime',surfaceId:p.startsWith('apps/insights-runtime/')?'INSIGHTS-BASE-001':'SG2-BASE-001'}))};
  write(root,ADMISSIONS_PATH,JSON.stringify({schemaVersion:'1.0',records:[record]}));
  const control=commit(root);git(root,'update-ref','refs/remotes/origin/main',control);
  git(root,'-c','user.name=Synthetic fixture','-c','user.email=synthetic@example.invalid','-c','commit.gpgsign=false','merge','--quiet','--no-ff',source,'-m','SYNTHETIC_ONLY real reviewed producer postimages');
  const verify=createKnowledgeCurrentSourceVerifier(root,names,{governanceRoot:repository});
  for(const p of names)assert.deepEqual(verify(p,fs.readFileSync(path.join(root,p))),fs.readFileSync(path.join(root,p)));
  const read=p=>fs.readFileSync(path.join(root,p));
  const historical=(sha,p)=>execFileSync('git',['cat-file','blob',sha+':'+p],{cwd:root,stdio:['ignore','pipe','pipe']});
  const options={sourceRoot:root,authorityRoot:root,governanceRoot:repository};
  const view=knowledgeSourcePredecessor(read,historical,options);assert(view);
  const c=await import('../../../scripts/governance/controlled-package-ci.mjs');
  assert(c.knowledgeStage2TrustedPredecessor(read,historical,options));
  for(const p of names.filter(p=>Object.hasOwn(frozen.sourceDigests,p)))assert.deepEqual(view.previousBytes(p),historical(frozen.previousSourceSha,p));
  for(const [p,digest]of Object.entries({...frozen.preservedReceipts,...frozen.retainedSuccessorReceipts}))assert.equal(hash(read(p)),digest);
  assert.equal(git(root,'status','--porcelain'),'');
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});

test('a verifier never reuses a stale physical postimage after its first successful read',()=>run({},f=>{
 const verify=f.verify(),before=f.read(input);
 assert.deepEqual(verify(input,before),before);
 fs.appendFileSync(path.join(f.root,input),'changed after first verification');
 assert.throws(()=>verify(input,before),/physical input/);
 assert.throws(()=>verify(input,f.read(input)),/postimage/);
}));


import {test as currentKnowledgePolicyTest} from 'node:test';
import currentKnowledgeAssert from 'node:assert/strict';
currentKnowledgePolicyTest('current Knowledge helper belongs to the complete trusted policy digest',async()=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
 const c=await import('../../../scripts/governance/controlled-package-ci.mjs'),authority=new URL('../../../',import.meta.url);
 currentKnowledgeAssert(c.CONTROL_POLICY_FILES.includes('apps/architecture-lab/knowledge-source.mjs'));
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'knowledge-policy-digest-test-')));
 try{
  for(const p of c.CONTROL_POLICY_FILES){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.copyFileSync(new URL(p,authority),path.join(root,p));}
  const before=c.controlPolicyDigest(root);
  fs.appendFileSync(path.join(root,'apps/architecture-lab/knowledge-source.mjs'),'\n// SYNTHETIC_ONLY untrusted helper change\n');
  currentKnowledgeAssert.notEqual(c.controlPolicyDigest(root),before);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
currentKnowledgePolicyTest('producer local-package policy requires the closed eight-file postimages and cannot come from candidate metadata',async()=>{
 const fs=await import('node:fs'),cp=await import('node:child_process'),c=await import('../../../scripts/governance/controlled-package-ci.mjs');
 const root=new URL('../../../',import.meta.url),source='cda1f12c3d729c71030031439e94510e356789d6';
 const names=['apps/insights-runtime/package-lock.json','apps/insights-runtime/package.json','apps/insights-runtime/render/report.py','apps/insights-runtime/src/citations.mjs','apps/insights-runtime/src/composer.mjs','apps/insights-runtime/src/renderer.mjs','apps/insights-runtime/tests/citations.test.mjs','apps/sg-runtime/package-lock.json'];
 const record={id:'SG2:SG2-PI-CITATION-SOURCE-PUBLICATION-20261118',taskId:'SG2-PI-CITATION-SOURCE-PUBLICATION-20261118',sourceSha:source,scope:'SOURCE_VALIDATION_ONLY',status:'ACTIVE',actor:'profitia',files:names.map(p=>({path:p,mode:'100644',blob:cp.execFileSync('git',['rev-parse',source+':'+p],{cwd:root,encoding:'utf8'}).trim()}))};
 const actual=c.currentSdkSourceAdmissionPolicy(record);
 currentKnowledgeAssert.deepEqual(Object.keys(actual.reviewedLocalPackages),['@profitia/insights-runtime']);
 const altered=structuredClone(record);altered.files[1]=altered.files[0];
 currentKnowledgeAssert.equal(c.currentSdkSourceAdmissionPolicy(altered),undefined);
 const incomplete=structuredClone(record);incomplete.files.pop();
 currentKnowledgeAssert.equal(c.currentSdkSourceAdmissionPolicy(incomplete),undefined);
 currentKnowledgeAssert.equal(c.currentSdkSourceAdmissionPolicy({...record,id:'unreviewed',reviewedLocalPackages:actual.reviewedLocalPackages}),undefined);
});


const SDK138_PRODUCER_BASE='09b78d30391627f17112b5b4dcaa2b155585d9d1';
const REVIEWED_PRODUCER_CODE='cda1f12c3d729c71030031439e94510e356789d6';
const PRODUCER_TRANSPORT_PATHS=Object.freeze(['apps/insights-runtime/package-lock.json','apps/insights-runtime/package.json','apps/insights-runtime/render/report.py','apps/insights-runtime/src/citations.mjs','apps/insights-runtime/src/composer.mjs','apps/insights-runtime/src/renderer.mjs','apps/insights-runtime/tests/citations.test.mjs','apps/sg-runtime/package-lock.json']);
const actualGitBytes=(sha,p)=>git(repository,'--literal-pathspecs','ls-tree',sha,'--',p)?execFileSync('git',['cat-file','blob',sha+':'+p],{cwd:repository,env,stdio:['ignore','pipe','pipe'],maxBuffer:3*1024*1024}):null;
function sdk138ProducerFixture(options={}){
 // The original SDK and producer bytes are genuine. Only this isolated authority,
 // its commits and admission are SYNTHETIC_ONLY; no real grant/proof is created.
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'pi-sdk138-closed-transport-test-')));
 git(root,'init','--quiet');git(root,'remote','add','origin','https://github.com/profitia/SG-dev.git');
 const before=new Map();
 for(const p of PRODUCER_TRANSPORT_PATHS){const bytes=actualGitBytes(options.baselineOldSdk?'efc1290378507e947cbf9ad0bcfc1e4a71086bb6':SDK138_PRODUCER_BASE,p);before.set(p,bytes);if(bytes)write(root,p,bytes);}
 const base=commit(root);
 for(const p of PRODUCER_TRANSPORT_PATHS){
  let bytes;
  if(p.endsWith('.json')){
   const value=JSON.parse(actualGitBytes(SDK138_PRODUCER_BASE,p));
   if(p==='apps/insights-runtime/package.json')value.version='1.2.2';
   else if(p==='apps/insights-runtime/package-lock.json'){
    value.version='1.2.2';value.packages[''].version='1.2.2';
    if(options.downgradedSdkLock)value.packages['node_modules/@profitia/platform-contracts'].version='1.37.0';
   }else value.packages['node_modules/@profitia/insights-runtime'].version='1.2.2';
   bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');
  }else bytes=actualGitBytes(REVIEWED_PRODUCER_CODE,p);
  if(options.changedCode&&p.endsWith('/composer.mjs'))bytes=Buffer.concat([bytes,Buffer.from('\n// SYNTHETIC_ONLY unreviewed code\n')]);
  write(root,p,bytes);
 }
 const source=commit(root),record={id:'SG2:SG2-PI-CITATION-SOURCE-PUBLICATION-20261118',taskId:'SYNTHETIC_ONLY_CLOSED_SDK138_TRANSPORT',status:'ACTIVE',repository:'profitia/SG-dev',actor:'profitia',targetEnvironment:'development',scope:'SOURCE_VALIDATION_ONLY',approvalRef:'SYNTHETIC_ONLY fixture, never owner approval or actual admission',sourceSha:options.falseSourceRef?'f'.repeat(40):source,baseSha:base,validFrom:'2000-01-01T00:00:00Z',validUntil:options.expired?'2001-01-01T00:00:00Z':'2099-01-01T00:00:00Z',files:PRODUCER_TRANSPORT_PATHS.map(p=>({path:p,blob:git(root,'rev-parse',source+':'+p),mode:'100644',status:before.get(p)?'modified':'added',projectKey:'SG2',owner:p.startsWith('apps/insights-runtime/')?'Insights Domain':'SG Runtime',surfaceId:p.startsWith('apps/insights-runtime/')?'INSIGHTS-BASE-001':'SG2-BASE-001'}))};
 git(root,'checkout','--quiet','--detach',base);
 write(root,ADMISSIONS_PATH,JSON.stringify({schemaVersion:'1.0',records:options.noTrustedRecord?[]:[record]}));
 const control=commit(root);git(root,'update-ref','refs/remotes/origin/main',control);
 git(root,'-c','user.name=Synthetic fixture','-c','user.email=synthetic@example.invalid','-c','commit.gpgsign=false','merge','--quiet','--no-ff',source,'-m','SYNTHETIC_ONLY closed SDK1.38 producer transport');
 return {root,record,read:p=>fs.readFileSync(path.join(root,p)),verify:()=>createKnowledgeCurrentSourceVerifier(root,PRODUCER_TRANSPORT_PATHS,{governanceRoot:repository})};
}
function sdk138ProducerRun(options,body){const f=sdk138ProducerFixture(options);try{return body(f);}finally{fs.rmSync(f.root,{recursive:true,force:true});}}
test('genuine SDK1.38 locks and unchanged reviewed producer code require one complete fresh SHA admission',()=>sdk138ProducerRun({},f=>{
 const review=knowledgeReviewedLocalPackages(f.record);assert.deepEqual(Object.keys(review),['@profitia/insights-runtime']);
 const verify=f.verify();for(const p of PRODUCER_TRANSPORT_PATHS)assert.deepEqual(verify(p,f.read(p)),f.read(p));
 for(const p of ['apps/insights-runtime/package-lock.json','apps/sg-runtime/package-lock.json'])assert.equal(JSON.parse(f.read(p)).packages['node_modules/@profitia/platform-contracts'].version,'1.38.0');
 assert.equal(JSON.parse(f.read('apps/insights-runtime/package.json')).version,'1.2.2');
 assert.equal(git(f.root,'status','--porcelain'),'');
}));
test('SDK1.38 metadata exception cannot reuse the old source approval or accept changed code, locks or incomplete scope',()=>sdk138ProducerRun({},f=>{
 for(const change of [r=>r.sourceSha=REVIEWED_PRODUCER_CODE,r=>r.files.pop(),r=>r.files.push({...r.files[0]}),r=>r.files[0].blob='f'.repeat(40),r=>r.repository='untrusted/repository',r=>r.targetEnvironment='production',r=>r.status='REVOKED',r=>r.actor='untrusted']){
  const altered=structuredClone(f.record);change(altered);assert.equal(knowledgeReviewedLocalPackages(altered),undefined);
 }
}));
test('SDK1.38 producer transport rejects missing or expired trusted admission and invented original source',()=>{
 for(const options of [{noTrustedRecord:true},{expired:true},{falseSourceRef:true}])sdk138ProducerRun(options,f=>assert.throws(()=>f.verify()('apps/insights-runtime/package-lock.json',f.read('apps/insights-runtime/package-lock.json'))));
});
test('closed producer metadata cannot upgrade an unaccepted SDK baseline, downgrade its lock or substitute code',()=>{
 for(const options of [{baselineOldSdk:true},{downgradedSdkLock:true},{changedCode:true}])sdk138ProducerRun(options,f=>assert.throws(()=>f.verify()('apps/insights-runtime/package-lock.json',f.read('apps/insights-runtime/package-lock.json')),/separately reviewed/));
});
