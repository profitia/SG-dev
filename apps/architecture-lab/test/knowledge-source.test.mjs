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
 const paths=['packages/platform-contracts/src/operation-context.mjs','packages/platform-contracts/src/knowledge-operations.mjs','packages/platform-contracts/current-e1-authority/migrations/015-knowledge-authority.sql','packages/platform-source-hub-contracts/package.json','packages/maps-embed/package.json','apps/identity-runtime/package-lock.json','apps/sg-runtime/package-lock.json','apps/srm/package-lock.json','apps/sg-runtime/operation-integration.json','apps/sg-runtime/knowledge-source-adoption.json',KNOWLEDGE_SOURCE_RECORD];
 for(const p of paths)assert.throws(()=>knowledgeSourcePredecessor(f=>f===p?Buffer.concat([read(f),Buffer.from('UNREVIEWED')]):read(f),history),p);
 const forbidden=Object.assign(Error('No access'),{code:'EACCES'});assert.throws(()=>knowledgeSourcePredecessor(()=>{throw forbidden;},history),e=>e===forbidden);
 assert.equal(knowledgeSourcePredecessor(()=>{throw Object.assign(Error('Missing'),{code:'ENOENT'});},history),null);
});
