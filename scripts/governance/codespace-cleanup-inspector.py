#!/usr/bin/env python3
"""Task-bound process observation and private resource execution.

Legacy process observation is read-only. Managed mode removes only newly
created private resources through its trusted ordinary worker. Publication
installs no privileges and does not activate global cleanup.
"""
import argparse
import array
import ctypes
import errno
import fcntl
import hashlib
import json
import os
import pathlib
import re
import socket
import stat
import struct
import sys
import time
import uuid

PROTOCOL = 'PROFITIA_CLEANUP_INSPECTOR_V1'
OWNER_FILE = '.codespace-cleanup-owner.json'
MAX_MESSAGE = 2_000_000
PROTECTED = {'.git', '.pmos', '.context', '.ssh', '.gnupg', '.aws', '.config',
             'recovery', 'recoveries', 'journal', 'journals', 'pending', 'closeout',
             'closeouts', 'evidence', 'receipts', 'archives', 'history', 'phr',
             'memoros', 'lkg', 'credentials', 'secrets', 'private', 'locks', '.env', '.env.local'}


class Refusal(Exception):
    pass


def require(value, reason):
    if not value:
        raise Refusal(reason)


def canonical(value):
    require(isinstance(value, str) and value.startswith('/') and os.path.normpath(value) == value
            and '\0' not in value, 'Absolute normalized path required')
    return value


def inside(value, parent):
    return value.startswith(parent.rstrip('/') + '/')


def plain_json(data):
    def unique(items):
        result = {}
        for k, v in items:
            require(k not in result, 'Duplicate JSON key')
            result[k] = v
        return result
    return json.loads(data, object_pairs_hook=unique)


def stable(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def trusted_path(value, *, socket_file=False):
    """The executable, descriptor and socket ancestors cannot be replaced by a client."""
    canonical(value)
    current = pathlib.Path('/')
    parts = pathlib.Path(value).parts[1:]
    for i, part in enumerate(parts):
        current /= part
        s = current.lstat()
        require(not stat.S_ISLNK(s.st_mode) and s.st_uid == 0, 'Trusted path must be root-owned without symlinks')
        if i == len(parts)-1 and socket_file:
            require(stat.S_ISSOCK(s.st_mode) and not s.st_mode & 0o002, 'Untrusted broker socket')
        else:
            require(not s.st_mode & 0o022, 'Trusted path is writable by a non-root principal')
            require(stat.S_ISDIR(s.st_mode) if i < len(parts)-1 else stat.S_ISREG(s.st_mode), 'Invalid trusted path type')


def open_directory(value):
    """Pin every component with O_NOFOLLOW; mutable task parents are never followed as symlinks."""
    canonical(value)
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
    try:
        for part in pathlib.Path(value).parts[1:]:
            next_fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=fd)
            os.close(fd)
            fd = next_fd
        return fd
    except BaseException:
        os.close(fd)
        raise


def identity(s):
    return {'dev': s.st_dev, 'ino': s.st_ino}


def read_at(parent, name, maximum=MAX_MESSAGE):
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=parent)
    try:
        s = os.fstat(fd)
        require(stat.S_ISREG(s.st_mode) and s.st_size <= maximum, 'Unsafe or oversized regular file')
        chunks = []
        remaining = maximum + 1
        while remaining:
            block = os.read(fd, min(65536, remaining))
            if not block:
                break
            chunks.append(block)
            remaining -= len(block)
        data = b''.join(chunks)
        require(len(data) <= maximum, 'File exceeded its inspection bound')
        return data
    finally:
        os.close(fd)


def protected(name):
    n = name.lower()
    return n in PROTECTED or n.startswith('.env.') or bool(re.search(r'\.(pem|key|p12|pfx|sqlite|db)$', n))


def inventory(parent, name, max_entries=10000, max_bytes=64*1024*1024):
    """Bound content and object identities before and after sealing, without following links."""
    rows, objects = [], set()
    total = 0
    top = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=parent)
    root_identity = identity(os.fstat(top))
    objects.add((root_identity['dev'], root_identity['ino']))

    def visit(fd, prefix):
        nonlocal total
        for entry in sorted(os.listdir(fd)):
            require(len(rows) < max_entries, 'Inventory entry bound exceeded')
            rel = prefix + entry
            require(not protected(entry) or (not prefix and entry == OWNER_FILE), 'Protected content in guarded candidate')
            s = os.stat(entry, dir_fd=fd, follow_symlinks=False)
            require(s.st_dev == root_identity['dev'], 'Nested filesystem boundary')
            require(stat.S_ISDIR(s.st_mode) or stat.S_ISREG(s.st_mode), 'Symlink or special filesystem entry')
            objects.add((s.st_dev, s.st_ino))
            if stat.S_ISDIR(s.st_mode):
                rows.append([rel, 'd', s.st_dev, s.st_ino, stat.S_IMODE(s.st_mode), 0, ''])
                child = os.open(entry, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=fd)
                try:
                    require(identity(os.fstat(child)) == identity(s), 'Directory changed during inventory')
                    visit(child, rel + '/')
                finally:
                    os.close(child)
            else:
                require(s.st_nlink == 1, 'Hardlinked file cannot be sealed for exclusive removal')
                total += s.st_size
                require(total <= max_bytes, 'Inventory byte bound exceeded')
                data = read_at(fd, entry, max_bytes)
                after = os.stat(entry, dir_fd=fd, follow_symlinks=False)
                require(identity(after) == identity(s) and after.st_size == len(data), 'File changed during inventory')
                rows.append([rel, 'f', s.st_dev, s.st_ino, stat.S_IMODE(s.st_mode), len(data), sha(data)])
        rows.sort(key=lambda r: r[0].encode('utf8'))

    try:
        visit(top, '')
        marker = read_at(top, OWNER_FILE)
        return {'identity': root_identity, 'treeDigest': sha(json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode()),
                'objects': objects, 'marker': plain_json(marker), 'markerSha256': sha(marker), 'bytes': total}
    finally:
        os.close(top)


def load_policy(file):
    trusted_path(file)
    p = plain_json(pathlib.Path(file).read_bytes())
    require(p.get('protocol') == PROTOCOL and p.get('schemaVersion') == '1.0', 'Invalid deployment policy')
    require(type(p.get('executionUid')) is int and p['executionUid'] > 0 and type(p.get('executionGid')) is int,
            'Cleanup execution must remain non-root')
    require(p.get('projectKey') in ('SG2', 'ARCHITECTURE', 'SRM') and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{3,159}', p.get('taskId', '')),
            'Invalid bound task/project')
    require(p.get('repository') == 'profitia/SG-dev', 'Invalid source repository')
    for key in ('modulePath', 'pythonPath', 'socketPath', 'guardRoot', 'scopeRoot', 'sourceRoot'):
        canonical(p[key])
    require(inside(p['scopeRoot'], '/workspaces') and not inside(p['scopeRoot'], p['sourceRoot'])
            and not inside(p['sourceRoot'], p['scopeRoot']) and p['scopeRoot'] != p['sourceRoot'], 'Invalid task scope')
    if p.get('mode')=='managed-private-v1':
        require(inside(p['guardRoot'],p['scopeRoot']) and not inside(p['guardRoot'],p['sourceRoot']), 'Managed guard must stay inside exact task scope')
    else:
        require(os.path.dirname(p['guardRoot']) == '/workspaces' and p['guardRoot'] not in (p['scopeRoot'],p['sourceRoot'])
                and not inside(p['scopeRoot'],p['guardRoot']) and not inside(p['sourceRoot'],p['guardRoot']), 'Invalid workspace-backed guard root')
    require(not any(protected(x) for x in pathlib.Path(p['scopeRoot']).parts[1:]), 'Protected task scope')
    require(type(p.get('maxEntries')) is int and 1 <= p['maxEntries'] <= 10000
            and type(p.get('maxBytes')) is int and 1 <= p['maxBytes'] <= 64*1024*1024, 'Invalid inspection bounds')
    trusted_path(p['modulePath'])
    trusted_path(p['pythonPath'])
    require(os.path.realpath(__file__) == p['modulePath'] and sha(pathlib.Path(p['modulePath']).read_bytes()) == p['moduleSha256'],
            'Installed inspector bytes differ from approved deployment')
    require(isinstance(p.get('resources'), list) and 0 < len(p['resources']) <= 32, 'Exact bounded resource list required')
    if p.get('mode')=='managed-private-v1':
        require(len({r['name'] for r in p['resources']})==len(p['resources']), 'Duplicate managed name')
        for r in p['resources']:
            require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}',r.get('name','')) and not protected(r['name'])
                    and type(r.get('maxBytes')) is int and 1<=r['maxBytes']<=4*1024*1024,'Invalid admitted managed resource')
    else:
        require(len({r['path'] for r in p['resources']}) == len(p['resources']), 'Duplicate policy resource')
        for r in p['resources']:
            canonical(r['path'])
            require(inside(r['path'], p['scopeRoot']) and type(r.get('dev')) is int and type(r.get('ino')) is int,
                    'Resource outside exact task scope')
            require(not any(protected(x) for x in pathlib.Path(r['path']).relative_to(p['scopeRoot']).parts), 'Protected resource path')
            require(re.fullmatch(r'[a-f0-9]{32,64}', r.get('allocationId', '')) and re.fullmatch(r'[a-f0-9]{64}', r.get('markerSha256', '')),
                    'Resource policy lacks exact allocation/marker binding')
    p['_digest'] = sha(pathlib.Path(file).read_bytes())
    return p


def validate_request(p, r):
    require(isinstance(r, dict) and len(stable(r)) <= MAX_MESSAGE, 'Invalid request')
    require(r.get('protocol') == PROTOCOL and r.get('policyDigest') == p['_digest'], 'Policy/protocol mismatch')
    require(r.get('projectKey') == p['projectKey'] and r.get('taskId') == p['taskId']
            and r.get('repository') == p['repository'] and r.get('scopeRoot') == p['scopeRoot']
            and r.get('sourceRoot') == p['sourceRoot'], 'Task/source/scope identity mismatch')
    require(r.get('action') in ('inspect', 'clean') and r.get('phase') in ('pre-closeout', 'post-closeout'), 'Unsupported operation')
    require(re.fullmatch(r'[a-f0-9]{32,64}', r.get('requestId', '')), 'Invalid request identity')
    allowed = next((x for x in p['resources'] if x['path'] == r.get('path')), None)
    require(allowed and r.get('kind') == 'ephemeral-directory', 'Resource is not explicitly admitted')
    for key in ('dev', 'ino', 'allocationId', 'markerSha256'):
        require(r.get(key) == allowed[key], 'Resource object/marker changed')
    require(re.fullmatch(r'[a-f0-9]{64}', r.get('treeDigest', '')), 'Missing substantive tree binding')
    return allowed


def verify_tree(p, r, parent, name):
    tree = inventory(parent, name, p.get('maxEntries', 10000), p.get('maxBytes', 64*1024*1024))
    require(tree['identity'] == {'dev': r['dev'], 'ino': r['ino']} and tree['treeDigest'] == r['treeDigest']
            and tree['markerSha256'] == r['markerSha256'], 'Candidate changed since ordinary cleanup validation')
    m = tree['marker']
    for k in ('projectKey', 'taskId', 'repository', 'scopeRoot', 'path', 'kind', 'allocationId'):
        require(m.get(k) == r.get(k), 'Owner marker does not match the admitted task')
    require(m.get('schemaVersion') == '1.0', 'Invalid owner marker version')
    return tree


def pid_identity(pid, proc=pathlib.Path('/proc')):
    text = (proc/str(pid)/'stat').read_text()
    parts = text[text.rfind(')')+2:].split()
    return parts[19], parts[0]


def scan_consumers(objects, prefixes, source_dev, proc=pathlib.Path('/proc')):
    """Bounded full visible process/thread observation, never delete authority.

    File descriptions can be transferred while /proc is read, or queued outside
    its FD tables. The separate reference-domain gate is mandatory for clean.
    """
    own_ns = {ns:os.readlink(proc/'self/ns'/ns) for ns in ('pid','mnt','user')}
    mount_rows = (proc/'self/mountinfo').read_text().splitlines()
    device = f'{os.major(source_dev)}:{os.minor(source_dev)}'
    require(sum(row.split()[2] == device for row in mount_rows) == 1,
            'Filesystem mount alias prevents exclusive containment proof')
    checked = checked_threads = descriptors_seen = 0
    ordinary_pids = set()
    initial_pids = {x.name for x in proc.iterdir() if x.name.isdigit()}
    for pid in sorted(initial_pids):
        item = proc/pid
        require(checked < 4096, 'Process observation bound exceeded')
        try:
            start, _ = pid_identity(pid, proc)
            initial_threads = {x.name for x in (item/'task').iterdir() if x.name.isdigit()}
            require(initial_threads, 'Empty process thread observation')
            for tid in sorted(initial_threads):
                thread = item/'task'/tid
                require(checked_threads < 16384, 'Thread observation bound exceeded')
                thread_start, state = pid_identity(tid, item/'task')
                data = dict(x.split(':',1) for x in (thread/'status').read_text().splitlines() if ':' in x)
                uids = [int(x) for x in data['Uid'].split()]
                for ns in ('pid','mnt','user'):
                    require(os.readlink(thread/'ns'/ns) == own_ns[ns],
                            'Unobserved mount namespace or other namespace could expose the candidate')
                require(0 in uids or int(data.get('CapPrm','0').strip(),16) == 0,
                        'Privileged non-root peer is outside the containment model')
                if 0 not in uids and state != 'Z':
                    ordinary_pids.add(int(pid))
                refs = [thread/'cwd',thread/'root']
                try:
                    refs += list((thread/'fd').iterdir())
                except FileNotFoundError:
                    require(not thread.exists() or state == 'Z', 'Live process has unavailable descriptor observation')
                for ref in refs:
                    descriptors_seen += 1
                    require(descriptors_seen <= 30000, 'Descriptor observation bound exceeded')
                    try:
                        value = os.readlink(ref).removesuffix(' (deleted)')
                        s = os.stat(ref)
                        require((s.st_dev,s.st_ino) not in objects
                                and not any(value == x or inside(value,x) for x in prefixes),'ACTIVE_CONSUMER')
                    except FileNotFoundError:
                        require(ref.name not in ('cwd','root') or not thread.exists() or state == 'Z',
                                'Live process path observation is incomplete')
                with (thread/'maps').open('r') as mappings:
                    map_text = mappings.read(MAX_MESSAGE+1)
                require(len(map_text) <= MAX_MESSAGE, 'Mapping observation bound exceeded')
                for row in map_text.splitlines():
                    fields = row.split(None,5)
                    require(len(fields) >= 5, 'Malformed process mapping observation')
                    major,minor = (int(x,16) for x in fields[3].split(':'))
                    require((os.makedev(major,minor),int(fields[4])) not in objects,'ACTIVE_MMAP_CONSUMER')
                    if len(fields) == 6:
                        mapped = fields[5].removesuffix(' (deleted)')
                        require(not any(mapped == x or inside(mapped,x) for x in prefixes),'ACTIVE_MMAP_CONSUMER')
                if thread.exists():
                    require(pid_identity(tid,item/'task')[0] == thread_start,'PID identity changed during observation')
                checked_threads += 1
            require(initial_threads == {x.name for x in (item/'task').iterdir() if x.name.isdigit()},
                    'Thread population changed during observation')
            require(pid_identity(pid,proc)[0] == start,'PID identity changed during observation')
            checked += 1
        except (FileNotFoundError,ProcessLookupError):
            require(not item.exists(),'Live process observation became incomplete')
        except PermissionError as e:
            raise Refusal(f'Incomplete process observation: {e.errno}') from e
    require(initial_pids == {x.name for x in proc.iterdir() if x.name.isdigit()},
            'Process population changed during observation')
    return {'checkedProcesses':checked,'checkedThreads':checked_threads,'complete':True,
            'ordinaryPids':sorted(ordinary_pids),'pidNamespace':own_ns['pid']}


def require_reference_domain(p, peer, coverage):
    """No claim that a shared Codespace /proc scan proves exclusive references.

    This implementation admits removal only in an administrator-established
    domain with private resource exposure from allocation and no other ordinary
    process. The normal shared Codespace controller/agent does not satisfy it.
    A root policy records the separately approved boundary; it cannot create one.
    """
    domain = p.get('referenceDomain', {})
    require(domain.get('mode') == 'exclusive-reference-domain-v1'
            and domain.get('resourceExposure') == 'private-since-allocation'
            and re.fullmatch(r'[a-f0-9]{64}',domain.get('authorityEvidenceSha256','')),
            'REFERENCE_DOMAIN_REQUIRED: a /proc scan alone cannot exclude transferred or queued descriptors')
    for ns in ('pid','mnt','user'):
        require(domain.get(ns+'Namespace') == os.readlink('/proc/self/ns/'+ns),
                'REFERENCE_DOMAIN_REQUIRED: admitted namespace boundary differs')
    require(coverage.get('complete') is True and coverage.get('ordinaryPids') == [peer['pid']],
            'REFERENCE_DOMAIN_REQUIRED: another ordinary process can hold or transfer references')


def rename_noreplace(src_fd, src, dst_fd, dst):
    libc = ctypes.CDLL(None, use_errno=True)
    require(hasattr(libc, 'renameat2'), 'Atomic no-replace rename is unavailable')
    if libc.renameat2(src_fd, os.fsencode(src), dst_fd, os.fsencode(dst), 1) != 0:
        raise OSError(ctypes.get_errno(), 'Atomic no-replace rename refused')


def write_record(parent, name, value):
    temp = '.journal-'+uuid.uuid4().hex
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_CLOEXEC, 0o600, dir_fd=parent)
    try:
        data = (stable(value)+'\n').encode()
        with os.fdopen(fd, 'wb', closefd=False) as out:
            out.write(data)
            out.flush()
            os.fsync(fd)
    finally:
        os.close(fd)
    os.rename(temp, name, src_dir_fd=parent, dst_dir_fd=parent)
    os.fsync(parent)


class Guard:
    """Filesystem transaction core; public server always uses owner UID zero.

    Internal owner/scanner injection is used only by isolated filesystem tests.
    A non-root instance cannot authenticate as the root broker to a real client.
    """
    def __init__(self, policy, _owner_uid=0, _scanner=scan_consumers):
        self.p, self.owner, self.scan = policy, _owner_uid, _scanner
        self.fd = self.lock = self.watch = None
        try:
            self._initialize(policy)
        except BaseException:
            self.close()
            raise

    def _initialize(self, policy):
        self.fd = open_directory(policy['guardRoot'])
        s = os.fstat(self.fd)
        require(s.st_uid == self.owner and stat.S_IMODE(s.st_mode) == 0o700
                and identity(s) == policy['guardIdentity'], 'Guard directory identity/ownership is not trusted')
        self.lock = os.open('.broker.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=self.fd)
        fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        libc = ctypes.CDLL(None, use_errno=True)
        self.watch = libc.inotify_init1(os.O_NONBLOCK | os.O_CLOEXEC)
        require(self.watch >= 0, 'Cannot watch guard path identity changes')
        # /workspaces is user-writable on Codespaces. Pin the root-owned inode
        # and reject even an ABA rename while any path-based process evidence is read.
        mask = 0x00000800 | 0x00000400 | 0x00002000 | 0x00004000
        require(libc.inotify_add_watch(self.watch, os.fsencode(f'/proc/self/fd/{self.fd}'), mask) >= 0,
                'Cannot protect guard location against concurrent rename')
        self.moved = False

    def close(self):
        for key in ('watch','lock','fd'):
            fd = getattr(self,key,None)
            if fd is not None and fd >= 0:
                os.close(fd)
            setattr(self,key,None)

    def stationary(self):
        try:
            if os.read(self.watch,65536):
                self.moved = True
        except BlockingIOError:
            pass
        require(not self.moved and os.readlink(f'/proc/self/fd/{self.fd}')==self.p['guardRoot'], 'Guard path moved during observation; preserve and recover')
        st=os.fstat(self.fd)
        require(st.st_uid==self.owner and stat.S_IMODE(st.st_mode)==0o700 and identity(st)==self.p['guardIdentity'],'Guard ownership/identity changed')

    def unresolved(self):
        result = []
        for name in os.listdir(self.fd):
            if re.fullmatch(r'[a-f0-9]{32}', name):
                fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=self.fd)
                try:
                    record = plain_json(read_at(fd, 'transaction.json'))
                    if record['state'] not in ('COMMITTED', 'RESTORED'):
                        result.append(name)
                finally:
                    os.close(fd)
        return result

    def prepare(self, r, peer):
        self.stationary()
        require(not self.unresolved(), 'RECOVERY_REQUIRED: unresolved guarded transaction')
        validate_request(self.p, r)
        parent = open_directory(os.path.dirname(r['path']))
        outer = inner = None
        name = os.path.basename(r['path'])
        record = None
        try:
            require(os.readlink(f'/proc/self/fd/{parent}') == os.path.dirname(r['path']), 'Source parent changed')
            initial_tree = verify_tree(self.p, r, parent, name)
            initial_coverage = self.scan(initial_tree['objects'], [r['path']], r['dev'])
            require_reference_domain(self.p, peer, initial_coverage)
            require(os.fstat(parent).st_dev == os.fstat(self.fd).st_dev, 'Guard must use the same workspace filesystem')
            token = uuid.uuid4().hex
            os.mkdir(token, 0o700, dir_fd=self.fd)
            outer = os.open(token, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=self.fd)
            os.mkdir('lease', 0o700, dir_fd=outer)
            inner = os.open('lease', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=outer)
            require(os.fstat(inner).st_gid == self.p['executionGid'], 'Broker must run with the admitted execution group')
            record = {'schemaVersion':'1.0', 'token':token, 'state':'PREPARED', 'request':r, 'peer':peer,
                      'sourceParent':identity(os.fstat(parent)), 'policyDigest':self.p['_digest']}
            write_record(outer, 'transaction.json', record)
            rename_noreplace(parent, name, inner, 'candidate')
            os.fsync(parent)
            os.fsync(inner)
            tree = verify_tree(self.p, r, inner, 'candidate')
            require(os.readlink(f'/proc/self/fd/{parent}') == os.path.dirname(r['path']), 'Source parent moved during admission')
            sealed_path = os.readlink(f'/proc/self/fd/{inner}') + '/candidate'
            coverage = self.scan(tree['objects'], [r['path'],sealed_path], r['dev'])
            require_reference_domain(self.p, peer, coverage)
            self.stationary()
            record.update({'state':'SEALED', 'coverage':coverage})
            write_record(outer, 'transaction.json', record)
            # The outer root-owned0700 boundary is never opened to the client.
            # Its child permits the ordinary worker to unlink through a private FD.
            os.fchmod(inner, 0o770)
            return {'parent':parent, 'outer':outer, 'inner':inner, 'record':record}
        except BaseException:
            if record is not None:
                tx = {'parent':parent, 'outer':outer, 'inner':inner, 'record':record}
                try:
                    self.abort(tx)
                except BaseException:
                    pass  # Root journal and guarded data remain recoverable.
            if inner is not None:
                os.close(inner)
            if outer is not None:
                os.close(outer)
            os.close(parent)
            raise

    def begin(self, tx):
        r = tx['record']['request']
        require(tx['record']['state'] == 'SEALED', 'Deletion lease has already been consumed')
        require(not exists_at(tx['parent'], os.path.basename(r['path'])), 'Source path was recreated')
        self.stationary()
        tree = verify_tree(self.p, r, tx['inner'], 'candidate')
        coverage = self.scan(tree['objects'], [r['path'],os.readlink(f'/proc/self/fd/{tx["inner"]}')+'/candidate'], r['dev'])
        require_reference_domain(self.p, tx['record']['peer'], coverage)
        self.stationary()
        tx['record']['state'] = 'DELETING'
        write_record(tx['outer'], 'transaction.json', tx['record'])

    def commit(self, tx):
        require(tx['record']['state'] == 'DELETING', 'No active deletion lease')
        require(not exists_at(tx['inner'], 'candidate') and os.listdir(tx['inner']) == [], 'Candidate still exists in guard')
        os.fsync(tx['inner'])
        tx['record']['state'] = 'COMMITTED'
        write_record(tx['outer'], 'transaction.json', tx['record'])
        os.rmdir('lease', dir_fd=tx['outer'])
        return {'removed':True, 'transactionId':tx['record']['token'], 'guarded':True,
                'dev':tx['record']['request']['dev'], 'ino':tx['record']['request']['ino']}

    def abort(self, tx):
        r = tx['record']['request']
        if tx['record']['state'] not in ('PREPARED', 'SEALED'):
            raise Refusal('RECOVERY_REQUIRED: preserve guarded remnants after deletion began')
        if exists_at(tx['inner'], 'candidate'):
            verify_tree(self.p, r, tx['inner'], 'candidate')
            rename_noreplace(tx['inner'], 'candidate', tx['parent'], os.path.basename(r['path']))
            os.fsync(tx['parent'])
        else:
            verify_tree(self.p, r, tx['parent'], os.path.basename(r['path']))
        tx['record']['state'] = 'RESTORED'
        write_record(tx['outer'], 'transaction.json', tx['record'])

    def recover(self, token):
        require(re.fullmatch(r'[a-f0-9]{32}', token), 'Invalid recovery identity')
        outer = os.open(token, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=self.fd)
        inner = os.open('lease', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=outer)
        parent = None
        try:
            record = plain_json(read_at(outer, 'transaction.json'))
            require(record['policyDigest'] == self.p['_digest'], 'Recovery policy mismatch')
            try:
                live = pid_identity(record['peer']['pid'])[0] == record['peer']['startTime']
            except (FileNotFoundError, ProcessLookupError):
                live = False
            require(not live, 'Lease holder is still active; do not interfere')
            parent = open_directory(os.path.dirname(record['request']['path']))
            require(identity(os.fstat(parent)) == record['sourceParent'], 'Recovery source parent changed')
            self.abort({'parent':parent,'outer':outer,'inner':inner,'record':record})
        finally:
            if parent is not None:
                os.close(parent)
            os.close(inner)
            os.close(outer)


def exists_at(fd, name):
    try:
        os.stat(name, dir_fd=fd, follow_symlinks=False)
        return True
    except FileNotFoundError:
        return False


def packet(sock, value, fd=None):
    data = (stable(value)+'\n').encode()
    require(len(data) <= MAX_MESSAGE, 'Message exceeds bound')
    ancillary = [] if fd is None else [(socket.SOL_SOCKET, socket.SCM_RIGHTS, array.array('i', [fd]))]
    sent = sock.sendmsg([data], ancillary)
    require(sent == len(data), 'Truncated authenticated message')


def receive(sock, expect_fd=False):
    flags = getattr(socket, 'MSG_CMSG_CLOEXEC', 0)
    data, ancillary, msg_flags, _ = sock.recvmsg(MAX_MESSAGE+1, socket.CMSG_SPACE(4*4), flags)
    fds = []
    for level, kind, content in ancillary:
        if level == socket.SOL_SOCKET and kind == socket.SCM_RIGHTS:
            a = array.array('i')
            a.frombytes(content[:len(content)-(len(content)%a.itemsize)])
            fds.extend(a)
    try:
        require(data and len(data) <= MAX_MESSAGE and not msg_flags & (socket.MSG_TRUNC | socket.MSG_CTRUNC), 'Incomplete authenticated message')
        require(len(fds) == (1 if expect_fd else 0), 'Unexpected descriptor count')
        value = plain_json(data)
        return value, fds[0] if fds else None
    except BaseException:
        for fd in fds:
            os.close(fd)
        raise


def peer_credentials(sock):
    pid, uid, gid = struct.unpack('3i', sock.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
    return {'pid':pid, 'uid':uid, 'gid':gid}


def validate_peer(p, peer):
    require(peer['uid'] == p['executionUid'] and peer['gid'] == p['executionGid'], 'Unexpected cleanup principal')
    proc = pathlib.Path('/proc')/str(peer['pid'])
    for ns in ('user', 'pid', 'mnt'):
        require(os.readlink(proc/'ns'/ns) == os.readlink(pathlib.Path('/proc/self/ns')/ns), 'Client observation namespace differs')
    require((proc/'fd').stat().st_uid == 0, 'Cleanup worker must be nondumpable before receiving a private directory FD')
    data = dict(x.split(':',1) for x in (proc/'status').read_text().splitlines() if ':' in x)
    require(all(int(x) == p['executionUid'] for x in data['Uid'].split()) and int(data['CapPrm'].strip(),16) == 0,
            'Cleanup worker must retain its ordinary unprivileged identity')
    peer['startTime'] = pid_identity(peer['pid'])[0]


def handle(sock, p, guard):
    peer = peer_credentials(sock)
    validate_peer(p, peer)
    r, _ = receive(sock)
    validate_request(p, r)
    if r['action'] == 'inspect':
        require(not guard.unresolved(), 'RECOVERY_REQUIRED: guarded transaction remains')
        parent = open_directory(os.path.dirname(r['path']))
        try:
            tree = verify_tree(p, r, parent, os.path.basename(r['path']))
            coverage = scan_consumers(tree['objects'], [r['path']], r['dev'])
            packet(sock, {'protocol':PROTOCOL,'requestId':r['requestId'],'status':'OBSERVED_IDLE','coverage':coverage,'deleteAuthorized':False})
        finally:
            os.close(parent)
        return
    # Root credentials and PR_SET_DUMPABLE do not authenticate a Python
    # caller's code. Do not hand a private FD to an independently started
    # ordinary client or mistake a root-written policy for lifetime isolation.
    # A broker-created trusted worker and an actually established reference
    # boundary are still required; no descriptor field can enable this branch.
    raise Refusal('LIVE_DELETE_UNAVAILABLE: observation-only inspector; trusted worker launch and exclusive reference boundary are not implemented for this controller')


def remove_contents(parent, name):
    fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=parent)
    try:
        for entry in os.listdir(fd):
            s = os.stat(entry, dir_fd=fd, follow_symlinks=False)
            require(not stat.S_ISLNK(s.st_mode), 'Unexpected link in sealed directory')
            if stat.S_ISDIR(s.st_mode):
                remove_contents(fd, entry)
            else:
                require(stat.S_ISREG(s.st_mode) and s.st_nlink == 1, 'Unexpected sealed file type or hardlink')
                os.unlink(entry, dir_fd=fd)
    finally:
        os.close(fd)
    os.rmdir(name, dir_fd=parent)


def client(policy_file, request):
    p = load_policy(policy_file)
    require(os.getuid() == p['executionUid'] and os.geteuid() == p['executionUid']
            and os.getegid() == p['executionGid'], 'Client must not run as root or another principal')
    libc = ctypes.CDLL(None, use_errno=True)
    require(libc.prctl(4, 0, 0, 0, 0) == 0 and libc.prctl(3, 0, 0, 0, 0) == 0, 'Cannot protect private directory descriptors')
    require(request.get('action') == 'inspect', 'LIVE_DELETE_UNAVAILABLE: observation-only inspector; no trusted worker/reference boundary')
    request['policyDigest'] = p['_digest']
    validate_request(p, request)
    trusted_path(p['socketPath'], socket_file=True)
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_SEQPACKET | socket.SOCK_CLOEXEC)
    sock.settimeout(60)
    fd = None
    try:
        sock.connect(p['socketPath'])
        require(peer_credentials(sock)['uid'] == 0, 'Inspector endpoint is not the trusted root component')
        packet(sock, request)
        reply, fd = receive(sock, expect_fd=request['action'] == 'clean')
        require(reply.get('protocol') == PROTOCOL and reply.get('requestId') == request['requestId'], 'Inspector response identity mismatch')
        if request['action'] == 'inspect':
            require(reply.get('status') == 'OBSERVED_IDLE' and reply.get('coverage',{}).get('complete') is True, 'Incomplete process proof')
            return reply
        require(reply.get('status') == 'SEALED' and reply.get('dev') == request['dev'] and reply.get('ino') == request['ino']
                and reply.get('treeDigest') == request['treeDigest'], 'Sealed object proof mismatch')
        try:
            verify_tree(p, request, fd, 'candidate')
        except BaseException:
            packet(sock, {'action':'abort','token':reply['token']})
            receive(sock)
            raise
        packet(sock, {'action':'begin-delete','token':reply['token']})
        admitted, _ = receive(sock)
        require(admitted.get('status') == 'DELETE_ADMITTED' and admitted.get('token') == reply['token'], 'Deletion lease not admitted')
        # Ordinary UID, no child command or exported FD. The peer can no longer
        # acquire this directory through the path or the nondumpable worker.
        remove_contents(fd, 'candidate')
        packet(sock, {'action':'commit','token':reply['token']})
        result, _ = receive(sock)
        require(result.get('status') == 'CLEANED' and result.get('protocol') == PROTOCOL
                and result.get('requestId') == request['requestId'] and result.get('removed') is True
                and result.get('guarded') is True and result.get('dev') == request['dev'] and result.get('ino') == request['ino'], 'Missing committed removal proof')
        return result
    finally:
        if fd is not None:
            os.close(fd)
        sock.close()


def serve(policy_file):
    require(sys.platform == 'linux' and os.geteuid() == 0, 'Broker requires separately admitted root-component execution')
    status = dict(x.split(':',1) for x in pathlib.Path('/proc/self/status').read_text().splitlines() if ':' in x)
    capabilities = int(status['CapEff'].strip(),16)
    allowed = (1 << 19) | (1 << 2)
    require(all(int(status[k].strip(),16) == allowed for k in ('CapEff','CapPrm','CapBnd'))
            and int(status['CapInh'].strip(),16) == 0 and int(status['CapAmb'].strip(),16) == 0
            and status['NoNewPrivs'].strip() == '1',
            'Read-only broker requires exactly SYS_PTRACE and DAC_READ_SEARCH, no inherited/ambient capabilities, and no-new-privileges')
    p = load_policy(policy_file)
    require(os.getegid() == p['executionGid'], 'Broker execution group mismatch')
    guard = Guard(p)
    sock = None
    try:
        require(not os.path.lexists(p['socketPath']), 'Existing socket must not be overwritten')
        trusted_path(os.path.join(os.path.dirname(p['socketPath']), '.deployment-anchor'))
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_SEQPACKET | socket.SOCK_CLOEXEC)
        sock.bind(p['socketPath'])
        os.chmod(p['socketPath'],0o660)
        sock.listen(4)
        sock.settimeout(300)
        # Task-scoped and bounded, never a global installed daemon or schedule.
        for _ in range(64):
            try:
                connection, _ = sock.accept()
            except socket.timeout:
                break
            with connection:
                connection.settimeout(60)
                try:
                    handle(connection,p,guard)
                except Exception as e:
                    try:
                        packet(connection,{'protocol':PROTOCOL,'status':'REVIEW_REQUIRED','reason':str(e)[:400]})
                    except OSError:
                        pass
    finally:
        if sock is not None:
            sock.close()
            os.unlink(p['socketPath'])
        guard.close()


# Managed resources are private from creation, never adopted from the workspace.
# No arbitrary job execution or resource FD is exposed through this protocol.
MANAGED_KIND = 'managed-private-directory'

def managed_marker(p, token, path):
    return {'schemaVersion':'1.0','projectKey':p['projectKey'],'taskId':p['taskId'],
            'repository':p['repository'],'scopeRoot':p['scopeRoot'],'path':path,
            'kind':MANAGED_KIND,'allocationId':token}


def managed_child(inner, control, uid, gid):
    import resource
    import base64
    # Duplicate before closing inherited root descriptors. The child retains
    # only its private inner FD and private parent channel, never the guard FD.
    first,second=os.dup(inner),os.dup(control)
    os.dup2(first,3);os.dup2(second,4)
    maximum=resource.getrlimit(resource.RLIMIT_NOFILE)[0]
    require(maximum != resource.RLIM_INFINITY and maximum <= 1048576,'Unbounded descriptor table')
    os.closerange(5,maximum)
    null=os.open('/dev/null',os.O_RDWR)
    for fd in range(3):os.dup2(null,fd)
    if null>4:os.close(null)
    if os.geteuid()==0:
        os.setgroups([]);os.setgid(gid);os.setuid(uid)
    require(os.getuid()==uid and os.geteuid()==uid and uid>0 and os.getegid()==gid,'Worker identity differs')
    libc=ctypes.CDLL(None,use_errno=True)
    require(libc.prctl(4,0,0,0,0)==0 and libc.prctl(3,0,0,0,0)==0,'Worker cannot protect private FDs')
    require(libc.prctl(38,1,0,0,0)==0,'Worker cannot enable no-new-privileges')
    os.chdir('/')
    status=dict(x.split(':',1) for x in pathlib.Path('/proc/self/status').read_text().splitlines() if ':' in x)
    require(all(int(status[k].strip(),16)==0 for k in ['CapEff','CapPrm','CapInh','CapAmb']), 'Worker retained a capability')
    channel=socket.socket(fileno=4);frozen=False
    packet(channel,{'status':'READY','pid':os.getpid(),'uid':os.getuid(),'gid':os.getegid(),
                    'dumpable':0,'capabilities':0,'noNewPrivileges':True,'startTime':pid_identity(os.getpid())[0]})
    try:
        while True:
            command,_=receive(channel)
            op=command.get('operation')
            if op=='stop':break
            if op=='allocate':
                require(not frozen and not exists_at(3,'candidate'),'Resource already exists')
                os.mkdir('candidate',0o700,dir_fd=3)
                candidate=os.open('candidate',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=3)
                try:
                    fd=os.open(OWNER_FILE,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=candidate)
                    with os.fdopen(fd,'wb') as out:out.write((stable(command['marker'])+'\n').encode());out.flush();os.fsync(out.fileno())
                    seed=base64.b64decode(command['seedBase64'],validate=True);length=command['bytes']
                    require(0<len(seed)<=4096 and type(length) is int and 1<=length<=4*1024*1024,'Payload bounds')
                    fd=os.open('payload.bin',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=candidate)
                    with os.fdopen(fd,'wb') as out:
                        block=(seed*((65536+len(seed)-1)//len(seed)))[:65536]
                        remaining=length
                        while remaining:part=block[:remaining];out.write(part);remaining-=len(part)
                        out.flush();os.fsync(out.fileno())
                    os.fsync(candidate)
                finally:os.close(candidate)
            elif op=='attach':
                require(exists_at(3,'candidate'),'Recovery candidate missing');frozen=command.get('frozen') is True
            elif op=='freeze':frozen=True
            elif op=='read':
                require(not frozen,'Managed read lease has ended')
                candidate=os.open('candidate',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=3)
                try:data=read_at(candidate,'payload.bin',4096)
                finally:os.close(candidate)
                packet(channel,{'status':'DONE','operation':op,'uid':os.getuid(),'capabilities':0,
                                'payloadBase64':base64.b64encode(data).decode(),'payloadSha256':sha(data)})
                continue
            elif op=='clean':
                require(frozen,'Resource has an active producer lease')
                remove_contents(3,'candidate');os.fsync(3)
            else:raise Refusal('Unsupported worker operation')
            packet(channel,{'status':'DONE','operation':op,'uid':os.getuid(),'capabilities':0,'frozen':frozen})
    finally:
        os.close(3);channel.close()


def start_managed_worker(inner,p):
    a,b=socket.socketpair(socket.AF_UNIX,socket.SOCK_SEQPACKET|socket.SOCK_CLOEXEC)
    pid=os.fork()
    if pid==0:
        try:managed_child(inner,b.fileno(),p['executionUid'],p['executionGid']);os._exit(0)
        except BaseException:os._exit(2)
    b.close();a.settimeout(20)
    try:
        hello,_=receive(a)
        require(hello.get('status')=='READY' and hello.get('pid')==pid and hello.get('uid')==p['executionUid']
                and hello.get('capabilities')==0 and hello.get('dumpable')==0 and hello.get('noNewPrivileges') is True,
                'Trusted worker startup failed')
        return {'socket':a,'pid':pid,'startTime':hello['startTime']}
    except BaseException:a.close();raise


def worker_operation(worker,operation,**args):
    packet(worker['socket'],{'operation':operation,**args})
    response,_=receive(worker['socket'])
    require(response.get('status')=='DONE' and response.get('operation')==operation
            and response.get('capabilities')==0,'Trusted worker operation failed')
    return response


class ManagedStore(Guard):
    def __init__(self,p,_owner_uid=0):
        super().__init__(p,_owner_uid=_owner_uid)
        self.workers={}
        if exists_at(self.fd,'managed-index.json'):
            self.index=plain_json(read_at(self.fd,'managed-index.json'))
            require(self.index.get('policyDigest')==p['_digest'] and self.index.get('taskId')==p['taskId'], 'Managed recovery identity mismatch')
        else:
            self.index={'schemaVersion':'1.0','taskId':p['taskId'],'policyDigest':p['_digest'],'resources':[]};self.save()

    def save(self):write_record(self.fd,'managed-index.json',self.index)

    def shutdown(self):
        for worker in list(self.workers.values()):
            try:packet(worker['socket'],{'operation':'stop'})
            except OSError:pass
            worker['socket'].close()
            os.waitpid(worker['pid'],0)
        self.workers.clear();self.close()

    def validate(self,r):
        require(r.get('protocol')==PROTOCOL and r.get('policyDigest')==self.p['_digest'],'Managed protocol/policy mismatch')
        for k in ['projectKey','taskId','repository','scopeRoot','sourceRoot']:
            require(r.get(k)==self.p[k],'Managed task/source identity mismatch')
        require(re.fullmatch(r'[a-f0-9]{32,64}',r.get('requestId','')),'Managed request identity missing')
        require(r.get('action') in ['allocate','audit','release','clean','status','stop','read'],'Unsupported managed operation')
        require(r.get('phase') in ['pre-closeout','post-closeout'],'Unsupported managed phase')
        self.stationary()

    def open_resource(self,entry):
        outer=os.open(entry['allocationId'],os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=self.fd)
        inner=os.open('lease',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=outer)
        return outer,inner

    def verify(self,entry,inner):
        require(entry['state'] not in ['CREATING','BUSY','DELETING','RECOVERY_REQUIRED'],'RECOVERY_REQUIRED: incomplete managed operation')
        tree=inventory(inner,'candidate',self.p['maxEntries'],self.p['maxBytes'])
        require(tree['identity']==entry['identity'] and tree['treeDigest']==entry['treeDigest']
                and tree['marker']==entry['marker'],'Managed resource content/object changed')
        return tree

    def worker(self,entry,inner):
        if entry['allocationId'] in self.workers:return self.workers[entry['allocationId']]
        if entry.get('worker'):
            try:active=pid_identity(entry['worker']['pid'])[0]==entry['worker']['startTime']
            except (FileNotFoundError,ProcessLookupError):active=False
            require(not active,'RECOVERY_REQUIRED: prior managed worker is still active')
        self.verify(entry,inner)
        worker=start_managed_worker(inner,self.p)
        worker_operation(worker,'attach',frozen=entry['state']=='FROZEN')
        self.workers[entry['allocationId']]=worker;entry['worker']={k:worker[k] for k in ['pid','startTime']};self.save()
        return worker

    def entry(self,r):
        found=[x for x in self.index['resources'] if x['allocationId']==r.get('allocationId')]
        require(len(found)==1,'Unknown managed resource')
        entry=found[0]
        require(r.get('path')==entry['path'] and r.get('kind')==MANAGED_KIND and r.get('identity')==entry.get('identity'),'Managed path/kind/object mismatch')
        return entry

    def dispatch(self,r):
        import base64
        self.validate(r);op=r['action']
        if op=='stop':
            require(all(x['state']=='COMMITTED' for x in self.index['resources']),'Managed resources still require retention/recovery')
            return {'status':'STOPPED','referenceProtection':'PRIVATE_SINCE_CREATION_NO_FD_EXPORT'}
        if op=='allocate':
            allowed=next((x for x in self.p['resources'] if x.get('name')==r.get('name')),None)
            require(allowed,'Managed name is not admitted')
            size=r.get('bytes');seed=r.get('seedBase64','');decoded=base64.b64decode(seed,validate=True)
            require(type(size) is int and 1<=size<=allowed['maxBytes'] and 0<len(decoded)<=4096,'Managed allocation bounds')
            signature=sha(stable({'name':r['name'],'bytes':size,'seedBase64':seed,'phase':r['phase']}).encode())
            old=[x for x in self.index['resources'] if x['name']==r['name']]
            if old:
                require(len(old)==1 and old[0]['requestDigest']==signature and old[0]['state'] in ['ACTIVE','FROZEN'],'Managed allocation conflicts with existing resource')
                outer,inner=self.open_resource(old[0])
                try:self.verify(old[0],inner)
                finally:os.close(inner);os.close(outer)
                return {'status':'RESOURCE_REGISTERED',**self.receipt(old[0])}
            token=uuid.uuid4().hex;path=self.p['guardRoot']+'/'+token+'/lease/candidate'
            entry={'name':r['name'],'allocationId':token,'path':path,'kind':MANAGED_KIND,'phase':r['phase'],
                   'state':'CREATING','requestDigest':signature,'marker':managed_marker(self.p,token,path)}
            self.index['resources'].append(entry);self.save()
            os.mkdir(token,0o700,dir_fd=self.fd)
            outer=os.open(token,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=self.fd)
            try:
                os.mkdir('lease',0o770,dir_fd=outer)
                inner=os.open('lease',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=outer)
                try:
                    os.fchmod(inner,0o770)
                    require(os.fstat(inner).st_gid==self.p['executionGid'],'Managed worker group mismatch')
                    worker=start_managed_worker(inner,self.p);self.workers[token]=worker
                    entry['worker']={k:worker[k] for k in ['pid','startTime']};self.save()
                    worker_operation(worker,'allocate',marker=entry['marker'],bytes=size,seedBase64=seed)
                    tree=inventory(inner,'candidate',self.p['maxEntries'],self.p['maxBytes'])
                    data=os.open('candidate',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=inner)
                    try: allocated=sum(os.stat(n,dir_fd=data,follow_symlinks=False).st_blocks*512 for n in os.listdir(data))
                    finally:os.close(data)
                    entry.update(state='ACTIVE',identity=tree['identity'],treeDigest=tree['treeDigest'],measurement={'logicalBytes':tree['bytes'],'allocatedBytes':allocated,'entries':2})
                    self.stationary();self.save()
                finally:os.close(inner)
            finally:os.close(outer)
            return {'status':'RESOURCE_REGISTERED',**self.receipt(entry)}
        entry=self.entry(r)
        if entry['state']=='COMMITTED':
            require(op in ['audit','clean','status'],'Committed resource cannot be reactivated')
            outer,inner=self.open_resource(entry)
            try:require(not exists_at(inner,'candidate') and not os.listdir(inner),'Committed resource path was recreated')
            finally:os.close(inner);os.close(outer)
            return {'status':'NOT_APPLICABLE','physicalAbsent':True,**self.receipt(entry)}
        outer,inner=self.open_resource(entry)
        try:
            tree=self.verify(entry,inner)
            if op in ['audit','status']:
                return {'status':'OWNED_DISPOSABLE' if entry['state']=='FROZEN' else 'RETAINED',**self.receipt(entry)}
            worker=self.worker(entry,inner)
            if op=='read':
                require(entry['state']=='ACTIVE','Managed read lease has ended')
                result=worker_operation(worker,'read')
                return {'status':'CACHE_READ',**self.receipt(entry),
                        'payloadBase64':result['payloadBase64'],'payloadSha256':result['payloadSha256']}
            if op=='release':
                require(entry['state'] in ['ACTIVE','FROZEN'],'Managed resource is busy')
                worker_operation(worker,'freeze');entry['state']='FROZEN';self.save()
                return {'status':'RELEASE_ATTESTED',**self.receipt(entry)}
            require(op=='clean' and entry['state']=='FROZEN' and entry['phase']==r['phase'],'Managed producer lease or phase prevents deletion')
            require(all(r.get('authorization',{}).get(k) is True for k in ['resultVerified','retentionReleased','recoveryPreserved','noActiveConsumers']), 'Managed release authorization incomplete')
            measurement={'logicalBytes':tree['bytes'],'allocatedBytes':0,'entries':0}
            candidate=os.open('candidate',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC,dir_fd=inner)
            try:
                for name in os.listdir(candidate):
                    st=os.stat(name,dir_fd=candidate,follow_symlinks=False)
                    require(stat.S_ISREG(st.st_mode) and st.st_nlink==1,'Unexpected managed payload')
                    measurement['allocatedBytes']+=st.st_blocks*512;measurement['entries']+=1
            finally:os.close(candidate)
            self.stationary();before=os.statvfs(self.p['scopeRoot']);available_before=before.f_bavail*before.f_frsize
            entry['state']='DELETING';self.save()
            worker_operation(worker,'clean')
            require(not exists_at(inner,'candidate') and not os.listdir(inner),'Managed candidate still exists')
            packet(worker['socket'],{'operation':'stop'});worker['socket'].close()
            _,status=os.waitpid(worker['pid'],0);require(status==0,'Managed worker did not close cleanly')
            self.workers.pop(entry['allocationId'],None)
            after=os.statvfs(self.p['scopeRoot']);delta=after.f_bavail*after.f_frsize-available_before
            entry.update(state='COMMITTED',measurement=measurement,observedFreeBytesDelta=delta,workerStopped=True);self.save();self.stationary()
            return {'status':'CLEANED',**self.receipt(entry)}
        finally:os.close(inner);os.close(outer)

    def receipt(self,entry):
        return {k:entry[k] for k in ['name','allocationId','path','kind','phase','state','identity','treeDigest','worker','measurement','observedFreeBytesDelta','workerStopped'] if k in entry} | {
                'referenceProtection':'PRIVATE_SINCE_CREATION_NO_FD_EXPORT','producerLeaseActive':entry['state']=='ACTIVE'}


def managed_client(policy_file,r):
    p=load_policy(policy_file)
    require(p.get('mode')=='managed-private-v1','Wrong managed deployment mode')
    require(os.getuid()==p['executionUid'] and os.geteuid()==p['executionUid'] and os.getegid()==p['executionGid'],'Unexpected managed client identity')
    trusted_path(p['socketPath'],socket_file=True)
    r['policyDigest']=p['_digest']
    connection=socket.socket(socket.AF_UNIX,socket.SOCK_SEQPACKET|socket.SOCK_CLOEXEC);connection.settimeout(30)
    try:
        connection.connect(p['socketPath']);require(peer_credentials(connection)['uid']==0,'Managed peer is not root-owned broker')
        packet(connection,r);reply,_=receive(connection)
        require(reply.get('protocol')==PROTOCOL and reply.get('requestId')==r.get('requestId'),'Managed response identity mismatch')
        require(reply.get('status')!='REVIEW_REQUIRED',reply.get('reason','Managed operation refused'))
        return reply
    finally:connection.close()


def managed_serve(policy_file):
    require(sys.platform=='linux' and os.geteuid()==0,'Managed broker requires separately admitted root-component execution')
    p=load_policy(policy_file);require(p.get('mode')=='managed-private-v1' and os.getegid()==p['executionGid'],'Wrong managed mode/group')
    status=dict(x.split(':',1) for x in pathlib.Path('/proc/self/status').read_text().splitlines() if ':' in x)
    allowed=(1<<1)|(1<<6)|(1<<7)
    require(all(int(status[k].strip(),16)==allowed for k in ['CapEff','CapPrm','CapBnd'])
            and int(status['CapInh'].strip(),16)==0 and int(status['CapAmb'].strip(),16)==0
            and status['NoNewPrivs'].strip()=='1','Managed broker requires exactly DAC_OVERRIDE,SETGID,SETUID and no-new-privileges')
    import signal
    def terminate(*_):raise KeyboardInterrupt('Task broker stopped')
    signal.signal(signal.SIGTERM,terminate)
    os.umask(0o077);store=ManagedStore(p);listener=None
    try:
        require(not os.path.lexists(p['socketPath']),'Managed socket already exists')
        trusted_path(os.path.dirname(p['socketPath'])+'/.deployment-anchor')
        listener=socket.socket(socket.AF_UNIX,socket.SOCK_SEQPACKET|socket.SOCK_CLOEXEC)
        listener.bind(p['socketPath']);os.chmod(p['socketPath'],0o660);listener.listen(4);listener.settimeout(300)
        for _ in range(128):
            try:connection,_=listener.accept()
            except socket.timeout:break
            with connection:
                connection.settimeout(30);request={}
                try:
                    peer=peer_credentials(connection)
                    require(peer['uid']==p['executionUid'] and peer['gid']==p['executionGid'],'Unexpected managed principal')
                    request,_=receive(connection);reply=store.dispatch(request)
                    packet(connection,{'protocol':PROTOCOL,'requestId':request['requestId'],**reply})
                    if reply.get('status')=='STOPPED':break
                except Exception as e:
                    try:packet(connection,{'protocol':PROTOCOL,'requestId':request.get('requestId'),'status':'REVIEW_REQUIRED','reason':str(e)[:500]})
                    except OSError:pass
    finally:
        store.shutdown()
        if listener is not None:listener.close();os.unlink(p['socketPath'])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action',choices=['client','serve','managed-client','managed-serve'])
    parser.add_argument('--descriptor',required=True)
    args = parser.parse_args()
    if args.action in ('client','managed-client'):
        raw = sys.stdin.buffer.read(MAX_MESSAGE+1)
        require(len(raw) <= MAX_MESSAGE,'Request exceeds bound')
        print(stable((managed_client if args.action=='managed-client' else client)(args.descriptor,plain_json(raw))))
    else:
        (managed_serve if args.action=='managed-serve' else serve)(args.descriptor)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(stable({'protocol':PROTOCOL,'status':'REVIEW_REQUIRED','reason':str(error)[:500]}),file=sys.stderr)
        sys.exit(2)
