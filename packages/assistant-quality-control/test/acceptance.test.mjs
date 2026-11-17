import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {qualificationCommand,syntheticResponseEvents,qualifyLinuxExecutor} from '../src/acceptance.mjs'
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
