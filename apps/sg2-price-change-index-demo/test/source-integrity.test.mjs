import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import postcss from 'postcss';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const matrix=JSON.parse(read('apps/sg2-price-change-index-demo/verification/completeness-matrix.json'));
const sharedTheme='packages/sg2-price-change-index-ui/src/canon/theme.css';
const plain=s=>(s===true?'':String(s??'')).replace(/\s+/g,'');
const elements=new Map(),styles=new Map();
function jsx(file){if(elements.has(file))return elements.get(file);const a=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),rows=[];function visit(n){if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))rows.push({tag:n.tagName.getText(a),attrs:Object.fromEntries(n.attributes.properties.filter(ts.isJsxAttribute).map(p=>[p.name.getText(a),plain(p.initializer?.getText(a))]))});ts.forEachChild(n,visit);}visit(a);elements.set(file,rows);return rows;}
// Resolve only the documented local bridges. Original fallbacks remain in the
// matrix; this does not change CSS or discard a geometric measurement.
function bridgeFallbacks(s){let out='';for(let i=0;i<s.length;){if(!s.startsWith('var(',i)){out+=s[i++];continue;}let depth=1,j=i+4,comma=-1;for(;j<s.length&&depth;j++){if(s[j]==='(')depth++;else if(s[j]===')')depth--;else if(s[j]===','&&depth===1&&comma<0)comma=j;}const inner=s.slice(i+4,j-1);out+=(/^(?:--(?:theme|canon)-|--action-fill,)/.test(inner.trim()))&&comma>=0?bridgeFallbacks(s.slice(comma+1,j-1)):'var('+bridgeFallbacks(inner)+')';i=j;}return out;}
const cssValue=s=>plain(bridgeFallbacks(s)).toLowerCase();
const scoped=s=>s.replace(/:root\b/g,'.pci-surface').replace(/\bhtml\[data-srm-theme\] body/g,'.pci-surface[data-srm-theme]').replace(/(^|[\s,])body(?=\s*[{,]|$)/gm,'$1.pci-surface');
function css(file){if(styles.has(file))return styles.get(file);const src=read(file),parts=[],rows=[];if(file.endsWith('.css'))parts.push(src);else{const a=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);function visit(n){if(ts.isNoSubstitutionTemplateLiteral(n)&&n.text.includes('{'))parts.push(n.text);ts.forEachChild(n,visit);}visit(a);}for(const s of parts)postcss.parse(s).walkRules(r=>rows.push({selector:r.selector,attrs:Object.fromEntries(r.nodes.filter(d=>d.type==='decl').map(d=>[d.prop,{value:d.value,important:!!d.important}]))}));styles.set(file,rows);return rows;}

test('all 1864 pinned JSX entries retain source attributes or an explicit bounded transformation',()=>{
 const misses=[];let checked=0;
 for(const row of matrix.rows.filter(r=>r.kind==='element')){
  checked++;const transform=row.approvedTransform;
  if(transform?.kind==='removed-remote-theme-transport'){assert.equal(row.element,'iframe');assert.ok(!read(row.implementationFile).includes('<iframe'));continue;}
  const changed=transform?.changedAttributes??[];if(transform?.kind==='resolved-pinned-provenance')assert.deepEqual(transform.resolvedAttributes,{'data-canon-source':JSON.stringify(matrix.library.componentId)});
  assert.ok(changed.every(x=>['value','onCancel','onClick'].includes(x)),row.id);
  if(transform?.kind==='local-theme-provider'){const s=read(row.implementationFile);assert.match(s,/usePresentationScope/);assert.doesNotMatch(s,/localStorage|postMessage|<iframe/);}
  if(transform?.kind==='C27-focus-return'){const s=read(row.implementationFile);assert.ok(s.indexOf('dialog.current?.close()')<s.indexOf('previous?.focus('),row.id);}
  const hit=jsx(row.implementationFile).some(n=>n.tag===row.element&&row.parameters.filter(p=>!changed.includes(p.name)).every(p=>n.attrs[p.name]===plain(transform?.resolvedAttributes?.[p.name]??p.value)));
  if(!hit)misses.push(row.id);
 }
 assert.equal(checked,1864);assert.deepEqual(misses,[]);
});

test('all 3246 pinned style entries retain declarations and documented canonical/scoping changes',()=>{
 const misses=[];let checked=0;
 for(const row of matrix.rows.filter(r=>r.kind==='style')){
  checked++;const transform=row.approvedTransform;
  const selector=transform?.selector??scoped(row.selector);
  const declarations=Object.fromEntries(row.parameters.map(p=>[p.property,p]));
  for(const [property,value]of Object.entries(transform?.properties??{})){assert.equal(transform.kind,'library-action-geometry');assert.ok(['--canon-actionHeight','--canon-actionFont','--canon-cardRadius'].includes(property));declarations[property]={property,value,important:false};}
  const candidates=[...css(row.implementationFile),...css(sharedTheme)].filter(r=>plain(r.selector)===plain(selector));
  const hit=candidates.some(r=>Object.values(declarations).every(p=>{const d=r.attrs[p.property];return d&&d.important===p.important&&cssValue(d.value)===cssValue(p.value);}));
  if(!hit)misses.push(row.id);
 }
 assert.equal(checked,3246);assert.deepEqual(misses,[]);
});
