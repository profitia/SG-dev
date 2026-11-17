import {createHash,createPublicKey,sign,verify} from 'node:crypto'
import {readRepairManifest} from '../../assistant-context-contracts/src/quality.mjs'

export const SOURCE_PATHS=Object.freeze({
 C1:'apps/sg-runtime/lib/assistant/calendar-period.ts',
 C2:'apps/sg-runtime/lib/assistant/quality-response.ts',
 C3:'apps/sg-runtime/lib/assistant/quality-response.ts',
})
const deny=code=>{throw Object.assign(Error('Quality authority unavailable'),{code})}
const require=(ok,code='AUTHORITY_INVALID')=>{if(!ok)deny(code)}
const object=v=>v!==null&&Object.getPrototypeOf(v)===Object.prototype
function exact(v,keys){require(object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k))&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&'value'in Object.getOwnPropertyDescriptor(v,k)))}
function canonical(v,depth=0){
 require(depth<=20)
 if(v===null||typeof v==='boolean'||typeof v==='string')return JSON.stringify(v)
 if(typeof v==='number'){require(Number.isFinite(v));return JSON.stringify(v)}
 if(Array.isArray(v)){
  require(v.length<=512&&Reflect.ownKeys(v).length===v.length+1)
  return '['+Array.from({length:v.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(v,String(i));require(d&&'value'in d);return canonical(d.value,depth+1)}).join(',')+']'
 }
 require(object(v)&&Reflect.ownKeys(v).length<=64)
 const keys=Reflect.ownKeys(v);require(keys.every(k=>typeof k==='string'&&!['__proto__','prototype','constructor'].includes(k)&&'value'in Object.getOwnPropertyDescriptor(v,k)))
 return '{'+keys.sort().map(k=>JSON.stringify(k)+':'+canonical(v[k],depth+1)).join(',')+'}'
}
export const documentDigest=v=>createHash('sha256').update(canonical(v)).digest('hex')
const publicKey=key=>key?.type==='public'?key:createPublicKey(key)
export const publicKeyId=key=>createHash('sha256').update(publicKey(key).export({format:'der',type:'spki'})).digest('hex')
const signatureBytes=(kind,body)=>Buffer.from('SpendGuru-AQC/1\n'+kind+'\n'+canonical(body),'utf8')
const stamp=v=>{require(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v));const n=Date.parse(v);require(Number.isFinite(n)&&new Date(n).toISOString()===v);return n}
const sha=(v,n=64)=>require(typeof v==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(v))
const uuid=v=>require(typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v))
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
const admittedManifests=new WeakSet()
export function assertVerifiedRepairManifest(value){require(admittedManifests.has(value),'VERIFIED_MANIFEST_REQUIRED');return value}

/** Called only by an admitted operator/controller/verifier, with its own key.
 * Repair workers never receive any signing key or a signing endpoint. */
export function signDocument(kind,body,privateKey){
 require(typeof kind==='string'&&/^AQC_[A-Z0-9_]+_V1$/.test(kind));require(privateKey?.type==='private'&&privateKey.asymmetricKeyType==='ed25519')
 const payload=structuredClone(JSON.parse(canonical(body)))
 return freeze({kind,body:payload,attestation:{keyId:publicKeyId(privateKey),signature:sign(null,signatureBytes(kind,payload),privateKey).toString('base64url')}})
}

/** Trust comes from the installed role-specific key map, never a key embedded
 * in an artifact, a PR, a conversation, or a model's statement. */
export function verifyDocument(value,{kind,trustedKeys}={}){
 exact(value,['kind','body','attestation']);require(value.kind===kind&&trustedKeys instanceof Map&&trustedKeys.size>0,'SIGNER_UNAVAILABLE')
 exact(value.attestation,['keyId','signature']);sha(value.attestation.keyId)
 require(typeof value.attestation.signature==='string'&&/^[A-Za-z0-9_-]{86}$/.test(value.attestation.signature),'SIGNATURE_INVALID')
 const configured=trustedKeys.get(value.attestation.keyId);require(configured,'SIGNER_UNKNOWN')
 const key=publicKey(configured);require(key.asymmetricKeyType==='ed25519'&&publicKeyId(key)===value.attestation.keyId,'SIGNER_INVALID')
 require(signatureBytes(kind,value.body).length<=32768,'DOCUMENT_TOO_LARGE')
 require(verify(null,signatureBytes(kind,value.body),key,Buffer.from(value.attestation.signature,'base64url')),'SIGNATURE_INVALID')
 return freeze(JSON.parse(canonical(value.body)))
}

export function verifyExecutionMandate(value,{ownerKeys,now,expectedServiceId,expectedGateSetSha256}={}){
 require(Number.isFinite(now));sha(expectedGateSetSha256);require(typeof expectedServiceId==='string'&&/^srv-[a-z0-9-]+$/.test(expectedServiceId))
 const b=verifyDocument(value,{kind:'AQC_EXECUTION_MANDATE_V1',trustedKeys:ownerKeys})
 exact(b,['id','version','applicationId','environment','stage','issuedAt','expiresAt','projectKey','repository','targetServiceId','classes','sourcePaths','gateSetSha256','controlledFixtureOnly','maxActiveExecutorsPerRepository','maxNewRepairReleasesPer24h','maxAttempts','maxAttemptSeconds','maxIncidentMicroUsd','maxPilotMicroUsd','maxPilotDays','minimumHoldoutCases','criticalRegressionsAllowed','maxPatchBytes','maxChangedLines'])
 uuid(b.id);require(b.version==='1.0.0'&&b.applicationId==='spendguru'&&b.environment==='development'&&b.stage==='E1','MANDATE_SCOPE_REJECTED')
 require(stamp(b.issuedAt)<=now&&stamp(b.expiresAt)>now,'MANDATE_EXPIRED')
 require(b.projectKey==='SG2'&&b.repository==='profitia/SG-dev'&&b.targetServiceId===expectedServiceId,'MANDATE_SCOPE_REJECTED')
 require(canonical(b.classes)===canonical(['C1','C2','C3'])&&canonical(b.sourcePaths)===canonical(SOURCE_PATHS),'MANDATE_PATHS_REJECTED')
 require(b.gateSetSha256===expectedGateSetSha256&&b.controlledFixtureOnly===true,'MANDATE_POLICY_REJECTED')
 require(b.maxActiveExecutorsPerRepository===1&&b.maxNewRepairReleasesPer24h===1&&b.maxAttempts===2&&b.maxAttemptSeconds===1800
  &&b.maxIncidentMicroUsd===5000000&&b.maxPilotMicroUsd===50000000&&b.maxPilotDays===14
  &&b.minimumHoldoutCases===200&&b.criticalRegressionsAllowed===0&&b.maxPatchBytes===32768&&b.maxChangedLines===300,'MANDATE_BOUNDS_REJECTED')
 return b
}

export function verifyBoundManifest(value,{mandate,fixtureExport,ownerKeys,verifierKeys,now,expectedBaseSha,expectedServiceId,expectedGateSetSha256}={}){
 sha(expectedBaseSha,40)
 const m=readRepairManifest(value,{now})
 const b=verifyExecutionMandate(mandate,{ownerKeys,now,expectedServiceId,expectedGateSetSha256})
 require(m.projectKey===b.projectKey&&m.repository===b.repository&&m.baseSha===expectedBaseSha&&b.classes.includes(m.repairClass),'MANIFEST_BASE_OR_SCOPE_CHANGED')
 require(m.mandate.id===b.id&&m.mandate.version===b.version&&m.mandate.sha256===documentDigest(b)
  &&m.mandate.issuedAt===b.issuedAt&&m.mandate.expiresAt===b.expiresAt&&canonical(m.mandate.attestation)===canonical(mandate.attestation),'MANIFEST_MANDATE_MISMATCH')
 require(m.gateSetSha256===b.gateSetSha256,'GATE_POLICY_CHANGED')
 const paths=[SOURCE_PATHS[m.repairClass],`apps/sg-runtime/tests/assistant-quality-regressions/${m.incidentId}.test.ts`]
 require(canonical([...m.allowedPaths].sort())===canonical(paths.sort()),'MANIFEST_PATHS_REJECTED')
 const f=verifyDocument(fixtureExport,{kind:'AQC_SYNTHETIC_EXPORT_V1',trustedKeys:verifierKeys})
 exact(f,['id','fixtureId','sha256','scope','incidentId','repairClass','issuedAt','expiresAt','rawQaPayloadIncluded'])
 require(f.id===m.synthetic.exportReceiptId&&f.fixtureId===m.synthetic.fixtureId&&f.sha256===m.synthetic.sha256
  &&f.scope==='CONTROLLED_ACCEPTANCE'&&f.incidentId===m.incidentId&&f.repairClass===m.repairClass&&f.rawQaPayloadIncluded===false,'SYNTHETIC_EXPORT_MISMATCH')
 require(stamp(f.issuedAt)<=now&&stamp(f.expiresAt)>now,'SYNTHETIC_EXPORT_EXPIRED')
 admittedManifests.add(m);return m
}
