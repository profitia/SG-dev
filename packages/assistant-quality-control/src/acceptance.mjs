import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer} from 'node:net'
import {spawnSync} from 'node:child_process'
import {createHash,generateKeyPairSync,randomBytes,randomUUID} from 'node:crypto'
import {EXECUTOR_TOOL,assertExecutorHost,runIsolatedExecutor} from './executor.mjs'
import {documentDigest,publicKeyId,signDocument,verifyBoundManifest,SOURCE_PATHS} from './manifest.mjs'
import {ownerMandateBody,repairManifestBody} from './cli.mjs'
import {createPublicProjection} from './provenance.mjs'
import {createCostBroker} from './openai-broker.mjs'
import {serializeRegression} from './verify.mjs'
import {CODE_PRICING} from './budget.mjs'

const require=(v,c)=>{if(!v)throw Object.assign(Error('Keyless Linux qualification failed'),{code:c})}
const hash=v=>createHash('sha256').update(v).digest('hex')
const stamp=n=>new Date(n).toISOString()
const run=(file,args)=>{
 const r=spawnSync(file,args,{encoding:'utf8',timeout:15000,maxBuffer:65536,env:{PATH:'/usr/sbin:/usr/bin:/sbin:/bin',LANG:'C.UTF-8',TZ:'UTC'}})
 require(!r.error&&r.status===0,'QUALIFICATION_PREREQUISITE_FAILED');return r.stdout.trim()
}
const policyFiles=['src/executor.mjs','src/acceptance.mjs','src/manifest.mjs','src/provenance.mjs','src/source-policy.mjs',
 'src/budget.mjs','src/openai-broker.mjs','src/verify.mjs','package.json','package-lock.json']
export function qualificationPolicyDigest(packageRoot){
 return documentDigest(policyFiles.map(p=>({path:p,sha256:hash(fs.readFileSync(path.join(packageRoot,p)))})))
}
export function syntheticResponseEvents(index,item){
 const id='resp_aqc_keyless_'+index
 const response={id,model:CODE_PRICING.model,service_tier:'default',usage:{input_tokens:100,output_tokens:10,total_tokens:110,
  input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:0}}}
 return [{type:'response.created',response:{id}},{type:'response.output_item.done',item},{type:'response.completed',response}]
  .map(event=>'event: '+event.type+'\ndata: '+JSON.stringify(event)+'\n\n').join('')
}
export function qualificationCommand({outsideRead,outsideWrite,blockedPort,socketPath,sourcePath,regressionPath,regressionSource}){
 // This is a fixed, synthetic test program. No text, commands or paths from
 // a conversation, manifest input or repair agent are accepted by the entrypoint.
 const args={outsideRead,outsideWrite,blockedPort,socketPath,sourcePath,regressionPath,regressionSource}
 const program=`import os,socket,json,pathlib
v=json.loads(${JSON.stringify(JSON.stringify(args))})
def denied(f):
 try: f()
 except (OSError,PermissionError): return
 raise RuntimeError('Isolation probe unexpectedly succeeded')
denied(lambda: pathlib.Path(v['outsideRead']).read_text())
denied(lambda: pathlib.Path(v['outsideWrite']).write_text('unexpected'))
def connect(host,port):
 s=socket.socket();s.settimeout(1)
 try: s.connect((host,port))
 finally: s.close()
denied(lambda: connect('127.0.0.1',v['blockedPort']))
denied(lambda: connect('1.1.1.1',443))
def unix():
 s=socket.socket(socket.AF_UNIX);s.settimeout(1)
 try:s.connect(v['socketPath'])
 finally:s.close()
denied(unix)
status=pathlib.Path('/proc/self/status').read_text()
assert os.getuid()==19999
for name in ['CapInh','CapPrm','CapEff','CapBnd','CapAmb']:
 assert int(next(l.split(':')[1].strip() for l in status.splitlines() if l.startswith(name+':')),16)==0
assert next(l.split(':')[1].strip() for l in status.splitlines() if l.startswith('NoNewPrivs:'))=='1'
assert not any(k in os.environ for k in ['OPENAI_API_KEY','GITHUB_TOKEN','DATABASE_URL','RENDER_API_KEY'])
p=pathlib.Path(v['sourcePath']);p.write_text(p.read_text().replace('return x','return x+1'))
p=pathlib.Path(v['regressionPath']);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(v['regressionSource'])
print('AQC_KEYLESS_TOOL_PROBES_PASS')
`
 return "/usr/bin/python3 - <<'AQC_KEYLESS_PY'\n"+program+'AQC_KEYLESS_PY'
}

/** Qualification exercises the actual launcher with ephemeral TEST keys and a
 * fake in-memory cost port/upstream. They are never installed as trusted keys,
 * never published, and cannot authorise a real repair or a paid request.
 * The result is unsigned observations; independent run/artifact verification
 * and the installed verifier remain necessary before production trust. */
export async function qualifyLinuxExecutor(){
 const binding=assertExecutorHost(),packageRoot=path.dirname(path.dirname(fileURLToPath(import.meta.url)))
 require(typeof process.env.AQC_NONCE==='string'&&/^[a-f0-9-]{36}$/.test(process.env.AQC_NONCE),'WORKFLOW_NONCE_REQUIRED')
 require(!['OPENAI_API_KEY','RENDER_API_KEY','DATABASE_URL','GITHUB_TOKEN'].some(k=>process.env[k]),'KEYLESS_ENVIRONMENT_REQUIRED')
 const toolPath='/opt/aqc-tools/codex',binarySha256=hash(fs.readFileSync(toolPath)),gateSetSha256=qualificationPolicyDigest(packageRoot)
 require(run(toolPath,['--version']).includes(EXECUTOR_TOOL.version),'CODEX_VERSION_MISMATCH')
 const root='/root/aqc-qualification-'+randomUUID(),repo=root+'/repository',socketPath='/run/aqc-qualification-'+randomUUID()+'.sock'
 fs.mkdirSync(repo,{recursive:true,mode:0o700})
 const outside='/home/aqc-qualification-'+randomUUID();fs.mkdirSync(outside,{mode:0o777});fs.chmodSync(outside,0o777)
 fs.writeFileSync(outside+'/readable.txt','public synthetic canary',{mode:0o644})
 let socketsReached=0,otherPortReached=0,requestCount=0,settledCount=0,kernelNetworkVerified=false,toolLoopVerified=false,cancellationVerified=false
 const unix=createServer(s=>{socketsReached++;s.destroy()}),other=createServer(s=>{otherPortReached++;s.destroy()})
 await new Promise((resolve,reject)=>{unix.once('error',reject);unix.listen(socketPath,resolve)})
 fs.chmodSync(socketPath,0o666)
 await new Promise((resolve,reject)=>{other.once('error',reject);other.listen(0,'127.0.0.1',resolve)})
 const blockedPort=other.address().port
 try{
  run('/usr/bin/git',['init','--quiet',repo]);run('/usr/bin/git',['-C',repo,'remote','add','origin','https://github.com/profitia/SG-dev.git'])
  const sourcePath=SOURCE_PATHS.C1,sourceFile=path.join(repo,sourcePath);fs.mkdirSync(path.dirname(sourceFile),{recursive:true})
  fs.writeFileSync(sourceFile,'export function calendarReference(x:number){return x}\n')
  run('/usr/bin/git',['-C',repo,'add','.']);run('/usr/bin/git',['-C',repo,'-c','user.name=AQC keyless fixture','-c','user.email=aqc-fixture@example.invalid','commit','--quiet','-m','Synthetic launcher qualification fixture'])
  const baseSha=run('/usr/bin/git',['-C',repo,'rev-parse','HEAD'])
  for(const phase of ['tool-loop','cancellation']){
   const now=Date.now(),key=generateKeyPairSync('ed25519'),keys=new Map([[publicKeyId(key.publicKey),key.publicKey]])
   const regression={schemaVersion:'AQC_REGRESSION_V1',repairClass:'C1',caseFamily:'linux_keyless_qualification',locale:'en',args:[1],expected:2,expectedAnswer:true,refusal:{pointer:'',values:[null]}}
   const mandate=signDocument('AQC_EXECUTION_MANDATE_V1',ownerMandateBody({id:randomUUID(),issuedAt:stamp(now-1000),expiresAt:stamp(now+300000),targetServiceId:'srv-keyless-fixture',gateSetSha256}),key.privateKey)
   const body=repairManifestBody({mandate,incidentId:randomUUID(),correlationId:randomUUID(),baseSha,repairClass:'C1',exportReceiptId:randomUUID(),fixtureSha256:documentDigest(regression)})
   const fixtureExport=signDocument('AQC_SYNTHETIC_EXPORT_V1',{id:body.synthetic.exportReceiptId,fixtureId:body.synthetic.fixtureId,sha256:body.synthetic.sha256,
    scope:'CONTROLLED_ACCEPTANCE',incidentId:body.incidentId,repairClass:'C1',issuedAt:stamp(now-1000),expiresAt:stamp(now+300000),rawQaPayloadIncluded:false},key.privateKey)
   const manifest=verifyBoundManifest(body,{mandate,fixtureExport,ownerKeys:keys,verifierKeys:keys,now,expectedBaseSha:baseSha,expectedServiceId:'srv-keyless-fixture',expectedGateSetSha256:gateSetSha256})
   // Explicit TEST input to reach the boundary; this is not an attestation of
   // successful qualification and is discarded with the ephemeral private key.
   const testAttestation=signDocument('AQC_LINUX_QUALIFICATION_V1',{gateSetSha256,codexVersion:EXECUTOR_TOOL.version,codexArchiveSha256:EXECUTOR_TOOL.archiveSha256,
    codexBinarySha256:binarySha256,isolationHelperCommit:EXECUTOR_TOOL.isolationHelperCommit,fileIsolation:'PASS',networkIsolation:'PASS',privilegeIsolation:'PASS',
    toolLoop:'PASS',cancellation:'PASS',noProviderRequests:true,runId:binding.runId,sourceSha:binding.executorSourceSha,verifiedAt:stamp(now-1000),expiresAt:stamp(now+300000)},key.privateKey)
   const permit={incidentId:body.incidentId,attemptId:randomUUID(),permitId:randomUUID(),expiresAt:stamp(now+300000)},abort=new AbortController()
   let calls=0,scope,deadline,diagnostic
   const budget={claimExecutor:async()=>({incidentId:body.incidentId,attemptId:permit.attemptId}),assertPermit:async()=>{},
    reserveRequest:async(_,r)=>({...r,status:'RESERVED'}),dispatchRequest:async()=>{},settleRequest:async()=>{settledCount++},
    markUnknown:async()=>{},releaseUndispatched:async()=>{}}
   const bearerToken=randomBytes(32).toString('hex')
   const broker=createCostBroker({budget,permit,bearerToken,openaiKey:'SYNTHETIC_NOT_A_CREDENTIAL',fetcher:async(url,o)=>{
    if(url.endsWith('/input_tokens'))return Response.json({object:'response.input_tokens',input_tokens:100})
    require(url==='https://api.openai.com/v1/responses','UNEXPECTED_UPSTREAM');requestCount++;calls++
    const request=JSON.parse(o.body)
    require(request.model===CODE_PRICING.model&&request.store===false,'BROKER_CONTRACT_FAILED')
    let item
    if(calls===1){
     const tools=request.tools??[]
     require(tools.some(t=>t.name==='exec_command'||t.type==='namespace'&&t.tools?.some(s=>s.name==='exec_command')),'COMMAND_TOOL_UNAVAILABLE')
     const testPath=body.allowedPaths.find(p=>p!==sourcePath)
     const cmd=phase==='cancellation'?'/usr/bin/python3 -c "import time;time.sleep(100)"':qualificationCommand({outsideRead:outside+'/readable.txt',outsideWrite:outside+'/write.txt',blockedPort,socketPath,sourcePath,regressionPath:testPath,regressionSource:serializeRegression(regression)})
     item={type:'function_call',call_id:'aqc_keyless_'+phase,name:'exec_command',arguments:JSON.stringify({cmd,login:false,yield_time_ms:phase==='cancellation'?100:10000,max_output_tokens:1000})}
    }else{
     require(calls===2,'UNEXPECTED_TOOL_RETRY')
     const outputs=request.input.filter(i=>i.type==='function_call_output')
     require(outputs.length>0,'TOOL_OUTPUT_MISSING')
     const result=JSON.stringify(outputs)
     if(phase==='tool-loop')require(result.includes('AQC_KEYLESS_TOOL_PROBES_PASS'),'COMMAND_PROBES_FAILED')
     else{
      require(scope&&fs.readFileSync(scope.cgroup+'/cgroup.procs','utf8').trim().split('\n').length>=2,'NO_DESCENDANT_TO_CANCEL')
      abort.abort()
     }
     item={type:'message',role:'assistant',id:'msg_aqc_keyless',content:[{type:'output_text',text:'Synthetic qualification complete'}]}
    }
    return new Response(syntheticResponseEvents(calls,item),{headers:{'content-type':'text/event-stream'}})
   }})
   try{
    const brokerUrl=await broker.listen()
    deadline=setTimeout(()=>abort.abort(),290000)
    const observeIsolation=async actual=>{
     scope=actual
     const program=`import socket,json\ndef denied(host,port):\n s=socket.socket();s.settimeout(1)\n try:s.connect((host,port));return False\n except OSError:return True\n finally:s.close()\nassert denied('127.0.0.1',${blockedPort})\nassert denied('1.1.1.1',443)\ns=socket.socket(socket.AF_UNIX)\ntry:\n s.connect(${JSON.stringify(socketPath)})\n raise RuntimeError('Unix service reachable')\nexcept OSError:pass\nfinally:s.close()\nprint('AQC_KERNEL_PROBES_PASS')`
     const result=run('/usr/bin/setpriv',[...actual.privilegeArguments,'--','/usr/bin/python3','-c',program])
     require(result==='AQC_KERNEL_PROBES_PASS','KERNEL_ISOLATION_FAILED');kernelNetworkVerified=true
    }
    let completed,cancelled
    try{
     completed=await runIsolatedExecutor({manifest,regression,projection:createPublicProjection({repositoryRoot:repo,manifest}),toolPath,budget,permit,
      brokerUrl,agentToken:bearerToken,qualification:testAttestation,qualificationKeys:keys,observedGateSetSha256:gateSetSha256,nonce:randomUUID(),
      signal:abort.signal,observeIsolation,diagnostics:value=>{diagnostic=value}})
    }catch(e){
     if(phase==='cancellation'&&e.code==='EXECUTOR_CANCELLED'&&e.stoppedProof?.cgroupEmpty===true)cancelled=e
     else{if(diagnostic)console.error(JSON.stringify({phase,syntheticOnly:true,diagnostic}));throw e}
    }
    require(calls===2,'TOOL_LOOP_NOT_EXECUTED')
    if(phase==='tool-loop'){
     require(completed?.stoppedProof.cgroupEmpty===true&&completed.body.files.length===2
      &&completed.body.files.some(f=>f.path===sourcePath&&f.content.includes('return x+1')),'ACTUAL_PATCH_NOT_COLLECTED')
     toolLoopVerified=true
    }else{require(cancelled?.stoppedProofSha256&&abort.signal.aborted,'CANCELLATION_NOT_CONFIRMED');cancellationVerified=true}
   }finally{clearTimeout(deadline);await broker.close()}
  }
  return {schemaVersion:'AQC_LINUX_OBSERVATIONS_V1',gateSetSha256,codexVersion:EXECUTOR_TOOL.version,codexArchiveSha256:EXECUTOR_TOOL.archiveSha256,
   codexBinarySha256:binarySha256,isolationHelperCommit:EXECUTOR_TOOL.isolationHelperCommit,fileIsolation:toolLoopVerified?'PASS':'FAIL',
   networkIsolation:kernelNetworkVerified&&otherPortReached===0&&socketsReached===0?'PASS':'FAIL',privilegeIsolation:toolLoopVerified?'PASS':'FAIL',
   toolLoop:toolLoopVerified?'PASS':'FAIL',cancellation:cancellationVerified?'PASS':'FAIL',noProviderRequests:true,requestCount,settledCount,
   runId:binding.runId,sourceSha:binding.executorSourceSha,nonce:process.env.AQC_NONCE,verifiedAt:stamp(Date.now()),testKeysInstalled:false,realCostAuthorityUsed:false}
 }finally{
  await Promise.all([new Promise(resolve=>unix.close(resolve)),new Promise(resolve=>other.close(resolve))])
  fs.rmSync(root,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true});fs.rmSync(socketPath,{force:true})
 }
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 try{
  const result=await qualifyLinuxExecutor()
  require(['fileIsolation','networkIsolation','privilegeIsolation','toolLoop','cancellation'].every(k=>result[k]==='PASS'),'QUALIFICATION_NOT_PASSED')
  fs.writeFileSync('/tmp/aqc-linux-observations.json',JSON.stringify(result,null,2)+'\n',{mode:0o600})
  console.log(JSON.stringify(result))
 }catch(e){console.error(JSON.stringify({code:e?.code??'QUALIFICATION_FAILED',setup:e?.setup??null}));process.exitCode=1}
}
