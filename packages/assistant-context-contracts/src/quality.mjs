import {readContextReference,CONTEXT_STATUSES} from './index.mjs'

export const QUALITY_CONTRACTS=Object.freeze({evidence:'QA_EVIDENCE_V1',verdict:'QUALITY_VERDICT_V1',repair:'REPAIR_MANIFEST_V1',release:'RELEASE_RECEIPT_V1'})
const DAY=86400000
const fail=()=>{throw TypeError('Invalid assistant quality contract')}
const require=v=>{if(!v)fail()}
const object=v=>v!==null&&Object.getPrototypeOf(v)===Object.prototype
const exact=(v,keys)=>require(object(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(','))
const text=(v,max=256)=>require(typeof v==='string'&&v.length>0&&v.length<=max)
const one=(v,values)=>require(values.includes(v))
const uuid=v=>require(typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v))
const sha=(v,length=64)=>require(typeof v==='string'&&new RegExp('^[a-f0-9]{'+length+'}$').test(v))
const version=v=>require(typeof v==='string'&&/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(v))
function stamp(v){require(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v));const n=Date.parse(v);require(Number.isFinite(n)&&new Date(n).toISOString()===v);return n}
const list=(v,max,min=0)=>require(Array.isArray(v)&&v.length>=min&&v.length<=max)
const unique=v=>require(new Set(v).size===v.length)
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}

/** Only plain JSON is accepted. Accessors, prototypes and extra authority fields
 * cannot acquire meaning through a parser. Text content remains untrusted data. */
function json(value,maxBytes){
 let nodes=0
 function walk(v,depth){
  require(depth<=16&&++nodes<=20000)
  if(v===null||typeof v==='string'||typeof v==='boolean')return
  if(typeof v==='number'){require(Number.isFinite(v));return}
  require(Array.isArray(v)||object(v))
  if(Array.isArray(v)){
   require(v.length<=512&&Object.keys(v).length===v.length&&Reflect.ownKeys(v).length===v.length+1)
   for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));require(d&&d.enumerable&&'value'in d);walk(d.value,depth+1)}
   return
  }
  require(Reflect.ownKeys(v).length<=64)
  for(const key of Reflect.ownKeys(v)){
   const d=Object.getOwnPropertyDescriptor(v,key)
   require(typeof key==='string'&&!['__proto__','prototype','constructor'].includes(key)&&d.enumerable&&'value'in d)
   walk(d.value,depth+1)
  }
 }
 walk(value,0);require(Buffer.byteLength(JSON.stringify(value),'utf8')<=maxBytes)
 return structuredClone(value)
}
function clock(now){require(Number.isFinite(now)&&now>=0);return now}
function period(v){if(v===null)return;exact(v,['from','to','weekStartsOn']);require(stamp(v.from)<=stamp(v.to)&&v.weekStartsOn==='MONDAY')}
function signature(v){exact(v,['keyId','signature']);text(v.keyId,128);require(/^[A-Za-z0-9_-]{86}$/.test(v.signature))}

/** Parsing never grants QA access. The host must separately check current
 * account, organisation/source rights, purpose and revocation before every read,
 * model dispatch and result publication. No caller-provided ALLOW is accepted. */
export function readQualityEvidence(value,{now}={}){
 const v=json(value,196608),at=clock(now)
 exact(v,['schemaVersion','evidenceId','interactionId','accountId','applicationId','environment','occurredAt','earliestInputAt','timeZone','interpretedPeriod','purpose','versions','sourceScopes','modelInput','output','expiresAt'])
 require(v.schemaVersion===QUALITY_CONTRACTS.evidence&&v.applicationId==='spendguru'&&v.environment==='development')
 for(const key of ['evidenceId','interactionId','accountId'])uuid(v[key])
 const occurred=stamp(v.occurredAt),earliest=stamp(v.earliestInputAt)
 require(earliest<=occurred&&occurred<=at)
 text(v.timeZone,128);try{new Intl.DateTimeFormat('en',{timeZone:v.timeZone}).format(occurred)}catch{fail()}
 period(v.interpretedPeriod)
 exact(v.purpose,['id','policyVersion','grantId','validUntil']);require(v.purpose.id==='ASSISTANT_QUALITY');version(v.purpose.policyVersion);uuid(v.purpose.grantId)
 exact(v.versions,['applicationSha','model','promptSha256','modelConfigurationSha256','cicVersion','gatewayVersion'])
 sha(v.versions.applicationSha,40);sha(v.versions.promptSha256);sha(v.versions.modelConfigurationSha256)
 text(v.versions.model,128);version(v.versions.cicVersion);version(v.versions.gatewayVersion)
 // A model input can include 12 prior turns in addition to the current four
 // sources. Preserve each original organisation/reference/version scope; do
 // not collapse historical private references into the current selection.
 // This does not raise the Gateway's four-source-per-turn execution bound.
 list(v.sourceScopes,64)
 for(const s of v.sourceScopes){
  exact(s,['source','organisationId','classification','sourceVersion','rightsVersion','validUntil','status','reference'])
  uuid(s.organisationId);one(s.classification,['SHARED_KNOWLEDGE','ORGANISATION_PRIVATE','USER_IN_ORGANISATION_PRIVATE'])
  if(s.sourceVersion!==null)sha(s.sourceVersion)
  text(s.rightsVersion);stamp(s.validUntil);one(s.status,CONTEXT_STATUSES)
  require(readContextReference(s.reference).source===s.source)
 }
 unique(v.sourceScopes.map(s=>JSON.stringify([s.source,s.organisationId,s.sourceVersion,
  Object.fromEntries(Object.entries(s.reference).sort(([a],[b])=>a.localeCompare(b)))])))
 list(v.modelInput,32,1)
 for(const m of v.modelInput){exact(m,['role','content']);one(m.role,['developer','user','assistant']);text(m.content,32768)}
 require(Buffer.byteLength(JSON.stringify(v.modelInput),'utf8')<=32768)
 exact(v.output,['draft','delivered','status']);one(v.output.status,['COMPLETE','INTERRUPTED','FAILED'])
 for(const key of ['draft','delivered'])require(typeof v.output[key]==='string'&&v.output[key].length<=64000)
 const limit=Math.min(occurred+7*DAY,earliest+7*DAY,stamp(v.purpose.validUntil),...v.sourceScopes.map(s=>stamp(s.validUntil)))
 require(stamp(v.expiresAt)<=limit&&stamp(v.expiresAt)>at)
 return freeze(v)
}

/** A verdict, including a deterministic FAIL, is a diagnosis. Independent
 * reproduction, current mandate and promotion checks remain separate. */
export function readQualityVerdict(value){
 const v=json(value,16384)
 exact(v,['schemaVersion','evidenceId','rubricVersion','judgeVersion','method','result','dimensions','harm','cause','evidencePointers','proposedRepairClass'])
 require(v.schemaVersion===QUALITY_CONTRACTS.verdict);uuid(v.evidenceId);version(v.rubricVersion);text(v.judgeVersion)
 one(v.method,['DETERMINISTIC','SEMANTIC_ADVISORY']);one(v.result,['PASS','FAIL','INSUFFICIENT_EVIDENCE'])
 list(v.dimensions,5,1);unique(v.dimensions);v.dimensions.forEach(d=>one(d,['LANGUAGE','FACTS','LOGIC','CONTEXT','ACCESS']))
 one(v.harm,['NONE','MINOR','MAJOR','CRITICAL'])
 if(v.cause!==null)one(v.cause,['INTENT','CONTEXT','SOURCE_DATA','INTEGRATION','APPLICATION_LOGIC','INSTRUCTION_OR_GENERATION','UNKNOWN'])
 list(v.evidencePointers,16);unique(v.evidencePointers);for(const p of v.evidencePointers)require(typeof p==='string'&&p.length<=512&&/^\/(?:modelInput|output|sourceScopes|interpretedPeriod|versions|occurredAt)(?:\/[A-Za-z0-9_~-]+)*$/.test(p))
 if(v.proposedRepairClass!==null)one(v.proposedRepairClass,['C1','C2','C3'])
 if(v.result==='PASS')require(v.harm==='NONE'&&v.cause===null&&v.proposedRepairClass===null)
 if(v.result==='FAIL')require(v.harm!=='NONE'&&v.cause!==null&&v.evidencePointers.length>0)
 if(v.result==='INSUFFICIENT_EVIDENCE')require(v.cause==='UNKNOWN'&&v.proposedRepairClass===null)
 return freeze(v)
}

function repository(v){require(v.projectKey==='SG2'&&v.repository==='profitia/SG-dev'||v.projectKey==='CIC'&&v.repository==='profitia/conversational-intelligence-core')}
function sourcePath(p){
 text(p,256)
 require(!p.startsWith('/')&&!p.endsWith('/')&&!/[\\\x00-\x20*?\[\]{}]/.test(p)&&p.split('/').every(x=>x&&x!=='.'&&x!=='..')
  &&!p.startsWith('Canon/')&&!p.startsWith('.github/')&&!p.startsWith('governance/')&&!p.startsWith('packages/assistant-quality-control/')&&!p.startsWith('packages/platform-contracts/')
  &&!/(?:^|\/)(?:quality-policy\.[^/]+|package(?:-lock)?\.json|[^/]*security[^/]*|[^/]*integrity[^/]*)$/i.test(p))
}

/** Synthetic payload lives in a separately checked immutable export artifact.
 * Neither raw QA content nor arbitrary URLs enter a repair dispatch. Signature
 * shape is validated here; the controller must verify its trusted issuer/key. */
export function readRepairManifest(value,{now}={}){
 const v=json(value,16384),at=clock(now)
 exact(v,['schemaVersion','incidentId','repairClass','projectKey','repository','baseSha','allowedPaths','mandate','gateSetSha256','synthetic','limits','correlationId'])
 require(v.schemaVersion===QUALITY_CONTRACTS.repair);uuid(v.incidentId);uuid(v.correlationId);one(v.repairClass,['C1','C2','C3']);repository(v);sha(v.baseSha,40)
 list(v.allowedPaths,12,1);unique(v.allowedPaths);v.allowedPaths.forEach(sourcePath)
 require(v.allowedPaths.every(p=>v.projectKey==='SG2'?p.startsWith('apps/sg-runtime/'):p.startsWith('packages/cic-')))
 exact(v.mandate,['id','version','sha256','issuedAt','expiresAt','attestation']);uuid(v.mandate.id);version(v.mandate.version);sha(v.mandate.sha256)
 require(stamp(v.mandate.issuedAt)<=at&&stamp(v.mandate.expiresAt)>at);signature(v.mandate.attestation);sha(v.gateSetSha256)
 exact(v.synthetic,['fixtureId','sha256','exportReceiptId']);require(/^qa_synthetic_[a-f0-9]{64}$/.test(v.synthetic.fixtureId));sha(v.synthetic.sha256);uuid(v.synthetic.exportReceiptId)
 exact(v.limits,['maxAttempts','maxAttemptSeconds','maxIncidentMicroUsd'])
 require(v.limits.maxAttempts===2&&v.limits.maxAttemptSeconds===1800&&v.limits.maxIncidentMicroUsd===5000000)
 return freeze(v)
}

/** Metadata is never a substitute for GitHub/provider/runtime readback. The
 * trusted verifier attestation must be checked before using a stored receipt. */
export function readReleaseReceipt(value,{now}={}){
 const v=json(value,16384),at=clock(now)
 exact(v,['schemaVersion','incidentId','repairClass','projectKey','repository','baseSha','sourceSha','artifactSha256','verification','lastKnownGood','deployment','acceptance','state','rollback','attestation'])
 require(v.schemaVersion===QUALITY_CONTRACTS.release);uuid(v.incidentId);one(v.repairClass,['C1','C2','C3']);repository(v)
 sha(v.baseSha,40);sha(v.sourceSha,40);sha(v.artifactSha256)
 exact(v.verification,['runId','commitSha','gateSetSha256','holdoutSha256','result']);require(/^\d+$/.test(v.verification.runId));require(v.verification.commitSha===v.sourceSha&&v.verification.result==='PASS');sha(v.verification.gateSetSha256);sha(v.verification.holdoutSha256)
 exact(v.lastKnownGood,['sourceSha','artifactSha256','configurationSha256','deployId']);sha(v.lastKnownGood.sourceSha,40);sha(v.lastKnownGood.artifactSha256);sha(v.lastKnownGood.configurationSha256);text(v.lastKnownGood.deployId)
 exact(v.deployment,['environment','serviceId','deployId','sourceSha','configurationSha256']);require(v.deployment.environment==='development'&&v.deployment.sourceSha===v.sourceSha);text(v.deployment.serviceId);text(v.deployment.deployId);sha(v.deployment.configurationSha256)
 exact(v.acceptance,['runId','result','observedAt']);text(v.acceptance.runId);one(v.acceptance.result,['PASS','FAIL','INSUFFICIENT_EVIDENCE']);require(stamp(v.acceptance.observedAt)<=at)
 one(v.state,['RELEASED','OBSERVING','CLOSED','ROLLED_BACK']);if(v.state==='CLOSED')require(v.acceptance.result==='PASS')
 exact(v.rollback,['decisionAt','completedAt','sourceSha','deployId','verificationRunId'])
 if(v.state==='ROLLED_BACK'){
  require(v.rollback.sourceSha===v.lastKnownGood.sourceSha&&stamp(v.rollback.decisionAt)<=stamp(v.rollback.completedAt)&&stamp(v.rollback.completedAt)<=at)
  text(v.rollback.deployId);text(v.rollback.verificationRunId)
 }else require(Object.values(v.rollback).every(x=>x===null))
 signature(v.attestation)
 return freeze(v)
}
