import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
import {spawnSync} from 'node:child_process'

const root=fs.realpathSync(fileURLToPath(new URL('../../../',import.meta.url)))
const require=createRequire(import.meta.url)
const publicSource=path.dirname(require.resolve('ipaddr.js/package.json'))
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value))
function fixture(){
 const directory=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'sg2-cross-host-')))
 const source=path.join(directory,'packages/platform-contracts')
 fs.mkdirSync(source,{recursive:true})
 for(const file of ['package.json','package-lock.json','src','migrations'])
  fs.cpSync(path.join(root,'packages/platform-contracts',file),path.join(source,file),{recursive:true})
 for(const host of ['sg-runtime','dashboard-preview']){
  const app=path.join(directory,'apps',host);fs.mkdirSync(app,{recursive:true})
  for(const file of ['package.json','package-lock.json'])fs.copyFileSync(path.join(root,'apps',host,file),path.join(app,file))
 }
 const app=path.join(directory,'apps/sg-runtime'),helper=path.join(app,'scripts/with-cross-host-local-packages.mjs')
 fs.mkdirSync(path.dirname(helper));fs.copyFileSync(path.join(root,'apps/sg-runtime/scripts/with-cross-host-local-packages.mjs'),helper)
 const installed=path.join(app,'node_modules/ipaddr.js')
 fs.cpSync(publicSource,installed,{recursive:true})
 const sdk=host=>path.join(directory,'apps',host,'node_modules/@profitia/platform-contracts')
 const sourcePublic=path.join(source,'node_modules/ipaddr.js')
 return {directory,source,app,helper,installed,sdk,sourcePublic,
  run(code='process.exit(0)',extra={},host='sg-runtime'){
   const env={...process.env};for(const key of ['NPM_TOKEN','NODE_AUTH_TOKEN','SG2_PACKAGES_READ_TOKEN'])delete env[key]
   const result=spawnSync(process.execPath,[helper,'--input-type=module','-e',code],{cwd:path.join(directory,'apps',host),env:{...env,...extra},encoding:'utf8'})
   assert.ifError(result.error);return result
  },close(){fs.rmSync(directory,{recursive:true,force:true})}}
}
function scoped(fn){const f=fixture();try{fn(f)}finally{f.close()}}
function rejected(f,pattern){const r=f.run("throw Error('CHILD_MUST_NOT_RUN')");assert.equal(r.status,1);assert.match(r.stderr,pattern);assert.doesNotMatch(r.stderr,/CHILD_MUST_NOT_RUN/);return r}

test('stages genuine source and reviewed installed public dependency for both hosts, then removes only its links',()=>scoped(f=>{
 const r=f.run(`import assert from 'node:assert/strict';import fs from 'node:fs';
  import {isPublicAddress} from '@profitia/platform-contracts/public-web-transport';
  assert.equal(isPublicAddress('8.8.8.8'),true);assert.equal(isPublicAddress('127.0.0.1'),false);
  assert.equal(fs.realpathSync('../dashboard-preview/node_modules/@profitia/platform-contracts'),fs.realpathSync('../../packages/platform-contracts'));`)
 assert.equal(r.status,0,r.stderr)
 for(const file of [f.sdk('sg-runtime'),f.sdk('dashboard-preview'),f.sourcePublic])assert.equal(fs.existsSync(file),false)
 assert.equal(read(path.join(f.installed,'package.json')).version,'2.2.0')
}))
test('preserves an already installed identical SDK directory',()=>scoped(f=>{
 fs.cpSync(f.source,f.sdk('sg-runtime'),{recursive:true})
 const r=f.run();assert.equal(r.status,0,r.stderr);assert.equal(fs.lstatSync(f.sdk('sg-runtime')).isDirectory(),true)
}))
test('independently installed dashboard uses its own reviewed public bytes without an SG Runtime install',()=>scoped(f=>{
 const installed=path.join(f.directory,'apps/dashboard-preview/node_modules/ipaddr.js');fs.mkdirSync(path.dirname(installed),{recursive:true});fs.renameSync(f.installed,installed)
 const r=f.run("import assert from 'node:assert/strict';import {isPublicAddress} from '@profitia/platform-contracts/public-web-transport';assert.equal(isPublicAddress('8.8.8.8'),true)",{},'dashboard-preview')
 assert.equal(r.status,0,r.stderr);assert.equal(fs.existsSync(f.installed),false);assert.equal(fs.existsSync(f.sdk('sg-runtime')),false);assert.equal(fs.existsSync(f.sourcePublic),false);assert.equal(fs.existsSync(installed),true)
}))
test('an unregistered receiving directory cannot stage any dependency',()=>scoped(f=>{
 fs.mkdirSync(path.join(f.directory,'apps/another-app'))
 const r=f.run("throw Error('CHILD_MUST_NOT_RUN')",{},'another-app')
 assert.equal(r.status,1);assert.match(r.stderr,/Explicit receiving host required/);assert.doesNotMatch(r.stderr,/CHILD_MUST_NOT_RUN/);assert.equal(fs.existsSync(f.sourcePublic),false)
}))
for(const field of ['dependencies','peerDependencies','optionalDependencies'])test(`rejects unreviewed ${field}`,()=>scoped(f=>{
 const file=path.join(f.source,'package.json'),v=read(file);v[field]={...v[field],unreviewed:'1.0.0'};write(file,v)
 rejected(f,/explicit dependency setup review/)
}))
for(const host of ['packages/platform-contracts','apps/sg-runtime','apps/dashboard-preview'])test(`rejects a changed public lock in ${host}`,()=>scoped(f=>{
 const file=path.join(f.directory,host,'package-lock.json'),v=read(file);v.packages['node_modules/ipaddr.js'].integrity='sha512-unaccepted';write(file,v)
 rejected(f,/Unaccepted public dependency lock/)
}))
test('rejects altered executable public dependency bytes',()=>scoped(f=>{
 fs.appendFileSync(path.join(f.installed,'lib/ipaddr.js'),'\n// different bytes\n');rejected(f,/Installed public dependency bytes differ/)
}))
test('rejects public dependency symlinks without altering the target',()=>scoped(f=>{
 const file=path.join(f.installed,'lib/ipaddr.js'),saved=path.join(f.directory,'preserved.js');fs.renameSync(file,saved);fs.symlinkSync(saved,file)
 rejected(f,/Installed public dependency bytes differ/);assert.equal(fs.existsSync(saved),true)
}))
test('rejects symlinked SDK source files and removes only newly staged links',()=>scoped(f=>{
 const file=path.join(f.source,'src/public-web-transport.mjs'),saved=path.join(f.directory,'preserved.mjs');fs.renameSync(file,saved);fs.symlinkSync(saved,file)
 rejected(f,/Local SDK source symlink refused/);assert.equal(fs.existsSync(f.sourcePublic),false);assert.equal(fs.existsSync(saved),true)
}))
test('preserves a foreign existing SDK with changed bytes',()=>scoped(f=>{
 fs.cpSync(f.source,f.sdk('dashboard-preview'),{recursive:true});fs.appendFileSync(path.join(f.sdk('dashboard-preview'),'src/public-web-transport.mjs'),'\n// foreign\n')
 rejected(f,/Existing SDK bytes differ/);assert.equal(fs.lstatSync(f.sdk('dashboard-preview')).isDirectory(),true);assert.equal(fs.existsSync(f.sdk('sg-runtime')),false)
}))
test('preserves an existing dangling SDK link',()=>scoped(f=>{
 const destination=f.sdk('dashboard-preview');fs.mkdirSync(path.dirname(destination),{recursive:true});fs.symlinkSync(path.join(f.directory,'missing'),destination)
 rejected(f,/Existing incomplete dependency fixture preserved/);assert.equal(fs.lstatSync(destination).isSymbolicLink(),true)
}))
test('refuses a foreign SDK public dependency link',()=>scoped(f=>{
 const copy=path.join(f.directory,'foreign-public');fs.cpSync(f.installed,copy,{recursive:true});fs.mkdirSync(path.dirname(f.sourcePublic),{recursive:true});fs.symlinkSync(copy,f.sourcePublic)
 rejected(f,/Foreign public dependency preserved/);assert.equal(fs.lstatSync(f.sourcePublic).isSymbolicLink(),true)
}))
test('changed owned dependency is preserved for recovery, and cleanup fails closed',()=>scoped(f=>{
 const r=f.run(`import fs from 'node:fs';const p='node_modules/@profitia/platform-contracts';fs.unlinkSync(p);fs.mkdirSync(p);fs.writeFileSync(p+'/recovery','preserve');`)
 assert.equal(r.status,1);assert.match(r.stderr,/Changed dependency preserved for recovery/);assert.equal(fs.readFileSync(path.join(f.sdk('sg-runtime'),'recovery'),'utf8'),'preserve')
}))
for(const key of ['NPM_TOKEN','NODE_AUTH_TOKEN','SG2_PACKAGES_READ_TOKEN'])test(`refuses execution while ${key} is present without printing its value`,()=>scoped(f=>{
 const marker='credential-fixture-marker',r=f.run("throw Error('CHILD_MUST_NOT_RUN')",{[key]:marker})
 assert.equal(r.status,1);assert.match(r.stderr,/Package credentials must be removed/);assert.doesNotMatch(r.stderr,new RegExp(marker+'|CHILD_MUST_NOT_RUN'));assert.equal(fs.existsSync(f.sourcePublic),false)
}))
test('propagates a failed child and still cleans only its own fixture',()=>scoped(f=>{
 const r=f.run('process.exit(7)');assert.equal(r.status,7);assert.equal(fs.existsSync(f.sdk('sg-runtime')),false);assert.equal(fs.existsSync(f.sourcePublic),false)
}))
