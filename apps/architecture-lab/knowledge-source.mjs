// Closed source-compatibility review only; never imported by product runtime.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const KNOWLEDGE_SOURCE_RECORD='apps/architecture-lab/knowledge-source.json';
export const KNOWLEDGE_SOURCE_RECORD_SHA256='977e0857fee4fc0a3ab9d83b2d215a0697d4e40bffd0552e6e0f990c75d74604';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function knowledgeSourcePredecessor(current,historical){
 let bytes;try{bytes=current(KNOWLEDGE_SOURCE_RECORD);}catch(error){if(error?.code==='ENOENT')return null;throw error;}
 assert.equal(hash(bytes),KNOWLEDGE_SOURCE_RECORD_SHA256,'exact reviewed Platform Knowledge source record');
 const a=JSON.parse(bytes);
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.scope,'PLATFORM_KNOWLEDGE_SDK_SOURCE_ACCEPTANCE');
 assert.equal(a.platformVersion,'1.37.0');assert.equal(a.legacyImplementation,'1.0.0-candidate.16');assert.equal(a.optionalImplementation,'1.0.0-candidate.23');
 assert.match(a.previousSourceSha,/^[a-f0-9]{40}$/);
 for(const flag of ['runtimeActivated','newGrantsInstalled','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag);
 assert.equal(hash(current(a.predecessorRecord)),a.predecessorRecordSha256,'immutable recurring record');
 const prior=JSON.parse(current(a.predecessorRecord));
 for(const [p,h]of Object.entries(a.sourceDigests))assert.equal(hash(current(p)),h,'current knowledge source '+p);
 for(const [p,h]of Object.entries({...a.preservedReceipts,...a.retainedSuccessorReceipts})){
  assert.equal(hash(current(p)),h,'immutable receipt '+p);assert.equal(hash(historical(a.previousSourceSha,p)),h,'previous receipt '+p);
 }
 for(const project of ['ARCHITECTURE','SG2','SRM']){
  const p=project==='ARCHITECTURE'?'apps/architecture-lab/knowledge-source-adoption.json':'apps/'+(project==='SG2'?'sg-runtime':'srm')+'/knowledge-source-adoption.json';
  assert.deepEqual(JSON.parse(current(p)),{schemaVersion:'1.0.0',projectKey:project,taskId:a.taskIds[project],targetEnvironment:'development',scope:'SOURCE_ONLY_NO_RUNTIME_ACTIVATION',sourceRecord:KNOWLEDGE_SOURCE_RECORD,sourceRecordSha256:KNOWLEDGE_SOURCE_RECORD_SHA256});
 }
 const changed=new Set(Object.keys(a.replacements)),added=new Set(a.knowledgeAddedPaths),cache=new Map();
 // A replacement binds BOTH current bytes and accepted predecessor. Nothing
 // outside this closed set is projected or exempted from the earlier checks.
 for(const [p,r]of Object.entries(a.replacements)){
  assert.equal(r.currentSha256,a.sourceDigests[p]);assert.equal(hash(historical(a.previousSourceSha,p)),r.previousSha256,'exact previous source '+p);
 }
 // Do not drop an earlier source from current authentication. The caller then
 // verifies the complete accepted predecessor chain, including the later ECR
 // correction, against its own immutable receipts and exact source hashes.
 for(const p of Object.keys(prior.sourceDigests))assert.match(a.sourceDigests[p]??'',/^[a-f0-9]{64}$/,'retained source '+p);
 return{manifest:a,previousBytes:p=>{
  if(p===KNOWLEDGE_SOURCE_RECORD||p.endsWith('/knowledge-source-adoption.json')||added.has(p))throw Object.assign(Error('Absent from knowledge predecessor'),{code:'ENOENT'});
  if(!changed.has(p))return current(p);
  if(!cache.has(p))cache.set(p,Buffer.from(historical(a.previousSourceSha,p)));
  return Buffer.from(cache.get(p));
 }};
}
