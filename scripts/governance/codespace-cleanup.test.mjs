import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { executeCleanup, OWNER_FILE } from './codespace-cleanup.mjs'

function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 10000 })
  if (r.status) throw new Error(`${args.join(' ')}: ${r.stderr}`)
  return r.stdout.trim()
}
function fixture(t) {
  // A unit test must not depend on visibility of unrelated host processes.
  // Codespaces can deny same-UID /proc reads for unrelated editor/services.
  // Scope the synthetic process table to our own process plus fixture children;
  // the implementation is unchanged and reads the real cwd/fd links for each.
  const hostProcessTable = fs.readdirSync.bind(fs)
  const visiblePids = new Set([String(process.pid)])
  t.mock.method(fs, 'readdirSync', (directory, ...args) =>
    directory === '/proc' ? [...visiblePids] : hostProcessTable(directory, ...args))
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cleanup-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const bare = path.join(root, 'remote.git')
  const source = path.join(root, 'src')
  const scope = path.join(root, 'scope')
  fs.mkdirSync(scope)
  fs.mkdirSync(source)
  git(root, 'init', '--bare', bare)
  git(source, 'init', '-b', 'main')
  git(source, 'config', 'user.name', 'Test')
  git(source, 'config', 'user.email', 'test@example.net')
  fs.writeFileSync(path.join(source, 'README.md'), 'source file\n')
  git(source, 'add', 'README.md')
  git(source, 'commit', '-m', 'initial')
  git(source, 'remote', 'add', 'origin', bare)
  git(source, 'push', '-u', 'origin', 'main')
  const taskId = 'ARCHITECTURE-CODESPACE-CLEANUP-02-TOOLING'
  const base = { command: 'audit', projectKey: 'ARCHITECTURE', taskId, repository: 'profitia/SG-dev',
    sourceRoot: source, scopeRoot: scope, phase: 'pre-closeout', allowLocalOriginForTests: true }
  const state = { schemaVersion: '1.0', projectKey: base.projectKey, taskId, repository: base.repository, scopeRoot: scope,
    resources: [], closeout: { status: 'CLOSEOUT_COMPLETE', phrPublished: true, pendingSlotCleared: true, readbackVerified: true } }
  const stateFile = path.join(root, 'task-state.json')
  const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2))
  const resource = (name, kind='ephemeral-directory', { phase='pre-closeout', create=true }={}) => {
    const p = path.join(scope, name)
    if(create) fs.mkdirSync(p, { recursive: true })
    const nonce = 'a'.repeat(30)+ (state.resources.length%10).toString(16).repeat(2)
    const entry = { kind, path: p, phase, allocationId: nonce,
      authorization: { resultVerified: true, retentionReleased: true, recoveryPreserved: true, noActiveConsumers: true } }
    const marker = { schemaVersion: '1.0', projectKey: state.projectKey, taskId, repository: state.repository,
      scopeRoot: scope, path: p, kind, allocationId: nonce }
    fs.writeFileSync(path.join(p, OWNER_FILE), JSON.stringify(marker))
    state.resources.push(entry)
    save()
    return { entry, path: p, marker }
  }
  save()
  const audit = (other={}) => executeCleanup({ ...base, stateFile, ...other })
  const clean = (other={}) => audit({ command: 'clean', confirmClean: taskId, ...other })
  const watchPid = pid => visiblePids.add(String(pid))
  return { root, source, scope, bare, base, state, stateFile, save, resource, audit, clean, watchPid }
}

test('audit without inventory does not infer ownership from directory name or age', (t) => {
  const f=fixture(t)
  fs.mkdirSync(path.join(f.scope, 'ancient-unused-worktree'))
  const result=executeCleanup(f.base)
  assert.equal(result.summary.UNKNOWN_OWNER, 1)
  assert.equal(fs.existsSync(path.join(f.scope, 'ancient-unused-worktree')), true)
})

test('positive owned cache audit and clean, with measured space delta', (t) => {
  const f=fixture(t)
  const c=f.resource('task-a-cache')
  fs.writeFileSync(path.join(c.path,'out.bin'), Buffer.alloc(4096, 1))
  assert.equal(f.audit().summary.OWNED_DISPOSABLE, 1)
  const r=f.clean()
  assert.equal(r.summary.CLEANED, 1)
  assert.equal(typeof r.results[0].observedFreeBytesDelta, 'number')
  assert.equal(fs.existsSync(c.path), false)
})

test('clean refuses when task confirmation is absent', t => {
  const f=fixture(t); f.resource('task-a-cache')
  assert.throws(()=>f.audit({command:'clean'}), /confirm-clean/)
})

test('missing marker or mismatched task is UNKNOWN_OWNER', t => {
  const f=fixture(t);const c=f.resource('cache')
  fs.unlinkSync(path.join(c.path,OWNER_FILE))
  assert.equal(f.audit().summary.UNKNOWN_OWNER,1)
  fs.writeFileSync(path.join(c.path,OWNER_FILE), JSON.stringify({...c.marker,taskId:'ANOTHER-TASK'}))
  assert.equal(f.audit().summary.UNKNOWN_OWNER,1)
  assert.equal(f.clean().summary.UNKNOWN_OWNER,1)
  assert.equal(fs.existsSync(c.path), true)
})

test('symlink to foreign folder and nested symlink are refused', t => {
  const f=fixture(t);const c=f.resource('cache')
  const foreign=path.join(f.root,'private');fs.mkdirSync(foreign);fs.writeFileSync(path.join(foreign,'keep.txt'),'keep')
  fs.symlinkSync(foreign,path.join(c.path,'escape'))
  assert.equal(f.clean().summary.REVIEW_REQUIRED,1)
  assert.equal(fs.existsSync(path.join(foreign,'keep.txt')),true)
  fs.unlinkSync(path.join(c.path,'escape'))
  const replacement=path.join(f.scope,'foreign');fs.mkdirSync(replacement)
  fs.renameSync(c.path,path.join(f.root,'old-cache'))
  fs.symlinkSync(replacement,c.path)
  assert.equal(f.audit().summary.REVIEW_REQUIRED,1)
  assert.equal(fs.existsSync(replacement),true)
})

test('protected PMOS, archive and credential content cannot be removed', t => {
  const f=fixture(t);const c=f.resource('cache')
  fs.mkdirSync(path.join(c.path,'.pmos'))
  assert.equal(f.clean().summary.REVIEW_REQUIRED,1)
  fs.rmSync(path.join(c.path,'.pmos'),{recursive:true})
  fs.writeFileSync(path.join(c.path,'.env.local'),'test=secret')
  assert.equal(f.clean().summary.REVIEW_REQUIRED,1)
  assert.equal(fs.existsSync(c.path),true)
})

test('unverified outcomes, pending continuity and active lease prevent cleanup', t => {
  const f=fixture(t); f.resource('cache')
  f.state.resources[0].authorization.noActiveConsumers=false;f.save()
  assert.equal(f.clean().summary.RETAINED,1)
  f.state.resources[0].authorization.noActiveConsumers=true
  f.state.resources[0].phase='post-closeout'
  f.state.closeout.pendingSlotCleared=false;f.save()
  assert.equal(f.clean({phase:'post-closeout'}).summary.RETAINED,1)
  assert.equal(fs.existsSync(f.state.resources[0].path),true)
})

test('do not touch foreign or primary repository roots',t=>{
  const f=fixture(t);const c=f.resource('cache')
  f.state.resources[0].path = f.source;f.save()
  assert.equal(f.clean().summary.REVIEW_REQUIRED,1)
  assert.equal(fs.existsSync(path.join(f.source,'README.md')),true)
})

test('cache containing tracked Git files is refused even with a matching marker',t=>{
  const f=fixture(t)
  const p=path.join(f.source,'node-build-cache');fs.mkdirSync(p)
  fs.writeFileSync(path.join(p,'important.txt'),'tracked')
  git(f.source,'add','node-build-cache/important.txt')
  git(f.source,'commit','-m','track cache')
  git(f.source,'push','origin','main')
  // It is deliberately outside selected scope root.
  const c=f.resource('safe-cache')
  assert.equal(f.clean().summary.CLEANED,1)
  assert.equal(fs.existsSync(path.join(p,'important.txt')),true)
})

test('valid detached Git worktree can be removed after confirmed closeout only', t=>{
  const f=fixture(t)
  const p=path.join(f.scope,'worktree-test')
  git(f.source,'worktree','add','--detach',p,'HEAD')
  const w=f.resource('worktree-test','git-worktree',{phase:'post-closeout',create:false})
  assert.equal(f.audit({phase:'pre-closeout'}).summary.RETAINED,1)
  assert.equal(f.audit({phase:'post-closeout'}).summary.OWNED_DISPOSABLE,1)
  const r=f.clean({phase:'post-closeout'})
  assert.deepEqual(r.summary,{CLEANED:1})
  assert.equal(fs.existsSync(p),false)
})

test('dirty worktree with ignored secrets or untracked changes remains', t=>{
  const f=fixture(t);const p=path.join(f.scope,'dirty-worktree')
  git(f.source,'worktree','add','--detach',p,'HEAD')
  f.resource('dirty-worktree','git-worktree',{phase:'post-closeout',create:false})
  fs.writeFileSync(path.join(p,'newfile'),'test')
  assert.equal(f.clean({phase:'post-closeout'}).summary.RETAINED,1)
  fs.unlinkSync(path.join(p,'newfile'))
  fs.writeFileSync(path.join(p,'.gitignore'),'.private\n')
  fs.writeFileSync(path.join(p,'.private'),'secret')
  assert.equal(f.clean({phase:'post-closeout'}).summary.RETAINED,1)
  assert.equal(fs.existsSync(p),true)
})

test('locked worktree, unpushed HEAD, and stale remote tracking are refused', t=>{
  const f=fixture(t);const p=path.join(f.scope,'worktree-locked')
  git(f.source,'worktree','add','--detach',p,'HEAD')
  f.resource('worktree-locked','git-worktree',{phase:'post-closeout',create:false})
  git(f.source,'worktree','lock',p)
  assert.equal(f.audit({phase:'post-closeout'}).summary.RETAINED,1)
  git(f.source,'worktree','unlock',p)
  git(p,'config','user.email','test@example.net');git(p,'config','user.name','Test')
  fs.writeFileSync(path.join(p,'newfile'),'commit')
  git(p,'add','newfile');git(p,'commit','-m','not pushed')
  assert.equal(f.clean({phase:'post-closeout'}).summary.RETAINED,1)
  assert.equal(fs.existsSync(p),true)
})

test('post-closeout requires current remote tip and never fetches automatically', t=>{
  const f=fixture(t);const p=path.join(f.scope,'stale-worktree')
  git(f.source,'worktree','add','--detach',p,'HEAD')
  f.resource('stale-worktree','git-worktree',{phase:'post-closeout',create:false})
  const other=path.join(f.root,'other');git(f.root,'clone','--no-checkout','--no-single-branch','--branch','main',f.bare,other)
  git(other,'switch','main')
  git(other,'config','user.email','test@example.net');git(other,'config','user.name','Test')
  fs.writeFileSync(path.join(other,'next.txt'),'next')
  git(other,'add','next.txt');git(other,'commit','-m','remote change');git(other,'push','origin','main')
  assert.equal(f.clean({phase:'post-closeout'}).summary.RETAINED,1)
  assert.equal(fs.existsSync(p),true)
})

test('missing PHR postcondition keeps worktree and leaves previous evidence unchanged', t=>{
  const f=fixture(t);const p=path.join(f.scope,'with-pending')
  git(f.source,'worktree','add','--detach',p,'HEAD')
  f.resource('with-pending','git-worktree',{phase:'post-closeout',create:false})
  f.state.closeout.phrPublished=false;f.save()
  assert.equal(f.clean({phase:'post-closeout'}).summary.RETAINED,1)
  assert.equal(fs.existsSync(p),true)
})

test('different repository identity is a hard STOP and no filesystem mutation', t=>{
  const f=fixture(t);f.resource('cache')
  assert.throws(()=>f.clean({repository:'elsewhere/other'}),/Source origin|Task inventory/)
  assert.equal(fs.existsSync(f.state.resources[0].path),true)
})

test('duplicate resource entry cannot pass owner verification',t=>{
  const f=fixture(t);f.resource('cache')
  f.state.resources.push({...f.state.resources[0]});f.save()
  assert.equal(f.clean().summary.REVIEW_REQUIRED,2)
})

test('clean is idempotent: a missing resource is NOT_APPLICABLE, never re-deleted',t=>{
  const f=fixture(t)
  const c=f.resource('cache');fs.writeFileSync(path.join(c.path,'artifact'),'data')
  assert.equal(f.clean().summary.CLEANED,1)
  assert.deepEqual(f.clean().summary,{NOT_APPLICABLE:1})
  assert.equal(fs.existsSync(c.path),false)
})

test('cooperative cleanup lock prevents a second executor from deleting',t=>{
  const f=fixture(t)
  const c=f.resource('cache')
  const lock=f.stateFile+'.codespace-cleanup.lock'
  fs.writeFileSync(lock,'other process holds task lock')
  try {assert.throws(()=>f.clean(), /EEXIST/) } finally {fs.unlinkSync(lock)}
  assert.equal(fs.existsSync(c.path),true)
})

test('tracked files inside the marked cache block removal',t=>{
  const f=fixture(t)
  // Scope within source is allowed, but the *source checkout itself* is protected.
  f.base.scopeRoot=f.source;f.state.scopeRoot=f.source
  const p=path.join(f.source,'build-artifact');fs.mkdirSync(p)
  fs.writeFileSync(path.join(p,'critical.txt'),'tracked')
  git(f.source,'add','build-artifact/critical.txt')
  git(f.source,'commit','-m','tracked build artifact')
  git(f.source,'push','origin','main')
  const nonce='c'.repeat(32)
  f.state.resources.push({path:p,kind:'ephemeral-directory',phase:'pre-closeout',allocationId:nonce,
    authorization:{resultVerified:true,retentionReleased:true,recoveryPreserved:true,noActiveConsumers:true}})
  fs.writeFileSync(path.join(p,OWNER_FILE),JSON.stringify({schemaVersion:'1.0',projectKey:f.state.projectKey,
    taskId:f.state.taskId,repository:f.state.repository,scopeRoot:f.source,path:p,kind:'ephemeral-directory',allocationId:nonce}))
  f.save()
  assert.equal(f.clean().summary.REVIEW_REQUIRED,1)
  assert.equal(fs.existsSync(path.join(p,'critical.txt')),true)
})

test('running same-user process with cwd inside candidate prevents cleanup',async t=>{
  const f=fixture(t)
  const c=f.resource('cache');fs.writeFileSync(path.join(c.path,'artifact'),'data')
  const { spawn } = await import('node:child_process')
  const child=spawn(process.execPath,['-e','process.stdout.write("ready\\n");setInterval(()=>{},5000)'],{cwd:c.path,stdio:['ignore','pipe','pipe']})
  t.after(()=>child.kill('SIGKILL'))
  f.watchPid(child.pid)
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject)})
  assert.equal(f.clean().summary.RETAINED,1)
  assert.equal(fs.existsSync(c.path),true)
})

test('running same-user process holding open file inside candidate prevents cleanup',async t=>{
  const f=fixture(t)
  const c=f.resource('cache');const target=path.join(c.path,'artifact');fs.writeFileSync(target,'data')
  const { spawn } = await import('node:child_process')
  const child=spawn(process.execPath,['-e','const fs=require("fs");fs.openSync(process.argv[1],"r");process.stdout.write("ready\\n");setInterval(()=>{},5000)',target],{cwd:f.root,stdio:['ignore','pipe','pipe']})
  t.after(()=>child.kill('SIGKILL'))
  f.watchPid(child.pid)
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject)})
  assert.equal(f.clean().summary.RETAINED,1)
  assert.equal(fs.existsSync(c.path),true)
})


test('inaccessible same-UID proc cwd fails closed without deleting an otherwise eligible cache', t => {
  const f = fixture(t)
  const c = f.resource('private-cache')
  fs.writeFileSync(path.join(c.path, 'artifact'), 'must survive')
  const readlink = fs.readlinkSync.bind(fs)
  const blocked = `/proc/${process.pid}/cwd`
  t.mock.method(fs, 'readlinkSync', (target, ...args) => {
    if (target === blocked) {
      const error = new Error('permission denied in restricted Codespace /proc')
      error.code = 'EACCES'
      throw error
    }
    return readlink(target, ...args)
  })
  const audit = f.audit()
  assert.equal(audit.summary.REVIEW_REQUIRED, 1)
  assert.match(audit.results[0].reason, /Unable to inspect same-user process cwd/)
  assert.equal(f.clean().summary.REVIEW_REQUIRED, 1)
  assert.equal(fs.existsSync(path.join(c.path, 'artifact')), true)
})


test('known RETAINED authorization is not masked by unreadable unrelated proc entries', t => {
  const f = fixture(t)
  const c = f.resource('unreleased-cache')
  fs.writeFileSync(path.join(c.path, 'artifact'), 'retained')
  f.state.resources[0].authorization.noActiveConsumers = false
  f.save()
  const readlink = fs.readlinkSync.bind(fs)
  t.mock.method(fs, 'readlinkSync', (target, ...args) => {
    if (target === `/proc/${process.pid}/cwd`) {
      const e = new Error('restricted proc read'); e.code = 'EACCES'; throw e
    }
    return readlink(target, ...args)
  })
  assert.equal(f.audit().summary.RETAINED, 1)
  assert.equal(f.clean().summary.RETAINED, 1)
  assert.equal(fs.existsSync(c.path), true)
})

test('protected files remain REVIEW_REQUIRED even when process telemetry is unreadable', t => {
  const f = fixture(t)
  const c = f.resource('protected-cache')
  fs.mkdirSync(path.join(c.path, '.pmos'))
  const readlink = fs.readlinkSync.bind(fs)
  t.mock.method(fs, 'readlinkSync', (target, ...args) => {
    if (target === `/proc/${process.pid}/cwd`) {
      const e = new Error('restricted proc read'); e.code = 'EACCES'; throw e
    }
    return readlink(target, ...args)
  })
  assert.equal(f.audit().summary.REVIEW_REQUIRED, 1)
  assert.match(f.clean().results[0].reason, /Protected content under candidate/)
  assert.equal(fs.existsSync(path.join(c.path, '.pmos')), true)
})

test('opt-in missing inspector fails closed and never falls back to ordinary deletion',t=>{
  const f=fixture(t),r=f.resource('opt-in-cache')
  const result=f.clean({inspectorDescriptor:path.join(f.root,'not-installed.json')})
  assert.equal(result.summary.REVIEW_REQUIRED,1)
  assert.equal(fs.existsSync(r.path),true)
})
test('caller-writable inspector policy cannot execute a substituted component',t=>{
  const f=fixture(t),r=f.resource('untrusted-inspector-cache')
  const descriptor=path.join(f.root,'inspector.json'),executed=path.join(f.root,'executed')
  fs.writeFileSync(descriptor,JSON.stringify({modulePath:executed,pythonPath:'/bin/sh'}))
  assert.equal(f.clean({inspectorDescriptor:descriptor}).summary.REVIEW_REQUIRED,1)
  assert.equal(fs.existsSync(r.path),true);assert.equal(fs.existsSync(executed),false)
})
test('protected content retains its guard before an optional inspector is called',t=>{
  const f=fixture(t),r=f.resource('protected-inspector-cache')
  fs.writeFileSync(path.join(r.path,'.env'),'synthetic')
  const result=f.clean({inspectorDescriptor:path.join(f.root,'not-installed.json')})
  assert.equal(result.summary.REVIEW_REQUIRED,1);assert.equal(fs.existsSync(r.path),true)
  assert.match(result.results[0].reason,/Protected|protected/)
})
test('opt-in does not delegate worktree removal to the inspector',t=>{
  const f=fixture(t),p=path.join(f.scope,'normal-worktree')
  git(f.source,'worktree','add','--detach',p,'HEAD')
  f.resource('normal-worktree','git-worktree',{phase:'post-closeout',create:false})
  const result=f.clean({phase:'post-closeout',inspectorDescriptor:path.join(f.root,'absent-inspector.json')})
  assert.equal(result.summary.CLEANED,1);assert.equal(fs.existsSync(p),false)
})
test('Node and isolated Python bind exactly the same substantive Unicode tree',async t=>{
  const {inspectorTreeDigest}=await import('./codespace-cleanup.mjs')
  const f=fixture(t),r=f.resource('cross-language-cache')
  for(const name of ['😀','\ue000','ąć','plain'])fs.writeFileSync(path.join(r.path,name),name)
  fs.mkdirSync(path.join(r.path,'nested'));fs.writeFileSync(path.join(r.path,'nested','bytes'),Buffer.from([0,255,127]))
  const modulePath=new URL('./codespace-cleanup-inspector.py',import.meta.url)
  const program="import importlib.util,os,sys;spec=importlib.util.spec_from_file_location('m',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);fd=m.open_directory(os.path.dirname(sys.argv[2]));print(m.inventory(fd,os.path.basename(sys.argv[2]))['treeDigest']);os.close(fd)"
  const p=spawnSync('python3',['-I','-c',program,decodeURIComponent(modulePath.pathname),r.path],{encoding:'utf8',timeout:10000})
  assert.equal(p.status,0,p.stderr)
  assert.equal(inspectorTreeDigest(r.path,10000,64*1024*1024),p.stdout.trim())
})

test('managed private kind cannot adopt an ordinary directory or fall back without its trusted broker',t=>{
  const f=fixture(t),r=f.resource('managed-adoption-attempt','managed-private-directory')
  const result=f.clean()
  assert.equal(result.summary.REVIEW_REQUIRED,1);assert.equal(fs.existsSync(r.path),true)
})
