import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {randomUUID,generateKeyPairSync,createHash} from 'node:crypto'
import {EXECUTOR_TOOL,executorPlan,readPrivilegeState,verifyLinuxQualification,collectRepairArtifact,assertExecutorHost,assertCodeModeHostArchive,assertBwrapArchive,prepareExecutorTools} from '../src/executor.mjs'
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
 assert(text.includes('default_permissions="aqc-workspace"'));assert(text.includes('permissions.aqc-workspace.extends=":workspace"'))
 assert(text.includes('permissions.aqc-workspace.filesystem={":root" = "deny", ":minimal" = "read", ":tmpdir" = "deny", ":slash_tmp" = "deny", "/opt/aqc-tools/codex" = "read", "/opt/aqc-tools/codex-code-mode-host" = "read", "/opt/aqc-tools/codex-resources/bwrap" = "read"}'))
 assert(!text.includes('filesystem.":'));assert(text.includes('permissions.aqc-workspace.network.enabled=false'))
 assert(text.includes('request_max_retries=0'));assert(text.includes('stream_max_retries=0'))
 assert(text.includes('features.multi_agent=false'));assert(text.includes('features.enable_request_compression=false'))
 assert(text.includes('features.code_mode=true'));assert(text.includes('features.code_mode_only=true'))
 assert(text.includes('features.incremental_tools=false'))
 assert(p.privilegeArguments.includes('--no-new-privs'));assert(p.privilegeArguments.includes('--clear-groups'));assert(p.privilegeArguments.includes('--bounding-set=-all'))
 assert.deepEqual(Object.keys(p.environment).sort(),['AQC_AGENT_TOKEN','LANG','PATH','TZ']);assert(!Object.hasOwn(p.environment,'OPENAI_API_KEY'))
 for(const brokerUrl of ['https://api.openai.com/v1','http://localhost:1234/v1','http://127.0.0.1:1234/v1?route=other'])assert.throws(()=>executorPlan({work:'/tmp/aqc-'+randomUUID()+'/work',toolPath:'/opt/aqc-tools/codex',uid:19999,gid:19999,brokerUrl,agentToken:'c'.repeat(64)}))
})
test('Privilege check requires empty capabilities/no_new_privs; host entry rejects missing trusted workflow identity',()=>{
 const status='Groups:\t\nCapInh:\t00000000\nCapPrm:\t00000000\nCapEff:\t00000000\nCapBnd:\t00000000\nCapAmb:\t00000000\nNoNewPrivs:\t1\n'
 const inspect=(value,groups=[19999],gid=19999,uid=19999)=>readPrivilegeState(value,uid,groups,gid)
 assert.equal(inspect(status).safe,true)
 assert.equal(inspect(status.replace('CapBnd:\t00000000','CapBnd:\t00000001')).safe,false)
 assert.equal(inspect(status.replace('NoNewPrivs:\t1','NoNewPrivs:\t0')).safe,false)
 assert.equal(inspect(status.replace('Groups:\t','Groups:\t27 ')).safe,false)
 assert.equal(inspect(status.replace('Groups:\t\n','')).safe,false)
 assert.equal(inspect(status,[19999,27]).safe,false)
 assert.equal(inspect(status,[]).safe,false)
 assert.equal(inspect(status,[0],0).safe,false)
 assert.equal(inspect(status,[19999],19999,0).safe,false)
 assert.throws(()=>assertExecutorHost({}),{code:process.platform==='linux'&&process.getuid?.()===0?'TRUSTED_EPHEMERAL_WORKFLOW_REQUIRED':'LINUX_ROOT_REQUIRED'})
})
test('Paid execution requires signed actual Linux qualification bound to exact tool and policy',()=>{
 const body={gateSetSha256:gate,codexVersion:EXECUTOR_TOOL.version,codexArchiveSha256:EXECUTOR_TOOL.archiveSha256,codexBinarySha256:'f'.repeat(64),codeModeHostArchiveSha256:EXECUTOR_TOOL.codeModeHostArchiveSha256,codeModeHostBinarySha256:EXECUTOR_TOOL.codeModeHostBinarySha256,bwrapArchiveSha256:EXECUTOR_TOOL.bwrapArchiveSha256,bwrapBinarySha256:EXECUTOR_TOOL.bwrapBinarySha256,isolationHelperCommit:EXECUTOR_TOOL.isolationHelperCommit,
  fileIsolation:'PASS',networkIsolation:'PASS',privilegeIsolation:'PASS',toolLoop:'PASS',cancellation:'PASS',noProviderRequests:true,runId:'123',sourceSha:'b'.repeat(40),verifiedAt:stamp(now-1000),expiresAt:stamp(now+3600000)}
 assert.equal(verifyLinuxQualification(signDocument('AQC_LINUX_QUALIFICATION_V1',body,key.privateKey),{keys,gateSetSha256:gate,now}).toolLoop,'PASS')
 for(const change of [{toolLoop:'NOT_TESTED'},{networkIsolation:'FAIL'},{noProviderRequests:false},{codexVersion:'floating'},{codeModeHostBinarySha256:'0'.repeat(64)},{bwrapArchiveSha256:'0'.repeat(64)},{bwrapBinarySha256:'0'.repeat(64)},{gateSetSha256:'e'.repeat(64)},{expiresAt:stamp(now-1)}])assert.throws(()=>verifyLinuxQualification(signDocument('AQC_LINUX_QUALIFICATION_V1',{...body,...change},key.privateKey),{keys,gateSetSha256:gate,now}))
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

test('Standalone Code Mode host is pinned and cannot be prepared by an untrusted local host',async()=>{
 assert.match(EXECUTOR_TOOL.codeModeHostArchiveSha256,/^[a-f0-9]{64}$/);assert.match(EXECUTOR_TOOL.codeModeHostBinarySha256,/^[a-f0-9]{64}$/)
 assert.throws(()=>assertCodeModeHostArchive(Buffer.from('untrusted')),{code:'CODE_MODE_HOST_ARCHIVE_PIN_MISMATCH'})
 await assert.rejects(prepareExecutorTools(),{code:process.platform==='linux'&&process.getuid?.()===0?'TRUSTED_EPHEMERAL_WORKFLOW_REQUIRED':'LINUX_ROOT_REQUIRED'})
})

test('Bundled bubblewrap uses the same official CLI release and refuses missing or forged resource bytes',()=>{
 assert.equal(new URL(EXECUTOR_TOOL.bwrapArchiveUrl).hostname,'github.com');assert(EXECUTOR_TOOL.bwrapArchiveUrl.includes('/rust-v0.167.2/'))
 for(const bytes of [Buffer.alloc(0),Buffer.alloc(EXECUTOR_TOOL.bwrapArchiveBytes),Buffer.alloc(EXECUTOR_TOOL.bwrapArchiveBytes+1)])assert.throws(()=>assertBwrapArchive(bytes),{code:'BWRAP_ARCHIVE_PIN_MISMATCH'})
})
