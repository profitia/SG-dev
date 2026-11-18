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
  return { root, source, scope, bare, base, state, stateFile, save, resource, audit, clean }
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
  const other=path.join(f.root,'other');git(f.root,'clone',f.bare,other)
  git(other,'switch','-c','main','origin/main')
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
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject)})
  assert.equal(f.clean().summary.RETAINED,1)
  assert.equal(fs.existsSync(c.path),true)
})
