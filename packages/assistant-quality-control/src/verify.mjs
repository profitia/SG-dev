import {createHash} from 'node:crypto'
import {documentDigest,verifyDocument,assertVerifiedRepairManifest,SOURCE_PATHS} from './manifest.mjs'

const fail=code=>{throw Object.assign(Error('Independent quality verification refused'),{code})}
const require=(v,c='VERIFICATION_INPUT_INVALID')=>{if(!v)fail(c)}
const hash=v=>createHash('sha256').update(v).digest('hex')
const exact=(v,keys)=>require(v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===[...keys].sort().join(','))
const integer=v=>Number.isSafeInteger(v)&&v>=0
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const code=v=>typeof v==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(v)
const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v
const prefix='export default ',suffix=' as const;\n'

export function readRegression(value){
 const v=typeof value==='string'?JSON.parse(value):value
 exact(v,['schemaVersion','repairClass','caseFamily','locale','args','expected','expectedAnswer','refusal'])
 require(v.schemaVersion==='AQC_REGRESSION_V1'&&['C1','C2','C3'].includes(v.repairClass)&&code(v.caseFamily)&&['pl','en'].includes(v.locale))
 require(Array.isArray(v.args)&&v.args.length<=4&&typeof v.expectedAnswer==='boolean')
 exact(v.refusal,['pointer','values']);require(typeof v.refusal.pointer==='string'&&/^(?:\/[a-zA-Z0-9_~-]+)*$/.test(v.refusal.pointer)
  &&Array.isArray(v.refusal.values)&&v.refusal.values.length<=8)
 // Canonical validation rejects accessors, cycles, inherited values and unsafe
 // keys. JSON data is never imported, evaluated or interpreted as instructions.
 documentDigest(v);require(Buffer.byteLength(JSON.stringify(v))<=16384)
 return structuredClone(v)
}
export function serializeRegression(value){return prefix+JSON.stringify(readRegression(value),null,2)+suffix}
export function readRegressionSource(source){
 require(typeof source==='string'&&Buffer.byteLength(source)<=32768&&source.startsWith(prefix)&&source.endsWith(suffix),'EXECUTABLE_REGRESSION_REJECTED')
 let v;try{v=readRegression(source.slice(prefix.length,-suffix.length))}catch{fail('REGRESSION_DATA_INVALID')}
 require(serializeRegression(v)===source,'NONCANONICAL_REGRESSION_REJECTED');return v
}

function valueAt(value,pointer){
 for(const token of pointer.split('/').slice(1)){
  const key=token.replaceAll('~1','/').replaceAll('~0','~');if(value===null||typeof value!=='object'||!Object.hasOwn(value,key))return undefined;value=value[key]
 }
 return value
}
function judgement(value,fixture){
 if(value?.status!=='COMPLETE')return {correct:false,refusal:false,unverifiable:true,accessViolation:value?.accessViolation===true}
 let actualDigest
 try{actualDigest=documentDigest(value.output)}catch{return {correct:false,refusal:false,unverifiable:true,accessViolation:true}}
 const refused=valueAt(value.output,fixture.refusal.pointer)
 return {correct:actualDigest===documentDigest(fixture.expected),outputSha256:actualDigest,
  refusal:fixture.expectedAnswer&&fixture.refusal.values.some(v=>{try{return documentDigest(v)===documentDigest(refused)}catch{return false}}),
  unverifiable:false,accessViolation:value.accessViolation===true}
}

/** The parent owns labels and comparison. runCase is a trusted OS-isolated
 * execution port, with read-only source and no model/DB/provider credentials.
 * It returns actual typed values; agent TAP, stdout or self-grades are unused.
 * The pack and its attestation must be frozen before the repair agent starts. */
export async function verifyCandidate({manifest,beforeSource,afterSource,regressionSource,pack,packAttestation,reviewerKeys,gateSetSha256,runCase,artifactSha256,now=Date.now()}){
 const m=assertVerifiedRepairManifest(manifest)
 require(typeof runCase==='function'&&digest(artifactSha256)&&m.gateSetSha256===gateSetSha256)
 const {assertRepairSource}=await import('./source-policy.mjs')
 const source=assertRepairSource({before:beforeSource,after:afterSource,path:SOURCE_PATHS[m.repairClass],repairClass:m.repairClass})
 const repair=readRegressionSource(regressionSource)
 require(repair.repairClass===m.repairClass&&documentDigest(repair)===m.synthetic.sha256&&m.synthetic.fixtureId==='qa_synthetic_'+m.synthetic.sha256,'REPAIR_FIXTURE_MISMATCH')
 const meta=verifyDocument(packAttestation,{kind:'AQC_REFERENCE_PACK_V1',trustedKeys:reviewerKeys})
 exact(meta,['sha256','gateSetSha256','rubricVersion','issuedAt','expiresAt','repairFamilies','minimumCases','labelSource','split'])
 require(meta.sha256===documentDigest(pack)&&meta.gateSetSha256===gateSetSha256&&meta.split==='HOLDOUT'
  &&meta.labelSource==='INDEPENDENT_REVIEWED_REFERENCE'&&meta.minimumCases>=200&&code(meta.rubricVersion)
  &&stamp(meta.issuedAt)&&stamp(meta.expiresAt)&&Date.parse(meta.issuedAt)<=now&&Date.parse(meta.expiresAt)>now,'REFERENCE_NOT_FROZEN_OR_APPROVED')
 require(Array.isArray(meta.repairFamilies)&&meta.repairFamilies.includes(repair.caseFamily)&&Array.isArray(pack)&&pack.length>=meta.minimumCases&&pack.length<=512)
 const ids=new Set(),counts={C1:0,C2:0,C3:0},criticalCounts={C1:0,C2:0,C3:0},locales={C1:new Set(),C2:new Set(),C3:new Set()},criticalLocales={C1:new Set(),C2:new Set(),C3:new Set()}
 for(const item of pack){
  exact(item,['id','critical','fixture']);require(digest(item.id)&&!ids.has(item.id)&&typeof item.critical==='boolean');ids.add(item.id)
  const f=readRegression(item.fixture);require(!meta.repairFamilies.includes(f.caseFamily),'REFERENCE_FAMILY_LEAK')
  counts[f.repairClass]++;locales[f.repairClass].add(f.locale)
  if(item.critical){criticalCounts[f.repairClass]++;criticalLocales[f.repairClass].add(f.locale)}
 }
 require(Object.values(counts).every(n=>n>=20)&&Object.values(locales).every(v=>v.size===2)
  &&Object.values(criticalCounts).every(n=>n>=20)&&Object.values(criticalLocales).every(v=>v.size===2),'REFERENCE_COVERAGE_INSUFFICIENT')
 const execute=async(version,fixture,repeat=0)=>{
  const sourceSha256=version==='base'?source.beforeSha256:source.afterSha256
  const r=await runCase({version,sourceSha256,repairClass:fixture.repairClass,args:structuredClone(fixture.args),repeat})
  require(r?.sourceSha256===sourceSha256,'EXECUTION_SOURCE_MISMATCH')
  return judgement(r,fixture)
 }
 const red=await execute('base',repair),green=await execute('candidate',repair)
 const observations=[];let beforeCorrect=0,afterCorrect=0,beforeRefusals=0,afterRefusals=0,criticalRegressions=0,accessViolations=0,criticalCasesPass=true,stable=true,scopeBeforeDefects=0,scopeAfterDefects=0
 for(let repeat=1;repeat<3;repeat++){
  if(documentDigest(await execute('base',repair,repeat))!==documentDigest(red)||documentDigest(await execute('candidate',repair,repeat))!==documentDigest(green))stable=false
 }
 for(const item of pack){
  const before=await execute('base',item.fixture),after=await execute('candidate',item.fixture)
  beforeCorrect+=Number(before.correct);afterCorrect+=Number(after.correct);beforeRefusals+=Number(before.refusal);afterRefusals+=Number(after.refusal)
  accessViolations+=Number(after.accessViolation);if(item.critical&&!after.correct)criticalCasesPass=false
  if(item.critical&&before.correct&&!after.correct)criticalRegressions++
  if(item.fixture.repairClass===m.repairClass){scopeBeforeDefects+=Number(!before.correct);scopeAfterDefects+=Number(!after.correct)}
  if(item.critical)for(let repeat=1;repeat<3;repeat++){
   const again=await execute('candidate',item.fixture,repeat),baseAgain=await execute('base',item.fixture,repeat)
   if(!again.correct||again.accessViolation||documentDigest(again)!==documentDigest(after)||documentDigest(baseAgain)!==documentDigest(before))stable=false
  }
  // Only classifications, never private inputs, labels or candidate outputs.
  observations.push({id:item.id,before,after})
 }
 const correctnessDeltaPp=100*(afterCorrect-beforeCorrect)/pack.length,unjustifiedRefusalDeltaPp=100*(afterRefusals-beforeRefusals)/pack.length
 const passed=!red.correct&&!red.unverifiable&&green.correct&&!green.accessViolation&&criticalCasesPass&&stable
  &&criticalRegressions===0&&accessViolations===0&&correctnessDeltaPp>=-1&&unjustifiedRefusalDeltaPp<=2
  &&(scopeBeforeDefects<10||scopeAfterDefects*2<=scopeBeforeDefects)
 const body={result:passed?'PASS':'FAIL',baseSha:m.baseSha,artifactSha256,baseTest:red.correct?'PASS':red.unverifiable?'UNKNOWN':'FAIL',candidateTest:green.correct?'PASS':'FAIL',
  holdoutCases:pack.length,classCounts:counts,criticalRegressions,accessViolations,criticalCasesPass,criticalRepeats:3,stable,
  correctnessDeltaPp,unjustifiedRefusalDeltaPp,holdoutSha256:meta.sha256,rubricVersion:meta.rubricVersion,
  scopeBeforeDefects,scopeAfterDefects,
  beforeSourceSha256:source.beforeSha256,afterSourceSha256:source.afterSha256,regressionSha256:hash(regressionSource),observationsSha256:documentDigest(observations)}
 return Object.freeze({...body,proofSha256:documentDigest(body)})
}
