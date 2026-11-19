import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import test from 'node:test'
const file=fileURLToPath(new URL('./codespace-cleanup-task-admin.py',import.meta.url))
const common=String.raw`
import importlib.util,sys,os,pathlib,tempfile,json,stat
sys.dont_write_bytecode=True
s=importlib.util.spec_from_file_location('admin',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def expect(call):
 try:call()
 except (ValueError,OSError,KeyError):return
 raise AssertionError('Expected safe refusal')
def fixture():
 p={'class':m.CLASS,'status':'PILOT','pilotTaskId':'ARCHITECTURE-PILOT','scopeBase':'/workspaces/sgdev-tasks/new-managed-namespace'}
 c={'projectKey':'ARCHITECTURE','repository':'profitia/SG-dev','taskId':p['pilotTaskId'],'sourceRoot':'/workspaces/sgdev-tasks/source-own'}
 c['scopeRoot']=m.scope_for(p,c['taskId']);c.update(stateFile=c['scopeRoot']+'/lifecycle.json',beginInputFile=c['scopeRoot']+'/begin-input.json',inspectorDescriptor=str(m.RUN/m.digest(c['taskId'].encode())/'policy.json'))
 return p,c,c['scopeRoot']+'/lifecycle-config.json'
`
function py(name,body){test(name,()=>{
 const r=spawnSync('python3',['-I','-',file],{input:common+'\n'+body,encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stdout+'\n'+r.stderr)
})}
py('launch validation binds pilot, new namespace and exact descriptor',String.raw`
p,c,f=fixture();assert str(m.validate_config(c,p,f)).endswith(m.digest(c['taskId'].encode()))
for key,value in [('projectKey','SG2'),('repository','foreign/repo'),('taskId','ARCHITECTURE-OTHER'),('scopeRoot','/workspaces/old17-resources'),('sourceRoot','/workspaces/SG-dev'),('stateFile','/old/recovery'),('inspectorDescriptor','/tmp/fake')]:expect(lambda:m.validate_config({**c,key:value},p,f))
expect(lambda:m.validate_config(c,{**p,'status':'DISABLED'},f))
`)
py('active profile admits another correctly isolated task without accepting a history directory',String.raw`
p,c,f=fixture();p['status']='ACTIVE';c['taskId']='ARCHITECTURE-NEXT';c['scopeRoot']=m.scope_for(p,c['taskId']);c['stateFile']=c['scopeRoot']+'/lifecycle.json';c['beginInputFile']=c['scopeRoot']+'/begin-input.json';c['inspectorDescriptor']=str(m.RUN/m.digest(c['taskId'].encode())/'policy.json')
m.validate_config(c,p,c['scopeRoot']+'/lifecycle-config.json')
expect(lambda:m.validate_config({**c,'scopeRoot':p['scopeBase']+'/../old'},p,c['scopeRoot']+'/lifecycle-config.json'))
`)
py('untrusted JSON cannot override an earlier task identity',String.raw`
expect(lambda:m.json_unique(b'{"taskId":"ARCHITECTURE-PILOT","taskId":"FOREIGN"}'))
`)
py('configuration files reject symlinks, aliases and oversized content',String.raw`
with tempfile.TemporaryDirectory() as d:
 p=pathlib.Path(d)/'config';p.write_text('{}');assert m.read_file(str(p),20)==b'{}'
 link=p.with_name('link');link.symlink_to(p);expect(lambda:m.read_file(str(link),20))
 alias=p.with_name('alias');os.link(p,alias);expect(lambda:m.read_file(str(p),20));alias.unlink()
 p.write_bytes(b'x'*21);expect(lambda:m.read_file(str(p),20))
`)
py('task directory traversal refuses a symbolic ancestor',String.raw`
with tempfile.TemporaryDirectory() as d:
 root=pathlib.Path(d);real=root/'real';real.mkdir();link=root/'link';link.symlink_to(real,target_is_directory=True)
 expect(lambda:m.directory(str(link)))
`)
py('partial configuration writes preserve prior immutable policy and recovery temp',String.raw`
with tempfile.TemporaryDirectory() as d:
 p=pathlib.Path(d)/'policy.json';m.write_json(p,{'status':'PILOT'});before=p.read_bytes();p.with_name('policy.json.new').write_text('interrupted')
 expect(lambda:m.write_json(p,{'status':'ACTIVE'}));assert p.read_bytes()==before
`)
py('ordinary invocation cannot install or start a privileged component',String.raw`
if os.geteuid()!=0:expect(lambda:m.main('start','/not-admitted'))
`)

py('Linux pathname socket stays bounded and different tasks remain separately bound',String.raw`
p,c,f=fixture()
a=m.socket_for(c['taskId']);b=m.socket_for('ARCHITECTURE-'+'Z'*145)
assert len(os.fsencode(a))<=107 and len(os.fsencode(b))<=107 and a!=b
assert str(m.RUN) in a
# Full task identity and the descriptor remain independently checked.
expect(lambda:m.validate_config({**c,'taskId':'ARCHITECTURE-OTHER'},p,f))
`)
