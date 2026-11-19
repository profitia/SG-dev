import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import test from 'node:test'

const modulePath=fileURLToPath(new URL('./codespace-cleanup-inspector.py',import.meta.url))
const common=String.raw`
import array,ctypes,hashlib,importlib.util,json,os,pathlib,socket,stat,subprocess,sys,tempfile,unittest.mock,uuid
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('inspector',sys.argv[1])
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def expect(call, message=None):
 try:call()
 except (m.Refusal,OSError,KeyError,ValueError) as e:
  if message:assert message in str(e),(message,str(e))
  return
 raise AssertionError('Expected safe refusal')
def fixture(base):
 root=pathlib.Path(base);scope=root/'scope';source=root/'source';guard=root/'guard'
 for p in [scope,source,guard]:p.mkdir(mode=0o700)
 resource=scope/'cache';resource.mkdir(mode=0o700)
 (resource/'payload').write_text('OWN_SYNTHETIC_FIXTURE\n')
 allocation=uuid.uuid4().hex
 marker={'schemaVersion':'1.0','projectKey':'ARCHITECTURE','taskId':'ARCHITECTURE-INSPECTOR-TEST',
  'repository':'profitia/SG-dev','scopeRoot':str(scope),'path':str(resource),'kind':'ephemeral-directory','allocationId':allocation}
 (resource/m.OWNER_FILE).write_text(json.dumps(marker,indent=2)+'\n')
 p={'schemaVersion':'1.0','protocol':m.PROTOCOL,'projectKey':'ARCHITECTURE','taskId':marker['taskId'],
  'repository':marker['repository'],'scopeRoot':str(scope),'sourceRoot':str(source),'guardRoot':str(guard),
  'guardIdentity':m.identity(guard.stat()),'executionUid':os.getuid(),'executionGid':os.getgid(),
  'maxEntries':10000,'maxBytes':1024*1024,'_digest':'a'*64,
  'referenceDomain':{'mode':'exclusive-reference-domain-v1','resourceExposure':'private-since-allocation',
   'authorityEvidenceSha256':'f'*64,**{ns+'Namespace':os.readlink('/proc/self/ns/'+ns) for ns in ['pid','mnt','user']}}}
 fd=m.open_directory(str(scope))
 try:t=m.inventory(fd,'cache')
 finally:os.close(fd)
 r={**marker,'protocol':m.PROTOCOL,'requestId':uuid.uuid4().hex,'action':'clean','phase':'pre-closeout',
  'policyDigest':p['_digest'],'sourceRoot':str(source),'dev':t['identity']['dev'],'ino':t['identity']['ino'],
  'markerSha256':t['markerSha256'],'treeDigest':t['treeDigest']}
 p['resources']=[{k:r[k] for k in ['path','dev','ino','allocationId','markerSha256']}]
 peer={'pid':999999999,'startTime':'never','uid':os.getuid(),'gid':os.getgid()}
 return root,resource,p,r,peer
def guard(p, scanner=None):
 return m.Guard(p,_owner_uid=os.getuid(),_scanner=scanner or (lambda *a:{'complete':True,'checkedProcesses':1,'ordinaryPids':[999999999]}))
def close_tx(g,tx):
 for k in ['parent','outer','inner']:os.close(tx[k])
 g.close()
def proc_fixture(root, resource):
 proc=root/'proc';proc.mkdir();(proc/'self').mkdir();(proc/'self/ns').mkdir()
 (proc/'self/ns/mnt').symlink_to('mnt:[fixture]')
 (proc/'self/ns/pid').symlink_to('pid:[fixture]');(proc/'self/ns/user').symlink_to('user:[fixture]')
 dev=resource.stat().st_dev
 mount=f'1 0 {os.major(dev)}:{os.minor(dev)} / /fixture rw - ext4 fixture rw\n'
 (proc/'self/mountinfo').write_text(mount)
 p=proc/'4242';p.mkdir();(p/'ns').mkdir();(p/'ns/mnt').symlink_to('mnt:[fixture]');(p/'ns/pid').symlink_to('pid:[fixture]');(p/'ns/user').symlink_to('user:[fixture]');(p/'fd').mkdir();(p/'task').mkdir();(p/'task/4242').symlink_to(p)
 fields=['S']+['0']*19;fields[19]='991'
 (p/'stat').write_text('4242 (opaque sshd fixture) '+' '.join(fields))
 (p/'status').write_text('Uid:\t1000\t1000\t1000\t1000\nCapPrm:\t0000000000000000\n')
 outside=root/'outside';outside.mkdir();(outside/'file').write_text('outside')
 (p/'cwd').symlink_to(outside,target_is_directory=True);(p/'root').symlink_to(root,target_is_directory=True)
 (p/'maps').write_text('')
 (p/'fd/3').symlink_to(outside/'file')
 return proc,p,mount
`

function python(name,body){
 test(name,{skip:process.platform!=='linux'},()=>{
  const p=spawnSync('python3',['-I','-',modulePath],{input:common+'\n'+body,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024})
  assert.equal(p.status,0,p.stdout+'\n'+p.stderr)
 })
}

python('inspector exact task, object and marker admission binds every request',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d)
 assert m.validate_request(p,r)['path']==str(resource)
 for key,value in [('taskId','OTHER-TASK'),('dev',0),('ino',0),('allocationId','b'*32),('markerSha256','b'*64),('scopeRoot','/tmp/other'),('kind','git-worktree'),('policyDigest','b'*64),('action','shell')]:
  expect(lambda:m.validate_request(p,{**r,key:value}))
`)
python('inspector inventory binds substantive bytes, modes, names and Unicode order',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d)
 for n in ['😀','\ue000','ąć','nested']:
  (resource/n).write_text(n)
 fd=m.open_directory(str(resource.parent))
 try:
  a=m.inventory(fd,'cache');b=m.inventory(fd,'cache');assert a['treeDigest']==b['treeDigest']
  (resource/'payload').write_text('changed')
  assert m.inventory(fd,'cache')['treeDigest']!=a['treeDigest']
 finally:os.close(fd)
`)
python('guard seals then admits one ordinary-UID FD removal and commits physical absence',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);g=guard(p);tx=g.prepare(r,peer)
 assert not resource.exists() and m.exists_at(tx['inner'],'candidate')
 assert tx['record']['state']=='SEALED'
 assert json.loads(m.read_at(tx['outer'],'transaction.json'))['state']=='SEALED'
 g.begin(tx);assert tx['record']['state']=='DELETING'
 uid=os.getuid();m.remove_contents(tx['inner'],'candidate');assert os.getuid()==uid
 receipt=g.commit(tx);assert receipt['removed'] and receipt['guarded'] and not resource.exists()
 expect(lambda:g.commit(tx),'No active deletion lease')
 close_tx(g,tx)
`)
python('guard active-consumer refusal restores the exact unchanged candidate without deleting',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d)
 def active(*args):raise m.Refusal('ACTIVE_CONSUMER')
 g=guard(p,active);before=(resource/'payload').read_bytes()
 expect(lambda:g.prepare(r,peer),'ACTIVE_CONSUMER')
 assert resource.exists() and (resource/'payload').read_bytes()==before and not g.unresolved()
 g.close()
`)
python('guard observation EACCES restores data and never authorizes a deletion',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d)
 def denied(*args):raise PermissionError(13,'unknown observation')
 g=guard(p,denied);expect(lambda:g.prepare(r,peer));assert resource.exists() and not g.unresolved();g.close()
`)
python('guard rejects changed bytes after earlier audit and before sealing',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);(resource/'payload').write_text('new retained data')
 g=guard(p);expect(lambda:g.prepare(r,peer),'Candidate changed');assert resource.exists();g.close()
`)
python('guard refuses a symlink replacement without touching its target',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);other=resource.parent/'retained';resource.rename(other);resource.symlink_to(other)
 g=guard(p);expect(lambda:g.prepare(r,peer));assert (other/'payload').exists() and resource.is_symlink();g.close()
`)
python('guard hardlink and protected-data checks remain mandatory',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);fd=m.open_directory(str(resource.parent))
 try:
  (resource/'.env').write_text('SYNTHETIC_NO_SECRET=1');expect(lambda:m.inventory(fd,'cache'),'Protected content');(resource/'.env').unlink()
  os.link(resource/'payload',root/'other-link');expect(lambda:m.inventory(fd,'cache'),'Hardlinked')
 finally:os.close(fd)
`)
python('guard recreated source name is preserved and original data remains in recovery',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);g=guard(p);tx=g.prepare(r,peer)
 resource.mkdir();(resource/'new').write_text('retain new replacement')
 expect(lambda:g.begin(tx),'Source path was recreated')
 expect(lambda:g.abort(tx));assert (resource/'new').exists() and m.exists_at(tx['inner'],'candidate')
 assert g.unresolved();close_tx(g,tx)
`)
python('guard changed sealed content cannot pass begin-delete or silent restore',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);g=guard(p);tx=g.prepare(r,peer)
 fd=os.open('candidate',os.O_RDONLY|os.O_DIRECTORY,dir_fd=tx['inner'])
 f=os.open('payload',os.O_WRONLY,dir_fd=fd);os.write(f,b'changed by old producer');os.close(f);os.close(fd)
 expect(lambda:g.begin(tx),'Candidate changed');expect(lambda:g.abort(tx),'Candidate changed')
 assert g.unresolved();close_tx(g,tx)
`)
python('guard detects even an ABA rename of its user-writable workspace location',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d)
 def moved(*args):
  a=pathlib.Path(p['guardRoot']);b=root/'moved';a.rename(b);b.rename(a)
  return {'complete':True,'ordinaryPids':[peer['pid']]}
 g=guard(p,moved);expect(lambda:g.prepare(r,peer),'Guard path moved');assert resource.exists();g.close()
`)
python('guard crash recovery restores a sealed resource with no active lease holder',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);g=guard(p);tx=g.prepare(r,peer);token=tx['record']['token'];close_tx(g,tx)
 g=guard(p);assert g.unresolved()==[token];g.recover(token)
 assert resource.exists() and not g.unresolved();g.close()
`)
python('guard live lease-holder identity blocks recovery interference',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);peer.update(pid=os.getpid(),startTime=m.pid_identity(os.getpid())[0])
 g=guard(p,lambda *a:{'complete':True,'ordinaryPids':[peer['pid']]});tx=g.prepare(r,peer);token=tx['record']['token'];close_tx(g,tx)
 g=guard(p);expect(lambda:g.recover(token),'Lease holder is still active');assert not resource.exists();g.close()
`)
python('guard deleting crash is retained, not replayed or presented as success',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);g=guard(p);tx=g.prepare(r,peer);g.begin(tx);token=tx['record']['token'];close_tx(g,tx)
 g=guard(p);expect(lambda:g.recover(token),'RECOVERY_REQUIRED');assert g.unresolved();g.close()
`)
python('guard unresolved recovery prevents another cleanup transaction',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);g=guard(p);tx=g.prepare(r,peer);expect(lambda:g.prepare(r,peer),'RECOVERY_REQUIRED');g.abort(tx);close_tx(g,tx)
`)
python('guard global broker lock rejects conflicting broker ownership',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);g=guard(p);expect(lambda:guard(p));g.close()
`)
python('root policy cannot be supplied from a caller-writable deployment directory',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);path=root/'deployment.json';path.write_text(json.dumps(p))
 expect(lambda:m.load_policy(str(path)),'Trusted path')
`)
python('duplicate JSON keys cannot replace task or scope identities',String.raw`
expect(lambda:m.plain_json('{'+'"taskId":"A","taskId":"B"'+'}'),'Duplicate JSON key')
`)
python('Unix descriptor transfer preserves identity with close-on-exec',String.raw`
with tempfile.TemporaryDirectory() as d:
 fd=m.open_directory(d);a,b=socket.socketpair(socket.AF_UNIX,socket.SOCK_SEQPACKET)
 try:
  m.packet(a,{'test':True},fd);value,copy=m.receive(b,True)
  try:assert value['test'] and m.identity(os.fstat(copy))==m.identity(os.fstat(fd)) and not os.get_inheritable(copy)
  finally:os.close(copy)
 finally:a.close();b.close();os.close(fd)
`)
python('Unix descriptor count mismatch is rejected without retaining supplied descriptors',String.raw`
with tempfile.TemporaryDirectory() as d:
 fd=m.open_directory(d);a,b=socket.socketpair(socket.AF_UNIX,socket.SOCK_SEQPACKET)
 try:
  a.sendmsg([b'{}'],[(socket.SOL_SOCKET,socket.SCM_RIGHTS,array.array('i',[fd,fd]))])
  before=len(os.listdir('/proc/self/fd'));expect(lambda:m.receive(b,True),'Unexpected descriptor count');assert len(os.listdir('/proc/self/fd'))==before
 finally:a.close();b.close();os.close(fd)
`)
python('a normal-user socket peer cannot masquerade as the trusted root component',String.raw`
a,b=socket.socketpair(socket.AF_UNIX,socket.SOCK_SEQPACKET)
try:assert m.peer_credentials(a)['uid']==os.getuid()
finally:a.close();b.close()
`)
python('nondumpable ordinary worker descriptors are inaccessible to a same-UID process',String.raw`
require=ctypes.CDLL(None).prctl(4,0,0,0,0);assert require==0
script='import os,sys;\ntry:\n os.readlink("/proc/"+sys.argv[1]+"/fd/0");print("READABLE")\nexcept OSError as e:print(e.errno)'
p=subprocess.run([sys.executable,'-I','-c',script,str(os.getpid())],capture_output=True,text=True)
assert p.returncode==0 and p.stdout.strip() in ['13','1'],p.stdout+p.stderr
`)

for(const kind of ['idle','cwd','root','fd','mmap','eacces','mount-alias','mount-namespace','capable-peer','missing-maps','pid-reuse']){
 python(`inspector process coverage: ${kind}`,String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);proc,pid,mount=proc_fixture(root,resource)
 objects={(resource.stat().st_dev,resource.stat().st_ino),((resource/'payload').stat().st_dev,(resource/'payload').stat().st_ino)}
 case=`+JSON.stringify(kind)+String.raw`
 if case in ['cwd','root']:(pid/case).unlink();(pid/case).symlink_to(resource,target_is_directory=True)
 if case=='fd':(pid/'fd/3').unlink();(pid/'fd/3').symlink_to(resource/'payload')
 if case=='mmap':
  s=(resource/'payload').stat();(pid/'maps').write_text(f'1000-2000 r--p 0000 {os.major(s.st_dev):x}:{os.minor(s.st_dev):x} {s.st_ino} /alias/hidden\n')
 if case=='mount-alias':(proc/'self/mountinfo').write_text(mount+mount)
 if case=='mount-namespace':(pid/'ns/mnt').unlink();(pid/'ns/mnt').symlink_to('mnt:[different]')
 if case=='capable-peer':(pid/'status').write_text('Uid:\t1000\t1000\t1000\t1000\nCapPrm:\t0000000000000002\n')
 if case=='missing-maps':(pid/'maps').unlink()
 check=lambda:m.scan_consumers(objects,[str(resource)],resource.stat().st_dev,proc)
 if case=='idle':assert check()['complete']
 elif case=='eacces':
  original=m.os.readlink
  def inaccessible(path,*a,**kw):
   if str(path).endswith('/cwd'):raise PermissionError(13,'denied')
   return original(path,*a,**kw)
  with unittest.mock.patch.object(m.os,'readlink',inaccessible):expect(check,'Incomplete process observation')
 elif case=='pid-reuse':
  original=m.pid_identity;counter=[0]
  def reused(*a,**kw):counter[0]+=1;return (str(counter[0]),'S')
  with unittest.mock.patch.object(m,'pid_identity',reused):expect(check,'PID identity changed')
 else:expect(check)
`)
}

python('public broker startup cannot install or acquire privileges',String.raw`
p=subprocess.run([sys.executable,'-I',sys.argv[1],'serve','--descriptor','/not-installed'],capture_output=True,text=True)
assert p.returncode==2 and 'REVIEW_REQUIRED' in p.stderr
`)

python('an idle shared-domain scan cannot authorize removal or move the candidate',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d)
 g=guard(p,lambda *a:{'complete':True,'ordinaryPids':[peer['pid'],1234]})
 before=(resource/'payload').read_bytes()
 expect(lambda:g.prepare(r,peer),'REFERENCE_DOMAIN_REQUIRED')
 assert resource.exists() and (resource/'payload').read_bytes()==before and not g.unresolved()
 g.close()
`)
python('a root descriptor cannot substitute for an absent reference domain',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);p.pop('referenceDomain');g=guard(p)
 expect(lambda:g.prepare(r,peer),'REFERENCE_DOMAIN_REQUIRED')
 assert resource.exists() and not g.unresolved();g.close()
`)
python('an admitted domain from another namespace is rejected before any rename',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);p['referenceDomain']['pidNamespace']='pid:[other]';g=guard(p)
 expect(lambda:g.prepare(r,peer),'namespace boundary differs')
 assert resource.exists() and not g.unresolved();g.close()
`)
python('new reference-transfer potential before begin-delete preserves guarded data',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);g=guard(p);tx=g.prepare(r,peer)
 g.scan=lambda *a:{'complete':True,'ordinaryPids':[peer['pid'],1234]}
 expect(lambda:g.begin(tx),'REFERENCE_DOMAIN_REQUIRED')
 assert tx['record']['state']=='SEALED' and m.exists_at(tx['inner'],'candidate')
 g.abort(tx);assert resource.exists();close_tx(g,tx)
`)
python('a sibling thread with its own active directory blocks observation',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);proc,pid,mount=proc_fixture(root,resource)
 thread=pid/'task/4243';thread.mkdir()
 for name in ['status','stat','maps']:(thread/name).write_bytes((pid/name).read_bytes())
 (thread/'ns').symlink_to(pid/'ns');(thread/'fd').symlink_to(pid/'fd')
 (thread/'root').symlink_to(root);(thread/'cwd').symlink_to(resource)
 expect(lambda:m.scan_consumers({(resource.stat().st_dev,resource.stat().st_ino)},[str(resource)],resource.stat().st_dev,proc),'ACTIVE_CONSUMER')
`)

python('public clean cannot hand private directory FDs to an independently started caller',String.raw`
with tempfile.TemporaryDirectory() as d:
 root,resource,p,r,peer=fixture(d);g=guard(p);a,b=socket.socketpair(socket.AF_UNIX,socket.SOCK_SEQPACKET)
 try:
  m.packet(a,r)
  with unittest.mock.patch.object(m,'validate_peer',lambda *x:None):
   expect(lambda:m.handle(b,p,g),'LIVE_DELETE_UNAVAILABLE')
  assert resource.exists() and not g.unresolved()
 finally:a.close();b.close();g.close()
`)

const managedReadFixture=String.raw`
import base64
def managed_fixture(d):
 root=pathlib.Path(d);g=root/'managed';g.mkdir(mode=0o700)
 p={'taskId':'ARCHITECTURE-READ-TEST','projectKey':'ARCHITECTURE','repository':'profitia/SG-dev','scopeRoot':str(root),'sourceRoot':'/no-source',
    'guardRoot':str(g),'guardIdentity':m.identity(g.stat()),'executionUid':os.getuid(),'executionGid':os.getgid(),'maxBytes':16384,'maxEntries':4,'_digest':'a'*64,'resources':[{'name':'receipt-cache','maxBytes':8192}]}
 s=m.ManagedStore(p,_owner_uid=os.getuid());r={'protocol':m.PROTOCOL,'requestId':uuid.uuid4().hex,'policyDigest':p['_digest'],**{k:p[k] for k in ['taskId','projectKey','repository','scopeRoot','sourceRoot']},'phase':'pre-closeout'}
 return s,r
def managed_call(s,r,e,op,**extra):return s.dispatch({**r,'action':op,**{k:e[k] for k in ['path','allocationId','kind','identity']},**extra})
def managed_allocate(s,r,data):return s.dispatch({**r,'action':'allocate','name':'receipt-cache','bytes':len(data),'seedBase64':base64.b64encode(data[:4096]).decode()})
`
python('managed receipt cache returns byte-exact Unicode copies without exporting descriptors',managedReadFixture+String.raw`
with tempfile.TemporaryDirectory() as d:
 s,r=managed_fixture(d)
 try:
  data='{"actualResult":"SUCCESS","label":"wynik źródłowy"}'.encode();e=managed_allocate(s,r,data)
  first=managed_call(s,r,e,'read');second=managed_call(s,r,e,'read')
  assert base64.b64decode(first['payloadBase64'])==data and first['payloadSha256']==hashlib.sha256(data).hexdigest()
  assert first['payloadBase64']==second['payloadBase64'] and not any('fd' in k.lower() for k in first)
  expect(lambda:os.listdir('/proc/'+str(e['worker']['pid'])+'/fd'))
  managed_call(s,r,e,'release');clean=managed_call(s,r,e,'clean',authorization={k:True for k in ['resultVerified','retentionReleased','recoveryPreserved','noActiveConsumers']})
  assert clean['status']=='CLEANED' and not pathlib.Path(e['path']).exists() and base64.b64decode(first['payloadBase64'])==data
 finally:s.shutdown()
`)
python('managed frozen receipt refuses a new read consumer before and after cleanup',managedReadFixture+String.raw`
with tempfile.TemporaryDirectory() as d:
 s,r=managed_fixture(d)
 try:
  e=managed_allocate(s,r,b'{"result":"SUCCESS"}');managed_call(s,r,e,'release')
  expect(lambda:managed_call(s,r,e,'read'),'lease has ended')
  assert pathlib.Path(e['path']).exists()
 finally:s.shutdown()
`)
python('oversized managed read fails closed while retaining private data',managedReadFixture+String.raw`
with tempfile.TemporaryDirectory() as d:
 s,r=managed_fixture(d)
 try:
  e=managed_allocate(s,r,b'x'*4097);expect(lambda:managed_call(s,r,e,'read'))
  assert pathlib.Path(e['path']).exists() and s.index['resources'][0]['state']=='ACTIVE'
 finally:s.shutdown()
`)
python('managed read refuses a foreign task and substituted allocation identity',managedReadFixture+String.raw`
with tempfile.TemporaryDirectory() as d:
 s,r=managed_fixture(d)
 try:
  e=managed_allocate(s,r,b'{"result":"SUCCESS"}')
  expect(lambda:managed_call(s,{**r,'taskId':'ARCHITECTURE-FOREIGN'},e,'read'),'identity')
  expect(lambda:managed_call(s,r,{**e,'identity':{'dev':0,'ino':0}},'read'),'object mismatch')
 finally:s.shutdown()
`)
