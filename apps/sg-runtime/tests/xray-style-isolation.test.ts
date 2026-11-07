import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const postcss=require('postcss');
const selectors=require('postcss-selector-parser');
const root=path.resolve(import.meta.dirname,'../../..');
const baseline='4040eaf576c6934ede4f9040e52c5c3f9e8bd9fa';
const boundary=':not(:where(.srm-xray-product, .srm-xray-product *))';
const files=['canon-theme','canon-shared','spacing-bindings','srm-interaction-motion','benchmark-finder','canon-dropdown']
 .map(name=>'apps/sg-runtime/components/benchmark-finder/visual/magicpath/'+name+'.css');

function signature(text:string,scoped:boolean){
 const css=postcss.parse(text);
 css.walkRules((rule:any)=>{
  for(let parent=rule.parent;parent;parent=parent.parent)if(parent.type==='atrule'&&/keyframes$/i.test(parent.name))return;
  const ast=selectors().astSync(rule.selector);
  ast.each((selector:any)=>{
   if(!scoped)return;
   const guards=selector.nodes.filter((node:any)=>node.type==='pseudo'&&node.toString()===boundary);
   assert.equal(guards.length,1,'Every selector excludes the shared product at its styled target');
   const guard=guards[0];
   const pseudoElement=selector.nodes.find((node:any)=>node.type==='pseudo'&&/^(::|:(before|after|first-line|first-letter)$)/.test(node.value));
   assert.equal(pseudoElement?selector.nodes.indexOf(guard)+1===selector.nodes.indexOf(pseudoElement):selector.last===guard,true,'Boundary precedes pseudo-elements and follows the target compound');
   guard.remove();
  });
  rule.selector=ast.toString();
 });
 const describe=(node:any):unknown=>{
  if(node.type==='comment')return undefined;
  const children=node.nodes?.map(describe).filter((value:unknown)=>value!==undefined);
  if(node.type==='root')return children;
  if(node.type==='rule')return {type:node.type,selector:node.selector,children};
  if(node.type==='atrule')return {type:node.type,name:node.name,params:node.params,children};
  if(node.type==='decl')return {type:node.type,prop:node.prop,value:node.value,important:!!node.important};
  throw Error('Unknown CSS node');
 };
 return describe(css);
}
function verify(file:string,text:string){
 const prior=execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8'});
 assert.deepEqual(signature(text,true),signature(prior,false),'Finder declarations, keyframes, media rules and original selector specificity stay unchanged outside X-Ray');
}
test('Finder imported styles exclude X-Ray without rewriting their existing cascade',()=>{
 for(const file of files)verify(file,fs.readFileSync(path.join(root,file),'utf8'));
});
test('Finder/X-Ray boundary rejects a missing exclusion and unrelated declaration drift',()=>{
 const file=files[0],current=fs.readFileSync(path.join(root,file),'utf8');
 assert.throws(()=>verify(file,current.replace(boundary,'')));
 const changed=postcss.parse(current);let altered=false;
 changed.walkDecls((decl:any)=>{if(!altered){decl.value='initial';altered=true;}});
 assert(altered);assert.throws(()=>verify(file,changed.toString()));
});
