import {createHash} from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {gunzipSync} from 'node:zlib'
import ts from 'typescript'
import {documentDigest,verifyDocument,signDocument,assertVerifiedRepairManifest,SOURCE_PATHS} from './manifest.mjs'
import {advanceIncident} from './controller.mjs'

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
 try{actualDigest=documentDigest(value.output)}catch{return {correct:false,refusal:false,unverifiable:true,accessViolation:value.accessViolation===true}}
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
 const observations=[];let beforeCorrect=0,afterCorrect=0,beforeRefusals=0,afterRefusals=0,criticalRegressions=0,accessViolations=0,unverifiableCases=0,criticalCasesPass=true,stable=true,scopeBeforeDefects=0,scopeAfterDefects=0
 for(let repeat=1;repeat<3;repeat++){
  if(documentDigest(await execute('base',repair,repeat))!==documentDigest(red)||documentDigest(await execute('candidate',repair,repeat))!==documentDigest(green))stable=false
 }
 for(const item of pack){
  const before=await execute('base',item.fixture),after=await execute('candidate',item.fixture)
  beforeCorrect+=Number(before.correct);afterCorrect+=Number(after.correct);beforeRefusals+=Number(before.refusal);afterRefusals+=Number(after.refusal)
  accessViolations+=Number(after.accessViolation);if(item.critical&&!after.correct)criticalCasesPass=false
  unverifiableCases+=Number(before.unverifiable||after.unverifiable)
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
  &&criticalRegressions===0&&accessViolations===0&&unverifiableCases===0&&correctnessDeltaPp>=-1&&unjustifiedRefusalDeltaPp<=2
  &&(scopeBeforeDefects<10||scopeAfterDefects*2<=scopeBeforeDefects)
 const body={result:passed?'PASS':'FAIL',baseSha:m.baseSha,artifactSha256,baseTest:red.correct?'PASS':red.unverifiable?'UNKNOWN':'FAIL',candidateTest:green.correct?'PASS':'FAIL',
  holdoutCases:pack.length,classCounts:counts,criticalRegressions,accessViolations,unverifiableCases,criticalCasesPass,criticalRepeats:3,stable,
  correctnessDeltaPp,unjustifiedRefusalDeltaPp,holdoutSha256:meta.sha256,rubricVersion:meta.rubricVersion,
  scopeBeforeDefects,scopeAfterDefects,
  beforeSourceSha256:source.beforeSha256,afterSourceSha256:source.afterSha256,regressionSha256:hash(regressionSource),observationsSha256:documentDigest(observations)}
 return Object.freeze({...body,proofSha256:documentDigest(body)})
}

const verificationBundles=new WeakSet()
const cicIntegrity='sha512-tuun88+cfOHFeCafBw1a8gnExgeDyWBgY7Zd9OPkKk2/Eef0YBP49vzDcXKVpFoCNJGh/CYbeR9B+M2ZXctNsg=='
export function assertQualityVerificationBundle(value){
 require(verificationBundles.has(value),'VERIFIED_SOURCE_BUNDLE_REQUIRED');return value
}
function cicFiles(archive){
 require(Buffer.isBuffer(archive)&&archive.length<=2097152&&'sha512-'+createHash('sha512').update(archive).digest('base64')===cicIntegrity,'VERIFIER_CIC_ARTIFACT_REQUIRED')
 const bytes=gunzipSync(archive,{maxOutputLength:4194304}),files={};let offset=0
 while(offset+512<=bytes.length){
  const h=bytes.subarray(offset,offset+512);if(h.every(n=>n===0))break
  const text=(a,b)=>h.subarray(a,b).toString('utf8').replace(/\0.*$/s,'')
  const name=text(0,100),prefix=text(345,500),type=text(156,157),sizeText=text(124,136).trim(),check=text(148,156).trim()
  require(/^[0-7]+$/.test(sizeText)&&/^[0-7]+$/.test(check),'VERIFIER_CIC_ARCHIVE_INVALID')
  const size=parseInt(sizeText,8),sum=h.reduce((n,b,i)=>n+(i>=148&&i<156?32:b),0)
  require(sum===parseInt(check,8)&&!prefix&&name.startsWith('package/')&&name.slice(8).split('/').every(p=>/^[a-zA-Z0-9_.-]+$/.test(p)&&p!=='.'&&p!=='..')
   &&['','0'].includes(type)&&size<=524288&&offset+512+size<=bytes.length,'VERIFIER_CIC_ARCHIVE_INVALID')
  const relative='node_modules/@profitia/cic-core/'+name.slice(8),body=bytes.subarray(offset+512,offset+512+size),source=body.toString('utf8')
  require(!Object.hasOwn(files,relative)&&Buffer.from(source).equals(body)&&Object.keys(files).length<256,'VERIFIER_CIC_ARCHIVE_INVALID')
  files[relative]=source;offset+=512+Math.ceil(size/512)*512
 }
 const p=JSON.parse(files['node_modules/@profitia/cic-core/package.json']??'null')
 require(p?.name==='@profitia/cic-core'&&p.version==='1.8.0'&&Object.keys(p.dependencies??{}).length===0&&files['node_modules/@profitia/cic-core/dist/index.js'],'VERIFIER_CIC_ARTIFACT_REQUIRED')
 return files
}
/** Assemble inert source from the signed base Git objects and bounded patch.
 * No checkout import, package script, filesystem dependency tree or QA label
 * enters the child. Private CIC bytes must match its exact accepted tarball. */
export async function prepareQualityVerificationBundle({manifest,repositoryRoot,artifact,cicArchive}){
 const m=assertVerifiedRepairManifest(manifest)
 require(typeof repositoryRoot==='string'&&path.isAbsolute(repositoryRoot)&&artifact?.body&&artifact.artifactSha256===documentDigest(artifact.body),'VERIFIER_SOURCE_BINDING_INVALID')
 const read=p=>{
  const raw=execFileSync('git',['--no-replace-objects','-C',repositoryRoot,'show',m.baseSha+':'+p],{maxBuffer:1048576,timeout:15000,env:{PATH:'/usr/bin:/bin',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_OPTIONAL_LOCKS:'0'}})
  const s=raw.toString('utf8');require(Buffer.from(s).equals(raw),'VERIFIER_SOURCE_ENCODING_INVALID');return s
 }
 const sourcePath=SOURCE_PATHS[m.repairClass],testPath=m.allowedPaths.find(p=>p!==sourcePath),before=read(sourcePath)
 const {readPatchBody}=await import('./provenance.mjs')
 const b=readPatchBody(JSON.stringify(artifact.body),{manifest:m,beforeSource:before})
 const repaired=b.files.find(f=>f.path===sourcePath),test=b.files.find(f=>f.path===testPath)
 const oldLines=before.split('\n'),newLines=repaired.content.split('\n');let first=0,lastOld=oldLines.length,lastNew=newLines.length
 while(first<lastOld&&first<lastNew&&oldLines[first]===newLines[first])first++
 while(lastOld>first&&lastNew>first&&oldLines[lastOld-1]===newLines[lastNew-1]){lastOld--;lastNew--}
 require(lastOld-first+lastNew-first+test.content.split('\n').length<=300,'PATCH_LINE_LIMIT')
 const regression=readRegressionSource(test.content)
 require(documentDigest(regression)===m.synthetic.sha256&&regression.repairClass===m.repairClass,'REPAIR_FIXTURE_MISMATCH')
 const {assertRepairSource}=await import('./source-policy.mjs')
 const source=assertRepairSource({before,after:repaired.content,path:sourcePath,repairClass:m.repairClass})
 const sources={calendar:read(SOURCE_PATHS.C1),quality:read(SOURCE_PATHS.C2)},files={},primary=m.repairClass==='C1'?'calendar':'quality'
 let needsCic=false
 for(const version of ['base','candidate'])for(const [name,original]of Object.entries(sources)){
  const value=version==='candidate'&&name===primary?repaired.content:original
  const imports={'../../../../packages/assistant-context-contracts/src/index.mjs':'../contracts/index.mjs','node:crypto':'node:crypto','@profitia/cic-core':'@profitia/cic-core'}
  const result=ts.transpileModule(value,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext},reportDiagnostics:true,transformers:{before:[ctx=>sf=>ts.visitEachChild(sf,function visit(node){
   if(ts.isImportDeclaration(node)&&!node.importClause?.isTypeOnly){
    const used=!node.importClause||node.importClause?.name||node.importClause?.namedBindings&&(!ts.isNamedImports(node.importClause.namedBindings)||node.importClause.namedBindings.elements.some(e=>!e.isTypeOnly))
    if(used){
     const spec=node.moduleSpecifier.text;require(Object.hasOwn(imports,spec),'VERIFIER_IMPORT_REJECTED');if(spec==='@profitia/cic-core')needsCic=true
     return ctx.factory.updateImportDeclaration(node,node.modifiers,node.importClause,ctx.factory.createStringLiteral(imports[spec]),node.attributes)
    }
   }
   return ts.visitEachChild(node,visit,ctx)
  },ctx)]}})
  require(!(result.diagnostics??[]).some(d=>d.category===ts.DiagnosticCategory.Error),'VERIFIER_COMPILATION_FAILED')
  files[version+'/'+name+'.mjs']=result.outputText;files[version+'/'+name+'.ts']=value
 }
 const names=execFileSync('git',['--no-replace-objects','-C',repositoryRoot,'ls-tree','-r','--name-only',m.baseSha,'packages/assistant-context-contracts/src'],{encoding:'utf8',timeout:15000,env:{PATH:'/usr/bin:/bin',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}}).trim().split('\n').filter(Boolean)
 require(names.length>0&&names.length<=64,'VERIFIER_CONTRACT_GRAPH_INVALID')
 for(const p of names){const relative=p.slice('packages/assistant-context-contracts/src/'.length);if(!relative.endsWith('.mjs'))continue
  require(/^[a-zA-Z0-9_./-]+$/.test(relative)&&!relative.split('/').some(p=>!p||p==='.'||p==='..'),'VERIFIER_CONTRACT_GRAPH_INVALID');files['contracts/'+relative]=read(p)
 }
 if(needsCic){
  const lock=JSON.parse(read('apps/sg-runtime/package-lock.json')),pin=lock.packages?.['node_modules/@profitia/cic-core']
  require(pin?.version==='1.8.0'&&pin.integrity===cicIntegrity,'VERIFIER_CIC_ARTIFACT_REQUIRED')
  Object.assign(files,cicFiles(cicArchive))
 }
 require(Object.keys(files).length<=400&&Object.values(files).reduce((n,s)=>n+Buffer.byteLength(s),0)<=6291456,'VERIFIER_BUNDLE_LIMIT')
 const body=Object.freeze({files:Object.freeze(files),primary,baseSha:m.baseSha,expiresAt:m.mandate.expiresAt,gateSetSha256:m.gateSetSha256,
  sourceSha256:Object.freeze({base:source.beforeSha256,candidate:source.afterSha256}),artifactSha256:artifact.artifactSha256,
  bundleSha256:documentDigest(Object.entries(files).map(([path,content])=>({path,sha256:hash(content)})))})
 verificationBundles.add(body);return body
}
/** Installed verifier composition; the repair agent supplies neither runCase
 * nor an executable test. Expected values remain in verifyCandidate's parent. */
export async function createQualityIsolatedCaseRunner({bundle,qualification,qualificationKeys,observedGateSetSha256,signal,diagnostics}){
 const b=assertQualityVerificationBundle(bundle)
 require(diagnostics===undefined||typeof diagnostics==='function','VERIFIER_DIAGNOSTICS_INVALID')
 require(observedGateSetSha256===b.gateSetSha256,'GATE_POLICY_CHANGED')
 const {runIsolatedVerificationCase}=await import('./executor.mjs')
 return Object.freeze({async runCase(input){
  exact(input,['version','sourceSha256','repairClass','args','repeat'])
  require(['base','candidate'].includes(input.version)&&input.sourceSha256===b.sourceSha256[input.version]&&['C1','C2','C3'].includes(input.repairClass)
   &&Array.isArray(input.args)&&input.args.length<=4&&Number.isInteger(input.repeat)&&input.repeat>=0&&input.repeat<=2,'VERIFIER_CASE_BINDING_INVALID')
  documentDigest(input.args);require(Buffer.byteLength(JSON.stringify(input.args))<=16384,'VERIFIER_CASE_BINDING_INVALID')
  return runIsolatedVerificationCase({bundle:b,version:input.version,repairClass:input.repairClass,args:structuredClone(input.args),qualification,qualificationKeys,observedGateSetSha256,signal,diagnostics})
 }})
}


/** Private verifier composition reuses SG2's one canonical purpose/encryption
 * adapter. Only an independently established trusted main SHA and installed
 * host-code hash are accepted here, never a patch, agent module or import URL.
 * Read-only Git bytes and working files must match before any credential is
 * handed to that module. Controller/executor processes must not call this port. */
export async function createQualityPrivateEvidenceReader(options){
 const keys=['repositoryRoot','sourceSha','hostCodecSha256','purposeQuery','evidenceQuery','purposeKey','evidenceKey','storageKey',
  'purposeSchemaDigest','evidenceSchemaDigest','serviceId','storageGeneration','accountId']
 exact(options,Object.hasOwn(options??{},'now')?[...keys,'now']:keys)
 const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
 const o=Object.freeze({...options}),now=o.now??Date.now
 require(typeof o.repositoryRoot==='string'&&path.isAbsolute(o.repositoryRoot)&&/^[a-f0-9]{40}$/.test(o.sourceSha??'')
  &&digest(o.hostCodecSha256)&&typeof o.purposeQuery==='function'&&typeof o.evidenceQuery==='function'&&typeof now==='function'
  &&[o.purposeKey,o.evidenceKey,o.storageKey,o.purposeSchemaDigest,o.evidenceSchemaDigest].every(digest)
  &&new Set([o.purposeKey,o.evidenceKey,o.storageKey]).size===3&&[o.serviceId,o.storageGeneration,o.accountId].every(uuid)
  &&Number(process.versions.node.split('.')[0])>=24,'QA_READER_CONFIGURATION_INVALID')
 const host='apps/sg-runtime/lib/assistant/quality-evidence.ts',contracts='packages/assistant-context-contracts/src'
 let module
 try{
  require(fs.realpathSync(o.repositoryRoot)===path.resolve(o.repositoryRoot),'QA_READER_SOURCE_INVALID')
  const git=args=>execFileSync('/usr/bin/git',['--no-replace-objects','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-C',o.repositoryRoot,...args],
   {timeout:15000,maxBuffer:2097152,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_OPTIONAL_LOCKS:'0'},stdio:['ignore','pipe','pipe']})
  require(['https://github.com/profitia/SG-dev','https://github.com/profitia/SG-dev.git'].includes(git(['config','--get','remote.origin.url']).toString().trim())
   &&git(['rev-parse','HEAD']).toString().trim()===o.sourceSha,'QA_READER_SOURCE_INVALID')
  const graph=git(['ls-tree','-r','--name-only',o.sourceSha,contracts]).toString().trim().split('\n').filter(p=>p.endsWith('.mjs'))
  require(graph.length>0&&graph.length<=64&&graph.includes(contracts+'/quality.mjs'),'QA_READER_SOURCE_INVALID')
  for(const relative of [host,'apps/sg-runtime/package.json',...graph]){
   require(relative===host||relative==='apps/sg-runtime/package.json'||relative.startsWith(contracts+'/')
    &&/^[a-zA-Z0-9_./-]+$/.test(relative)&&!relative.split('/').some(p=>p==='.'||p==='..'),'QA_READER_SOURCE_INVALID')
   const file=path.join(o.repositoryRoot,relative),bytes=git(['show',o.sourceSha+':'+relative])
   require(fs.realpathSync(file)===file&&fs.lstatSync(file).isFile()&&fs.readFileSync(file).equals(bytes),'QA_READER_SOURCE_INVALID')
   if(relative===host)require(hash(bytes)===o.hostCodecSha256,'QA_READER_SOURCE_INVALID')
  }
  // Native Node24 strips type-only imports; this loads only the trusted SG2
  // codec, never any generated source. The whole neutral import graph is pinned.
  module=await import(pathToFileURL(path.join(o.repositoryRoot,host)).href+'?aqc_source='+o.sourceSha+'&codec='+o.hostCodecSha256)
  require(typeof module.createQualityEvidencePurposeClient==='function'&&typeof module.createQualityEvidenceStore==='function','QA_READER_SOURCE_INVALID')
 }catch{fail('QA_READER_SOURCE_UNAVAILABLE')}
 const purpose=module.createQualityEvidencePurposeClient({query:o.purposeQuery,commandKey:o.purposeKey,schemaDigest:o.purposeSchemaDigest,
  serviceId:o.serviceId,storageGeneration:o.storageGeneration,role:'sg2_assistant_quality_authority',now})
 const evidence=module.createQualityEvidenceStore({query:o.evidenceQuery,commandKey:o.evidenceKey,storageKey:o.storageKey,
  schemaDigest:o.evidenceSchemaDigest,serviceId:o.serviceId,storageGeneration:o.storageGeneration,role:'sg2_assistant_quality_reader',
  authorize:demand=>purpose.authorize(demand),now})
 return Object.freeze({
  async ready(){
   const [a,b]=await Promise.all([purpose.descriptor(),evidence.descriptor()])
   require(a.enabled===false&&b.enabled===false,'QA_READER_READINESS_STATE_INVALID')
   return Object.freeze({schemaVersion:'AQC_PRIVATE_READER_READINESS_V1',sourceSha:o.sourceSha,hostCodecSha256:o.hostCodecSha256,
    purposeAuthority:'CONNECTED_DISABLED',evidenceStore:'CONNECTED_DISABLED'})
  },
  async read(evidenceId){
   require(uuid(evidenceId),'QA_READER_INPUT_INVALID')
   // SG2's canonical reader performs current native authority checks both
   // before decryption and after validating the exact original input/scopes.
   // This private value never enters an executor, public proof or telemetry.
   try{return await evidence.read(o.accountId,evidenceId)}catch{fail('QA_READER_UNAVAILABLE')}
  },
 })
}


const isolatedVerificationResults=new WeakMap()
const verificationFields=Object.freeze(['result','baseSha','artifactSha256','baseTest','candidateTest','holdoutCases','classCounts',
 'criticalRegressions','accessViolations','unverifiableCases','criticalCasesPass','criticalRepeats','stable','correctnessDeltaPp',
 'unjustifiedRefusalDeltaPp','holdoutSha256','rubricVersion','scopeBeforeDefects','scopeAfterDefects','beforeSourceSha256',
 'afterSourceSha256','regressionSha256','observationsSha256','proofSha256'])
function verificationMetadata(value,manifest,at){
 const m=assertVerifiedRepairManifest(manifest);exact(value,verificationFields)
 require(['PASS','FAIL'].includes(value.result)&&value.baseSha===m.baseSha
  &&['PASS','FAIL','UNKNOWN'].includes(value.baseTest)&&['PASS','FAIL'].includes(value.candidateTest)
  &&['artifactSha256','holdoutSha256','beforeSourceSha256','afterSourceSha256','regressionSha256','observationsSha256','proofSha256'].every(k=>digest(value[k]))
  &&code(value.rubricVersion)&&['criticalCasesPass','stable'].every(k=>typeof value[k]==='boolean'),'VERIFICATION_RECEIPT_INVALID')
 exact(value.classCounts,['C1','C2','C3'])
 require(Object.values(value.classCounts).every(v=>integer(v)&&v<=512)
  &&['holdoutCases','criticalRegressions','accessViolations','unverifiableCases','criticalRepeats','scopeBeforeDefects','scopeAfterDefects'].every(k=>integer(value[k])&&value[k]<=512)
  &&['correctnessDeltaPp','unjustifiedRefusalDeltaPp'].every(k=>Number.isFinite(value[k])&&Math.abs(value[k])<=100),'VERIFICATION_RECEIPT_INVALID')
 const {proofSha256,...body}=value
 require(documentDigest(body)===proofSha256,'VERIFICATION_RECEIPT_DIGEST_INVALID')
 // Reuse the controller's authoritative complete VERIFY transition; a signed
 // PASS does not replace any holdout, critical, stability or access threshold.
 advanceIncident({status:'PATCH_READY',attemptsUsed:1,repairClass:m.repairClass,baseSha:m.baseSha,
  patch:{artifactSha256:value.artifactSha256},pending:{action:'VERIFY'}},'VERIFY',value,at)
 return value
}
/** Only this closed composition produces an attestable result. Neither an
 * agent TAP report nor verifyCandidate with a caller execution callback gets
 * this capability. Reference labels stay in the trusted parent process. */
export async function verifyQualityCandidateInIsolation(options){
 const fields=['manifest','repositoryRoot','artifact','cicArchive','pack','packAttestation','reviewerKeys','qualification','qualificationKeys','observedGateSetSha256','nonce']
 exact(options,Object.hasOwn(options??{},'signal')?[...fields,'signal']:fields)
 const o=Object.freeze({...options}),m=assertVerifiedRepairManifest(o.manifest)
 require(typeof o.nonce==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(o.nonce)
  &&o.reviewerKeys instanceof Map&&o.qualificationKeys instanceof Map,'VERIFICATION_JOB_BINDING_INVALID')
 const {assertExecutorHost}=await import('./executor.mjs'),binding=assertExecutorHost()
 const reference=verifyDocument(o.packAttestation,{kind:'AQC_REFERENCE_PACK_V1',trustedKeys:new Map(o.reviewerKeys)})
 documentDigest(o.pack)
 // A stable private snapshot cannot be relabelled while children are running.
 const pack=structuredClone(o.pack),freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};freeze(pack)
 const began=Date.now(),until=Math.min(Date.parse(m.mandate.expiresAt),Date.parse(reference.expiresAt),began+30*60000)
 require(Number.isFinite(until)&&until>began,'VERIFICATION_AUTHORITY_EXPIRED')
 const bundle=await prepareQualityVerificationBundle({manifest:m,repositoryRoot:o.repositoryRoot,artifact:o.artifact,cicArchive:o.cicArchive})
 const runner=await createQualityIsolatedCaseRunner({bundle,qualification:o.qualification,qualificationKeys:new Map(o.qualificationKeys),
  observedGateSetSha256:o.observedGateSetSha256,signal:o.signal})
 const test=o.artifact.body.files.find(f=>f.path!==SOURCE_PATHS[m.repairClass])
 const result=await verifyCandidate({manifest:m,beforeSource:bundle.files['base/'+bundle.primary+'.ts'],afterSource:bundle.files['candidate/'+bundle.primary+'.ts'],
  regressionSource:test.content,pack,packAttestation:o.packAttestation,reviewerKeys:new Map(o.reviewerKeys),gateSetSha256:o.observedGateSetSha256,
  runCase:runner.runCase,artifactSha256:o.artifact.artifactSha256,now:began})
 const at=Date.now();require(at<until,'VERIFICATION_AUTHORITY_EXPIRED');verificationMetadata(result,m,at)
 const value=Object.freeze({...result,classCounts:Object.freeze({...result.classCounts})})
 isolatedVerificationResults.set(value,Object.freeze({manifest:m,nonce:o.nonce,controlSourceSha:binding.executorSourceSha,runId:binding.runId,
  observedAt:new Date(at).toISOString(),expiresAt:new Date(until).toISOString()}))
 return value
}
/** The independent verifier's private key never enters the executor or publisher.
 * The signer accepts only a capability minted after actual isolated execution. */
export function createQualityVerificationAttestor(options){
 exact(options,['privateKey'])
 const privateKey=options.privateKey
 require(privateKey?.type==='private'&&privateKey.asymmetricKeyType==='ed25519','VERIFICATION_SIGNER_REQUIRED')
 return Object.freeze({attest(value){
  const c=isolatedVerificationResults.get(value);require(c,'REAL_ISOLATED_VERIFICATION_REQUIRED')
  const m=c.manifest,at=Date.now()
  require(at<Date.parse(c.expiresAt)&&at<Date.parse(m.mandate.expiresAt),'VERIFICATION_AUTHORITY_EXPIRED')
  verificationMetadata(value,m,at)
  return signDocument('AQC_VERIFICATION_RESULT_V1',{schemaVersion:'AQC_VERIFICATION_RESULT_V1',applicationId:'spendguru',environment:'development',
   repository:'profitia/SG-dev',incidentId:m.incidentId,repairClass:m.repairClass,baseSha:m.baseSha,manifestSha256:documentDigest(m),gateSetSha256:m.gateSetSha256,
   artifactSha256:value.artifactSha256,verification:value,nonce:c.nonce,controlSourceSha:c.controlSourceSha,runId:c.runId,runAttempt:1,
   observedAt:c.observedAt,expiresAt:c.expiresAt,rawQaPayloadIncluded:false},privateKey)
 }})
}
export function readQualityVerificationResult(document,{keys,manifest,nonce,controlSourceSha,runId,notBefore,now=Date.now()}){
 const m=assertVerifiedRepairManifest(manifest),b=verifyDocument(document,{kind:'AQC_VERIFICATION_RESULT_V1',trustedKeys:keys})
 exact(b,['schemaVersion','applicationId','environment','repository','incidentId','repairClass','baseSha','manifestSha256','gateSetSha256','artifactSha256',
  'verification','nonce','controlSourceSha','runId','runAttempt','observedAt','expiresAt','rawQaPayloadIncluded'])
 require(b.schemaVersion==='AQC_VERIFICATION_RESULT_V1'&&b.applicationId==='spendguru'&&b.environment==='development'&&b.repository==='profitia/SG-dev'
  &&b.incidentId===m.incidentId&&b.repairClass===m.repairClass&&b.baseSha===m.baseSha&&b.manifestSha256===documentDigest(m)&&b.gateSetSha256===m.gateSetSha256
  &&typeof nonce==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(nonce)&&b.nonce===nonce&&/^[a-f0-9]{40}$/.test(controlSourceSha??'')&&b.controlSourceSha===controlSourceSha
  &&/^[1-9][0-9]{0,19}$/.test(runId??'')&&b.runId===runId&&b.runAttempt===1&&b.rawQaPayloadIncluded===false
  &&b.artifactSha256===b.verification?.artifactSha256,'VERIFICATION_RECEIPT_BINDING_INVALID')
 require(Number.isFinite(now)&&stamp(notBefore)&&stamp(b.observedAt)&&stamp(b.expiresAt)
  &&Date.parse(b.observedAt)>=Date.parse(notBefore)&&Date.parse(b.observedAt)<=now&&Date.parse(b.expiresAt)>now
  &&Date.parse(b.expiresAt)<=Date.parse(b.observedAt)+30*60000&&Date.parse(b.expiresAt)<=Date.parse(m.mandate.expiresAt),'VERIFICATION_RECEIPT_STALE')
 return verificationMetadata(b.verification,m,now)
}
