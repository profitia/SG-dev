import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {randomUUID,generateKeyPairSync,createHash} from 'node:crypto'
import {EXECUTOR_TOOL,executorPlan,readPrivilegeState,verifyLinuxQualification,collectRepairArtifact,assertExecutorHost} from '../src/executor.mjs'
import {signDocument,publicKeyId,documentDigest,verifyBoundManifest,SOURCE_PATHS} from '../src/manifest.mjs'
import {ownerMandateBody,repairManifestBody} from '../src/cli.mjs'
import {serializeRegression} from '../src/verify.mjs'

const key=generateKeyPairSync('ed25519'),keys=new Map([[publicKeyId(key.publicKey),key.publicKey]]),gate='a'.repeat(64),now=Date.now(),stamp=n=>new Date(n).toISOString()
function fixture(){
 const regression={schemaVersion:'AQC_REGRESSION_V1',repairClass:'C1',caseFamily:'synthetic_local_only',locale:'pl',args:[1],expected:2,expectedAnswer:true,refusal:{pointer:'',values:[null]}}
 const mandate=signDocument('AQC_EXECUTION_MANDATE_V1',ownerMandateBody({id:randomUUID(),issuedAt:stamp(now-1000),expiresAt:stamp(now+3600000),targetServiceId:'srv-fixture',gateSetSha256:gate}),key.privateKey)
 const m=repairManifestBody({mandate,incidentId:randomUUID(),correlationId:randomUUID(),baseSha:'b'.repeat(40),repairClass:'C1',exportReceiptId:randomUUID(),fixtureSha256:documentDigest(regression)})
 const e=signDocument('AQC_SYNTHETIC_EXPORT_V1',{id:m.synthetic.exportReceiptId,fixtureId:m.synthetic.fixtureId,sha256:m.synthetic.sha256,scope:'CONTROLLED_ACCEPTANCE',incidentId:m.incidentId,repairClass:'C1',issuedAt:stamp(now-1000),expiresAt:stamp(now+3600000),rawQaPayloadIncluded:false},key.privateKey)
 const manifest=verifyBoundManifest(m,{mandate,fixtureExport:e,ownerKeys:keys,verifierKeys:keys,now,expectedBaseSha:m.baseSha,expectedServiceId:'srv-fixture',expectedGateSetSha256:gate})
 return {manifest,regression}
}
test('Executor plan uses only the local broker, no retries, cleared identity and built-in command permission profile',()=>{
 const p=executorPlan({work:'/tmp/aqc-'+randomUUID()+'/work',toolPath:'/opt/aqc-tools/codex',uid:19999,gid:19999,brokerUrl:'http://127.0.0.1:1234/v1',agentToken:'c'.repeat(64)})
 const text=p.args.join(' ')
 assert(text.includes('default_permissions=":workspace"'));assert(text.includes('request_max_retries=0'));assert(text.includes('stream_max_retries=0'))
 assert(text.includes('features.multi_agent=false'));assert(text.includes('features.enable_request_compression=false'))
 assert(p.privilegeArguments.includes('--no-new-privs'));assert(p.privilegeArguments.includes('--clear-groups'));assert(p.privilegeArguments.includes('--bounding-set=-all'))
 assert.deepEqual(Object.keys(p.environment).sort(),['AQC_AGENT_TOKEN','LANG','PATH','TZ']);assert(!Object.hasOwn(p.environment,'OPENAI_API_KEY'))
 for(const brokerUrl of ['https://api.openai.com/v1','http://localhost:1234/v1','http://127.0.0.1:1234/v1?route=other'])assert.throws(()=>executorPlan({work:'/tmp/aqc-'+randomUUID()+'/work',toolPath:'/opt/aqc-tools/codex',uid:19999,gid:19999,brokerUrl,agentToken:'c'.repeat(64)}))
})
test('Privilege check requires empty capabilities/no_new_privs; host entry rejects missing trusted workflow identity',()=>{
 const status='CapInh:\t00000000\nCapPrm:\t00000000\nCapEff:\t00000000\nCapBnd:\t00000000\nCapAmb:\t00000000\nNoNewPrivs:\t1\n'
 assert.equal(readPrivilegeState(status,19999,[]).safe,true)
 assert.equal(readPrivilegeState(status.replace('CapBnd:\t00000000','CapBnd:\t00000001'),19999,[]).safe,false)
 assert.equal(readPrivilegeState(status.replace('NoNewPrivs:\t1','NoNewPrivs:\t0'),19999,[]).safe,false)
 assert.throws(()=>assertExecutorHost({}),{code:process.platform==='linux'&&process.getuid?.()===0?'TRUSTED_EPHEMERAL_WORKFLOW_REQUIRED':'LINUX_ROOT_REQUIRED'})
})
test('Paid execution requires signed actual Linux qualification bound to exact tool and policy',()=>{
 const body={gateSetSha256:gate,codexVersion:EXECUTOR_TOOL.version,codexArchiveSha256:EXECUTOR_TOOL.archiveSha256,codexBinarySha256:'f'.repeat(64),isolationHelperCommit:EXECUTOR_TOOL.isolationHelperCommit,
  fileIsolation:'PASS',networkIsolation:'PASS',privilegeIsolation:'PASS',toolLoop:'PASS',cancellation:'PASS',noProviderRequests:true,runId:'123',sourceSha:'b'.repeat(40),verifiedAt:stamp(now-1000),expiresAt:stamp(now+3600000)}
 assert.equal(verifyLinuxQualification(signDocument('AQC_LINUX_QUALIFICATION_V1',body,key.privateKey),{keys,gateSetSha256:gate,now}).toolLoop,'PASS')
 for(const change of [{toolLoop:'NOT_TESTED'},{networkIsolation:'FAIL'},{noProviderRequests:false},{codexVersion:'floating'},{gateSetSha256:'e'.repeat(64)},{expiresAt:stamp(now-1)}])assert.throws(()=>verifyLinuxQualification(signDocument('AQC_LINUX_QUALIFICATION_V1',{...body,...change},key.privateKey),{keys,gateSetSha256:gate,now}))
})
test('Artifact collection reads actual files and rejects scope changes, links and executable regressions',()=>{
 const {manifest,regression}=fixture(),root=fs.mkdtempSync(path.join(os.tmpdir(),'aqc-artifact-fixture-')),source=SOURCE_PATHS.C1,before='export function calendarReference(x:number){return x}\n'
 const sourceFile=path.join(root,source),testPath=manifest.allowedPaths.find(p=>p!==source),testFile=path.join(root,testPath)
 const original={};original[source]={content:before,sha256:createHash('sha256').update(before).digest('hex')}
 try{
  fs.mkdirSync(path.dirname(sourceFile),{recursive:true});fs.mkdirSync(path.dirname(testFile),{recursive:true})
  fs.writeFileSync(sourceFile,before.replace('return x','return x+1'));fs.writeFileSync(testFile,serializeRegression(regression))
  const a=collectRepairArtifact({manifest,before:original,work:root,regression});assert.equal(a.body.files.length,2)
  fs.writeFileSync(path.join(root,'extra.txt'),'outside scope');assert.throws(()=>collectRepairArtifact({manifest,before:original,work:root,regression}),{code:'OUTSIDE_MANIFEST_CHANGE'});fs.unlinkSync(path.join(root,'extra.txt'))
  fs.writeFileSync(testFile,'process.exit(0)');assert.throws(()=>collectRepairArtifact({manifest,before:original,work:root,regression}));fs.unlinkSync(testFile)
  fs.symlinkSync(sourceFile,testFile);assert.throws(()=>collectRepairArtifact({manifest,before:original,work:root,regression}),{code:'WORKSPACE_LINK_REJECTED'})
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
