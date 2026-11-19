import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import test from 'node:test'
const modulePath=fileURLToPath(new URL('./codespace-cleanup-inspector.py',import.meta.url))
const common=String.raw`
import base64,hashlib,importlib.util,json,os,pathlib,signal,socket,sys,tempfile,uuid,unittest.mock
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('m',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def expect(call,pattern=None):
 try:call()
 except (m.Refusal,OSError,KeyError,ValueError) as e:
  if pattern:assert pattern in str(e),(pattern,str(e))
  return
 raise AssertionError('Expected refusal')
def fixture(d):
 root=pathlib.Path(d);guard=root/'guard';guard.mkdir(mode=0o700)
 p={'taskId':'ARCHITECTURE-MANAGED-TEST','projectKey':'ARCHITECTURE','repository':'profitia/SG-dev',
  'scopeRoot':str(root),'sourceRoot':'/not-a-test-target','guardRoot':str(guard),'guardIdentity':m.identity(guard.stat()),
  'executionUid':os.getuid(),'executionGid':os.getgid(),'maxBytes':1048576,'maxEntries':1000,'_digest':'a'*64,
  'resources':[{'name':'test-cache','maxBytes':1048576}]}
 s=m.ManagedStore(p,_owner_uid=os.getuid())
 r={'protocol':m.PROTOCOL,'requestId':uuid.uuid4().hex,'policyDigest':p['_digest'],**{k:p[k] for k in ['taskId','projectKey','repository','scopeRoot','sourceRoot']},'phase':'pre-closeout'}
 return root,p,s,r
def allocate(s,r,**opts):return s.dispatch({**r,'action':'allocate','name':'test-cache','bytes':8192,'seedBase64':base64.b64encode(b'OWN_CACHE').decode(),**opts})
def call(s,r,e,action,**opts):return s.dispatch({**r,'action':action,**{k:e[k] for k in ['path','allocationId','kind','identity']},**opts})
release={'resultVerified':True,'retentionReleased':True,'recoveryPreserved':True,'noActiveConsumers':True}
`
function python(name,body){test(name,{skip:process.platform!=='linux'},()=>{
 const p=spawnSync('python3',['-I','-',modulePath],{input:common+'\n'+body,encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024})
 assert.equal(p.status,0,p.stdout+'\n'+p.stderr)
})}
python('managed resource is created by an ordinary nondumpable capability-free worker',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d)
 try:
  e=allocate(s,r);f=pathlib.Path(e['path']);assert f.exists() and (f/'payload.bin').stat().st_size==8192
  assert (f/'payload.bin').stat().st_uid==os.getuid()
  expect(lambda:os.listdir('/proc/'+str(e['worker']['pid'])+'/fd'))
  assert e['referenceProtection']=='PRIVATE_SINCE_CREATION_NO_FD_EXPORT'
  assert e['producerLeaseActive'] and call(s,r,e,'audit')['status']=='RETAINED'
 finally:s.shutdown()
`)
python('managed clean requires release, deletes through ordinary worker and commits actual absence',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d)
 try:
  e=allocate(s,r);before=(pathlib.Path(e['path'])/'payload.bin').read_bytes()
  expect(lambda:call(s,r,e,'clean',authorization=release),'producer lease')
  assert call(s,r,e,'release')['producerLeaseActive'] is False
  assert call(s,r,e,'audit')['status']=='OWNED_DISPOSABLE'
  cleaned=call(s,r,e,'clean',authorization=release)
  assert cleaned['status']=='CLEANED' and cleaned['workerStopped'] and not pathlib.Path(e['path']).exists()
  assert cleaned['measurement']['allocatedBytes']>=8192 and cleaned['measurement']['logicalBytes']>=8192
  assert isinstance(cleaned['observedFreeBytesDelta'],int)
  assert call(s,r,e,'clean',authorization=release)['status']=='NOT_APPLICABLE'
 finally:s.shutdown()
`)
python('managed allocation is idempotent without creating a second resource',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d)
 try:
  e=allocate(s,r);again=allocate(s,r);assert e['allocationId']==again['allocationId'] and len(s.index['resources'])==1
  expect(lambda:allocate(s,r,bytes=8193),'conflicts')
 finally:s.shutdown()
`)
for(const field of ['taskId','projectKey','scopeRoot','sourceRoot','policyDigest'])python('managed foreign '+field+' is refused before mutation',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d)
 try:
  expect(lambda:allocate(s,{**r,`+JSON.stringify(field)+String.raw`:'FOREIGN'}))
  assert not s.index['resources']
 finally:s.shutdown()
`)
python('managed allocation refuses traversal, historical adoption and excess payload',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d)
 try:
  for name in ['../old','evidence','.git','old-user-cache']:expect(lambda:allocate(s,r,name=name))
  expect(lambda:allocate(s,r,bytes=1048577),'bounds')
  assert not s.index['resources']
 finally:s.shutdown()
`)
python('managed root journal and marker prevent a substituted object from being removed',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d)
 try:
  e=allocate(s,r);f=pathlib.Path(e['path']);f.rename(f.with_name('preserved-original'));f.mkdir()
  (f/'payload.bin').write_text('FOREIGN')
  expect(lambda:call(s,r,e,'release'))
  assert (f/'payload.bin').read_text()=='FOREIGN' and f.with_name('preserved-original').exists()
 finally:s.shutdown()
`)
for(const item of ['.env','symlink','hardlink','mutation'])python('managed '+item+' is retained instead of deleting changed bytes',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d)
 try:
  e=allocate(s,r);f=pathlib.Path(e['path']);item=`+JSON.stringify(item)+String.raw`
  if item=='.env':(f/'.env').write_text('SYNTHETIC')
  if item=='symlink':(f/'link').symlink_to(root)
  if item=='hardlink':os.link(f/'payload.bin',f/'alias')
  if item=='mutation':(f/'payload.bin').write_text('changed')
  expect(lambda:call(s,r,e,'release'));assert f.exists()
 finally:s.shutdown()
`)
python('managed retention and phase gates remain mandatory after worker quiescence',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d)
 try:
  e=allocate(s,r);call(s,r,e,'release')
  for key in release:expect(lambda:call(s,r,e,'clean',authorization={**release,key:False}),'authorization')
  expect(lambda:call(s,{**r,'phase':'post-closeout'},e,'clean',authorization=release),'phase')
  assert pathlib.Path(e['path']).exists()
 finally:s.shutdown()
`)
python('managed restart preserves private data and resumes the identical allocation without redo',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d);e=allocate(s,r);digest=e['treeDigest'];s.shutdown()
 s=m.ManagedStore(p,_owner_uid=os.getuid())
 try:
  again=allocate(s,r);assert again['allocationId']==e['allocationId'] and again['treeDigest']==digest
  call(s,r,e,'release');assert call(s,r,e,'clean',authorization=release)['status']=='CLEANED'
 finally:s.shutdown()
`)
python('managed crashed deletion stays recovery-required and is not replayed',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d)
 try:
  e=allocate(s,r);call(s,r,e,'release');s.index['resources'][0]['state']='DELETING';s.save()
  expect(lambda:call(s,r,e,'clean',authorization=release),'RECOVERY_REQUIRED');assert pathlib.Path(e['path']).exists()
 finally:s.shutdown()
`)
python('managed ABA guard move refuses clean while preserving the resource',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d)
 try:
  e=allocate(s,r);call(s,r,e,'release');a=pathlib.Path(p['guardRoot']);b=root/'moved';a.rename(b);b.rename(a)
  expect(lambda:call(s,r,e,'clean',authorization=release),'Guard path moved');assert pathlib.Path(e['path']).exists()
 finally:s.shutdown()
`)
python('managed parallel stores and foreign allocation IDs cannot share a live resource',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d)
 try:
  e=allocate(s,r);expect(lambda:m.ManagedStore(p,_owner_uid=os.getuid()))
  expect(lambda:call(s,r,{**e,'allocationId':'b'*32},'clean',authorization=release),'Unknown managed')
  assert pathlib.Path(e['path']).exists()
 finally:s.shutdown()
`)
python('public managed service refuses ordinary launch without installing privileges',String.raw`
import subprocess
p=subprocess.run([sys.executable,'-I',sys.argv[1],'managed-serve','--descriptor','/not-installed'],capture_output=True,text=True)
assert p.returncode==2 and 'separately admitted root-component' in p.stderr
`)
python('managed service cannot stop while recovery data is retained, then stops after committed cleanup',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d)
 try:
  e=allocate(s,r);expect(lambda:s.dispatch({**r,'action':'stop'}),'retention/recovery')
  call(s,r,e,'release');call(s,r,e,'clean',authorization=release)
  assert s.dispatch({**r,'action':'stop'})['status']=='STOPPED'
 finally:s.shutdown()
`)
python('managed ancestor rename is detected even if the guard inode itself did not move',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d)
 try:
  e=allocate(s,r);call(s,r,e,'release')
  moved=root.with_name(root.name+'-moved');root.rename(moved)
  try:expect(lambda:call(s,r,e,'clean',authorization=release),'Guard path moved')
  finally:moved.rename(root)
  assert pathlib.Path(e['path']).exists()
 finally:s.shutdown()
`)
python('managed committed readback checks actual absence rather than trusting its stored status',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d)
 try:
  e=allocate(s,r);call(s,r,e,'release');call(s,r,e,'clean',authorization=release)
  assert call(s,r,e,'status')['physicalAbsent'] is True
  pathlib.Path(e['path']).mkdir();expect(lambda:call(s,r,e,'status'),'recreated')
 finally:s.shutdown()
`)

python('managed stale inode identity cannot authorize release or deletion',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d)
 try:
  e=allocate(s,r);expect(lambda:call(s,r,{**e,'identity':{'dev':0,'ino':0}},'release'),'object mismatch')
  assert pathlib.Path(e['path']).exists()
 finally:s.shutdown()
`)
python('managed workers isolate two concurrent resource lifetimes and reject mixed identities',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,p,s,r=fixture(d);p['resources'].append({'name':'second-cache','maxBytes':1048576})
 try:
  a=allocate(s,r);b=allocate(s,r,name='second-cache')
  assert a['worker']['pid']!=b['worker']['pid']
  expect(lambda:call(s,r,{**b,'path':a['path']},'release'),'object mismatch')
  call(s,r,a,'release');call(s,r,a,'clean',authorization=release)
  assert pathlib.Path(b['path']).exists() and call(s,r,b,'audit')['producerLeaseActive']
 finally:s.shutdown()
`)
