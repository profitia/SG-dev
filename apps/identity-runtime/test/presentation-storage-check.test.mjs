import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
const guard=fs.readFileSync(new URL('../scripts/check.mjs',import.meta.url),'utf8')
const read="localStorage.getItem('srm:interface-theme:v1')==='dark'"
const write="localStorage.setItem('srm:interface-theme:v1',theme==='dark'?'dark':'light')"
const hint=read+';'+write+';'
function check(name,source){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'identity-presentation-authority-'))
 try{
  for(const p of ['src','scripts','test'])fs.mkdirSync(path.join(root,p))
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({dependencies:{'@clerk/backend':'3.25.0','@profitia/platform-contracts':'file:../../packages/platform-contracts'}}))
  fs.writeFileSync(path.join(root,'scripts/check.mjs'),guard)
  fs.writeFileSync(path.join(root,'src',name),source)
  return spawnSync(process.execPath,['scripts/check.mjs'],{cwd:root,encoding:'utf8'})
 }finally{fs.rmSync(root,{recursive:true,force:true})}
}
test('approved fixed theme preference permits only its comparison and two literal output values',()=>{
 const result=check('account-visuals.ts',hint)
 assert.equal(result.status,0,result.stderr)
})
const cases=[
 ['foreign file','foreign.ts',hint],
 ['foreign preference key','account-visuals.ts',hint.replaceAll('srm:interface-theme:v1','unapproved:key')],
 ['arbitrary data at theme key','account-visuals.ts',read+";localStorage.setItem('srm:interface-theme:v1',token);"],
 ['dynamic key','account-visuals.ts',"localStorage.getItem(key)==='dark';"+write],
 ['unrelated storage after approved preference','account-visuals.ts',hint+"localStorage.setItem('session',token);"],
 ['duplicate storage call','account-visuals.ts',hint+write],
 ['cookie after theme','account-visuals.ts',hint+"document.cookie='session='+token;"],
 ['JWT verification after theme','account-visuals.ts',hint+"jwt.verify(token);"],
 ['alternate JWT library','account-visuals.ts',hint+"jsonwebtoken.verify(token);"],
 ['alternate verification','account-visuals.ts',hint+"verifyToken(token);"],
 ['theme calls in avatar file','account-conversation.ts',hint]
]
for(const [label,file,source]of cases)test('presentation exception refuses '+label,()=>{
 const result=check(file,source)
 assert.notEqual(result.status,0)
 assert.match(result.stderr,/No alternate browser\/session\/JWT authority/)
})
