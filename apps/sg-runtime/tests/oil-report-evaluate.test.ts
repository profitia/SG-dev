import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {B1_INPUT,B1_COUNTER,readBoundFile,readOperatorRelease,checkDatabaseUrl,checkCredential,prepareCounterCommand,validateCounterReceipt,runReleasedReport,sanitizeOperatorError,main,type OperatorRelease,type CounterReceipt} from '../scripts/oil-report-evaluate'
import {OIL_B1} from '../lib/insights/oil-report-source'
const hash=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex')
const privateRoot=()=>fs.mkdtempSync(path.join(os.tmpdir(),'oil-b1-operator-test-'))
const save=(root:string,name:string,body:string)=>{const file=path.join(root,name);fs.writeFileSync(file,body,{mode:0o600});return {path:file,sha256:hash(body)}}
function fixtureRelease(root:string,patch:Partial<OperatorRelease>={}){
 const f={path:path.join(root,'not-read.json'),sha256:'a'.repeat(64)}
 const release:OperatorRelease={schemaVersion:'OilB1OperatorRelease/1',status:'CONTROLLED_INSTALLATION_ACCEPTED',expiresAt:new Date(Date.now()+60000).toISOString(),
  artifact:f,request:f,d0:f,lastCase:f,marketEvidence:f,privateBindings:f,credentialSha256:'b'.repeat(64),counterReceipt:null,
  rootConfigurationVersion:'oil-b1-fixture',modelConfigurationVersion:'oil-b1-model-fixture',counterConfigurationVersion:'oil-b1-count-fixture',
  refs:{ownerInstallation:'OWNER-TEST-ONLY',controlledRelease:'OWNER-TEST-ONLY',credential:'KEY-PROOF-TEST-ONLY',counter:'COUNTER-TEST-ONLY',previousLiability:'LIABILITY-TEST-ONLY',monitoring:'MONITORING-TEST-ONLY'},
  monitoring:{ingestHost:'o1.ingest.sentry.io',projectId:'123'},...patch}
 return save(root,'release-'+Math.random().toString(16).slice(2)+'.json',JSON.stringify(release))
}
test('operator accepts only private regular exact-hash files, rejects symlinks, hardlinks, public modes and changed bytes',()=>{
 const root=privateRoot()
 try{
  const f=save(root,'private.json','{}');assert.equal(readBoundFile(f).toString(),'{}')
  assert.throws(()=>readBoundFile({...f,path:'relative'}),/REFERENCE/)
  assert.throws(()=>readBoundFile({...f,sha256:'b'.repeat(64)}),/FINGERPRINT/)
  fs.chmodSync(f.path,0o644);assert.throws(()=>readBoundFile(f),/NOT_PRIVATE/);fs.chmodSync(f.path,0o600)
  const link=path.join(root,'link');fs.symlinkSync(f.path,link);assert.throws(()=>readBoundFile({...f,path:link}),/NOT_PRIVATE/)
  const hard=path.join(root,'hard');fs.linkSync(f.path,hard);assert.throws(()=>readBoundFile(f),/NOT_PRIVATE/)
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
test('release is an exact reviewed instruction, not a boolean, placeholder or expired authorization',()=>{
 const root=privateRoot()
 try{
  assert.equal(readOperatorRelease(fixtureRelease(root)).status,'CONTROLLED_INSTALLATION_ACCEPTED')
  assert.throws(()=>readOperatorRelease(fixtureRelease(root,{expiresAt:'2020-01-01T00:00:00Z'})),/NOT_ACCEPTED/)
  assert.throws(()=>readOperatorRelease(fixtureRelease(root,{refs:{ownerInstallation:'PENDING'} as OperatorRelease['refs']})),/NOT_ACCEPTED/)
  assert.throws(()=>readOperatorRelease(fixtureRelease(root,{monitoring:{ingestHost:'elsewhere.example',projectId:'123'}})),/NOT_ACCEPTED/)
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
test('runtime database cannot use an owner role, another branch host, database or non-TLS connection',()=>{
 const url='postgresql://'+OIL_B1.role+':fixture-password@ep-muddy-pine-b22pdyqd-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require'
 assert.equal(checkDatabaseUrl(url,OIL_B1.role),url)
 assert.equal(checkDatabaseUrl(url+'&channel_binding=require',OIL_B1.role),url+'&channel_binding=require')
 for(const bad of [url.replace(OIL_B1.role,'neondb_owner'),url.replace('ep-muddy-pine-b22pdyqd-pooler','ep-unapproved'),url.replace('/neondb','/other'),url.replace('sslmode=require','sslmode=disable'),
  url+'&host=unapproved.example',url+'&user=neondb_owner',url+'&database=other',url+'&options=-c%20role%3Dneondb_owner',url+'&sslmode=disable',url+'#unapproved',url.replace('/neondb',':443/neondb')])assert.throws(()=>checkDatabaseUrl(bad,OIL_B1.role),/BINDING/)
 assert.throws(()=>checkDatabaseUrl(url,B1_COUNTER.role),/BINDING/)
})
test('only the accepted existing key/project/tracking fingerprint can be used; process fallbacks are absent',()=>{
 const key='fixture-only-not-an-api-key',c={key,projectId:OIL_B1.projectId,trackingId:OIL_B1.keyTrackingId}
 assert.equal(checkCredential(c,hash(key)),c)
 for(const bad of [{...c,key:key+'other'},{...c,projectId:'other'},{...c,trackingId:'other'},{...c,key:key+'\n'}])assert.throws(()=>checkCredential(bad,hash(key)),/CREDENTIAL/)
})
test('arbitrary requests cannot be used to access the token-count operation',()=>{
 assert.throws(()=>prepareCounterCommand('{}'),/FROZEN_REQUEST/)
 assert.throws(()=>prepareCounterCommand(JSON.stringify({model:'gpt-6.1-sol',input:'fixture'})),/FROZEN_REQUEST/)
})
test('operator monitoring never sends exceptions, prompts, credentials, request URLs or private user context',()=>{
 const event={type:undefined,event_id:'a'.repeat(32),level:'error' as const,message:'private-message',request:{url:'https://private.example',headers:{authorization:'private-key'}},
  exception:{values:[{value:'private-exception'}]},extra:{prompt:'private-prompt'},user:{email:'private-user@example.com'}}
 const result=sanitizeOperatorError(event,'b'.repeat(64)),encoded=JSON.stringify(result)
 assert.equal(result.message,'Oil B1 technical event');assert.equal(result.environment,'development')
 assert.doesNotMatch(encoded,/private-message|private\.example|private-key|private-exception|private-prompt|private-user/)
})
test('GO is checked before credentials/database/provider access and cannot be replaced by a release instruction',async()=>{
 const root=privateRoot()
 try{
  const release=fixtureRelease(root),badGo=save(root,'go.json',JSON.stringify({decision:'GO_ONE_ATTEMPT',controlledReleaseRef:'wrong'}))
  await assert.rejects(runReleasedReport(release,badGo,path.join(root,'result')),/GO_RELEASE_BINDING/)
  assert.equal(fs.existsSync(path.join(root,'result')),false)
  await assert.rejects(main(['--mode','run','--release',release.path,'--release-sha256',release.sha256,'--output',path.join(root,'result')]),/ARGUMENT_REQUIRED/)
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
test('licensed frozen request binds counter to model, strict schema, reasoning and exact body; receipt cannot be caller fabricated or stale',{
 skip:!process.env.OIL_B1_REQUEST_READONLY_FILE},()=>{
 const request=fs.readFileSync(process.env.OIL_B1_REQUEST_READONLY_FILE!,'utf8'),c=prepareCounterCommand(request),v=JSON.parse(c.body),original=JSON.parse(request)
 assert.equal(hash(request),B1_INPUT.requestSha256);assert.equal(Buffer.byteLength(request),B1_INPUT.bodyBytes)
 assert.deepEqual(v.input,original.input);assert.deepEqual(v.text,original.text);assert.deepEqual(v.reasoning,original.reasoning)
 assert.equal(v.model,'gpt-6.1-sol');assert.equal('max_output_tokens'in v,false);assert.equal('tools'in v,false)
 const now=Date.now(),receipt:CounterReceipt={schemaVersion:'OilB1TokenCount/1',count:100,model:'gpt-6.1-sol',bodySha256:hash(request),counterBodySha256:c.bodySha256,
  verified:true,countedAt:new Date(now).toISOString(),sourceCallId:'11111111-1111-4111-8111-111111111111',requestId:'req_fixture',acceptanceRef:'COUNTER-TEST-ONLY',billingCost:'UNKNOWN',retryAllowed:false}
 assert.equal(validateCounterReceipt(receipt,request,'COUNTER-TEST-ONLY',now),100)
 assert.equal(validateCounterReceipt({...receipt,requestId:null},request,'COUNTER-TEST-ONLY',now),100)
 for(const patch of [{count:15001},{count:0},{verified:false},{bodySha256:'b'.repeat(64)},{counterBodySha256:'c'.repeat(64)},
  {model:'gpt-5.6-luna'},{countedAt:'2020-01-01T00:00:00Z'},{countedAt:new Date(now+1).toISOString()},{billingCost:'0'},{retryAllowed:true},{requestId:''},{requestId:undefined}]){
  assert.throws(()=>validateCounterReceipt({...receipt,...patch} as CounterReceipt,request,'COUNTER-TEST-ONLY',now),/TOKEN_RECEIPT/)
 }
 assert.throws(()=>validateCounterReceipt(receipt,request,'unaccepted',now),/TOKEN_RECEIPT/)
})
