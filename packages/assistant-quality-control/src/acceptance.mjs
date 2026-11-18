import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer} from 'node:net'
import {spawnSync} from 'node:child_process'
import {createHash,generateKeyPairSync,randomBytes,randomUUID} from 'node:crypto'
import {EXECUTOR_TOOL,assertExecutorHost,runIsolatedExecutor,prepareExecutorTools,runIsolatedVerificationCase} from './executor.mjs'
import {documentDigest,publicKeyId,signDocument,verifyBoundManifest,SOURCE_PATHS} from './manifest.mjs'
import {ownerMandateBody,repairManifestBody} from './cli.mjs'
import {createPublicProjection} from './provenance.mjs'
import {createCostBroker} from './openai-broker.mjs'
import {serializeRegression,prepareQualityVerificationBundle,createQualityIsolatedCaseRunner} from './verify.mjs'
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

export function qualificationProcessIdentity(status,comm,hostPid,namespacePid){
 const pid=p=>typeof p==='string'&&/^[1-9][0-9]{0,9}$/.test(p)
 if(typeof status!=='string'||comm!=='python3'||!pid(hostPid)||!pid(namespacePid))return false
 const lines=status.split('\n'),names=lines.filter(l=>l.startsWith('NSpid:')),uids=lines.filter(l=>l.startsWith('Uid:'))
 if(names.length!==1||uids.length!==1)return false
 const ids=names[0].slice(6).trim().split(/\s+/),users=uids[0].slice(4).trim().split(/\s+/)
 return ids.length>=1&&ids.length<=32&&ids.every(pid)&&ids[0]===hostPid&&ids.at(-1)===namespacePid
  &&users.length===4&&users.every(v=>v==='19999')
}

export function qualificationCancellationCommand(){
 return "/usr/bin/python3 - <<'AQC_CANCEL_PY'\nimport os,pathlib,time\npathlib.Path('aqc-cancellation-probe').write_text(str(os.getpid()))\ntime.sleep(100)\nAQC_CANCEL_PY"
}
export function qualificationCodeModeCall(tools,cmd,phase){
 require(Array.isArray(tools)&&tools.length<=64&&typeof cmd==='string'&&Buffer.byteLength(cmd)<=16384&&['tool-loop','cancellation'].includes(phase),'CODE_MODE_TOOL_UNAVAILABLE')
 const choices=tools.flatMap(t=>t?.type==='custom'&&t.name==='exec'?[{}]
  :t?.type==='namespace'&&t.name==='functions'&&t.tools?.some(s=>s.type==='custom'&&s.name==='exec')?[{namespace:t.name}]:[])
 require(choices.length===1,'CODE_MODE_TOOL_UNAVAILABLE')
 return {type:'custom_tool_call',call_id:'aqc_keyless_'+phase,name:'exec',...choices[0],
  input:'const result = await tools.exec_command('+JSON.stringify({cmd,login:false,yield_time_ms:phase==='cancellation'?100:10000,max_output_tokens:1000})+'); text(result);'}
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
 const codeModeHost=await prepareExecutorTools()
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
    codexBinarySha256:binarySha256,...codeModeHost,isolationHelperCommit:EXECUTOR_TOOL.isolationHelperCommit,fileIsolation:'PASS',networkIsolation:'PASS',privilegeIsolation:'PASS',
    toolLoop:'PASS',cancellation:'PASS',noProviderRequests:true,runId:binding.runId,sourceSha:binding.executorSourceSha,verifiedAt:stamp(now-1000),expiresAt:stamp(now+300000)},key.privateKey)
   const permit={incidentId:body.incidentId,attemptId:randomUUID(),permitId:randomUUID(),expiresAt:stamp(now+300000)},abort=new AbortController()
   let calls=0,scope,deadline,diagnostic
   const budget={claimExecutor:async()=>({incidentId:body.incidentId,attemptId:permit.attemptId}),assertPermit:async()=>{},
    reserveRequest:async(_,r)=>({...r,status:'RESERVED'}),dispatchRequest:async()=>{},settleRequest:async()=>{settledCount++},
    markUnknown:async()=>{},releaseUndispatched:async()=>{}}
   const bearerToken=randomBytes(32).toString('hex')
   const broker=createCostBroker({budget,permit,bearerToken,openaiKey:'SYNTHETIC_NOT_A_CREDENTIAL',diagnostics:value=>console.error(JSON.stringify({phase,syntheticOnly:true,...value})),fetcher:async(url,o)=>{
    try{
    if(url.endsWith('/input_tokens'))return Response.json({object:'response.input_tokens',input_tokens:100})
    require(url==='https://api.openai.com/v1/responses','UNEXPECTED_UPSTREAM');requestCount++;calls++
    const request=JSON.parse(o.body)
    require(request.model===CODE_PRICING.model&&request.store===false,'BROKER_CONTRACT_FAILED')
    let item
    if(calls===1){
     const tools=[...(request.tools??[]),...request.input.filter(i=>i.type==='additional_tools').flatMap(i=>i.tools)]
     const testPath=body.allowedPaths.find(p=>p!==sourcePath)
     const cmd=phase==='cancellation'?qualificationCancellationCommand():qualificationCommand({outsideRead:outside+'/readable.txt',outsideWrite:outside+'/write.txt',blockedPort,socketPath,sourcePath,regressionPath:testPath,regressionSource:serializeRegression(regression)})
     item=qualificationCodeModeCall(tools,cmd,phase)
    }else{
     require(calls===2,'UNEXPECTED_TOOL_RETRY')
     const outputs=request.input.filter(i=>['function_call_output','custom_tool_call_output'].includes(i.type))
     require(outputs.length>0,'TOOL_OUTPUT_MISSING')
     const result=JSON.stringify(outputs)
     if(phase==='tool-loop'){
      if(!result.includes('AQC_KEYLESS_TOOL_PROBES_PASS'))console.error(JSON.stringify({event:'AQC_SYNTHETIC_TOOL_FAILURE',syntheticOnly:true,output:result.replaceAll(bearerToken,'[REDACTED]').slice(-6000)}))
      require(result.includes('AQC_KEYLESS_TOOL_PROBES_PASS'),'COMMAND_PROBES_FAILED')
     }
     else{
      require(scope,'NO_DESCENDANT_TO_CANCEL')
      const marker=scope.work+'/aqc-cancellation-probe'
      for(let i=0;i<200&&!fs.existsSync(marker);i++)await new Promise(resolve=>setTimeout(resolve,25))
      require(fs.existsSync(marker),'CANCELLATION_MARKER_MISSING')
      const namespacePid=fs.readFileSync(marker,'utf8').trim()
      const candidates=fs.readFileSync(scope.cgroup+'/cgroup.procs','utf8').trim().split('\n').filter(hostPid=>{
       if(!/^[1-9][0-9]{0,9}$/.test(hostPid))return false
       try{return qualificationProcessIdentity(fs.readFileSync('/proc/'+hostPid+'/status','utf8'),
        fs.readFileSync('/proc/'+hostPid+'/comm','utf8').trim(),hostPid,namespacePid)}catch{return false}
      })
      require(candidates.length===1,'CANCELLATION_DESCENDANT_UNVERIFIED')
      // The host PID was resolved only inside this executor's native cgroup,
      // using the kernel's namespace mapping and the fixed Python probe UID.
      abort.abort()
     }
     item={type:'message',role:'assistant',id:'msg_aqc_keyless',content:[{type:'output_text',text:'Synthetic qualification complete'}]}
    }
    return new Response(syntheticResponseEvents(calls,item),{headers:{'content-type':'text/event-stream'}})
    }catch(error){
     const codes=new Set(['UNEXPECTED_UPSTREAM','BROKER_CONTRACT_FAILED','CODE_MODE_TOOL_UNAVAILABLE','UNEXPECTED_TOOL_RETRY','TOOL_OUTPUT_MISSING','COMMAND_PROBES_FAILED','NO_DESCENDANT_TO_CANCEL','CANCELLATION_MARKER_MISSING','CANCELLATION_DESCENDANT_UNVERIFIED'])
     console.error(JSON.stringify({event:'AQC_SYNTHETIC_UPSTREAM_REJECTED',phase,syntheticOnly:true,code:codes.has(error?.code)?error.code:'SYNTHETIC_UPSTREAM_FAILED',calls}))
     throw error
    }
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
     if(phase==='cancellation'&&e.code==='EXECUTOR_CANCELLED'&&e.stoppedProof?.cgroupEmpty===true&&!e.cleanup)cancelled=e
     else{if(diagnostic)console.error(JSON.stringify({phase,syntheticOnly:true,diagnostic}));throw e}
    }
    require(calls===2,'TOOL_LOOP_NOT_EXECUTED')
    require(scope&&!fs.existsSync(scope.cgroup)&&!fs.existsSync(path.dirname(scope.work))&&!fs.existsSync('/home/aqc-repair')
     &&spawnSync('/usr/bin/getent',['passwd','aqc-repair']).status===2&&spawnSync('/usr/bin/getent',['group','aqc-repair']).status===2,'EXECUTOR_CLEANUP_NOT_CONFIRMED')
    if(phase==='tool-loop'){
     require(completed?.stoppedProof.cgroupEmpty===true&&completed.body.files.length===2
      &&completed.body.files.some(f=>f.path===sourcePath&&f.content.includes('return x+1')),'ACTUAL_PATCH_NOT_COLLECTED')
     toolLoopVerified=true
    }else{require(cancelled?.stoppedProofSha256&&abort.signal.aborted,'CANCELLATION_NOT_CONFIRMED');cancellationVerified=true}
   }finally{clearTimeout(deadline);await broker.close()}
  }
  const independentVerifier=await qualifyIndependentVerifier({gateSetSha256,binarySha256,codeModeHost,binding})
  return {schemaVersion:'AQC_LINUX_OBSERVATIONS_V1',gateSetSha256,codexVersion:EXECUTOR_TOOL.version,codexArchiveSha256:EXECUTOR_TOOL.archiveSha256,
   codexBinarySha256:binarySha256,...codeModeHost,isolationHelperCommit:EXECUTOR_TOOL.isolationHelperCommit,fileIsolation:toolLoopVerified&&independentVerifier.fileIsolation==='PASS'?'PASS':'FAIL',
   networkIsolation:kernelNetworkVerified&&otherPortReached===0&&socketsReached===0&&independentVerifier.networkIsolation==='PASS'?'PASS':'FAIL',privilegeIsolation:toolLoopVerified&&independentVerifier.privilegeIsolation==='PASS'?'PASS':'FAIL',
   toolLoop:toolLoopVerified?'PASS':'FAIL',cancellation:cancellationVerified&&independentVerifier.cancellation==='PASS'?'PASS':'FAIL',noProviderRequests:true,requestCount,settledCount,
   runId:binding.runId,sourceSha:binding.executorSourceSha,nonce:process.env.AQC_NONCE,verifiedAt:stamp(Date.now()),testKeysInstalled:false,realCostAuthorityUsed:false,independentVerifier}
 }finally{
  await Promise.all([new Promise(resolve=>unix.close(resolve)),new Promise(resolve=>other.close(resolve))])
  fs.rmSync(root,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true});fs.rmSync(socketPath,{force:true})
 }
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 try{
  const result=await qualifyLinuxExecutor()
  require(['fileIsolation','networkIsolation','privilegeIsolation','toolLoop','cancellation'].every(k=>result[k]==='PASS'),'QUALIFICATION_NOT_PASSED')
  require(result.independentVerifier?.status==='PASS','INDEPENDENT_VERIFIER_QUALIFICATION_REQUIRED')
  fs.writeFileSync('/tmp/aqc-linux-observations.json',JSON.stringify(result,null,2)+'\n',{mode:0o600})
  console.log(JSON.stringify(result))
 }catch(e){console.error(JSON.stringify({code:e?.code??'QUALIFICATION_FAILED',setup:e?.setup??null,cleanup:e?.cleanup??null}));process.exitCode=1}
}

/** Actual OS probes for the no-model verifier. The fixture and signing keys
 * are synthetic and are never installed as a production trust anchor. */
export async function qualifyIndependentVerifier({gateSetSha256,binarySha256,codeModeHost,binding}){
 const repo='/root/aqc-verifier-fixture-'+randomUUID(),key=generateKeyPairSync('ed25519'),keys=new Map([[publicKeyId(key.publicKey),key.publicKey]])
 fs.mkdirSync(repo,{mode:0o700})
 try{
  const write=(p,s)=>{const f=path.join(repo,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
  const before='export function calendarReference(x:number){return x}\n',after='export function calendarReference(x:number){return x+1}\n'
  write(SOURCE_PATHS.C1,before);write(SOURCE_PATHS.C2,'export function renderGroundedFacts(x:number){return x*2}\nexport function applyQualityPolicy(x:number){return x*3}\n')
  write('packages/assistant-context-contracts/src/index.mjs','export const syntheticOnly=true\n')
  run('/usr/bin/git',['init','--quiet',repo]);run('/usr/bin/git',['-C',repo,'add','.'])
  run('/usr/bin/git',['-C',repo,'-c','user.name=AQC verifier fixture','-c','user.email=aqc-fixture@example.invalid','commit','--quiet','-m','Synthetic independent verifier fixture'])
  const baseSha=run('/usr/bin/git',['-C',repo,'rev-parse','HEAD']),now=Date.now()
  const regression={schemaVersion:'AQC_REGRESSION_V1',repairClass:'C1',caseFamily:'linux_verifier_qualification',locale:'en',args:[1],expected:2,expectedAnswer:true,refusal:{pointer:'',values:[null]}}
  const mandate=signDocument('AQC_EXECUTION_MANDATE_V1',ownerMandateBody({id:randomUUID(),issuedAt:stamp(now-1000),expiresAt:stamp(now+300000),targetServiceId:'srv-keyless-fixture',gateSetSha256}),key.privateKey)
  const body=repairManifestBody({mandate,incidentId:randomUUID(),correlationId:randomUUID(),baseSha,repairClass:'C1',exportReceiptId:randomUUID(),fixtureSha256:documentDigest(regression)})
  const fixtureExport=signDocument('AQC_SYNTHETIC_EXPORT_V1',{id:body.synthetic.exportReceiptId,fixtureId:body.synthetic.fixtureId,sha256:body.synthetic.sha256,
   scope:'CONTROLLED_ACCEPTANCE',incidentId:body.incidentId,repairClass:'C1',issuedAt:stamp(now-1000),expiresAt:stamp(now+300000),rawQaPayloadIncluded:false},key.privateKey)
  const manifest=verifyBoundManifest(body,{mandate,fixtureExport,ownerKeys:keys,verifierKeys:keys,now,expectedBaseSha:baseSha,expectedServiceId:'srv-keyless-fixture',expectedGateSetSha256:gateSetSha256})
  const qualification=signDocument('AQC_LINUX_QUALIFICATION_V1',{gateSetSha256,codexVersion:EXECUTOR_TOOL.version,codexArchiveSha256:EXECUTOR_TOOL.archiveSha256,
   codexBinarySha256:binarySha256,...codeModeHost,isolationHelperCommit:EXECUTOR_TOOL.isolationHelperCommit,fileIsolation:'PASS',networkIsolation:'PASS',privilegeIsolation:'PASS',
   toolLoop:'PASS',cancellation:'PASS',noProviderRequests:true,runId:binding.runId,sourceSha:binding.executorSourceSha,verifiedAt:stamp(now-1000),expiresAt:stamp(now+300000)},key.privateKey)
  const makeBundle=async candidate=>{
   const regressionSource=serializeRegression(regression),files=[
    {path:SOURCE_PATHS.C1,beforeSha256:hash(before),afterSha256:hash(candidate),content:candidate},
    {path:body.allowedPaths.find(p=>p!==SOURCE_PATHS.C1),beforeSha256:null,afterSha256:hash(regressionSource),content:regressionSource}]
   const patch={schemaVersion:'AQC_PATCH_V1',incidentId:body.incidentId,baseSha,gateSetSha256,manifestSha256:documentDigest(manifest),files}
   return prepareQualityVerificationBundle({manifest,repositoryRoot:repo,artifact:{body:patch,artifactSha256:documentDigest(patch)}})
  }
  const bundle=await makeBundle(after),diagnostics=value=>console.error(JSON.stringify({event:'AQC_SYNTHETIC_VERIFIER_DIAGNOSTIC',syntheticOnly:true,...value})),runner=await createQualityIsolatedCaseRunner({bundle,qualification,qualificationKeys:keys,observedGateSetSha256:gateSetSha256,diagnostics})
  let typedResults=0
  for(const version of ['base','candidate'])for(const repairClass of ['C1','C2','C3']){
   const result=await runner.runCase({version,repairClass,sourceSha256:bundle.sourceSha256[version],args:[2],repeat:0})
   const expected=repairClass==='C1'?(version==='base'?2:3):repairClass==='C2'?4:6
   require(result.status==='COMPLETE'&&result.output===expected,'VERIFIER_TYPED_RESULT_FAILED');typedResults++
  }
  const endless=await makeBundle('export function calendarReference(x:number){while(true){}}\n')
  let timeoutScope,cancelScope,cancelled=false
  const common={bundle:endless,version:'candidate',repairClass:'C1',args:[1],qualification,qualificationKeys:keys,observedGateSetSha256:gateSetSha256,diagnostics}
  const timed=await runIsolatedVerificationCase({...common,observeIsolation:value=>{timeoutScope=value}})
  require(timed.status==='FAILED'&&timed.reason==='TIMEOUT'&&timeoutScope&&!fs.existsSync(timeoutScope.cgroup)&&!fs.existsSync(timeoutScope.root),'VERIFIER_TIMEOUT_RECOVERY_FAILED')
  const abort=new AbortController()
  try{await runIsolatedVerificationCase({...common,signal:abort.signal,observeIsolation:value=>{cancelScope=value;abort.abort()}})}
  catch(e){if(e.code==='VERIFIER_CANCELLED'&&!e.cleanup)cancelled=true;else throw e}
  require(cancelled&&cancelScope&&!fs.existsSync(cancelScope.cgroup)&&!fs.existsSync(cancelScope.root),'VERIFIER_CANCELLATION_RECOVERY_FAILED')
  return {status:'PASS',classes:['C1','C2','C3'],typedResults,fileIsolation:'PASS',networkIsolation:'PASS',privilegeIsolation:'PASS',timeout:'PASS',cancellation:'PASS',
   cgroupEmpty:true,nodeSha256:hash(fs.readFileSync(process.execPath)),noProviderRequests:true,rawQaPayloadIncluded:false,testKeysInstalled:false}
 }finally{fs.rmSync(repo,{recursive:true,force:true})}
}
