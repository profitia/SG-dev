import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {sdkSourceContext,CURRENT_SDK_SOURCE_RECORD} from './sdk-source-context.mjs'
const hash=x=>createHash('sha256').update(x).digest('hex')
const manifest='packages/platform-contracts/package.json',code='packages/platform-contracts/src/operation-context.mjs'
const extra='apps/example/app/[locale]/layout.tsx',receipt='apps/example/operation-integration.json',coverage='apps/example/source-record.json'
function fixture(){
 const oldReceipt='{"accepted":"original"}',oldCoverage=JSON.stringify({sourceDigests:{[manifest]:hash('old manifest'),[code]:hash('old code'),[extra]:hash('old view'),'AGENTS.md':hash('old agents')}})
 const current=new Map([[manifest,JSON.stringify({version:'1.38.0'})],[code,'new actual code'],[extra,'new actual view'],[receipt,oldReceipt],['AGENTS.md','new actual root instructions']])
 const historical=new Map([['a'.repeat(40)+':'+coverage,oldCoverage],['a'.repeat(40)+':'+receipt,oldReceipt],['a'.repeat(40)+':AGENTS.md','old agents'],['b'.repeat(40)+':AGENTS.md','second known tree'],
  ['a'.repeat(40)+':'+code,'old code'],['b'.repeat(40)+':'+code,'independent accepted code']])
 const record={schemaVersion:'1.0',scope:'CURRENT_SDK_SOURCE_INTEGRITY_ONLY',platformVersion:'1.38.0',
  runtimeActivated:false,permissionsChanged:false,providerCallsPerformed:false,deploymentPerformed:false,
  inputs:Object.fromEntries([...current].map(([p,v])=>[p,hash(v)])),baselines:{first:{sha:'a'.repeat(40)},second:{sha:'b'.repeat(40)}},
  coverageRecords:[{baseline:'first',path:coverage,sha256:hash(oldCoverage)}],retainedReceipts:{[receipt]:{baseline:'first',sha256:hash(oldReceipt)}},
  metadata:{sdkDigests:{operation:hash('new actual code')},optionalPackageDigests:{fresh:hash('new actual optional source')}}}
 let historicalReads=0
 const raw=p=>{if(p===CURRENT_SDK_SOURCE_RECORD)return Buffer.from(JSON.stringify(record));if(!current.has(p))throw Object.assign(Error('Absent'),{code:'ENOENT'});return Buffer.from(current.get(p))}
 const old=(sha,p)=>{historicalReads++;assert(historical.has(sha+':'+p));return Buffer.from(historical.get(sha+':'+p))}
 return{record,current,historical,raw,old,reads:()=>historicalReads,run:()=>sdkSourceContext(raw,old)}
}
test('current bytes and immutable historical views are separate, without projecting current source',()=>{
 const f=fixture(),v=f.run()
 assert.equal(v.metadata.sdkDigests.operation,hash('new actual code'))
 assert.equal(v.currentSourceDigests[extra],hash('new actual view'))
 assert.equal(v.baseline('first')(code).toString(),'old code')
 assert.equal(v.baseline('second')(code).toString(),'independent accepted code')
 const copy=v.baseline('first')(code);copy[0]=0
 assert.equal(v.baseline('first')(code).toString(),'old code')
 assert.throws(()=>{v.record.metadata.sdkDigests.operation='forged'})
 assert.throws(()=>v.baseline('undeclared'))
})
test('a changed current source fails before any historical view is read',()=>{
 const f=fixture();f.current.set(code,'substituted code')
 assert.throws(f.run,/current SDK source/);assert.equal(f.reads(),0)
})
test('current inputs are re-read after a prior successful verification',()=>{
 const f=fixture();f.run();f.current.set(extra,'changed after verification');assert.throws(f.run)
})
test('omitting a predecessor input cannot shrink the current source closure',()=>{
 const f=fixture();delete f.record.inputs[extra];assert.throws(f.run,/retained physical source coverage/)
})
test('historical source records and current retained receipts remain immutable',()=>{
 for(const change of [
  f=>f.historical.set('a'.repeat(40)+':'+coverage,'{}'),
  f=>{f.current.set(receipt,'{"accepted":"rewritten"}');f.record.inputs[receipt]=hash(f.current.get(receipt))},
  f=>f.historical.set('a'.repeat(40)+':'+receipt,'changed history')
 ]){const f=fixture();change(f);assert.throws(f.run)}
})
test('unsafe source paths, self-references and activation flags are refused',()=>{
 for(const path of ['../secret','/absolute','a/../secret','a\\secret','a/.git/config','a/.env.local','a/node_modules/private',CURRENT_SDK_SOURCE_RECORD]){
  const f=fixture();f.record.inputs[path]='a'.repeat(64);assert.throws(f.run)
 }
 for(const flag of ['runtimeActivated','permissionsChanged','providerCallsPerformed','deploymentPerformed']){const f=fixture();f.record[flag]=true;assert.throws(f.run)}
 const f=fixture();f.record.scope='RUNTIME_AUTHORITY';assert.throws(f.run)
})
test('an older SDK keeps its own unchanged verifier and never receives this current context',()=>{
 const f=fixture();f.current.set(manifest,JSON.stringify({version:'1.37.0'}))
 assert.equal(f.run(),null);assert.equal(f.reads(),0)
 assert.equal(sdkSourceContext(()=>{throw Object.assign(Error('missing record'),{code:'ENOENT'})},()=>assert.fail()),null)
})

test('full immutable Git views preserve absence as ENOENT without falling back to another tree',()=>{
 const missing='apps/example/absent-source.json'
 for(const message of ["' does not exist in ","' exists on disk, but not in "]){
  const f=fixture(),seen=[]
  const value=sdkSourceContext(f.raw,(sha,p)=>{
   if(p===missing){seen.push(sha);throw Object.assign(Error('missing Git path'),{status:128,stderr:"fatal: path '"+p+message+"'"+sha+"'"})}
   return f.old(sha,p)
  })
  assert.throws(()=>value.baseline('first')(missing),error=>error.code==='ENOENT')
  assert.deepEqual(seen,['a'.repeat(40)])
 }
})
test('other Git failures remain errors and cannot masquerade as an absent predecessor path',()=>{
 const f=fixture(),missing='apps/example/absent-source.json'
 const failure=Object.assign(Error('bad immutable object'),{status:128,stderr:'fatal: bad object'})
 const value=sdkSourceContext(f.raw,(sha,p)=>{if(p===missing)throw failure;return f.old(sha,p)})
 assert.throws(()=>value.baseline('first')(missing),error=>error===failure)
 assert.throws(()=>value.baseline('first')('../outside'))
})

test('root instruction files cannot disappear from the current physical closure',()=>{
 const f=fixture();delete f.record.inputs['AGENTS.md']
 assert.throws(f.run,/retained physical source coverage AGENTS.md/)
})
test('a missing-path message from an unknown full SHA cannot be accepted as genuine Git absence',()=>{
 const f=fixture(),missing='apps/example/absent-source.json',unknown='c'.repeat(40)
 f.record.baselines.unknown={sha:unknown}
 const failure=Object.assign(Error('unknown historical object'),{status:128,
  stderr:"fatal: path '"+missing+"' exists on disk, but not in '"+unknown+"'"})
 const value=sdkSourceContext(f.raw,(sha,p)=>{
  if(sha===unknown&&p===missing)throw failure
  return f.old(sha,p)
 })
 assert.throws(()=>value.baseline('unknown')(missing),error=>error===failure)
})


import continuityFs from 'node:fs';
import continuityOs from 'node:os';
import continuityPath from 'node:path';
import {execFileSync as continuityExec} from 'node:child_process';
import {fileURLToPath as continuityFileURL} from 'node:url';
const continuityRepository=continuityFileURL(new URL('../../../',import.meta.url));
const continuitySdk='fba2d4ea6b9740362e16a504857da418e9ab22e2';
const continuityInput='apps/sg-runtime/components/appshell/appshell-dashboard.tsx';
const continuityOther='apps/sg-runtime/scripts/monitor-benchmark-finder.mjs';
const continuityLedger='Canon/registries/controlled-source-admissions-v1.json';
const continuityEnv={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'};
const continuityGit=(root,...args)=>continuityExec('git',args,{cwd:root,env:continuityEnv,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const continuityWrite=(root,p,bytes)=>{continuityFs.mkdirSync(continuityPath.dirname(continuityPath.join(root,p)),{recursive:true});continuityFs.writeFileSync(continuityPath.join(root,p),bytes);};
function continuityCommit(root){
 continuityGit(root,'add','--sparse','.');
 continuityGit(root,'-c','user.name=Synthetic fixture','-c','user.email=synthetic@example.invalid','-c','commit.gpgsign=false','commit','--quiet','-m','SYNTHETIC_ONLY current SDK policy test');
 return continuityGit(root,'rev-parse','HEAD');
}
function realSdkContinuityFixture({kind='admitted',expired=false,incomplete=false,duplicate=false,completeRepository=false}={}){
 // Genuine, complete SDK1.38 source and its immutable records. Only the private
 // test main/admission are synthetic; they are never published or used as proof.
 const temporary=continuityFs.realpathSync(continuityFs.mkdtempSync(continuityPath.join(continuityOs.tmpdir(),'sdk-real-source-continuity-')));
 const root=continuityPath.join(temporary,'source');
 try{
  continuityGit(temporary,'clone','--quiet','--shared','--no-checkout',continuityRepository,'source');
  continuityGit(root,'remote','set-url','origin','https://github.com/profitia/SG-dev.git');
  const bytes=continuityExec('git',['cat-file','blob',continuitySdk+':'+CURRENT_SDK_SOURCE_RECORD],{cwd:root});
  const record=JSON.parse(bytes),names=new Set([CURRENT_SDK_SOURCE_RECORD,continuityLedger,...Object.keys(record.inputs),...Object.keys(record.retainedReceipts)]);
  assert.equal(record.platformVersion,'1.38.0');assert.equal(Object.keys(record.inputs).length,1690);assert(record.inputs[continuityInput]);
  if(!completeRepository){
  continuityGit(root,'sparse-checkout','init','--no-cone');
  continuityExec('git',['sparse-checkout','set','--no-cone','--stdin'],{cwd:root,env:continuityEnv,input:[...names].map(p=>'/'+p.replaceAll('[','\\[').replaceAll(']','\\]')).join('\n')+'\n',stdio:['pipe','pipe','pipe']});
  }
  continuityGit(root,'checkout','--quiet','--detach',continuitySdk);
  continuityFs.appendFileSync(continuityPath.join(root,continuityInput),'\n// SYNTHETIC_ONLY authorized application source advance\n');
  const source=continuityCommit(root);
  if(kind==='accepted'){
   continuityGit(root,'update-ref','refs/remotes/origin/main',source);
  }else{
   const row={id:'SYNTHETIC_ONLY:SDK_CURRENT_APPLICATION',taskId:'SYNTHETIC_ONLY',approvalRef:'SYNTHETIC_ONLY test fixture, not an actual mandate',repository:'profitia/SG-dev',actor:'profitia',status:'ACTIVE',targetEnvironment:'development',scope:'SOURCE_VALIDATION_ONLY',sourceSha:source,baseSha:continuitySdk,validFrom:'2000-01-01T00:00:00Z',validUntil:expired?'2001-01-01T00:00:00Z':'2099-01-01T00:00:00Z',files:[{path:continuityInput,blob:continuityGit(root,'rev-parse',source+':'+continuityInput),mode:'100644',status:'modified',projectKey:'SG2',owner:'SG Runtime',surfaceId:'SG2-BASE-001'}]};
   const unrelated={...row,id:'SYNTHETIC_ONLY:DISJOINT',files:[{...row.files[0],path:continuityOther,blob:continuityGit(root,'rev-parse',source+':'+continuityOther)}]};
   if(incomplete)row.files.push({...unrelated.files[0]});
   const records=[row,unrelated];if(duplicate)records.push({...row,id:'SYNTHETIC_ONLY:OVERLAP'});
   continuityGit(root,'checkout','--quiet','--detach',continuitySdk);
   continuityWrite(root,continuityLedger,JSON.stringify({schemaVersion:'1.0',records}));
   const authority=continuityCommit(root);continuityGit(root,'update-ref','refs/remotes/origin/main',authority);
   continuityGit(root,'-c','user.name=Synthetic fixture','-c','user.email=synthetic@example.invalid','-c','commit.gpgsign=false','merge','--quiet','--no-ff',source,'-m','SYNTHETIC_ONLY current source with complete admission');
  }
  let reads=0;
  const current=p=>continuityFs.readFileSync(continuityPath.join(root,p));
  const historical=(sha,p)=>{reads++;return continuityExec('git',['cat-file','blob',sha+':'+p],{cwd:root,stdio:['ignore','pipe','pipe']});};
  return {temporary,root,record,current,historical,reads:()=>reads,run:()=>sdkSourceContext(current,historical,{sourceRoot:root,authorityRoot:root,governanceRoot:continuityRepository})};
 }catch(error){continuityFs.rmSync(temporary,{recursive:true,force:true});throw error;}
}
function withRealSdkContinuity(options,body){
 const f=realSdkContinuityFixture(options);
 try{return body(f);}finally{continuityFs.rmSync(f.temporary,{recursive:true,force:true});}
}
test('real complete SDK1.38 accepts independently accepted application changes and retains original evidence',()=>withRealSdkContinuity({kind:'accepted'},f=>{
 const v=f.run();assert(v);
 assert.equal(v.currentSourceDigests[continuityInput],hash(f.current(continuityInput)));
 assert.equal(v.record.inputs[continuityInput],f.record.inputs[continuityInput]);
 assert.notEqual(v.currentSourceDigests[continuityInput],v.record.inputs[continuityInput]);
 assert.deepEqual(v.metadata,f.record.metadata);
 for(const [p,e]of Object.entries(f.record.retainedReceipts)){
  assert.equal(hash(f.current(p)),e.sha256);
  assert.equal(hash(v.baseline(e.baseline)(p)),e.sha256);
 }
}));
test('real complete SDK1.38 authenticates the entire current admission despite a disjoint record',()=>withRealSdkContinuity({},f=>{
 const v=f.run();assert(v);
 assert.equal(v.currentSourceDigests[continuityInput],hash(f.current(continuityInput)));
 assert.equal(continuityGit(f.root,'status','--porcelain'),'');
}));
test('SDK refuses expired, overlapping and incomplete admissions before reading legacy evidence',()=>{
 for(const options of [{expired:true},{duplicate:true},{incomplete:true}])withRealSdkContinuity(options,f=>{
  assert.throws(f.run);assert.equal(f.reads(),0);
 });
});
test('SDK refuses foreign authority, executable files, symlinks and unreviewed dirty inputs before history',()=>{
 const mutations=[
  f=>continuityGit(f.root,'remote','set-url','origin','https://example.invalid/untrusted'),
  f=>continuityFs.chmodSync(continuityPath.join(f.root,continuityInput),0o755),
  f=>{continuityFs.unlinkSync(continuityPath.join(f.root,continuityInput));continuityFs.symlinkSync(continuityPath.join(f.root,continuityOther),continuityPath.join(f.root,continuityInput));},
  f=>continuityWrite(f.root,'SYNTHETIC_ONLY_unreviewed.txt','unreviewed'),
  f=>{continuityWrite(f.root,'SYNTHETIC_ONLY_extra.mjs','// unreviewed');continuityCommit(f.root);},
 ];
 for(const mutation of mutations)withRealSdkContinuity({},f=>{mutation(f);assert.throws(f.run);assert.equal(f.reads(),0);});
});
test('candidate metadata cannot authorize a continuation and retained receipts cannot advance',()=>{
 withRealSdkContinuity({},f=>{
  const record=JSON.parse(f.current(CURRENT_SDK_SOURCE_RECORD));record.metadata.unreviewed='SYNTHETIC_ONLY';
  continuityWrite(f.root,CURRENT_SDK_SOURCE_RECORD,JSON.stringify(record));
  assert.throws(f.run,/independently accepted descriptor/);assert.equal(f.reads(),0);
 });
 withRealSdkContinuity({kind:'accepted'},f=>{
  const p=Object.keys(f.record.retainedReceipts)[0];continuityFs.appendFileSync(continuityPath.join(f.root,p),'SYNTHETIC_ONLY');
  const sha=continuityCommit(f.root);continuityGit(f.root,'update-ref','refs/remotes/origin/main',sha);
  assert.throws(f.run,/retained SDK evidence cannot advance|immutable|unchanged/);
 });
});
test('an unrelated metadata epoch cannot substitute an immutable complete SDK ancestor',()=>withRealSdkContinuity({kind:'accepted'},f=>{
 const record=JSON.parse(f.current(CURRENT_SDK_SOURCE_RECORD));record.status='SYNTHETIC_ONLY_NEW_EPOCH';
 continuityWrite(f.root,CURRENT_SDK_SOURCE_RECORD,JSON.stringify(record));
 const sha=continuityCommit(f.root);continuityGit(f.root,'update-ref','refs/remotes/origin/main',sha);
 assert.throws(f.run,/complete immutable current SDK source/);
 const fakeHistory=(sha,p)=>{
  if(p===CURRENT_SDK_SOURCE_RECORD)return f.current(p);
  if(p===manifest)return continuityExec('git',['cat-file','blob',continuitySdk+':'+p],{cwd:f.root});
  if(p===continuityInput)return continuityExec('git',['cat-file','blob',continuitySdk+':'+p],{cwd:f.root});
  return f.historical(sha,p);
 };
 assert.throws(()=>sdkSourceContext(f.current,fakeHistory,{sourceRoot:f.root,authorityRoot:f.root,governanceRoot:continuityRepository}),/complete immutable current SDK source/);
}));

test('a changed SDK runtime or manifest cannot retain old SDK metadata even after acceptance on main',()=>{
 for(const p of [code,manifest])withRealSdkContinuity({kind:'accepted'},f=>{
  if(p===manifest){const value=JSON.parse(f.current(p));value.SYNTHETIC_ONLY='runtime metadata must advance separately';continuityWrite(f.root,p,JSON.stringify(value));}
  else continuityFs.appendFileSync(continuityPath.join(f.root,p),'\n// SYNTHETIC_ONLY changed SDK runtime\n');
  const sha=continuityCommit(f.root);continuityGit(f.root,'update-ref','refs/remotes/origin/main',sha);
  assert.throws(f.run,/SDK runtime source requires separate metadata/);
 });
});
test('the actual seven-file source-only policy composes with genuine SDK1.38 and preserves every runtime input',async()=>{
 const f=realSdkContinuityFixture({kind:'accepted',completeRepository:true});
 try{
  const paths=['scripts/governance/development-execution.mjs','scripts/governance/development-execution.test.mjs','apps/architecture-lab/knowledge-source.mjs','apps/architecture-lab/test/knowledge-current-application-source.test.mjs','scripts/governance/controlled-package-ci.mjs','packages/platform-contracts/test/sdk-source-context.mjs','packages/platform-contracts/test/sdk-source-context.test.mjs'];
  for(const p of paths)continuityWrite(f.root,p,continuityFs.readFileSync(continuityPath.join(continuityRepository,p)));
  const sha=continuityCommit(f.root);continuityGit(f.root,'update-ref','refs/remotes/origin/main',sha);
  const {pathToFileURL}=await import('node:url');
  const actual=await import(pathToFileURL(continuityPath.join(f.root,'packages/platform-contracts/test/sdk-source-context.mjs')).href);
  const context=actual.currentSdkSourceContext();assert(context);
  assert.deepEqual(context.metadata,f.record.metadata);
  for(const [p,digest]of Object.entries(f.record.inputs)){
   if(p.startsWith('packages/platform-contracts/')&&!p.startsWith('packages/platform-contracts/test/'))assert.equal(hash(f.current(p)),digest,'unchanged SDK runtime '+p);
  }
  const knowledge=await import(pathToFileURL(continuityPath.join(f.root,'apps/architecture-lab/knowledge-source.mjs')).href);
  assert(knowledge.knowledgeSourcePredecessor(f.current,f.historical));
  const controller=await import(pathToFileURL(continuityPath.join(f.root,'scripts/governance/controlled-package-ci.mjs')).href);
  assert(controller.currentSdkProofContext(f.root));
  assert.equal(continuityGit(f.root,'status','--porcelain'),'');
 }finally{continuityFs.rmSync(f.temporary,{recursive:true,force:true});}
});
