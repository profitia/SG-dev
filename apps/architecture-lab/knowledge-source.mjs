// Closed source-compatibility review only; never imported by product runtime.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const KNOWLEDGE_SOURCE_RECORD='apps/architecture-lab/knowledge-source.json';
export const KNOWLEDGE_SOURCE_RECORD_SHA256='44b5e85e201974aadc863ed3d9a5afc2f10c0224dc979bfe1cff5a13bfd73f99';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
// Historical readers use Git's exact missing-path diagnostic rather than the
// filesystem ENOENT. Unknown revisions, foreign paths and access errors remain
// fatal; only this optional record can be genuinely absent from its predecessor.
const absent=(error,historical)=>{
 if(error?.code==='ENOENT')return true;
 if(error?.status!==128)return false;
 const diagnostic=String(error.stderr??'').trim();
 const prefix="fatal: path '"+KNOWLEDGE_SOURCE_RECORD+"' ";
 if(!diagnostic.startsWith(prefix))return false;
 const match=/^(?:does not exist in|exists on disk, but not in) '([a-f0-9]{40})'$/.exec(diagnostic.slice(prefix.length));
 if(!match)return false;
 // Git can print the same missing-path text for an unknown object. Verify a
 // real historical source at that revision before classifying absence.
 const witness=historical(match[1],'AGENTS.md');
 assert((Buffer.isBuffer(witness)||typeof witness==='string')&&witness.length>0,'readable historical revision required');
 return true;
};
export function knowledgeSourcePredecessor(current,historical){
 let bytes;try{bytes=current(KNOWLEDGE_SOURCE_RECORD);}catch(error){if(absent(error,historical))return null;throw error;}
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
