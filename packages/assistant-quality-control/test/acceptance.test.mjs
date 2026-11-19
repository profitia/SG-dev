import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {qualificationPolicyDigest,qualificationCommand,syntheticResponseEvents,qualifyLinuxExecutor,qualificationCodeModeCall,qualificationCancellationCommand,qualificationProcessIdentity} from '../src/acceptance.mjs'
import {boundAgentRequest} from '../src/openai-broker.mjs'
import {CODE_PRICING} from '../src/budget.mjs'

test('Keyless tool fixture keeps regression content as data and forms valid Python and Responses events',()=>{
 const command=qualificationCommand({outsideRead:'/home/public-canary',outsideWrite:'/home/public-write',blockedPort:12345,
  socketPath:'/run/synthetic.sock',sourcePath:'apps/sg-runtime/lib/assistant/calendar-period.ts',regressionPath:'synthetic.test.ts',
  regressionSource:'export default {"text":"quote \\\" and newline\\n$(must remain data)"} as const;\n'})
 const program=command.split("<<'AQC_KEYLESS_PY'\n")[1].replace(/AQC_KEYLESS_PY$/,'')
 const checked=spawnSync('python3',['-c','import ast,sys;ast.parse(sys.stdin.read())'],{input:program,encoding:'utf8'})
 assert.equal(checked.status,0,checked.stderr)
 const stream=syntheticResponseEvents(1,{type:'function_call',call_id:'synthetic',name:'exec_command',arguments:'{"cmd":"true","login":false}'})
 const events=stream.trim().split('\n\n').map(frame=>JSON.parse(frame.split('\n').find(l=>l.startsWith('data: ')).slice(6)))
 assert.deepEqual(events.map(e=>e.type),['response.created','response.output_item.done','response.completed'])
 assert.equal(events[1].item.name,'exec_command')
 const next=boundAgentRequest({model:CODE_PRICING.model,stream:true,input:[{type:'function_call_output',call_id:'synthetic',output:'AQC_KEYLESS_TOOL_PROBES_PASS'}]})
 assert.equal(next.input[0].output,'AQC_KEYLESS_TOOL_PROBES_PASS')
})
test('Keyless Linux qualification cannot run on an untrusted local host',async()=>{
 await assert.rejects(qualifyLinuxExecutor(),{code:process.platform==='linux'&&process.getuid?.()===0?'TRUSTED_EPHEMERAL_WORKFLOW_REQUIRED':'LINUX_ROOT_REQUIRED'})
})

test('Code Mode qualification uses the actual freeform namespace and a valid fixed Python cancellation marker',()=>{
 const call=qualificationCodeModeCall([{type:'namespace',name:'functions',tools:[{type:'custom',name:'exec'}]}],'printf synthetic','tool-loop')
 assert.equal(call.type,'custom_tool_call');assert.equal(call.namespace,'functions');assert.equal(call.name,'exec');assert(call.input.includes('tools.exec_command('));assert(call.input.includes('"login":false'))
 assert.throws(()=>qualificationCodeModeCall([{type:'function',name:'exec_command'}],'true','tool-loop'),{code:'CODE_MODE_TOOL_UNAVAILABLE'})
 assert.throws(()=>qualificationCodeModeCall([{type:'namespace',name:'foreign',tools:[{type:'custom',name:'exec'}]}],'true','tool-loop'),{code:'CODE_MODE_TOOL_UNAVAILABLE'})
 const script=qualificationCancellationCommand().split("<<'AQC_CANCEL_PY'\n")[1].replace(/AQC_CANCEL_PY$/,'')
 const checked=spawnSync('python3',['-c','import ast,sys;ast.parse(sys.stdin.read())'],{input:script,encoding:'utf8'})
 assert.equal(checked.status,0,checked.stderr);assert(script.includes('os.getpid()'))
})

test('Cancellation resolves the exact Python probe through the kernel PID namespace mapping, never another process',()=>{
 const status='Name:\tpython3\nUid:\t19999\t19999\t19999\t19999\nNSpid:\t4321\t7\n'
 assert.equal(qualificationProcessIdentity(status,'python3','4321','7'),true)
 assert.equal(qualificationProcessIdentity(status.replace('4321\t7','4321'),'python3','4321','4321'),true)
 for(const [s,c,h,n]of [[status,'codex','4321','7'],[status,'python3','4322','7'],[status,'python3','4321','8'],
  [status.replace('19999','0'),'python3','4321','7'],[status.replace('NSpid:','Wrong:'),'python3','4321','7'],
  [status+'NSpid:\t4321\t7\n','python3','4321','7'],[status,'python3','../4321','7']])
  assert.equal(qualificationProcessIdentity(s,c,h,n),false)
})


test('Linux policy digest binds every local verifier dependency, including the mandatory controller VERIFY gates',async()=>{
 const fs=await import('node:fs'),path=await import('node:path'),os=await import('node:os'),{fileURLToPath}=await import('node:url')
 const original=fileURLToPath(new URL('../',import.meta.url)),fixture=fs.mkdtempSync(path.join(os.tmpdir(),'aqc-policy-dependencies-'))
 try{
  fs.mkdirSync(path.join(fixture,'src'))
  for(const name of fs.readdirSync(path.join(original,'src')))if(name.endsWith('.mjs'))fs.copyFileSync(path.join(original,'src',name),path.join(fixture,'src',name))
  for(const name of ['package.json','package-lock.json'])fs.copyFileSync(path.join(original,name),path.join(fixture,name))
  const initial=qualificationPolicyDigest(fixture),pending=['verify.mjs'],visited=new Set()
  while(pending.length){
   const name=pending.pop();if(visited.has(name))continue;visited.add(name)
   const file=path.join(fixture,'src',name),source=fs.readFileSync(file,'utf8')
   for(const match of source.matchAll(/from ['"]\.\/([^'"]+\.mjs)['"]/g))pending.push(match[1])
   fs.writeFileSync(file,source+'\n// Synthetic dependency mutation, never imported or executed.\n')
   assert.notEqual(qualificationPolicyDigest(fixture),initial,'Unbound verifier dependency: '+name)
   fs.writeFileSync(file,source);assert.equal(qualificationPolicyDigest(fixture),initial)
  }
  assert(visited.has('controller.mjs'))
  fs.unlinkSync(path.join(fixture,'src/controller.mjs'))
  assert.throws(()=>qualificationPolicyDigest(fixture),{code:'ENOENT'})
 }finally{fs.rmSync(fixture,{recursive:true,force:true})}
})
