#!/usr/bin/env python3
"""Separately admitted fixed launcher. No cleanup implementation lives here.

Only new tasks in the installer-created namespace may receive one bounded
managed receipt cache. PMOS/routing authorization stays with the ordinary
runTask caller; this program grants no code, data or closeout authority.
"""
import argparse
import fcntl
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import stat
import subprocess
import sys
import time

BASE=pathlib.Path('/opt/profitia-cleanup-architecture-dev-v1')
PROFILE=BASE/'activation.json'
RUN=pathlib.Path('/run/profitia-cleanup-architecture-dev-v1')
CLASS='architecture-execution-receipt-v1'
RESOURCE='execution-receipt-cache'
UID=GID=1000

def require(value,message):
    if not value:raise ValueError(message)

def digest(value):return hashlib.sha256(value).hexdigest()

def scope_for(profile,task):return str(pathlib.Path(profile['scopeBase'])/digest(task.encode()))

def read_file(file,maximum,owner=None):
    fd=os.open(file,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC|os.O_NONBLOCK)
    try:
        s=os.fstat(fd)
        require(stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_size<=maximum,'Unsafe input file')
        if owner is not None:require(s.st_uid==owner,'Input owner mismatch')
        data=os.read(fd,maximum+1);require(len(data)<=maximum,'Input exceeded bound')
        return data
    finally:os.close(fd)

def json_unique(data):
    def unique(items):
        d={}
        for k,v in items:
            require(k not in d,'Duplicate JSON key');d[k]=v
        return d
    return json.loads(data,object_pairs_hook=unique)

def directory(file):
    require(type(file) is str and file.startswith('/') and os.path.normpath(file)==file and '\0' not in file,'Canonical directory required')
    fd=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_CLOEXEC)
    try:
        for part in pathlib.Path(file).parts[1:]:
            following=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=fd)
            os.close(fd);fd=following
        return fd
    except BaseException:os.close(fd);raise

def identity(s):return {'dev':s.st_dev,'ino':s.st_ino}

def validate_config(c,p,file):
    require(p.get('class')==CLASS and p.get('status') in ['PILOT','ACTIVE'],'Activation is disabled')
    require(c.get('projectKey')=='ARCHITECTURE' and c.get('repository')=='profitia/SG-dev','Wrong project/repository')
    task=c.get('taskId','')
    require(re.fullmatch(r'ARCHITECTURE-[A-Za-z0-9_.-]{1,145}',task),'Invalid Architecture task')
    require(p['status']=='ACTIVE' or task==p['pilotTaskId'],'Only the admitted pilot may start before activation')
    require(c.get('scopeRoot')==scope_for(p,task),'Only the new managed task namespace is admitted')
    require(pathlib.Path(file).parent==pathlib.Path(c['scopeRoot']),'Config must be directly inside its task scope')
    require(pathlib.Path(c.get('sourceRoot','')).parent==pathlib.Path('/workspaces/sgdev-tasks'),'Source must be a dedicated task checkout')
    require(c.get('stateFile')==c['scopeRoot']+'/lifecycle.json' and c.get('beginInputFile')==c['scopeRoot']+'/begin-input.json','Task control paths differ')
    expected=RUN/digest(task.encode())
    require(c.get('inspectorDescriptor')==str(expected/'policy.json'),'Descriptor path differs')
    return expected

def write_json(file,value):
    temporary=file.with_name(file.name+'.new')
    fd=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        with os.fdopen(fd,'w') as out:json.dump(value,out,indent=2);out.write('\n');out.flush();os.fsync(out.fileno())
        os.chmod(temporary,0o444);os.replace(temporary,file)
        d=os.open(str(file.parent),os.O_RDONLY|os.O_DIRECTORY);os.fsync(d);os.close(d)
    except BaseException:
        # Preserve an incomplete temp file for operator diagnosis, never remove
        # an existing policy or any task recovery material.
        raise

def inspector(profile):
    file=BASE/'inspector.py'
    require(digest(read_file(str(file),262144,0))==profile['moduleSha256'],'Protected module bytes differ')
    sys.dont_write_bytecode=True
    spec=importlib.util.spec_from_file_location('fixed_managed_inspector',file)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    return m

def main(action,file):
    require(os.geteuid()==0 and os.environ.get('SUDO_UID','1000')=='1000','Admitted ordinary caller/root component required')
    # The fixed launcher, interpreter and profile are root-owned; no writable
    # source, git configuration, caller program or shell command runs as root.
    p=json_unique(read_file(str(PROFILE),32768,0));m=inspector(p)
    m.trusted_path(str(PROFILE));m.trusted_path(str(BASE/'task-admin.py'));m.trusted_path(str(BASE/'python'))
    parent=directory(str(pathlib.Path(file).parent))
    try:
        require(os.readlink('/proc/self/fd/'+str(parent))==str(pathlib.Path(file).parent),'Config parent moved')
        c=json_unique(read_file(file,32768,UID));taskrun=validate_config(c,p,file)
        source=directory(c['sourceRoot']);scope=directory(c['scopeRoot']);base=directory(p['scopeBase'])
        try:
            require(identity(os.fstat(base))==p['scopeBaseIdentity'],'Managed namespace changed')
            require(os.fstat(source).st_uid==UID and os.fstat(scope).st_uid==UID,'Task directory owner differs')
            require(os.fstat(scope).st_dev==os.fstat(base).st_dev==pathlib.Path('/workspaces').stat().st_dev,'Task scope is not on the workspace filesystem')
            b=json_unique(read_file(c['beginInputFile'],131072,UID))
            require(b.get('schemaVersion')=='2.0' and b.get('project')=='ARCHITECTURE' and b.get('taskId')==c['taskId'] and b.get('targetEnvironment')=='development' and b.get('executionEnvironment')=='codespaces','Begin identity differs')
            src=pathlib.Path(c['sourceRoot'])/'scripts/governance/codespace-cleanup-inspector.py'
            srcparent=directory(str(src.parent))
            try:
                require(os.readlink('/proc/self/fd/'+str(srcparent))==str(src.parent),'Source parent changed')
                require(digest(read_file('/proc/self/fd/'+str(srcparent)+'/'+src.name,262144,UID))==p['moduleSha256'],'Task source differs from admitted managed component')
            finally:os.close(srcparent)
            lock=os.open(str(RUN/'admission.lock'),os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW|os.O_CLOEXEC,0o600)
            try:
                fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
                # Stable task policy and guard are created only once. Existing
                # guards without their root policy mean recovery, never adoption.
                policyfile=taskrun/'policy.json'
                if action=='start' and not taskrun.exists():
                    os.mkdir('.managed-private-root',0o700,dir_fd=scope)
                    g=os.stat('.managed-private-root',dir_fd=scope,follow_symlinks=False)
                    require(g.st_uid==0 and g.st_dev==os.fstat(scope).st_dev,'Private guard identity differs')
                    taskrun.mkdir(mode=0o755);os.chown(taskrun,0,GID)
                    (taskrun/'.deployment-anchor').write_text(c['taskId']+'\n');os.chmod(taskrun/'.deployment-anchor',0o444)
                    policy={'schemaVersion':'1.0','protocol':m.PROTOCOL,'mode':'managed-private-v1',
                      'projectKey':'ARCHITECTURE','taskId':c['taskId'],'repository':'profitia/SG-dev','executionUid':UID,'executionGid':GID,
                      'sourceRoot':c['sourceRoot'],'scopeRoot':c['scopeRoot'],'modulePath':str(BASE/'inspector.py'),'moduleSha256':p['moduleSha256'],
                      'pythonPath':str(BASE/'python'),'socketPath':str(taskrun/'broker.sock'),
                      'guardRoot':c['scopeRoot']+'/.managed-private-root','guardIdentity':identity(g),
                      'maxEntries':4,'maxBytes':8192,'resources':[{'name':RESOURCE,'maxBytes':4096}]}
                    write_json(policyfile,policy)
                require(policyfile.exists(),'Missing immutable task policy; preserve recovery')
                policy=m.load_policy(str(policyfile))
                for key in ['taskId','scopeRoot','sourceRoot']:require(policy[key]==c[key],'Installed task policy identity differs')
                if action=='promote':
                    require(c['taskId']==p['pilotTaskId'],'Only the admitted pilot may promote this policy')
                    if p['status']=='ACTIVE':return {'status':'POLICY_ACTIVE','taskId':c['taskId'],'class':CLASS}
                    # The ordinary client first observes absence and stops its
                    # broker. The root journal then supplies independent proof.
                    require(not pathlib.Path(policy['socketPath']).exists(),'Pilot broker must stop before promotion')
                    store=m.ManagedStore(policy)
                    try:
                        require(len(store.index['resources'])==1,'Exactly one real pilot cache required')
                        e=store.index['resources'][0];require(e['state']=='COMMITTED' and e.get('workerStopped') is True,'Pilot cleanup is incomplete')
                        request={'protocol':m.PROTOCOL,'policyDigest':policy['_digest'],'requestId':'a'*40,'action':'status',
                          **{k:policy[k] for k in ['projectKey','taskId','repository','sourceRoot','scopeRoot']},
                          **{k:e[k] for k in ['path','allocationId','kind','identity','phase']}}
                        actual=store.dispatch(request);require(actual.get('physicalAbsent') is True,'Pilot cache still exists')
                    finally:store.shutdown()
                    p.update(status='ACTIVE',pilotPhysicalCleanupVerified=True,pilotAllocationId=e['allocationId'])
                    write_json(PROFILE,p)
                    return {'status':'POLICY_ACTIVE','taskId':c['taskId'],'class':CLASS,'pilotAllocationId':e['allocationId']}
                pidfile=taskrun/'broker-process.json';sock=pathlib.Path(policy['socketPath'])
                if pidfile.exists():
                    old=json_unique(read_file(str(pidfile),1024,0))
                    try:
                        birth,state=m.pid_identity(old['pid']);alive=birth==old['startTime'] and state not in ['Z','X']
                    except (FileNotFoundError,ProcessLookupError):alive=False
                    if alive:
                        require(sock.is_socket(),'Previous broker is live without a usable socket')
                        return {'status':'BROKER_READY','taskId':c['taskId'],'class':CLASS,'pid':old['pid'],'resumed':True}
                    if sock.exists():m.trusted_path(str(sock),socket_file=True);sock.unlink()
                require(not sock.exists(),'Unexplained task socket requires recovery')
                log=os.open(str(taskrun/'broker.log'),os.O_WRONLY|os.O_CREAT|os.O_APPEND|os.O_NOFOLLOW,0o600)
                try:
                    command=['/usr/bin/setpriv','--reuid=0','--regid=1000','--clear-groups',
                      '--bounding-set=-all,+dac_override,+setgid,+setuid','--inh-caps=-all','--ambient-caps=-all','--no-new-privs',
                      str(BASE/'python'),'-I',str(BASE/'inspector.py'),'managed-serve','--descriptor',str(policyfile)]
                    child=subprocess.Popen(command,cwd='/',env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'},stdin=subprocess.DEVNULL,stdout=log,stderr=log,close_fds=True,start_new_session=True)
                finally:os.close(log)
                start=m.pid_identity(child.pid)[0]
                write_json(pidfile,{'pid':child.pid,'startTime':start,'taskId':c['taskId']})
                for _ in range(100):
                    require(child.poll() is None,'Fixed task broker failed; inspect root log')
                    if sock.is_socket():break
                    time.sleep(0.02)
                require(sock.is_socket(),'Task broker startup did not complete')
                return {'status':'BROKER_READY','taskId':c['taskId'],'class':CLASS,'pid':child.pid,'resumed':False}
            finally:os.close(lock)
        finally:os.close(source);os.close(scope);os.close(base)
    finally:os.close(parent)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['start','promote']);parser.add_argument('--config',required=True)
    args=parser.parse_args()
    try:print(json.dumps(main(args.action,args.config)))
    except Exception as e:print(str(e),file=sys.stderr);sys.exit(2)
