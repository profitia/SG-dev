import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import {
  LifecycleRefusal, loadConfiguration, startTask, allocateResource, releaseResource,
  phaseReport, finishTask, verifyPhrReadback, findPhrManifestForTask, runTask, PRE_CLOSEOUT_REPORT_PREFIX,
} from './codespace-cleanup-lifecycle.mjs'
import { OWNER_FILE, executeCleanup } from './codespace-cleanup.mjs'

function git(root, ...args) {
  const p = spawnSync('git', ['-C', root, ...args], { encoding:'utf8' })
  assert.equal(p.status, 0, `${args.join(' ')}: ${p.stderr}`)
  return p.stdout.trim()
}
function write(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n') }
function fixture(t, { taskId = 'ARCHITECTURE-TEST-3219' } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sg-cleanup-lifecycle-')))
  t.after(() => fs.rmSync(root, { recursive:true, force:true }))
  const src = path.join(root, 'dev', 'source')
  const scope = path.join(root, 'dev', 'tasks')
  const phr = path.join(root, 'dev', 'phr')
  for (const dir of [src, scope, phr]) fs.mkdirSync(dir, {recursive:true})
  for (const [dir, remote] of [[src, 'profitia/SG-dev'],[phr,'profitia/project-history-repository']]) {
    git(dir, 'init', '-b', 'main')
    git(dir, 'config', 'user.name', 'fixture')
    git(dir, 'config', 'user.email', 'fixture@example.test')
    if (dir === src) {
      const registryPath = path.join(dir, 'Canon/registries/profitia-projects-v1.json')
      fs.mkdirSync(path.dirname(registryPath), {recursive:true})
      write(registryPath,{schemaVersion:'1.0',projects:[{projectKey:'ARCHITECTURE',displayName:'ARCHITECTURE',
        status:'ACTIVE',repository:{slug:'profitia/SG-dev'},workspaces:['SG-dev Architecture']} ]})
    }
    fs.writeFileSync(path.join(dir, 'initial.txt'), 'fixture')
    git(dir, 'add', 'initial.txt'); git(dir, 'commit', '-qm', 'init')
    git(dir, 'remote', 'add', 'origin', `https://github.com/${remote}.git`)
  }
  const beginFile = path.join(scope, 'begin.json')
  const beginInput = {schemaVersion:'2.0', taskId, title:'Lifecycle fixture', scope:'Testing task resource lifecycle',
    project:'ARCHITECTURE', workspace:'SG-dev Architecture', executionEnvironment:'codespaces',
    targetEnvironment:'development', hostConversationId:null, originalTaskRequest:'Test context',
    declaredTargetPaths:['scripts/governance/codespace-cleanup-lifecycle.mjs']}
  write(beginFile, beginInput)
  const configFile = path.join(scope, 'config.json')
  const c = { schemaVersion:'1.0', projectKey:'ARCHITECTURE', taskId, repository:'profitia/SG-dev',
    sourceRoot:src, scopeRoot:scope, stateFile:path.join(scope,'state.json'), beginInputFile:beginFile, phrRoot:phr }
  write(configFile, c)
  const config = loadConfiguration(configFile)
  const calls = []
  let saveComplete = false
  const hooks = {}
  const runner = (cmd, args, cwd) => {
    calls.push([cmd,args,cwd])
    if (cmd==='node') return JSON.stringify({verdict:'PASS'})
    if (cmd==='npx' && args.includes('tsx') && args.includes('scripts/pmos-prepare-execution-handoff.ts')) {
      const source=args[args.indexOf('--input')+1],out=args[args.indexOf('--output')+1]
      const v=JSON.parse(fs.readFileSync(source,'utf8'))
      if (!Array.isArray(v.findings?.findings) || v.findings.findings.length===0)
        throw Error('canonical PMOS bootstrap validation failed')
      write(out,v)
      return `Prepared bootstrap input for ${v.metadata.taskId}`
    }
    if (args.includes('pmos:save')) { hooks.onSave?.(); saveComplete = true; fs.rmSync(path.join(src,'apps/pmos/.pmos/pending-artifact.json'),{force:true}); return 'PMOS persistence COMPLETE' }
    if (args.includes('--check-task-id')) return JSON.stringify({status:'PASS',executionStatus:saveComplete?'completed':'running',taskId,registrationId:'registered-11'})
    if (args.includes('pmos:begin')) return JSON.stringify({status:'REGISTERED',taskId,registrationId:'registered-11',conversationId:'pmos-task-v2:test'})
    throw new Error('Unexpected command')
  }
  const runtime = {run:runner,verifyPhr:() => ({head:'f'.repeat(40),manifestRelative:'history/2026/11/18/task/manifest.json',publicationId:`ARCHITECTURE:${taskId}`,bundleHash:'a'.repeat(64),publicationCommit:'f'.repeat(40)})}
  return {root,src,scope,phr,configFile,c,config,beginFile,beginInput,calls,runtime,hooks,hasSaved:()=>saveComplete}
}
function begin(f){return startTask(f.config,f.runtime)}
function allocated(f, name='trial-build', phase='pre-closeout') {
  begin(f)
  return allocateResource(f.config,{name,kind:'ephemeral-directory',phase},f.runtime)
}
function release(f,r,overrides={}) {
  const e = {schemaVersion:'1.0',projectKey:'ARCHITECTURE',taskId:f.config.taskId,allocationId:r.allocationId,
    kind:r.kind,path:r.path, verificationRef:'fixture:completed-and-retention-reviewed',authorization:{resultVerified:true,retentionReleased:true,recoveryPreserved:true,noActiveConsumers:true},...overrides}
  const p=path.join(f.scope,'release-evidence.json');write(p,e);return p
}
function finishFixture(f, opts, runtime = f.runtime) {
  const file=path.join(f.scope,'fixture-bootstrap.json')
  if (!fs.existsSync(file)) bootstrapFixture(f,file)
  return finishTask(f.config, {bootstrapInputFile:file,...opts}, runtime)
}
function tracked(stateFile){return JSON.parse(fs.readFileSync(stateFile,'utf8'))}

test('configuration validates actual Git origins and canonical source/scope/PHR roots',t=>{
  const f=fixture(t);assert.equal(f.config.projectKey,'ARCHITECTURE');assert.equal(f.config.beginInput.taskId,f.config.taskId)
})
test('configuration refuses foreign repository and state outside scope',t=>{
  const f=fixture(t);write(f.configFile,{...f.c,repository:'other/SG-dev'});assert.throws(()=>loadConfiguration(f.configFile),/identity mismatch/)
  write(f.configFile,{...f.c,stateFile:path.join(f.root,'elsewhere.json')});assert.throws(()=>loadConfiguration(f.configFile),/inside the dedicated scope/)
})
test('configuration refuses symlink scope and protected PMOS state path',t=>{
  const f=fixture(t);const alias=path.join(f.root,'alias');fs.symlinkSync(f.scope,alias)
  write(f.configFile,{...f.c,scopeRoot:alias});assert.throws(()=>loadConfiguration(f.configFile),/canonical physical directory/)
  write(f.configFile,{...f.c,stateFile:path.join(f.scope,'.pmos','state.json')});assert.throws(()=>loadConfiguration(f.configFile),/Protected state path/)
})
test('start invokes full preflight, canonical PMOS begin, require-begin in order',t=>{
  const f=fixture(t),r=begin(f);assert.equal(r.status,'TRACKING_INITIALIZED');assert.equal(f.calls.length,3)
  assert.match(f.calls[0][1].join(' '),/governance-preflight\.mjs/)
  assert.match(f.calls[1][1].join(' '),/pmos:begin/)
  assert.match(f.calls[2][1].join(' '),/--require-begin/)
  assert.equal(tracked(f.c.stateFile).lifecycle.beginRegistrationId,'registered-11')
})
test('start is idempotent and does not repeat PMOS begin',t=>{
  const f=fixture(t);begin(f);assert.equal(begin(f).status,'ALREADY_TRACKED');assert.equal(f.calls.filter(c=>c[1].includes('--input')).length,1)
})
test('start rejects completed inventory instead of reopening closed PMOS',t=>{
  const f=fixture(t);begin(f);const s=tracked(f.c.stateFile);s.closeout={status:'CLOSEOUT_COMPLETE'};write(f.c.stateFile,s)
  assert.throws(()=>begin(f),/cannot be reopened/)
})
test('failed preflight does not initialize state or call PMOS begin',t=>{
  const f=fixture(t);assert.throws(()=>startTask(f.config,{run:()=>{throw Error('blocked')}}),/blocked/)
  assert.equal(fs.existsSync(f.c.stateFile),false)
})
test('invalid PMOS begin acknowledgement stops before any inventory write',t=>{
  const f=fixture(t);assert.throws(()=>startTask(f.config,{run:(cmd,args)=>args.includes('pmos:begin')?'{}':'ok'}),/registration not confirmed/)
  assert.equal(fs.existsSync(f.c.stateFile),false)
})
test('failed require-begin retains PMOS registration but refuses task-state activation',t=>{
  const f=fixture(t);assert.throws(()=>startTask(f.config,{run:(cmd,args)=>{
    if(args.includes('--require-begin'))throw Error('missing gate')
    if(args.includes('pmos:begin'))return JSON.stringify({status:'REGISTERED',taskId:f.c.taskId,registrationId:'ok',conversationId:'id'})
    return 'ok'
  }}),/missing gate/);assert.equal(fs.existsSync(f.c.stateFile),false)
})
test('allocation creates only a new explicitly named directory with exact marker',t=>{
  const f=fixture(t),r=allocated(f);assert.equal(r.status,'RESOURCE_REGISTERED')
  const marker=JSON.parse(fs.readFileSync(path.join(r.path,OWNER_FILE)))
  assert.equal(marker.taskId,f.c.taskId);assert.equal(marker.allocationId,r.allocationId)
  const entry=tracked(f.c.stateFile).resources[0];assert.equal(entry.authorization.resultVerified,false)
})
test('allocation refuses pre-existing directory without adopting ownership',t=>{
  const f=fixture(t);begin(f);const existing=path.join(f.scope,'existing');fs.mkdirSync(existing)
  assert.throws(()=>allocateResource(f.config,{name:'existing',kind:'ephemeral-directory',phase:'pre-closeout'},f.runtime),/existing/)
  assert.equal(fs.existsSync(path.join(existing,OWNER_FILE)),false)
})
test('allocation rejects protected names and path traversal',t=>{
  const f=fixture(t);begin(f)
  for(const name of ['.pmos','../../foreign','history','secrets','..']) assert.throws(()=>allocateResource(f.config,{name,kind:'ephemeral-directory',phase:'pre-closeout'},f.runtime))
  assert.equal(tracked(f.c.stateFile).resources.length,0)
})
test('allocation rejects unknown kind or phase and pre-closeout worktree',t=>{
  const f=fixture(t);begin(f)
  assert.throws(()=>allocateResource(f.config,{name:'one',kind:'archive',phase:'pre-closeout'},f.runtime))
  assert.throws(()=>allocateResource(f.config,{name:'one',kind:'ephemeral-directory',phase:'after'},f.runtime))
  assert.throws(()=>allocateResource(f.config,{name:'one',kind:'git-worktree',phase:'pre-closeout'},f.runtime))
})
test('allocation after closeout is forbidden',t=>{
  const f=fixture(t);begin(f);const s=tracked(f.c.stateFile);s.closeout={status:'CLOSEOUT_COMPLETE'};write(f.c.stateFile,s)
  assert.throws(()=>allocateResource(f.config,{name:'after',kind:'ephemeral-directory',phase:'pre-closeout'},f.runtime),/after closeout/)
})
test('release requires explicit positive, task-bound evidence and preserves marker',t=>{
  const f=fixture(t),r=allocated(f);const p=release(f,r)
  assert.equal(releaseResource(f.config,p,f.runtime).status,'RELEASE_ATTESTED')
  assert.equal(tracked(f.c.stateFile).resources[0].authorization.noActiveConsumers,true)
  assert.equal(fs.existsSync(path.join(r.path,OWNER_FILE)),true)
})
test('release mismatched allocation ID is refused',t=>{
  const f=fixture(t),r=allocated(f),p=release(f,r,{allocationId:'b'.repeat(40)})
  assert.throws(()=>releaseResource(f.config,p,f.runtime),/does not match/)
})
test('release with false retention fails and does not modify inventory',t=>{
  const f=fixture(t),r=allocated(f),p=release(f,r,{authorization:{resultVerified:true,retentionReleased:false,recoveryPreserved:true,noActiveConsumers:true}})
  assert.throws(()=>releaseResource(f.config,p,f.runtime),/Four affirmative/)
  assert.equal(tracked(f.c.stateFile).resources[0].authorization.retentionReleased,false)
})
test('pre-closeout delegates read-only stage02 audit without granting deletion',t=>{
  const f=fixture(t),r=allocated(f)
  const report=phaseReport(f.config,'pre-closeout',false)
  assert.equal(report.summary.RETAINED,1);assert.equal(fs.existsSync(r.path),true)
})
test('post-closeout is blocked before verified canonical closeout',t=>{
  const f=fixture(t);allocated(f);assert.throws(()=>phaseReport(f.config,'post-closeout',false),/Post-closeout/)
})
test('finish executes canonical save, checks actual PMOS status, then verified PHR before epilogue',t=>{
  const f=fixture(t);const r=allocated(f,'temporary-trial','post-closeout')
  const events=[];const runtime={...f.runtime,run:(cmd,args,cwd)=>{events.push('run:'+args.join(' '));return f.runtime.run(cmd,args,cwd)},
    verifyPhr:(...args)=>{events.push('phr');return f.runtime.verifyPhr(...args)},
    cleanup:(args)=>{events.push('cleanup:'+args.phase+':'+args.command);return {summary:{RETAINED:1},observedFreeBytesDelta:null}}}
  const outcome=finishFixture(f,{manifestRelative:'history/2026/11/18/task/manifest.json'},runtime)
  assert.equal(outcome.status,'CLOSEOUT_VERIFIED')
  assert.deepEqual(events.map(x=>x.startsWith('run:')?(x.includes('pmos:save')?'save':x.includes('pmos-prepare')?'prepare':'check'):x),['check','cleanup:pre-closeout:audit','prepare','save','check','phr','cleanup:post-closeout:audit'])
  assert.equal(tracked(f.c.stateFile).closeout.phrPublished,true);assert.equal(fs.existsSync(r.path),true)
})
test('finish does not mark closeout if canonical PMOS save fails',t=>{
  const f=fixture(t);allocated(f)
  assert.throws(()=>finishFixture(f,{manifestRelative:'history/task/manifest.json'},{...f.runtime,run:(cmd,args,cwd)=>{if(args.includes('pmos:save'))throw Error('PMOS failed');return f.runtime.run(cmd,args,cwd)}}),/PMOS failed/)
  assert.equal(tracked(f.c.stateFile).closeout,undefined)
})
test('finish does not mark closeout if PMOS registration is not completed',t=>{
  const f=fixture(t);allocated(f)
  assert.throws(()=>finishFixture(f,{manifestRelative:'history/task/manifest.json'},{...f.runtime,run:(cmd,args,cwd)=>{if(args.includes('--check-task-id'))return JSON.stringify({status:'PASS',executionStatus:'running',registrationId:'registered-11'});return f.runtime.run(cmd,args,cwd)}}),/status or identity mismatch/)
  assert.equal(tracked(f.c.stateFile).closeout,undefined)
})
test('finish does not mark closeout if PHR cannot be independently confirmed',t=>{
  const f=fixture(t);allocated(f)
  assert.throws(()=>finishFixture(f,{manifestRelative:'history/task/manifest.json'},{...f.runtime,verifyPhr:()=>{throw Error('remote main unavailable')}}),/remote main unavailable/)
  assert.equal(tracked(f.c.stateFile).closeout,undefined)
})
test('finish prevents repeated canonical PMOS save on already completed task',t=>{
  const f=fixture(t);allocated(f);finishFixture(f,{manifestRelative:'history/task/manifest.json'},{...f.runtime,cleanup:()=>({summary:{},observedFreeBytesDelta:null})})
  const length=f.calls.length
  assert.throws(()=>finishFixture(f,{manifestRelative:'history/task/manifest.json'},f.runtime),/already recorded/)
  assert.equal(f.calls.length,length)
})
test('post-closeout delegates to stage02 once verified and remains conservative',t=>{
  const f=fixture(t);const r=allocated(f,'candidate','post-closeout')
  finishFixture(f,{manifestRelative:'history/task/manifest.json'}, {...f.runtime,cleanup:()=>({summary:{},observedFreeBytesDelta:null})})
  const audit=phaseReport(f.config,'post-closeout',false,{cleanup:args=>executeCleanup({...args,allowLocalOriginForTests:true})})
  assert.equal(audit.summary.RETAINED,1);assert.equal(fs.existsSync(r.path),true)
})
test('post-closeout clean is not called without explicit clean flag',t=>{
  const f=fixture(t);allocated(f,'candidate','post-closeout');const calls=[]
  finishFixture(f,{manifestRelative:'history/task/manifest.json'},{...f.runtime,cleanup:(args)=>{calls.push(args.command);return {summary:{},observedFreeBytesDelta:null}}})
  assert.deepEqual(calls,['audit','audit'])
})
test('release cannot be applied after the task has been completed',t=>{
  const f=fixture(t),r=allocated(f);const p=release(f,r)
  finishFixture(f,{manifestRelative:'history/task/manifest.json'},{...f.runtime,cleanup:()=>({summary:{},observedFreeBytesDelta:null})})
  assert.throws(()=>releaseResource(f.config,p,f.runtime),/completed task history/)
})

test('resume after PMOS save and transient PHR failure does not run PMOS save twice',t=>{
  const f=fixture(t);allocated(f)
  assert.throws(()=>finishFixture(f,{manifestRelative:'history/task/manifest.json'},{...f.runtime,verifyPhr:()=>{throw Error('PHR unreachable')},cleanup:()=>({summary:{},observedFreeBytesDelta:null})}),/PHR unreachable/)
  assert.equal(f.calls.filter(x=>x[1].includes('pmos:save')).length,1)
  assert.equal(tracked(f.c.stateFile).closeout,undefined)
  const completed=finishFixture(f,{manifestRelative:'history/task/manifest.json'},{...f.runtime,cleanup:()=>({summary:{},observedFreeBytesDelta:null})})
  assert.equal(completed.status,'CLOSEOUT_VERIFIED')
  assert.equal(f.calls.filter(x=>x[1].includes('pmos:save')).length,1)
})
test('finish refuses epilogue when PMOS pending slot remains after apparent save',t=>{
  const f=fixture(t);allocated(f)
  let attempted=false
  const runtime={...f.runtime,run:(cmd,args,cwd)=>{
    if(args.includes('pmos:save')){
      attempted=true
      const e=tracked(f.c.stateFile).lifecycle.preCloseoutEvidence
      const p=path.join(f.src,'apps/pmos/.pmos/pending-artifact.json');fs.mkdirSync(path.dirname(p),{recursive:true})
      write(p,{...JSON.parse(fs.readFileSync(e.inputFile,'utf8')),completionEvidence:{closeoutState:'PMOS_SAVE_STARTED'}})
      return 'PMOS output claims complete, slot left behind'
    }
    if(args.includes('--check-task-id'))return JSON.stringify({status:'PASS',executionStatus:attempted?'completed':'running',registrationId:'registered-11'})
    return f.runtime.run(cmd,args,cwd)
  }}
  assert.throws(()=>finishFixture(f,{manifestRelative:'history/task/manifest.json'},runtime),/Pending PMOS slot/)
  assert.equal(tracked(f.c.stateFile).closeout,undefined)
})
test('pre-closeout clean requires live running PMOS identity before stage02 can delete',t=>{
  const f=fixture(t);allocated(f)
  assert.throws(()=>phaseReport(f.config,'pre-closeout',true,{runtime:{run:()=>JSON.stringify({status:'PASS',executionStatus:'completed',registrationId:'registered-11'})},cleanup:()=>{throw Error('must not run')}}),/status or identity mismatch/)
})
test('post-closeout clean re-verifies exact published PHR commit before stage02',t=>{
  const f=fixture(t);allocated(f,'trial','post-closeout')
  finishFixture(f,{manifestRelative:'history/task/manifest.json'},{...f.runtime,cleanup:()=>({summary:{},observedFreeBytesDelta:null})})
  assert.throws(()=>phaseReport(f.config,'post-closeout',true,{runtime:f.runtime,verifyPhr:()=>({...f.runtime.verifyPhr(),bundleHash:'e'.repeat(64)}),cleanup:()=>{throw Error('stage02 should not be called')}}),/bundle or pinned/)
})
test('post-closeout clean can only delegate after repeat PMOS+PHR checks',t=>{
  const f=fixture(t);allocated(f,'trial','post-closeout')
  finishFixture(f,{manifestRelative:'history/task/manifest.json'},{...f.runtime,cleanup:()=>({summary:{},observedFreeBytesDelta:null})})
  let count=0
  const result=phaseReport(f.config,'post-closeout',true,{runtime:f.runtime,verifyPhr:f.runtime.verifyPhr,cleanup:(options)=>{count++;assert.equal(options.command,'clean');return {summary:{RETAINED:1}}}})
  assert.equal(count,1);assert.equal(result.summary.RETAINED,1)
})
test('release refuses evidence saved inside the disposable candidate',t=>{
  const f=fixture(t),r=allocated(f)
  const file=path.join(r.path,'evidence.json')
  write(file,{schemaVersion:'1.0',projectKey:f.c.projectKey,taskId:f.c.taskId,allocationId:r.allocationId,kind:r.kind,path:r.path,
    verificationRef:'test:123',authorization:{resultVerified:true,retentionReleased:true,recoveryPreserved:true,noActiveConsumers:true}})
  assert.throws(()=>releaseResource(f.config,file,f.runtime),/may not reside inside/)
})
function phrPublishedFixture(f) {
  const remote=path.join(f.root,'remote-phr.git')
  fs.mkdirSync(remote); git(remote,'init','--bare')
  const publicationSlug=`${f.c.projectKey}:${f.c.taskId}`.toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
  const relative='history/2026/11/18/2026-11-18__'+publicationSlug+'/manifest.json'
  const bundleDir=path.join(f.phr,path.dirname(relative));fs.mkdirSync(bundleDir,{recursive:true})
  const files=new Map()
  const published={metadata:{taskId:f.c.taskId,project:f.beginInput.project,conversationId:'pmos-task-v2:test'}}
  const present=['handoff.md','conversation-artifact.json','flight-record.json','closeout-evidence.json','integrity.json']
  const m={schemaVersion:'1.0',publicationId:'ARCHITECTURE:'+f.c.taskId,projectId:f.c.projectKey,taskId:f.c.taskId,
    sourceSystem:'PMOS',closeoutState:'CLOSEOUT_COMPLETE',result:'SUCCESS',publishedAt:'2026-11-18T20:01:00Z',
    artifacts:present.map(path=>({type:path,status:'PRESENT',path,sourceId:null}))}
  files.set('manifest.json',JSON.stringify(m,null,2)+'\n')
  files.set('handoff.md','# Completed handoff\n')
  files.set('conversation-artifact.json',JSON.stringify(published,null,2)+'\n')
  files.set('flight-record.json',JSON.stringify(published,null,2)+'\n')
  files.set('closeout-evidence.json',JSON.stringify({closeoutState:'CLOSEOUT_COMPLETE',pmosSaveStatus:'SUCCEEDED',handoffPublicationStatus:'SUCCEEDED',recoveryRequired:false},null,2)+'\n')
  // Mirror the existing canonical PHR bundle hash, without using an alternate
  // validation policy: SHA256(sort(name + NUL + sha256(raw-file-bytes))).
  const hash=v=>crypto.createHash('sha256').update(v).digest('hex')
  const list=[...files.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([path,content])=>({path,sha256:hash(content)}))
  const bundleHash=hash(list.map(x=>`${x.path}\0${x.sha256}`).join('\0'))
  files.set('integrity.json',JSON.stringify({schemaVersion:'1.0',algorithm:'sha256',bundleHash,files:list},null,2)+'\n')
  for(const [name,content] of files)fs.writeFileSync(path.join(bundleDir,name),content)
  git(f.phr,'add','.'); git(f.phr,'commit','-qm','publish task A')
  git(f.phr,'push',remote,'main:main')
  git(f.phr,'config',`url.file://${remote}.insteadOf`,'https://github.com/profitia/project-history-repository.git')
  // The controlled PMOS save publishes the actual enriched input, rather
  // than a fixture assembled before the measured report existed.
  f.hooks.onSave=()=>{
    const evidence=tracked(f.c.stateFile).lifecycle.preCloseoutEvidence
    if (!evidence) return
    const input=JSON.parse(fs.readFileSync(evidence.inputFile,'utf8'))
    for (const n of ['conversation-artifact.json','flight-record.json']) files.set(n,JSON.stringify(input,null,2)+'\n')
    const list=[...files.entries()].filter(([n])=>n!=='integrity.json').sort(([a],[b])=>a.localeCompare(b))
      .map(([path,content])=>({path,sha256:hash(content)}))
    files.set('integrity.json',JSON.stringify({schemaVersion:'1.0',algorithm:'sha256',
      bundleHash:hash(list.map(x=>`${x.path}\0${x.sha256}`).join('\0')),files:list},null,2)+'\n')
    for(const [n,content]of files)fs.writeFileSync(path.join(bundleDir,n),content)
    git(f.phr,'add','.');git(f.phr,'commit','-qm','canonical save publishes measured cleanup report');git(f.phr,'push',remote,'main:main')
  }
  return {remote,relative,bundleDir,bundleHash,commit:git(f.phr,'rev-parse','HEAD')}
}
test('real PHR readback validates exact published bundle integrity, closeout and remote main',t=>{
  const f=fixture(t);begin(f);const p=phrPublishedFixture(f)
  const proof=verifyPhrReadback(f.config,p.relative)
  assert.equal(proof.publicationId,'ARCHITECTURE:'+f.c.taskId)
  assert.equal(proof.bundleHash,p.bundleHash)
  assert.equal(proof.head,p.commit)
})
test('PHR append-only concurrent task B does not invalidate task A epilogue proof',t=>{
  const f=fixture(t);begin(f);const p=phrPublishedFixture(f)
  const first=verifyPhrReadback(f.config,p.relative)
  fs.writeFileSync(path.join(f.phr,'other-task.txt'),'unrelated newer history')
  git(f.phr,'add','.');git(f.phr,'commit','-qm','task B publishes history');git(f.phr,'push',p.remote,'main:main')
  const proof=verifyPhrReadback(f.config,p.relative,{publicationCommit:first.publicationCommit,bundleHash:first.bundleHash})
  assert.notEqual(proof.head,first.head)
  assert.equal(proof.bundleHash,first.bundleHash)
  assert.equal(proof.publicationCommit,first.publicationCommit)
})
test('PHR local ignored tampering is never trusted as a committed evidence source',t=>{
  const f=fixture(t);begin(f);const p=phrPublishedFixture(f)
  fs.appendFileSync(path.join(f.phr,'.git/info/exclude'),'\nhistory/**/closeout-evidence.json\n')
  fs.writeFileSync(path.join(p.bundleDir,'closeout-evidence.json'),'{}\n')
  const proof=verifyPhrReadback(f.config,p.relative)
  assert.equal(proof.bundleHash,p.bundleHash)
})
test('PHR corruption of closeout-evidence in remote commit is rejected even if manifest stays SUCCESS',t=>{
  const f=fixture(t);begin(f);const p=phrPublishedFixture(f)
  fs.writeFileSync(path.join(p.bundleDir,'closeout-evidence.json'),JSON.stringify({closeoutState:'CLOSEOUT_COMPLETE',pmosSaveStatus:'FAILED',handoffPublicationStatus:'SUCCEEDED',recoveryRequired:false})+'\n')
  git(f.phr,'add','.');git(f.phr,'commit','-qm','malicious evidence modification');git(f.phr,'push',p.remote,'main:main')
  assert.throws(()=>verifyPhrReadback(f.config,p.relative),/integrity|bundleHash/)
})
test('PHR removal of canonical integrity file blocks even when manifest still says SUCCESS',t=>{
  const f=fixture(t);begin(f);const p=phrPublishedFixture(f)
  git(f.phr,'rm',path.join(path.dirname(p.relative),'integrity.json'))
  git(f.phr,'commit','-qm','drop integrity');git(f.phr,'push',p.remote,'main:main')
  assert.throws(()=>verifyPhrReadback(f.config,p.relative),/integrity\/closeout evidence is incomplete/)
})

test('PHR discovery uses remote committed tree when local clone is stale',t=>{
  const f=fixture(t);begin(f);const p=phrPublishedFixture(f)
  git(f.phr,'reset','--hard','HEAD~1') // Synthetic checkout only: remote still has the publication.
  assert.equal(fs.existsSync(path.join(f.phr,p.relative)),false)
  assert.equal(findPhrManifestForTask(f.config),p.relative)
})
test('PHR remote discovery refuses ambiguous publications of the same task',t=>{
  const f=fixture(t);begin(f);const p=phrPublishedFixture(f)
  const second=path.join(f.phr,'history','2026','11','18','other__architecture-'+f.c.taskId.toLowerCase())
  fs.mkdirSync(second,{recursive:true})
  fs.copyFileSync(path.join(p.bundleDir,'manifest.json'),path.join(second,'manifest.json'))
  git(f.phr,'add','.');git(f.phr,'commit','-qm','duplicate committed publication');git(f.phr,'push',p.remote,'main:main')
  assert.throws(()=>findPhrManifestForTask(f.config),/found 2/)
})
test('PHR remote discovery rejects name-only match for a different task identity',t=>{
  const f=fixture(t);begin(f);const p=phrPublishedFixture(f)
  const m=JSON.parse(fs.readFileSync(path.join(p.bundleDir,'manifest.json'),'utf8'))
  m.taskId='FOREIGN-TASK';m.publicationId='ARCHITECTURE:FOREIGN-TASK'
  write(path.join(p.bundleDir,'manifest.json'),m)
  git(f.phr,'add','.');git(f.phr,'commit','-qm','remote metadata mismatch');git(f.phr,'push',p.remote,'main:main')
  assert.throws(()=>findPhrManifestForTask(f.config),/found 0/)
})
test('PHR remote discovery does not trust a locally created, uncommitted matching manifest',t=>{
  const f=fixture(t);begin(f);const p=phrPublishedFixture(f)
  const m=JSON.parse(fs.readFileSync(path.join(p.bundleDir,'manifest.json'),'utf8'))
  m.taskId='FOREIGN-TASK';m.publicationId='ARCHITECTURE:FOREIGN-TASK'
  write(path.join(p.bundleDir,'manifest.json'),m)
  git(f.phr,'add','.');git(f.phr,'commit','-qm','foreign remote identity');git(f.phr,'push',p.remote,'main:main')
  const fake=path.join(f.phr,'history','2026','11','18','local__architecture-'+f.c.taskId.toLowerCase())
  fs.mkdirSync(fake,{recursive:true})
  write(path.join(fake,'manifest.json'),{taskId:f.c.taskId,projectId:'ARCHITECTURE',publicationId:'ARCHITECTURE:'+f.c.taskId})
  assert.throws(()=>findPhrManifestForTask(f.config),/found 0/)
})
test('start performs no local state/lock mutation before the first canonical preflight',t=>{
  const f=fixture(t)
  const runtime={run:(cmd,args,cwd)=>{
    assert.equal(fs.existsSync(f.c.stateFile),false)
    assert.equal(fs.existsSync(f.c.stateFile+'.lifecycle.lock'),false)
    return f.runtime.run(cmd,args,cwd)
  }}
  assert.equal(startTask(f.config,runtime).status,'TRACKING_INITIALIZED')
})

test('PMOS checks carry original explicit host identity at resume and before cleanup', t => {
  const f = fixture(t)
  begin(f)
  const calls=[]
  const runtime={...f.runtime,run:(cmd,args,cwd)=>{calls.push(args);return f.runtime.run(cmd,args,cwd)}}
  assert.equal(startTask(f.config,runtime).status,'ALREADY_TRACKED')
  assert.ok(calls.some(args=>args.includes('--check-host-conversation-unavailable')))
  const modified={...f.beginInput,hostConversationId:'different-host-chat'}
  write(f.beginFile,modified)
  const c=loadConfiguration(f.configFile)
  assert.throws(()=>startTask(c,runtime),/host conversation identity changed/)
})
test('PMOS explicit host check forwards exact registered hostConversationId', t => {
  const f=fixture(t)
  write(f.beginFile,{...f.beginInput,hostConversationId:'real-host-chat-123'})
  const c=loadConfiguration(f.configFile)
  assert.equal(startTask(c,f.runtime).status,'TRACKING_INITIALIZED')
  const calls=[]
  const runtime={...f.runtime,run:(cmd,args,cwd)=>{calls.push(args);return f.runtime.run(cmd,args,cwd)}}
  startTask(c,runtime)
  assert.ok(calls.some(args=>args.join(' ').includes('--check-host-conversation-id real-host-chat-123')))
})
test('finish supports canonical bootstrap -> pmos:save without manually writing pending-artifact.json',t=>{
  const f=fixture(t);allocated(f)
  const file=path.join(f.scope,'bootstrap.json'),state=tracked(f.c.stateFile)
  write(file,{metadata:{taskId:f.c.taskId,project:f.beginInput.project,conversationId:state.lifecycle.conversationId,
    targetEnvironment:'development'},findings:{findings:['actual business result']}})
  const result=finishTask(f.config,{bootstrapInputFile:file,manifestRelative:'history/2026/11/18/task/manifest.json'},
    {...f.runtime,cleanup:()=>({summary:{RETAINED:1},observedFreeBytesDelta:null})})
  assert.equal(result.status,'CLOSEOUT_VERIFIED')
  const cmd=f.calls.find(([,args])=>args.includes('pmos:save'))[1]
  assert.deepEqual(cmd.slice(-3,-1),['--','--bootstrap-input'])
  assert.notEqual(cmd.at(-1),file)
  assert.ok(JSON.parse(fs.readFileSync(cmd.at(-1),'utf8')).findings.findings.some(x=>x.startsWith(PRE_CLOSEOUT_REPORT_PREFIX)))
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).findings.findings.length,1)
})
test('finish refuses bootstrap belonging to a different conversation',t=>{
  const f=fixture(t);allocated(f)
  const file=path.join(f.scope,'bootstrap.json')
  write(file,{metadata:{taskId:f.c.taskId,project:f.beginInput.project,conversationId:'FOREIGN',targetEnvironment:'development'},
    findings:{findings:['attempt']}})
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:file},f.runtime),/another task, conversation/)
  assert.equal(f.calls.some(([,args])=>args.includes('pmos:save')),false)
})
test('finish refuses both a foreign pending slot and valid bootstrap instead of ignoring bootstrap',t=>{
  const f=fixture(t);allocated(f)
  const file=path.join(f.scope,'bootstrap.json')
  write(file,{metadata:{taskId:f.c.taskId,project:f.beginInput.project,conversationId:'pmos-task-v2:test',targetEnvironment:'development'},
    findings:{findings:['real evidence']}})
  const dir=path.join(f.src,'apps/pmos/.pmos');fs.mkdirSync(dir,{recursive:true})
  write(path.join(dir,'pending-artifact.json'),{metadata:{taskId:'ANOTHER_TASK'}})
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:file},f.runtime),/another task, conversation/)
})
test('opt-in run executes automatic start -> authorized workload -> PMOS bootstrap save -> verified post-audit',t=>{
  const f=fixture(t),work=path.join(f.scope,'run-spec.json'),bootstrap=path.join(f.scope,'bootstrap.json')
  const script=path.join(f.scope,'produce-bootstrap.mjs')
  fs.writeFileSync(script,`import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(bootstrap)}, JSON.stringify({metadata:{taskId:${JSON.stringify(f.c.taskId)},conversationId:'pmos-task-v2:test',project:${JSON.stringify(f.beginInput.project)},targetEnvironment:'development'},findings:{findings:['completed']}}))`)
  write(work,{schemaVersion:'1.0',taskId:f.c.taskId,program:process.execPath,args:[script],cwd:f.src,
    timeoutMs:20000,bootstrapInputFile:bootstrap,cleanPreCloseout:false,cleanPostCloseout:false,
    manifestRelative:'history/2026/11/18/task/manifest.json'})
  const result=runTask(f.config,work,{...f.runtime,cleanup:()=>({summary:{NOT_APPLICABLE:1},observedFreeBytesDelta:null})})
  assert.equal(result.runner,'OPT_IN_AUTOMATIC_TASK_CHAIN')
  assert.equal(result.closeout.status,'CLOSEOUT_VERIFIED')
  assert.equal(tracked(f.c.stateFile).work.status,'SUCCEEDED')
  assert.ok(f.calls.some(([,args])=>args.includes('--bootstrap-input')))
  assert.ok(fs.existsSync(bootstrap))
})
test('opt-in task failure never starts PMOS save or cleanup and prevents blind retry',t=>{
  const f=fixture(t),work=path.join(f.scope,'work-spec.json')
  write(work,{schemaVersion:'1.0',taskId:f.c.taskId,program:process.execPath,args:['-e','process.exit(8)'],cwd:f.src,
    timeoutMs:5000,bootstrapInputFile:path.join(f.scope,'bootstrap.json')})
  const cleanup=()=>{throw Error('Cleanup must never start')}
  assert.throws(()=>runTask(f.config,work,{...f.runtime,cleanup}),/failed/)
  assert.equal(tracked(f.c.stateFile).work.status,'FAILED')
  assert.equal(f.calls.some(([,args])=>args.includes('pmos:save')),false)
  assert.throws(()=>runTask(f.config,work,{...f.runtime,cleanup}),/manual review/)
})
test('opt-in runner resumes after PHR verification failure without rerunning already successful work or PMOS save',t=>{
  const f=fixture(t),work=path.join(f.scope,'work-spec.json'),bootstrap=path.join(f.scope,'bootstrap.json')
  const workLog=path.join(f.scope,'work-count.txt')
  const script=path.join(f.scope,'work.cjs')
  fs.writeFileSync(script,`const fs=require('node:fs');fs.appendFileSync(${JSON.stringify(workLog)},'1');fs.writeFileSync(${JSON.stringify(bootstrap)},JSON.stringify({metadata:{taskId:${JSON.stringify(f.c.taskId)},conversationId:'pmos-task-v2:test',project:${JSON.stringify(f.beginInput.project)},targetEnvironment:'development'},findings:{findings:['result']}}))`)
  write(work,{schemaVersion:'1.0',taskId:f.c.taskId,program:process.execPath,args:[script],cwd:f.src,
    timeoutMs:20000,bootstrapInputFile:bootstrap,manifestRelative:'history/2026/11/18/task/manifest.json'})
  assert.throws(()=>runTask(f.config,work,{...f.runtime,verifyPhr:()=>{throw Error('transient PHR outage')},
    cleanup:()=>({summary:{}})}),/transient PHR outage/)
  const resumed=runTask(f.config,work,{...f.runtime,cleanup:()=>({summary:{}})})
  assert.equal(resumed.closeout.status,'CLOSEOUT_VERIFIED')
  assert.equal(fs.readFileSync(workLog,'utf8'),'1')
  assert.equal(f.calls.filter(([,args])=>args.includes('pmos:save')).length,1)
})

test('task A post-closeout clean delegates after task B adds a new PHR commit',t=>{
  const f=fixture(t);allocated(f,'task-a-cache','post-closeout')
  const p=phrPublishedFixture(f)
  const result=finishFixture(f,{manifestRelative:p.relative},
    {...f.runtime,verifyPhr:undefined,cleanup:()=>({summary:{RETAINED:1},observedFreeBytesDelta:null})})
  assert.equal(result.status,'CLOSEOUT_VERIFIED')
  fs.writeFileSync(path.join(f.phr,'other-task.txt'),'Task B appended after A')
  git(f.phr,'add','.');git(f.phr,'commit','-qm','Task B');git(f.phr,'push',p.remote,'main:main')
  let cleanAttempts=0
  const proof=phaseReport(f.config,'post-closeout',true,{runtime:f.runtime,cleanup:()=>{
    cleanAttempts++;return {summary:{RETAINED:1},observedFreeBytesDelta:null}
  }})
  assert.equal(cleanAttempts,1)
  assert.deepEqual(proof.summary,{RETAINED:1})
})

test('PHR pinned bundle integrity mismatch prevents stage02 clean even when remote main is reachable',t=>{
  const f=fixture(t);allocated(f,'task-a-cache','post-closeout')
  const p=phrPublishedFixture(f)
  finishFixture(f,{manifestRelative:p.relative},{...f.runtime,verifyPhr:undefined,cleanup:()=>({summary:{RETAINED:1}})})
  const manifestDir=path.dirname(p.relative)
  const extra=path.join(p.bundleDir,'handoff.md')
  fs.appendFileSync(extra,'tampered after closeout')
  git(f.phr,'add','.');git(f.phr,'commit','-qm','Unexpected rewrite');git(f.phr,'push',p.remote,'main:main')
  assert.throws(()=>phaseReport(f.config,'post-closeout',true,{runtime:f.runtime,cleanup:()=>{
    throw Error('Stage02 cleanup must not run without immutable PHR proof')
  }}),/integrity|bundleHash/)
})

// Stage 03 v3: fail-closed closeout-input protection and canonical recovery.
function bootstrapFixture(f, dest = path.join(f.scope, 'bootstrap.json'), findings = ['actual business result']) {
  const state = tracked(f.c.stateFile)
  write(dest, { metadata: { taskId:f.c.taskId, conversationId:state.lifecycle.conversationId,
    project:f.beginInput.project, targetEnvironment:'development'}, findings:{findings} })
  return dest
}
function canonicalPendingFixture(f, bootstrap, findingsOverride) {
  if (!tracked(f.c.stateFile).lifecycle.preCloseoutEvidence) {
    assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap},
      {...f.runtime,run:(cmd,args,cwd)=>{
        if(args.includes('pmos:save'))throw Error('fixture stops before canonical save')
        return f.runtime.run(cmd,args,cwd)
      },cleanup:()=>({summary:{NOT_APPLICABLE:0}})}),/fixture stops before canonical save/)
    f.calls.length=0
  }
  const pending=path.join(f.src,'apps/pmos/.pmos/pending-artifact.json')
  fs.mkdirSync(path.dirname(pending),{recursive:true})
  const b=JSON.parse(fs.readFileSync(tracked(f.c.stateFile).lifecycle.preCloseoutEvidence.inputFile,'utf8'))
  write(pending,{...b,findings:findingsOverride??b.findings,completionEvidence:{closeoutState:'PENDING_ARTIFACT_CREATED'}})
  return pending
}
function workSpecFixture(f, options={}) {
  const work=path.join(f.scope,'v3-work-spec.json'),bootstrap=path.join(f.scope,'v3-bootstrap.json')
  const log=path.join(f.scope,'v3-work-count.txt'), script=path.join(f.scope,'v3-work.cjs')
  fs.writeFileSync(script,`const fs=require('node:fs');fs.appendFileSync(${JSON.stringify(log)},'1');fs.writeFileSync(${JSON.stringify(bootstrap)},JSON.stringify({metadata:{taskId:${JSON.stringify(f.c.taskId)},conversationId:'pmos-task-v2:test',project:${JSON.stringify(f.beginInput.project)},targetEnvironment:'development'},findings:{findings:['actual business result']}}))`)
  write(work,{schemaVersion:'1.0',taskId:f.c.taskId,program:process.execPath,args:[script],cwd:f.src,
    timeoutMs:20000,bootstrapInputFile:bootstrap,manifestRelative:'history/2026/11/18/task/manifest.json',
    cleanPreCloseout:false,cleanPostCloseout:false,...options})
  return {work,bootstrap,log}
}
test('registered project displayName and workspace are validated against the canonical registry',t=>{
  const f=fixture(t)
  assert.equal(f.config.beginInput.project, 'ARCHITECTURE')
  assert.equal(f.config.beginInput.workspace, 'SG-dev Architecture')
  write(f.beginFile,{...f.beginInput,project:'SG-dev Architecture'})
  assert.throws(()=>loadConfiguration(f.configFile),/displayName\/workspace/)
  write(f.beginFile,{...f.beginInput,workspace:'FOREIGN WORKSPACE'})
  assert.throws(()=>loadConfiguration(f.configFile),/displayName\/workspace/)
})
test('pre-closeout clean never removes a resource containing the canonical bootstrap',t=>{
  const f=fixture(t),r=allocated(f,'bootstrap-holding-cache')
  const bootstrap=bootstrapFixture(f,path.join(r.path,'bootstrap.json'))
  releaseResource(f.config,release(f,r),f.runtime)
  let cleanupCalls=0
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap,cleanPreCloseout:true},{...f.runtime,
    cleanup:()=>{cleanupCalls++;throw Error('Cleanup must not run')}}),/contains required task control\/evidence input/)
  assert.equal(cleanupCalls,0)
  assert.ok(fs.existsSync(bootstrap))
  assert.equal(f.calls.filter(([,args])=>args.includes('pmos:save')).length,0)
})
test('pre-closeout clean validates bootstrap BEFORE calling cleanup',t=>{
  const f=fixture(t),r=allocated(f)
  const bootstrap=bootstrapFixture(f)
  const b=JSON.parse(fs.readFileSync(bootstrap,'utf8'))
  b.metadata.conversationId='OTHER TASK'
  write(bootstrap,b)
  let cleanupCalls=0
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap,cleanPreCloseout:true},
    {...f.runtime,cleanup:()=>{cleanupCalls++;return {summary:{}}}}),/another task, conversation/)
  assert.equal(cleanupCalls,0)
  assert.ok(fs.existsSync(r.path))
})
test('pre-closeout clean protects release evidence stored inside another resource',t=>{
  const f=fixture(t),a=allocated(f,'cache-a'),b=allocateResource(f.config,{name:'cache-b',kind:'ephemeral-directory',phase:'pre-closeout'},f.runtime)
  const evidence=path.join(b.path,'release-proof.json')
  write(evidence,{schemaVersion:'1.0',projectKey:f.c.projectKey,taskId:f.c.taskId,allocationId:a.allocationId,
    kind:a.kind,path:a.path,verificationRef:'fixture:retention-reviewed',
    authorization:{resultVerified:true,retentionReleased:true,recoveryPreserved:true,noActiveConsumers:true}})
  releaseResource(f.config,evidence,f.runtime)
  assert.ok(tracked(f.c.stateFile).lifecycle.releaseEvidencePaths.includes(evidence))
  let cleanCalls=0
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrapFixture(f),cleanPreCloseout:true},
    {...f.runtime,cleanup:()=>{cleanCalls++;return {summary:{}}}}),/contains required task control\/evidence input/)
  assert.equal(cleanCalls,0);assert.ok(fs.existsSync(a.path));assert.ok(fs.existsSync(b.path))
})
test('unprepared direct pre-closeout clean cannot bypass canonical input verification',t=>{
  const f=fixture(t),r=allocated(f)
  let calls=0
  assert.throws(()=>phaseReport(f.config,'pre-closeout',true,{runtime:f.runtime,cleanup:()=>{calls++}}),
    /requires a verified canonical closeout input/)
  assert.equal(calls,0);assert.ok(fs.existsSync(r.path))
})
test('resume with same-task pending plus bootstrap delegates to canonical existing pending slot',t=>{
  const f=fixture(t);allocated(f)
  const bootstrap=bootstrapFixture(f)
  const pending=canonicalPendingFixture(f,bootstrap)
  const result=finishTask(f.config,{bootstrapInputFile:bootstrap,manifestRelative:'history/2026/11/18/task/manifest.json'},
    {...f.runtime,cleanup:()=>({summary:{NOT_APPLICABLE:1}})})
  assert.equal(result.status,'CLOSEOUT_VERIFIED')
  assert.equal(fs.existsSync(pending),false)
  const save=f.calls.find(([,args])=>args.includes('pmos:save'))[1]
  assert.equal(save.includes('--bootstrap-input'),false)
})
test('resume with pending and conflicting bootstrap findings is rejected before canonical save',t=>{
  const f=fixture(t);allocated(f)
  const bootstrap=bootstrapFixture(f)
  const pending=canonicalPendingFixture(f,bootstrap,{findings:['different conclusions']})
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap},f.runtime),/conflicts with supplied bootstrap substantive content/)
  assert.ok(fs.existsSync(pending))
  assert.equal(f.calls.filter(([,args])=>args.includes('pmos:save')).length,0)
})
test('resume from same-task pending remains valid when bootstrap vanished but pending survived',t=>{
  const f=fixture(t);allocated(f)
  const bootstrap=bootstrapFixture(f)
  const pending=canonicalPendingFixture(f,bootstrap)
  fs.unlinkSync(bootstrap)
  const result=finishTask(f.config,{bootstrapInputFile:bootstrap,manifestRelative:'history/2026/11/18/task/manifest.json'},
    {...f.runtime,cleanup:()=>({summary:{NOT_APPLICABLE:1}})})
  assert.equal(result.status,'CLOSEOUT_VERIFIED');assert.equal(fs.existsSync(pending),false)
})
test('run resume after successful save and transient PHR failure skips pre-closeout clean',t=>{
  const f=fixture(t),spec=workSpecFixture(f,{cleanPreCloseout:true})
  let preCleanCalls=0
  const cleanup=options=>{
    if(options.phase==='pre-closeout'&&options.command==='clean')preCleanCalls++
    return {summary:{NOT_APPLICABLE:0}}
  }
  assert.throws(()=>runTask(f.config,spec.work,{...f.runtime,cleanup,verifyPhr:()=>{throw Error('temporary PHR readback outage')}}),
    /temporary PHR readback outage/)
  assert.equal(preCleanCalls,1)
  const resumed=runTask(f.config,spec.work,{...f.runtime,cleanup})
  assert.equal(resumed.closeout.status,'CLOSEOUT_VERIFIED')
  assert.equal(resumed.closeout.preCloseoutSkipped,'PMOS_ALREADY_COMPLETED')
  assert.equal(preCleanCalls,1)
  assert.equal(fs.readFileSync(spec.log,'utf8'),'1')
  assert.equal(f.calls.filter(([,args])=>args.includes('pmos:save')).length,1)
})
test('run resumes existing matching pending after a failed save without rerunning work',t=>{
  const f=fixture(t),spec=workSpecFixture(f)
  let saveCalls=0
  const run=(cmd,args,cwd)=>{
    if(args.includes('pmos:save')) {
      saveCalls++
      if(saveCalls===1){canonicalPendingFixture(f,spec.bootstrap);throw Error('transient PMOS save failure')}
    }
    return f.runtime.run(cmd,args,cwd)
  }
  assert.throws(()=>runTask(f.config,spec.work,{...f.runtime,run,cleanup:()=>({summary:{NOT_APPLICABLE:0}})}),
    /transient PMOS save failure/)
  assert.ok(fs.existsSync(path.join(f.src,'apps/pmos/.pmos/pending-artifact.json')))
  const resumed=runTask(f.config,spec.work,{...f.runtime,run,cleanup:()=>({summary:{NOT_APPLICABLE:0}})})
  assert.equal(resumed.closeout.status,'CLOSEOUT_VERIFIED')
  assert.equal(saveCalls,2)
  assert.equal(fs.readFileSync(spec.log,'utf8'),'1')
})
test('run resumes already completed closeout after epilogue failure without repeating PMOS',t=>{
  const f=fixture(t),spec=workSpecFixture(f,{cleanPostCloseout:true})
  let failPost=true, postCleanCalls=0
  const cleanup=opts=>{
    if(opts.phase==='post-closeout'&&opts.command==='clean') {
      postCleanCalls++
      if(failPost){failPost=false;throw Error('epilogue crashed')}
    }
    return {summary:{NOT_APPLICABLE:0}}
  }
  assert.throws(()=>runTask(f.config,spec.work,{...f.runtime,cleanup}),/epilogue crashed/)
  assert.equal(tracked(f.c.stateFile).closeout.status,'CLOSEOUT_COMPLETE')
  const result=runTask(f.config,spec.work,{...f.runtime,cleanup})
  assert.equal(result.closeout.status,'ALREADY_CLOSED')
  assert.equal(postCleanCalls,2)
  assert.equal(f.calls.filter(([,args])=>args.includes('pmos:save')).length,1)
  assert.equal(fs.readFileSync(spec.log,'utf8'),'1')
})
test('completed PMOS after PHR failure may resume even when old bootstrap is unavailable',t=>{
  const f=fixture(t);allocated(f)
  const bootstrap=bootstrapFixture(f)
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap,manifestRelative:'history/2026/11/18/task/manifest.json'},
    {...f.runtime,verifyPhr:()=>{throw Error('PHR unavailable')},cleanup:()=>({summary:{}})}),/PHR unavailable/)
  fs.unlinkSync(bootstrap)
  const result=finishTask(f.config,{bootstrapInputFile:bootstrap,cleanPreCloseout:true,manifestRelative:'history/2026/11/18/task/manifest.json'},
    {...f.runtime,cleanup:()=>({summary:{}})})
  assert.equal(result.status,'CLOSEOUT_VERIFIED')
  assert.equal(result.preCloseoutSkipped,'PMOS_ALREADY_COMPLETED')
  assert.equal(f.calls.filter(([,args])=>args.includes('pmos:save')).length,1)
})
test('pre-closeout clean requires canonical PMOS handoff validation BEFORE any deletion',t=>{
  const f=fixture(t),r=allocated(f,'releasable-v3')
  releaseResource(f.config,release(f,r),f.runtime)
  const bootstrap=bootstrapFixture(f)
  const events=[]
  const runner=(cmd,args,cwd)=>{events.push(cmd==='npx'?'prepare':args.includes('pmos:save')?'save':'check');return f.runtime.run(cmd,args,cwd)}
  const cleanup=opts=>{events.push(opts.phase+':'+opts.command);return {summary:{RETAINED:1}}}
  const out=finishTask(f.config,{bootstrapInputFile:bootstrap,cleanPreCloseout:true,manifestRelative:'history/2026/11/18/task/manifest.json'},
    {...f.runtime,run:runner,cleanup})
  assert.equal(out.status,'CLOSEOUT_VERIFIED')
  assert.ok(events.indexOf('prepare')<events.indexOf('pre-closeout:clean'))
  assert.ok(events.indexOf('pre-closeout:clean')<events.indexOf('save'))
  assert.equal(events.filter(x=>x==='prepare').length,2)
  const save=f.calls.find(([,args])=>args.includes('pmos:save'))[1]
  const validated=save[save.indexOf('--bootstrap-input')+1]
  assert.notEqual(validated,bootstrap)
  assert.ok(fs.existsSync(validated))
})
test('failed canonical PMOS bootstrap validation blocks pre-closeout deletion and save',t=>{
  const f=fixture(t),r=allocated(f,'releasable-v3')
  const bootstrap=bootstrapFixture(f)
  let cleanCalls=0
  const runtime={...f.runtime,run:(cmd,args,cwd)=>{
    if(cmd==='npx') throw Error('canonical PMOS input validation refused')
    return f.runtime.run(cmd,args,cwd)
  },cleanup:()=>{cleanCalls++;return {summary:{}}}}
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap,cleanPreCloseout:true},runtime),/canonical PMOS input validation refused/)
  assert.equal(cleanCalls,0)
  assert.equal(f.calls.filter(([,args])=>args.includes('pmos:save')).length,0)
  assert.ok(fs.existsSync(r.path))
})
test('resumed same-task pending skips pre-closeout deletion even with clean enabled',t=>{
  const f=fixture(t),r=allocated(f,'releasable-v3')
  const bootstrap=bootstrapFixture(f)
  canonicalPendingFixture(f,bootstrap)
  const actions=[]
  const result=finishTask(f.config,{bootstrapInputFile:bootstrap,cleanPreCloseout:true,manifestRelative:'history/2026/11/18/task/manifest.json'},
    {...f.runtime,cleanup:opts=>{actions.push(opts.phase+':'+opts.command);return {summary:{NOT_APPLICABLE:1}}}})
  assert.equal(result.status,'CLOSEOUT_VERIFIED')
  assert.equal(result.preCloseoutSkipped,'PMOS_PENDING_RECOVERY')
  assert.ok(!actions.includes('pre-closeout:audit'))
  assert.ok(!actions.includes('pre-closeout:clean'))
  assert.ok(fs.existsSync(r.path))
})

// Stage03 v4: full substantive pending/bootstrap parity and durable epilogue inputs.
test('pending and bootstrap with identical substantive input but PMOS-owned timestamp and completionEvidence differences resume',t=>{
  const f=fixture(t);allocated(f)
  const bootstrap=bootstrapFixture(f)
  const b=JSON.parse(fs.readFileSync(bootstrap,'utf8'))
  b.metadata.timestamp='2026-11-18T12:00:00.000Z'
  b.result={finalStatus:'SUCCESS'}
  b.actions={artifactsCreated:['report.json'],artifactsModified:['summary.md'],recommendations:['validated']}
  b.validations={checks:[{name:'business-outcome',status:'PASS'}]}
  write(bootstrap,b)
  const pending=canonicalPendingFixture(f,bootstrap)
  const p=JSON.parse(fs.readFileSync(pending,'utf8'))
  p.metadata.timestamp='2026-11-18T12:01:00.000Z'
  p.completionEvidence={closeoutState:'PMOS_SAVE_STARTED',pmosSaveStatus:'PARTIAL',archiveCompletenessStatus:'UNKNOWN'}
  write(pending,p)
  const out=finishTask(f.config,{bootstrapInputFile:bootstrap,manifestRelative:'history/2026/11/18/task/manifest.json'},
    {...f.runtime,cleanup:()=>({summary:{NOT_APPLICABLE:0}})})
  assert.equal(out.status,'CLOSEOUT_VERIFIED')
  assert.equal(f.calls.filter(([,args])=>args.includes('pmos:save')).length,1)
  assert.equal(f.calls.find(([,args])=>args.includes('pmos:save'))[1].includes('--bootstrap-input'),false)
})

test('pending/bootstrap same findings but different final business result fails closed',t=>{
  const f=fixture(t);allocated(f)
  const bootstrap=bootstrapFixture(f)
  const b=JSON.parse(fs.readFileSync(bootstrap,'utf8'))
  b.result={finalStatus:'PARTIAL_SUCCESS'};write(bootstrap,b)
  const pending=canonicalPendingFixture(f,bootstrap)
  const q=JSON.parse(fs.readFileSync(pending,'utf8'))
  q.result.finalStatus='SUCCESS';write(pending,q)
  let cleanup=0
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap,cleanPreCloseout:true},
    {...f.runtime,cleanup:()=>{cleanup++;return {summary:{}}}}),/conflicts with supplied bootstrap substantive content/)
  assert.equal(cleanup,0)
  assert.equal(f.calls.filter(([,args])=>args.includes('pmos:save')).length,0)
  assert.ok(fs.existsSync(pending))
})

test('pending/bootstrap same findings and result but different changed files fail closed',t=>{
  const f=fixture(t);allocated(f)
  const bootstrap=bootstrapFixture(f)
  const b=JSON.parse(fs.readFileSync(bootstrap,'utf8'))
  b.result={finalStatus:'SUCCESS'}
  b.actions={artifactsCreated:[],artifactsModified:['one.md'],recommendations:[]}
  write(bootstrap,b)
  const pending=canonicalPendingFixture(f,bootstrap)
  const p=JSON.parse(fs.readFileSync(pending,'utf8'))
  p.actions.artifactsModified=['other.md'];write(pending,p)
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap},f.runtime),
    /conflicts with supplied bootstrap substantive content/)
  assert.equal(f.calls.filter(([,args])=>args.includes('pmos:save')).length,0)
})

test('pending/bootstrap same findings and files but different validation evidence fail closed',t=>{
  const f=fixture(t);allocated(f)
  const bootstrap=bootstrapFixture(f)
  const b=JSON.parse(fs.readFileSync(bootstrap,'utf8'))
  b.validations={checks:[{name:'unit-tests',status:'PASS'}]}
  write(bootstrap,b)
  const pending=canonicalPendingFixture(f,bootstrap)
  const q=JSON.parse(fs.readFileSync(pending,'utf8'))
  q.validations.checks[0].status='FAIL';write(pending,q)
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap},f.runtime),
    /conflicts with supplied bootstrap substantive content/)
  assert.equal(f.calls.filter(([,args])=>args.includes('pmos:save')).length,0)
})

test('post-closeout refuses to delete its own work-spec, including after interrupted epilogue retry',t=>{
  const f=fixture(t)
  const r=allocated(f,'owned-post-work-spec','post-closeout')
  const spec=workSpecFixture(f,{cleanPostCloseout:true})
  const ownedSpec=path.join(r.path,'work-spec.json')
  fs.renameSync(spec.work,ownedSpec)
  let cleanCalls=0
  const rt={...f.runtime,cleanup:opts=>{
    if(opts.phase==='post-closeout'&&opts.command==='clean')cleanCalls++
    return {summary:{NOT_APPLICABLE:1}}
  }}
  assert.throws(()=>runTask(f.config,ownedSpec,rt),/contains required task control\/evidence input/)
  assert.equal(tracked(f.c.stateFile).closeout.status,'CLOSEOUT_COMPLETE')
  assert.equal(tracked(f.c.stateFile).work.specPath,ownedSpec)
  assert.ok(fs.existsSync(ownedSpec));assert.equal(cleanCalls,0)
  assert.throws(()=>runTask(f.config,ownedSpec,rt),/contains required task control\/evidence input/)
  assert.ok(fs.existsSync(ownedSpec));assert.equal(cleanCalls,0)
  assert.equal(fs.readFileSync(spec.log,'utf8'),'1')
  assert.equal(f.calls.filter(([,args])=>args.includes('pmos:save')).length,1)
})

test('post-closeout protects bootstrap contained in task candidate even for later direct epilogue retry',t=>{
  const f=fixture(t),r=allocated(f,'owned-post-bootstrap','post-closeout')
  const bootstrap=bootstrapFixture(f,path.join(r.path,'bootstrap.json'))
  let cleanCalls=0
  const rt={...f.runtime,cleanup:opts=>{
    if(opts.phase==='post-closeout'&&opts.command==='clean')cleanCalls++
    return {summary:{NOT_APPLICABLE:1}}
  }}
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap,cleanPostCloseout:true,
    manifestRelative:'history/2026/11/18/task/manifest.json'},rt),
    /contains required task control\/evidence input/)
  assert.ok(fs.existsSync(bootstrap));assert.equal(cleanCalls,0)
  assert.ok(tracked(f.c.stateFile).lifecycle.closeoutInputPaths.includes(bootstrap))
  assert.throws(()=>phaseReport(f.config,'post-closeout',true,{runtime:rt,cleanup:rt.cleanup,verifyPhr:rt.verifyPhr}),
    /contains required task control\/evidence input/)
  assert.ok(fs.existsSync(bootstrap));assert.equal(cleanCalls,0)
})

test('post-closeout protects the exact configuration file when supplied from a disposable candidate',t=>{
  const f=fixture(t),r=allocated(f,'owned-post-config','post-closeout')
  const nestedConfig=path.join(r.path,'config.json')
  write(nestedConfig,f.c)
  const config=loadConfiguration(nestedConfig)
  let cleanCalls=0
  assert.throws(()=>finishTask(config,{bootstrapInputFile:bootstrapFixture(f),cleanPostCloseout:true,
    manifestRelative:'history/2026/11/18/task/manifest.json'},
    {...f.runtime,cleanup:opts=>{if(opts.phase==='post-closeout'&&opts.command==='clean')cleanCalls++;return {summary:{NOT_APPLICABLE:1}}}}),
    /contains required task control\/evidence input/)
  assert.ok(fs.existsSync(nestedConfig));assert.equal(cleanCalls,0)
})

test('post-closeout protects release evidence retained in a different post-closeout candidate',t=>{
  const f=fixture(t),a=allocated(f,'owned-post-a','post-closeout')
  const b=allocateResource(f.config,{name:'owned-post-b',kind:'ephemeral-directory',phase:'post-closeout'},f.runtime)
  const evidence=path.join(b.path,'release.json')
  const e={schemaVersion:'1.0',projectKey:f.c.projectKey,taskId:f.c.taskId,allocationId:a.allocationId,
    kind:a.kind,path:a.path,verificationRef:'fixture:release-approved',
    authorization:{resultVerified:true,retentionReleased:true,recoveryPreserved:true,noActiveConsumers:true}}
  write(evidence,e);releaseResource(f.config,evidence,f.runtime)
  let cleanCalls=0
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrapFixture(f),cleanPostCloseout:true,
    manifestRelative:'history/2026/11/18/task/manifest.json'},
    {...f.runtime,cleanup:opts=>{if(opts.phase==='post-closeout'&&opts.command==='clean')cleanCalls++;return {summary:{NOT_APPLICABLE:1}}}}),
    /contains required task control\/evidence input/)
  assert.equal(cleanCalls,0);assert.ok(fs.existsSync(evidence))
})

test('post-closeout retry after PHR outage protects original bootstrap even when retry omits it',t=>{
  const f=fixture(t),r=allocated(f,'post-bootstrap-during-phr-outage','post-closeout')
  const bootstrap=bootstrapFixture(f,path.join(r.path,'bootstrap.json'))
  let cleanCalls=0
  const cleanup=opts=>{if(opts.phase==='post-closeout'&&opts.command==='clean')cleanCalls++;return {summary:{NOT_APPLICABLE:1}}}
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap,cleanPostCloseout:true,
    manifestRelative:'history/2026/11/18/task/manifest.json'},
    {...f.runtime,cleanup,verifyPhr:()=>{throw Error('PHR transient error')}}),/PHR transient error/)
  assert.equal(tracked(f.c.stateFile).closeout,undefined)
  assert.ok(tracked(f.c.stateFile).lifecycle.closeoutInputPaths.includes(bootstrap))
  assert.equal(f.calls.filter(([,args])=>args.includes('pmos:save')).length,1)
  assert.throws(()=>finishTask(f.config,{cleanPostCloseout:true,
    manifestRelative:'history/2026/11/18/task/manifest.json'},
    {...f.runtime,cleanup}),/contains required task control\/evidence input/)
  assert.equal(cleanCalls,0)
  assert.ok(fs.existsSync(bootstrap))
  assert.equal(f.calls.filter(([,args])=>args.includes('pmos:save')).length,1)
})

test('post-closeout refuses destructive programmatic invocation without originating config-file identity',t=>{
  const f=fixture(t);allocated(f,'candidate','post-closeout')
  finishTask(f.config,{bootstrapInputFile:bootstrapFixture(f),
    manifestRelative:'history/2026/11/18/task/manifest.json'},
    {...f.runtime,cleanup:()=>({summary:{NOT_APPLICABLE:1}})})
  const altered={...f.config};delete altered.configFile
  let cleanCalls=0
  assert.throws(()=>phaseReport(altered,'post-closeout',true,{runtime:f.runtime,
    verifyPhr:f.runtime.verifyPhr,cleanup:()=>{cleanCalls++}}),/Task configuration source path/)
  assert.equal(cleanCalls,0)
})

// Final v5: protect physical locations, including symlinks in parent folders.
test('configuration through a symlinked parent is rejected before task registration',t=>{
  const f=fixture(t),alias=path.join(f.root,'config-alias')
  fs.symlinkSync(f.scope,alias)
  assert.throws(()=>loadConfiguration(path.join(alias,'config.json')),/canonical physical path/)
  assert.equal(fs.existsSync(f.c.stateFile),false)
  assert.equal(f.calls.length,0)
  assert.ok(fs.existsSync(f.configFile))
})

test('begin input through a symlinked parent cannot bypass canonical identity validation',t=>{
  const f=fixture(t),alias=path.join(f.root,'begin-alias')
  fs.symlinkSync(f.scope,alias)
  write(f.configFile,{...f.c,beginInputFile:path.join(alias,'begin.json')})
  assert.throws(()=>loadConfiguration(f.configFile),/canonical physical path/)
  assert.equal(fs.existsSync(f.c.stateFile),false)
  assert.ok(fs.existsSync(f.beginFile))
})

test('release evidence through an external directory alias remains unauthorized and undeleted',t=>{
  const f=fixture(t),r=allocated(f,'aliased-release-candidate','post-closeout')
  const direct=path.join(r.path,'release.json')
  write(direct,{schemaVersion:'1.0',projectKey:f.c.projectKey,taskId:f.c.taskId,
    allocationId:r.allocationId,kind:r.kind,path:r.path,verificationRef:'fixture:actual-release',
    authorization:{resultVerified:true,retentionReleased:true,recoveryPreserved:true,noActiveConsumers:true}})
  const alias=path.join(f.root,'evidence-alias');fs.symlinkSync(r.path,alias)
  assert.throws(()=>releaseResource(f.config,path.join(alias,'release.json'),f.runtime),/canonical physical path/)
  assert.equal(tracked(f.c.stateFile).resources[0].authorization.retentionReleased,false)
  assert.equal(tracked(f.c.stateFile).lifecycle.releaseEvidencePaths,undefined)
  assert.ok(fs.existsSync(direct));assert.ok(fs.existsSync(r.path))
})

test('post-closeout rechecks an evidence parent changed into a symlink after release',t=>{
  const f=fixture(t),r=allocated(f,'retained-control-candidate','post-closeout')
  const originalDir=path.join(f.scope,'proofs');fs.mkdirSync(originalDir)
  const proof=path.join(originalDir,'release.json')
  write(proof,{schemaVersion:'1.0',projectKey:f.c.projectKey,taskId:f.c.taskId,
    allocationId:r.allocationId,kind:r.kind,path:r.path,verificationRef:'fixture:actual-release',
    authorization:{resultVerified:true,retentionReleased:true,recoveryPreserved:true,noActiveConsumers:true}})
  releaseResource(f.config,proof,f.runtime)
  const relocated=path.join(r.path,'proofs');fs.renameSync(originalDir,relocated);fs.symlinkSync(relocated,originalDir)
  let cleanCalls=0
  const rt={...f.runtime,cleanup:options=>{
    if(options.command==='clean')cleanCalls++
    return {summary:{RETAINED:1}}
  }}
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrapFixture(f),cleanPostCloseout:true,
    manifestRelative:'history/2026/11/18/task/manifest.json'},rt),/canonical physical path/)
  assert.equal(cleanCalls,0)
  assert.ok(fs.existsSync(path.join(relocated,'release.json')))
  assert.equal(tracked(f.c.stateFile).closeout.status,'CLOSEOUT_COMPLETE')
  assert.throws(()=>phaseReport(f.config,'post-closeout',true,{runtime:rt,cleanup:rt.cleanup,verifyPhr:rt.verifyPhr}),
    /canonical physical path/)
  assert.equal(cleanCalls,0)
})

test('post-closeout rejects a programmatic config alias before delegating any deletion',t=>{
  const f=fixture(t),r=allocated(f,'configuration-candidate','post-closeout')
  write(path.join(r.path,'config.json'),f.c)
  const alias=path.join(f.root,'late-config-alias');fs.symlinkSync(r.path,alias)
  const altered={...f.config,configFile:path.join(alias,'config.json')}
  let cleanCalls=0
  assert.throws(()=>finishTask(altered,{bootstrapInputFile:bootstrapFixture(f),cleanPostCloseout:true,
    manifestRelative:'history/2026/11/18/task/manifest.json'},
    {...f.runtime,cleanup:options=>{if(options.command==='clean')cleanCalls++;return {summary:{}}}}),
    /canonical physical path/)
  assert.equal(cleanCalls,0);assert.ok(fs.existsSync(path.join(r.path,'config.json')))
})

test('run refuses an output path through a parent symlink before executing business work',t=>{
  const f=fixture(t),spec=workSpecFixture(f)
  const alias=path.join(f.root,'future-output-alias');fs.symlinkSync(f.scope,alias)
  const value=JSON.parse(fs.readFileSync(spec.work,'utf8'))
  value.bootstrapInputFile=path.join(alias,'future','bootstrap.json');write(spec.work,value)
  assert.throws(()=>runTask(f.config,spec.work,f.runtime),/canonical physical path/)
  assert.equal(fs.existsSync(spec.log),false)
  assert.equal(fs.existsSync(f.c.stateFile),false)
  assert.equal(f.calls.length,0)
})

test('dangling symlink ancestors cannot be treated as safe missing recovery paths',t=>{
  const f=fixture(t),spec=workSpecFixture(f)
  const alias=path.join(f.root,'dangling-control-alias')
  fs.symlinkSync(path.join(f.scope,'missing-target'),alias)
  const value=JSON.parse(fs.readFileSync(spec.work,'utf8'))
  value.bootstrapInputFile=path.join(alias,'bootstrap.json');write(spec.work,value)
  assert.throws(()=>runTask(f.config,spec.work,f.runtime),/canonical physical path/)
  assert.equal(fs.existsSync(spec.log),false)
  assert.equal(f.calls.length,0)
})

test('a direct config symlink is refused while its physical source stays intact',t=>{
  const f=fixture(t),link=path.join(f.scope,'config-link.json')
  fs.symlinkSync(f.configFile,link)
  assert.throws(()=>loadConfiguration(link),/canonical physical path/)
  assert.ok(fs.existsSync(f.configFile));assert.equal(f.calls.length,0)
})

test('remote publication discovery supports valid task IDs with repeated punctuation',t=>{
  const f=fixture(t,{taskId:'ARCHITECTURE__RUN..1234'});begin(f)
  const p=phrPublishedFixture(f)
  assert.equal(findPhrManifestForTask(f.config),p.relative)
  assert.equal(verifyPhrReadback(f.config,p.relative).publicationId,`${f.c.projectKey}:${f.c.taskId}`)
})

test('automatic closeout retains measured pre-cleanup results for the final business handoff',t=>{
  const f=fixture(t);allocated(f)
  const pre={summary:{CLEANED:1},observedFreeBytesDelta:4096,
    results:[{path:path.join(f.scope,'measured-cache'),status:'CLEANED',
      measurement:{logicalBytes:4096,allocatedBytes:4096},observedFreeBytesDelta:4096}]}
  const post={summary:{NOT_APPLICABLE:1},results:[],observedFreeBytesDelta:null}
  const out=finishTask(f.config,{bootstrapInputFile:bootstrapFixture(f),cleanPreCloseout:true,
    manifestRelative:'history/2026/11/18/task/manifest.json'},
    {...f.runtime,cleanup:options=>options.phase==='pre-closeout'?pre:post})
  assert.deepEqual(out.preCloseoutReport,pre)
  assert.deepEqual(out.postCloseoutReport,post)
  assert.equal(out.preCloseoutReport.observedFreeBytesDelta,4096)
  assert.equal(out.observedFreeBytesDelta,null)
})

// Owner-required v6: the measured pre-closeout report is canonical before save.
test('actual pre-closeout resource statuses and measured bytes are in canonical input before PMOS save',t=>{
  const f=fixture(t);allocated(f)
  const report={schemaVersion:'1.0',phase:'pre-closeout',command:'clean',summary:{CLEANED:1,RETAINED:1},
    observedFreeBytesDelta:8192,results:[{path:path.join(f.scope,'cache'),status:'CLEANED',
      measurement:{logicalBytes:4096,allocatedBytes:8192},observedFreeBytesDelta:8192},
      {path:path.join(f.scope,'retained'),status:'RETAINED',reason:'Required recovery'}]}
  let measured=false,verifiedBeforeSave=false
  const rt={...f.runtime,cleanup:options=>{
    if(options.phase==='pre-closeout'){measured=true;return report}
    return {summary:{NOT_APPLICABLE:0}}
  },run:(cmd,args,cwd)=>{
    if(args.includes('pmos:save')){
      assert.equal(measured,true)
      const input=JSON.parse(fs.readFileSync(args.at(-1),'utf8'))
      const findings=input.findings.findings.filter(x=>x.startsWith(PRE_CLOSEOUT_REPORT_PREFIX))
      assert.equal(findings.length,1)
      const receipt=JSON.parse(findings[0].slice(PRE_CLOSEOUT_REPORT_PREFIX.length))
      assert.equal(receipt.taskId,f.c.taskId)
      assert.equal(receipt.conversationId,tracked(f.c.stateFile).lifecycle.conversationId)
      assert.deepEqual(receipt.report,report)
      verifiedBeforeSave=true
    }
    return f.runtime.run(cmd,args,cwd)
  }}
  const out=finishTask(f.config,{bootstrapInputFile:bootstrapFixture(f),cleanPreCloseout:true,
    manifestRelative:'history/2026/11/18/task/manifest.json'},rt)
  assert.equal(verifiedBeforeSave,true)
  assert.equal(out.preCloseoutEvidenceDigest,tracked(f.c.stateFile).lifecycle.preCloseoutEvidence.digest)
  assert.equal(out.preCloseoutReport.observedFreeBytesDelta,8192)
})

test('a failed save resumes the identical measured report without repeated cleanup or duplicate findings',t=>{
  const f=fixture(t);allocated(f);const bootstrap=bootstrapFixture(f)
  let cleans=0,saves=0
  const rt={...f.runtime,cleanup:options=>{
    if(options.phase==='pre-closeout'){cleans++;return {summary:{CLEANED:1},observedFreeBytesDelta:4096,results:[]}}
    return {summary:{}}
  },run:(cmd,args,cwd)=>{
    if(args.includes('pmos:save')){
      saves++
      if(saves===1){canonicalPendingFixture(f,bootstrap);throw Error('save interrupted after materialization')}
    }
    return f.runtime.run(cmd,args,cwd)
  }}
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap,cleanPreCloseout:true},rt),/save interrupted/)
  const original=tracked(f.c.stateFile).lifecycle.preCloseoutEvidence
  const out=finishTask(f.config,{bootstrapInputFile:bootstrap,cleanPreCloseout:true,
    manifestRelative:'history/2026/11/18/task/manifest.json'},rt)
  assert.equal(cleans,1);assert.equal(saves,2)
  assert.equal(out.preCloseoutEvidenceDigest,original.digest)
  assert.equal(out.preCloseoutReport.observedFreeBytesDelta,4096)
  const input=JSON.parse(fs.readFileSync(original.inputFile,'utf8'))
  assert.equal(input.findings.findings.filter(x=>x.startsWith(PRE_CLOSEOUT_REPORT_PREFIX)).length,1)
})

test('report survives validation failure after cleanup and loss of the unvalidated derived file',t=>{
  const f=fixture(t);allocated(f);const bootstrap=bootstrapFixture(f)
  let cleans=0,failed=false
  const rt={...f.runtime,cleanup:options=>{
    if(options.phase==='pre-closeout'){cleans++;return {summary:{CLEANED:1},observedFreeBytesDelta:1024,results:[]}}
    return {summary:{}}
  },run:(cmd,args,cwd)=>{
    if(cmd==='npx'&&args[args.indexOf('--input')+1]?.endsWith('.pre-closeout.input.json')&&!failed){
      failed=true;fs.unlinkSync(args[args.indexOf('--input')+1]);throw Error('validation transport failed')
    }
    return f.runtime.run(cmd,args,cwd)
  }}
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap,cleanPreCloseout:true},rt),/validation transport failed/)
  assert.equal(tracked(f.c.stateFile).lifecycle.preCloseoutEvidence.report.observedFreeBytesDelta,1024)
  const out=finishTask(f.config,{bootstrapInputFile:bootstrap,cleanPreCloseout:true,
    manifestRelative:'history/2026/11/18/task/manifest.json'},rt)
  assert.equal(cleans,1);assert.equal(out.preCloseoutReport.observedFreeBytesDelta,1024)
})

test('changed original bootstrap after measurement blocks recovery without replacing canonical evidence',t=>{
  const f=fixture(t);allocated(f);const bootstrap=bootstrapFixture(f)
  const rt={...f.runtime,run:(cmd,args,cwd)=>{
    if(args.includes('pmos:save'))throw Error('before save')
    return f.runtime.run(cmd,args,cwd)
  },cleanup:()=>({summary:{RETAINED:1},observedFreeBytesDelta:null})}
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap},rt),/before save/)
  const before=tracked(f.c.stateFile).lifecycle.preCloseoutEvidence
  const b=JSON.parse(fs.readFileSync(bootstrap,'utf8'));b.result={finalStatus:'PARTIAL_SUCCESS'};write(bootstrap,b)
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap},f.runtime),/Bootstrap changed after/)
  assert.deepEqual(tracked(f.c.stateFile).lifecycle.preCloseoutEvidence,before)
})

test('legacy pending without an actual captured report is preserved instead of silently saved',t=>{
  const f=fixture(t);allocated(f);const bootstrap=bootstrapFixture(f)
  const p=path.join(f.src,'apps/pmos/.pmos/pending-artifact.json');fs.mkdirSync(path.dirname(p),{recursive:true})
  write(p,{...JSON.parse(fs.readFileSync(bootstrap,'utf8')),completionEvidence:{closeoutState:'PMOS_SAVE_STARTED'}})
  const bytes=fs.readFileSync(p);let clean=0
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrap,cleanPreCloseout:true},
    {...f.runtime,cleanup:()=>{clean++}}),/lacks a captured pre-closeout report/)
  assert.equal(clean,0);assert.deepEqual(fs.readFileSync(p),bytes)
  assert.equal(f.calls.some(([,args])=>args.includes('pmos:save')),false)
})

test('valid PHR integrity and SUCCESS without the measured report cannot complete adapter closeout',t=>{
  const f=fixture(t);allocated(f);const p=phrPublishedFixture(f)
  f.hooks.onSave=()=>{} // Simulate a publisher that dropped the canonical finding.
  assert.throws(()=>finishTask(f.config,{bootstrapInputFile:bootstrapFixture(f),manifestRelative:p.relative},
    {...f.runtime,verifyPhr:undefined,cleanup:()=>({summary:{RETAINED:1},observedFreeBytesDelta:null})}),
    /missing the actual pre-closeout report/)
  assert.equal(tracked(f.c.stateFile).closeout,undefined)
  assert.ok(tracked(f.c.stateFile).lifecycle.preCloseoutEvidence.digest)
})

test('measured pre-closeout report is independently read back from both remote PHR JSON artifacts',t=>{
  const f=fixture(t);allocated(f);const p=phrPublishedFixture(f)
  const report={summary:{REVIEW_REQUIRED:1},observedFreeBytesDelta:null,
    results:[{path:path.join(f.scope,'protected-cache'),status:'REVIEW_REQUIRED',reason:'Process telemetry unavailable'}]}
  finishTask(f.config,{bootstrapInputFile:bootstrapFixture(f),manifestRelative:p.relative},
    {...f.runtime,verifyPhr:undefined,cleanup:o=>o.phase==='pre-closeout'?report:{summary:{}}})
  const expected=tracked(f.c.stateFile).lifecycle.preCloseoutEvidence
  for(const name of ['flight-record.json','conversation-artifact.json']){
    const a=JSON.parse(git(f.phr,'show',`origin/main:${path.dirname(p.relative)}/${name}`))
    const item=a.findings.findings.find(x=>x===expected.finding)
    assert.ok(item);assert.deepEqual(JSON.parse(item.slice(PRE_CLOSEOUT_REPORT_PREFIX.length)).report,report)
  }
  assert.equal(verifyPhrReadback(f.config,p.relative).publicationId,`${f.c.projectKey}:${f.c.taskId}`)
})
