import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {randomUUID,generateKeyPairSync,createHash} from 'node:crypto'
import {createPublicProjection,assertPublicProjection,assertWorkflowIdentity,assertArtifactIdentity,readPatchBody} from '../src/provenance.mjs'
import {ownerMandateBody,repairManifestBody} from '../src/cli.mjs'
import {publicKeyId,signDocument,verifyBoundManifest,documentDigest,SOURCE_PATHS} from '../src/manifest.mjs'

const key=generateKeyPairSync('ed25519'),keys=new Map([[publicKeyId(key.publicKey),key.publicKey]]),gate='a'.repeat(64)
const hash=s=>createHash('sha256').update(s).digest('hex')
function authority(baseSha){
 const now=Date.now(),issuedAt=new Date(now-1000).toISOString(),expiresAt=new Date(now+3600000).toISOString()
 const mandate=signDocument('AQC_EXECUTION_MANDATE_V1',ownerMandateBody({id:randomUUID(),issuedAt,expiresAt,targetServiceId:'srv-fixture',gateSetSha256:gate}),key.privateKey)
 const m=repairManifestBody({mandate,incidentId:randomUUID(),correlationId:randomUUID(),baseSha,repairClass:'C1',exportReceiptId:randomUUID(),fixtureSha256:'f'.repeat(64)})
 const f=signDocument('AQC_SYNTHETIC_EXPORT_V1',{id:m.synthetic.exportReceiptId,fixtureId:m.synthetic.fixtureId,sha256:m.synthetic.sha256,scope:'CONTROLLED_ACCEPTANCE',incidentId:m.incidentId,repairClass:'C1',issuedAt,expiresAt,rawQaPayloadIncluded:false},key.privateKey)
 return verifyBoundManifest(m,{mandate,fixtureExport:f,ownerKeys:keys,verifierKeys:keys,now,expectedBaseSha:baseSha,expectedServiceId:'srv-fixture',expectedGateSetSha256:gate})
}
test('Public projection reads committed allowlisted blobs, never local private files or changed working-tree content',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aqc-git-fixture-'))
 const git=(...args)=>execFileSync('/usr/bin/git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 try{
  git('init','--initial-branch=main');git('config','user.name','Synthetic Local Fixture');git('config','user.email','fixture@example.invalid')
  git('remote','add','origin','https://github.com/profitia/SG-dev.git')
  const source=path.join(root,SOURCE_PATHS.C1);fs.mkdirSync(path.dirname(source),{recursive:true});fs.writeFileSync(source,'export function calendarReference(x:number){return x}\n')
  fs.writeFileSync(path.join(root,'AGENTS.md'),'Synthetic local fixture only.\n');git('add','.');git('commit','-m','synthetic fixture')
  const manifest=authority(git('rev-parse','HEAD'))
  fs.writeFileSync(path.join(root,'.env.local'),'SYNTHETIC_NOT_A_CREDENTIAL=must-not-export\n')
  fs.writeFileSync(path.join(root,'reviewer-pack.json'),'must-not-export')
  fs.writeFileSync(source,'not the committed source')
  const projection=createPublicProjection({repositoryRoot:root,manifest}),files=assertPublicProjection(projection,manifest)
  assert.equal(files[SOURCE_PATHS.C1],'export function calendarReference(x:number){return x}\n')
  assert(!JSON.stringify(files).includes('must-not-export'));assert.equal(Object.keys(files).length,2)
  assert.throws(()=>assertPublicProjection(structuredClone(projection),manifest),{code:'VERIFIED_PUBLIC_PROJECTION_REQUIRED'})
  git('remote','set-url','origin','https://example.invalid/untrusted.git')
  assert.throws(()=>createPublicProjection({repositoryRoot:root,manifest}),{code:'PUBLIC_REPOSITORY_REQUIRED'})
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
test('Workflow and artifact evidence bind repository, exact source, actor, attempt, nonce and unexpired provider digest',()=>{
 const nonce=randomUUID(),sourceSha='b'.repeat(40),runId='123'
 const run={id:123,head_sha:sourceSha,head_branch:'main',path:'.github/workflows/assistant-quality-repair.yml',event:'workflow_dispatch',run_attempt:1,
  repository:{full_name:'profitia/SG-dev'},actor:{login:'profitia'},triggering_actor:{login:'profitia'},display_title:'AQC '+nonce,status:'completed',conclusion:'success'}
 const options={runId,sourceSha,nonce,completed:true};assertWorkflowIdentity(run,options)
 for(const change of [{head_sha:'c'.repeat(40)},{head_branch:'untrusted'},{run_attempt:2},{display_title:'AQC '+randomUUID()},{conclusion:'failure'},{repository:{full_name:'other/repo'}}])assert.throws(()=>assertWorkflowIdentity({...run,...change},options))
 const name='aqc-patch-'+nonce,digest='sha256:'+'d'.repeat(64),artifact={name,digest,expired:false,size_in_bytes:12345,workflow_run:{id:123,head_sha:sourceSha}}
 assertArtifactIdentity(artifact,{runId,sourceSha,name,digest})
 for(const change of [{expired:true},{digest:'sha256:'+'e'.repeat(64)},{workflow_run:{id:124,head_sha:sourceSha}},{size_in_bytes:1048577}])assert.throws(()=>assertArtifactIdentity({...artifact,...change},{runId,sourceSha,name,digest}))
})
test('Patch receipt verifies actual file bytes, original source, exact two paths and the already verified manifest',()=>{
 const m=authority('b'.repeat(40)),beforeSource='original public source',content='changed public source'
 const body={schemaVersion:'AQC_PATCH_V1',incidentId:m.incidentId,baseSha:m.baseSha,gateSetSha256:gate,manifestSha256:documentDigest(m),files:[
  {path:SOURCE_PATHS.C1,beforeSha256:hash(beforeSource),afterSha256:hash(content),content},
  {path:m.allowedPaths[1],beforeSha256:null,afterSha256:hash('regression data'),content:'regression data'}]}
 assert.equal(readPatchBody(JSON.stringify(body),{manifest:m,beforeSource}).files.length,2)
 const tampered=structuredClone(body);tampered.files[0].content='not the same source';assert.throws(()=>readPatchBody(JSON.stringify(tampered),{manifest:m,beforeSource}),{code:'PATCH_FILE_MISMATCH'})
 const foreign=structuredClone(body);foreign.files[1].path='Canon/not-admitted.md';assert.throws(()=>readPatchBody(JSON.stringify(foreign),{manifest:m,beforeSource}),{code:'PATCH_FILE_MISMATCH'})
 assert.throws(()=>readPatchBody(JSON.stringify(body),{manifest:m,beforeSource:'wrong source'}),{code:'PATCH_BASE_MISMATCH'})
})
