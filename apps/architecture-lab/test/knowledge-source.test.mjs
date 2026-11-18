import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
import {knowledgeSourcePredecessor,KNOWLEDGE_SOURCE_RECORD,KNOWLEDGE_SOURCE_RECORD_SHA256} from '../knowledge-source.mjs';
import {operationSourceDigest,OPERATION_CONTRACT,KNOWLEDGE_ROOT_CONTRACT} from '../../../packages/platform-contracts/src/operation-context.mjs';
const root=new URL('../../../',import.meta.url),read=p=>readFileSync(new URL(p,root));
const cache=new Map(),history=(sha,p)=>{const key=sha+':'+p;if(!cache.has(key))cache.set(key,execFileSync('git',['show',key],{cwd:root,stdio:['ignore','pipe','pipe']}));return cache.get(key);};
test('closed knowledge SDK successor binds real current digest and immutable predecessor without runtime activation',async()=>{
 const view=knowledgeSourcePredecessor(read,history);assert(view);assert.equal(view.manifest.sdkDigests.operationSourceDigest,await operationSourceDigest());
 assert.equal(OPERATION_CONTRACT.implementation,'1.0.0-candidate.16');assert.equal(KNOWLEDGE_ROOT_CONTRACT.implementation,'1.0.0-candidate.23');
 for(const p of Object.keys(view.manifest.replacements))assert.deepEqual(view.previousBytes(p),history(view.manifest.previousSourceSha,p),p);
 for(const p of view.manifest.knowledgeAddedPaths)assert.throws(()=>view.previousBytes(p),{code:'ENOENT'});
 assert.equal(knowledgeSourcePredecessor(view.previousBytes,history),null);
 assert.match(KNOWLEDGE_SOURCE_RECORD_SHA256,/^[a-f0-9]{64}$/);
});
test('unreviewed SDK, native schema, metadata, consumer or historical receipt never gets a projected predecessor',()=>{
 const paths=['apps/srm/deployment/root-atomic-claim-targets.json','apps/insights-runtime/package.json','apps/sg-runtime/procurement-insights-editorial-package-integration.json','apps/sg-runtime/tests/procurement-insights-editorial-package-integrity.mjs','apps/sg-runtime/tests/procurement-insights-editorial-package-integrity.test.mjs','packages/platform-contracts/src/operation-context.mjs','packages/platform-contracts/src/knowledge-operations.mjs','packages/platform-contracts/current-e1-authority/migrations/015-knowledge-authority.sql','packages/platform-source-hub-contracts/package.json','packages/maps-embed/package.json','apps/identity-runtime/package-lock.json','apps/sg-runtime/package-lock.json','apps/srm/package-lock.json','apps/sg-runtime/operation-integration.json','apps/sg-runtime/tests/finder-monitor-source-integrity.test.mjs','apps/sg-runtime/scripts/monitor-benchmark-finder.mjs','apps/sg-runtime/finder-monitor-source-integration.json','apps/sg-runtime/knowledge-source-adoption.json',KNOWLEDGE_SOURCE_RECORD];
 for(const p of paths)assert.throws(()=>knowledgeSourcePredecessor(f=>f===p?Buffer.concat([read(f),Buffer.from('UNREVIEWED')]):read(f),history),p);
 const forbidden=Object.assign(Error('No access'),{code:'EACCES'});assert.throws(()=>knowledgeSourcePredecessor(()=>{throw forbidden;},history),e=>e===forbidden);
 assert.equal(knowledgeSourcePredecessor(()=>{throw Object.assign(Error('Missing'),{code:'ENOENT'});},history),null);
});


test('real historical absence is optional while unknown Git revisions and missing foreign paths stay fatal',()=>{
 for(const sha of ['765e995ca9b1eacef83a562b46e9c23876992e9b','ef1d34e82ed6908a8f26103e2d6694e71374985d','fa81114d35281693604833f1b7639b3c3b829ce6','141cc559063c43cefa991acb9260b32ac5b92615'])
  assert.equal(knowledgeSourcePredecessor(p=>history(sha,p),history),null);
 assert.throws(()=>knowledgeSourcePredecessor(p=>history('f'.repeat(40),p),history));
 assert.throws(()=>knowledgeSourcePredecessor(()=>history('765e995ca9b1eacef83a562b46e9c23876992e9b','foreign-unreviewed-record.json'),history));
 const denied=Object.assign(Error("path '"+KNOWLEDGE_SOURCE_RECORD+"' does not exist in denied revision"),{code:'EACCES',status:1});
 assert.throws(()=>knowledgeSourcePredecessor(()=>{throw denied},history),e=>e===denied);
});

test('public Knowledge routing authenticates a real complete checkout without an unpublished controller export',async()=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
 const {reviewedKnowledgeConsumerPaths}=await import('../../platform-source-hub/scripts/ci-routing.mjs');
 const source=knowledgeSourcePredecessor(read,history),base=source.manifest.previousSourceSha;
 const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'knowledge-public-routing-'))),fixture=path.join(temporary,'source');
 const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'};
 const git=(cwd,...args)=>execFileSync('git',args,{cwd,env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git(temporary,'clone','--quiet','--shared','--no-checkout',root.pathname,'source');
  git(fixture,'checkout','--quiet','--detach',base);
  const cyclic=[KNOWLEDGE_SOURCE_RECORD,'apps/architecture-lab/knowledge-source.mjs',...['architecture-lab','sg-runtime','srm'].map(app=>'apps/'+app+'/knowledge-source-adoption.json')];
  for(const p of new Set([...Object.keys(source.manifest.sourceDigests),...cyclic])){const target=path.join(fixture,p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,read(p));git(fixture,'add','--',p);}
  git(fixture,'-c','user.name=Synthetic fixture','-c','user.email=synthetic@example.invalid','commit','--quiet','-m','SYNTHETIC_ONLY closed Knowledge source');
  const head=git(fixture,'rev-parse','HEAD'),review={baseSha:base,candidateSha:head},view=reviewedKnowledgeConsumerPaths(fixture,review);
  assert.equal(view.get('apps/sg-runtime/knowledge-source-adoption.json'),'SG2');assert.equal(view.get('apps/srm/knowledge-source-adoption.json'),'SRM');
  assert.throws(()=>reviewedKnowledgeConsumerPaths(fixture,{...review,candidateSha:'f'.repeat(40)}));
  const p='packages/platform-contracts/src/knowledge-operations.mjs',target=path.join(fixture,p),before=fs.readFileSync(target);
  fs.appendFileSync(target,'UNACCEPTED');assert.throws(()=>reviewedKnowledgeConsumerPaths(fixture,review));fs.writeFileSync(target,before);
  fs.unlinkSync(target);fs.symlinkSync(new URL(p,root),target);assert.throws(()=>reviewedKnowledgeConsumerPaths(fixture,review));fs.unlinkSync(target);fs.writeFileSync(target,before);
  git(fixture,'update-index','--chmod=+x',p);git(fixture,'-c','user.name=Synthetic fixture','-c','user.email=synthetic@example.invalid','commit','--quiet','-m','SYNTHETIC_ONLY executable drift');
  assert.throws(()=>reviewedKnowledgeConsumerPaths(fixture,{...review,candidateSha:git(fixture,'rev-parse','HEAD')}));
  git(fixture,'reset','--quiet','--hard',head);fs.writeFileSync(path.join(fixture,'foreign-unreviewed.txt'),'SYNTHETIC_ONLY');git(fixture,'add','foreign-unreviewed.txt');git(fixture,'-c','user.name=Synthetic fixture','-c','user.email=synthetic@example.invalid','commit','--quiet','-m','SYNTHETIC_ONLY extra input');
  assert.throws(()=>reviewedKnowledgeConsumerPaths(fixture,{...review,candidateSha:git(fixture,'rev-parse','HEAD')}));
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});

test('current SRM Root target authenticates the actual optional producer while its prior target remains immutable',async()=>{
 const {rootAtomicClaimSourceDigest}=await import('../../../packages/platform-contracts/root-atomic-claim/src/root-atomic-claim.mjs');
 const file='apps/srm/deployment/root-atomic-claim-targets.json',view=knowledgeSourcePredecessor(read,history),current=JSON.parse(read(file));
 assert.equal(current.sourceDigest,await rootAtomicClaimSourceDigest());assert.equal(current.sourceDigest,view.manifest.optionalPackageDigests.rootAtomicClaimSourceDigest);
 const previous=JSON.parse(view.previousBytes(file));assert.equal(previous.sourceDigest,'b3d6f2110f41ca93cac6a949b113a8582b6407688d81df1935cd8990424b393a');
 const {sourceDigest:now,...currentMetadata}=current,{sourceDigest:then,...previousMetadata}=previous;assert.notEqual(now,then);assert.deepEqual(currentMetadata,previousMetadata);
 assert.deepEqual(view.previousBytes(file),history(view.manifest.previousSourceSha,file));
 assert.throws(()=>knowledgeSourcePredecessor(p=>p===file?view.previousBytes(file):read(p),history),'historically valid target must not substitute the current producer');
});
