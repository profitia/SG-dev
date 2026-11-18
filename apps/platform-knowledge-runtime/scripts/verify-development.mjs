import fs from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createKnowledgeContextAdapter} from '../../../packages/assistant-context-gateway/src/knowledge.mjs';
import {validateSchema} from '../src/admin.mjs';
import {CONTEXT_TOKENIZER} from '../src/provider.mjs';

// An independent consumer, not a production assistant or an identity simulator.
// Only the author's synthetic corpus may leave this process for token counting.
const origin='https://platform-knowledge-development-api.onrender.com';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>{if(i%2===0)a.push([v,all[i+1]]);return a;},[]));
if(!args['--receipt']||!args['--bearer-file']||!args['--cic-module']||!args['--cic-sha256']||!args['--release'])throw Error('RECEIPT_SESSION_CIC_DIGEST_AND_RELEASE_REQUIRED');
if(!/^[a-f0-9]{40}$/.test(args['--release'])||!/^[a-f0-9]{64}$/.test(args['--cic-sha256']))throw Error('EXACT_RELEASE_REQUIRED');
const moduleBytes=await fs.readFile(args['--cic-module']);assert.equal(hash(moduleBytes),args['--cic-sha256'],'CIC_MODULE_DIGEST_MISMATCH');
const {planKnowledgeContext,KNOWLEDGE_CONTEXT_PLAN_VERSION}=await import(pathToFileURL(args['--cic-module']).href);
assert.equal(KNOWLEDGE_CONTEXT_PLAN_VERSION,'1.0.0');assert.equal(typeof planKnowledgeContext,'function');
const receipt=JSON.parse(await fs.readFile(args['--receipt'],'utf8'));
if(receipt.fixtureRights!=='AUTHOR_SYNTHETIC_TEST_ONLY'||receipt.release!==args['--release']||!Array.isArray(receipt.sources))throw Error('SYNTHETIC_IMPORT_RECEIPT_REQUIRED');
const corpus=JSON.parse(await fs.readFile(new URL('../../../packages/platform-knowledge-core/fixtures/corpus-v1.json',import.meta.url),'utf8'));
const profile=JSON.parse(await fs.readFile(new URL('../../../packages/platform-knowledge-core/fixtures/quality-profile-v1.json',import.meta.url),'utf8'));
const validIds=new Set(receipt.sources.map(s=>s.sourceId));
if(validIds.size!==receipt.sources.length||receipt.sources.some(s=>!/^[-a-f0-9]{36}$/.test(s.sourceId)))throw Error('INVALID_RECEIPT');
for(const key of ['delivery-standard','delivery-reference','delivery-history'])assert.ok(receipt.sources.some(s=>s.key===key),'COMPETING_DOCUMENT_MISSING');
if(!process.env.OPENAI_API_KEY)throw Error('APPROVED_OPENAI_CREDENTIAL_REQUIRED');
async function request(path,{method='GET',body}={}){
 const stat=await fs.stat(args['--bearer-file']);if((stat.mode&0o077)!==0||stat.size>16000)throw Error('PRIVATE_SHORT_LIVED_SESSION_FILE_REQUIRED');
 const bearer=(await fs.readFile(args['--bearer-file'],'utf8')).trim();if(!bearer||/[\r\n]/.test(bearer))throw Error('INVALID_SESSION_FILE');
 const response=await fetch(origin+path,{method,redirect:'error',headers:{Authorization:'Bearer '+bearer,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error('DEVELOPMENT_REQUEST_REJECTED_'+response.status);
 return response.json();
}
const ready=await fetch(origin+'/health/ready',{redirect:'error'});assert.equal(ready.status,200,'DEVELOPMENT_NOT_READY');
const statuses=await request('/v1/source-statuses',{method:'POST',body:{version:'0.2.0',sourceIds:[...validIds]}});
assert.ok(statuses.sources.every(s=>s.event==='READY'),'REFERENCE_LIBRARY_NOT_READY');
const counters={requests:0};
const adapter=createKnowledgeContextAdapter({validateSchema,
 query:async({query})=>request('/v1/query',{method:'POST',body:query}),
 countTokens:async serialized=>{
  const context=JSON.parse(serialized);
  if(context.evidence.some(e=>!validIds.has(e.sourceId)))throw Error('NON_FIXTURE_CONTEXT_NOT_SENT_TO_EXTERNAL_COUNTER');
  const response=await fetch('https://api.openai.com/v1/responses/input_tokens',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-6-luna',input:serialized}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('AUTHORITATIVE_TOKEN_COUNT_UNAVAILABLE');const count=await response.json();assert.ok(Number.isSafeInteger(count.input_tokens));counters.requests++;return count.input_tokens;
 }});
const results=[];
for(const fixture of corpus.questions.filter(q=>q.id!=='private-01')){
 const plan=planKnowledgeContext({requestId:randomUUID(),question:fixture.query,task:'ANSWER',language:'pl',scopes:['PROFITIA_SHARED'],maxTokens:12000,tokenizerId:CONTEXT_TOKENIZER,targetModel:'gpt-6-luna'});
 assert.equal(plan.query.documentIds,undefined,'NATURAL_DISCOVERY_MUST_NOT_HAVE_SOURCE_HINT');
 const context=await adapter.resolve({plan,request:new Request(origin)});
 const found=context.evidence.slice(0,10).map(e=>receipt.sources.find(s=>s.sourceId===e.sourceId)?.key);
 const expected=fixture.expectedEvidenceDocumentIds??[];
 const recall=expected.length?expected.filter(k=>found.includes(k)).length/expected.length:1;
 if(fixture.expectedStatus)assert.equal(context.status,fixture.expectedStatus);
 else assert.ok(recall>=(fixture.id==='exact-01'?profile.thresholds.exactIdentifierRecallAt10:profile.thresholds.naturalQueryRecallAt10),'RETRIEVAL_THRESHOLD_FAILED_'+fixture.id);
 for(const fact of fixture.requiredFacts??[])assert.ok(context.evidence.some(e=>e.text.toLowerCase().includes(fact.toLowerCase())),'MISSING_FACT_'+fixture.id);
 for(const e of context.evidence){assert.ok(e.locations.length);assert.ok(e.text.trim());assert.ok(e.rights.quotingAllowed&&e.rights.apiExcerptAllowed);}
 if(fixture.id==='conflict-01')assert.ok(context.evidence.some(e=>e.authority==='BINDING_STANDARD'),'BINDING_AUTHORITY_LOST');
 results.push({caseId:fixture.id,status:context.status,recallAt10:recall,evidenceCount:context.evidence.length,usedTokens:context.usedTokens,passed:true});
}
console.log(JSON.stringify({status:'PASS',proof:'REAL_CIC_PLAN_REAL_ACG_ADAPTER_DEVELOPMENT_API',release:args['--release'],cicModuleSha256:args['--cic-sha256'],contract:'0.2.0',profile:profile.id,independentTokenCounts:counters.requests,cases:results,scope:'SHARED_RETRIEVAL_SUBSET; not full Stage2 or Stage3 acceptance'},null,2));
