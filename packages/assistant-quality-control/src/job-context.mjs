// Pure signed-context construction only; no CLI startup, environment or provider access.
import {SOURCE_PATHS,documentDigest} from './manifest.mjs'
const unavailable=code=>{throw Object.assign(Error('Quality readiness unavailable'),{code})}
const uuidValue=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)

export function repairManifestBody({mandate,incidentId,correlationId,baseSha,repairClass,exportReceiptId,fixtureSha256}){
 const b=mandate.body
 return {schemaVersion:'REPAIR_MANIFEST_V1',incidentId,repairClass,projectKey:'SG2',repository:'profitia/SG-dev',baseSha,
  allowedPaths:[SOURCE_PATHS[repairClass],`apps/sg-runtime/tests/assistant-quality-regressions/${incidentId}.test.ts`],
  mandate:{id:b.id,version:b.version,sha256:documentDigest(b),issuedAt:b.issuedAt,expiresAt:b.expiresAt,attestation:mandate.attestation},gateSetSha256:b.gateSetSha256,
  synthetic:{fixtureId:'qa_synthetic_'+fixtureSha256,sha256:fixtureSha256,exportReceiptId},limits:{maxAttempts:2,maxAttemptSeconds:1800,maxIncidentMicroUsd:5000000},correlationId}
}


/** Reconstructs the same metadata-only manifest at both trusted endpoints from
 * an installed owner mandate and three independently exported synthetic cases.
 * This pure preparer grants no data access, creates no signer or ledger, and is
 * not called by readiness/standby. Private QA and the holdout are not inputs. */
export async function prepareQualityControllerJobContext({registry,incidentId,baseSha,ownerKeys,verifierKeys,
 expectedServiceId,expectedGateSetSha256,now=Date.now()}){
 const {verifyExecutionMandate,verifyBoundManifest,verifyDocument}=await import('./manifest.mjs')
 const {readRegression}=await import('./verify.mjs')
 const invalid=()=>unavailable('JOB_CONTEXT_INVALID')
 if(!uuidValue(incidentId)||typeof baseSha!=='string'||!/^[a-f0-9]{40}$/.test(baseSha)||!Number.isFinite(now))invalid()
 let value
 try{
  if(typeof registry==='string'){
   if(Buffer.byteLength(registry)>65536)invalid()
   value=JSON.parse(registry)
  }else value=registry
  documentDigest(value)
  if(Buffer.byteLength(JSON.stringify(value))>65536)invalid()
  value=structuredClone(value)
 }catch{invalid()}
 const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===[...keys].sort().join(',')
 if(!exact(value,['schemaVersion','repository','environment','mandate','fixtures'])
  ||value.schemaVersion!=='AQC_CONTROLLED_JOB_CONTEXTS_V1'||value.repository!=='profitia/SG-dev'||value.environment!=='development'
  ||!Array.isArray(value.fixtures)||value.fixtures.length!==3)invalid()
 if(!(ownerKeys instanceof Map)||!(verifierKeys instanceof Map)||ownerKeys.size===0||verifierKeys.size===0
  ||[...ownerKeys.keys()].some(id=>verifierKeys.has(id)))unavailable('JOB_CONTEXT_SEPARATE_TRUST_REQUIRED')
 const mandate=verifyExecutionMandate(value.mandate,{ownerKeys,now,expectedServiceId,expectedGateSetSha256})
 const classes=new Set(),incidents=new Set(),locales=new Set(),fixtures=new Set()
 let selected
 for(const item of value.fixtures){
  if(!exact(item,['fixtureExport','regression']))invalid()
  const exported=verifyDocument(item.fixtureExport,{kind:'AQC_SYNTHETIC_EXPORT_V1',trustedKeys:verifierKeys})
  const regression=readRegression(item.regression),fixtureSha256=documentDigest(regression)
  if(exported.repairClass!==regression.repairClass||exported.sha256!==fixtureSha256
   ||exported.fixtureId!=='qa_synthetic_'+fixtureSha256||exported.rawQaPayloadIncluded!==false
   ||!uuidValue(exported.incidentId)||incidents.has(exported.incidentId)||classes.has(regression.repairClass)||fixtures.has(fixtureSha256)
   ||Date.parse(exported.issuedAt)<Date.parse(mandate.issuedAt)||Date.parse(exported.expiresAt)>Date.parse(mandate.expiresAt))invalid()
  const manifest=verifyBoundManifest(repairManifestBody({mandate:value.mandate,incidentId:exported.incidentId,
   correlationId:exported.incidentId,baseSha,repairClass:regression.repairClass,exportReceiptId:exported.id,fixtureSha256}),
   {mandate:value.mandate,fixtureExport:item.fixtureExport,ownerKeys,verifierKeys,now,expectedBaseSha:baseSha,
    expectedServiceId,expectedGateSetSha256})
  classes.add(regression.repairClass);incidents.add(exported.incidentId);fixtures.add(fixtureSha256);locales.add(regression.locale)
  if(exported.incidentId===incidentId)selected={manifest,regression}
 }
 if(classes.size!==3||locales.size!==2||!selected)invalid()
 const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
 return freeze(selected)
}

/** The native workflow declares ten fields. GitHub may include declared unused
 * defaults as empty strings. Only those exact empty fields are discarded; an
 * unknown name, getter or nonempty unused permit is never ignored. */
export function normalizeQualityControllerJobInputs(value){
 const bad=()=>unavailable('JOB_CONTEXT_INPUT_INVALID')
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.getOwnPropertySymbols(value).length)bad()
 const common=['mode','action','nonce','control_source_sha','incident_id','manifest_sha256','base_sha']
 const allowed=[...common,'state','permit_id','permit_expires_at'],descriptors=Object.getOwnPropertyDescriptors(value)
 if(Object.keys(descriptors).length>10)bad()
 for(const [key,d]of Object.entries(descriptors)){
  if(!allowed.includes(key)||!d.enumerable||!Object.hasOwn(d,'value')||typeof d.value!=='string'
   ||Buffer.byteLength(d.value)>(key==='state'?16384:256))bad()
 }
 const inputs={...value}
 if(inputs.mode!=='controller-job'||!['QUALIFY','REPRODUCE','EXECUTE','VERIFY','PROPOSE','CHECKS','PROMOTE','VERIFY_RUNTIME','OBSERVE','ROLLBACK'].includes(inputs.action))bad()
 for(const key of ['permit_id','permit_expires_at'])if(inputs.action!=='EXECUTE'&&Object.hasOwn(inputs,key)){
  if(inputs[key]!=='')bad();delete inputs[key]
 }
 if(inputs.state==='')delete inputs.state
 const expected=[...common,...(inputs.action==='EXECUTE'?['permit_id','permit_expires_at']:[]),...(Object.hasOwn(inputs,'state')?['state']:[])].sort().join(',')
 if(Object.keys(inputs).sort().join(',')!==expected||Object.values(inputs).some(v=>!v))bad()
 return Object.freeze(inputs)
}
