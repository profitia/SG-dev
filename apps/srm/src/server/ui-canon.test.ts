import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { uiCanon, canonAttributes, type CanonId } from '@profitia/srm-xray';
const root=path.resolve(process.cwd(),'../..');
/** Guard the approved MagicPath surfaces, including newly imported presentation files.
 * KYS presentation now consumes the same canonical registry; provider adapters remain separate.
 */
const files=['apps/srm/app/login/page.tsx','packages/srm-xray/src/header.tsx','apps/srm/app/page.tsx','apps/srm/src/modules/xray/supplier-report.tsx',...['report-availability-view','mounts','financial-scanner','financial-dashboard','financial-explorer','SpendGuruAssessment','FinancialHistoryChart','FinancialHistoryView','FinancialHistoryDialog','statement-workspace','kys-report','kys-overview','kys-pdf-button','kys-krs-button'].map(name=>`packages/srm-xray/src/${name}.tsx`)];
const native=new Set(['button','input','select','textarea','summary','a','dialog','table']);
function audit(source:string,file:string){
 const errors:string[]=[], usages:string[]=[], ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function visit(node:ts.Node){
  if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
   const tag=node.tagName.getText(ast);
   if(native.has(tag)) errors.push(`${file}: unmapped ${tag}`);
   if(tag.startsWith('Canon')){
    const attrs=node.attributes.properties.filter(ts.isJsxAttribute);
    const literal=(name:string)=>{const p=attrs.find(a=>a.name.getText(ast)===name);return p?.initializer&&ts.isStringLiteral(p.initializer)?p.initializer.text:null;};
    const id=literal('canonId'),usage=literal('usage');
    if(!id||!Object.hasOwn(uiCanon,id))errors.push(`${file}: unknown definition ${id}`);
    if(!usage)errors.push(`${file}: missing usage`);else usages.push(usage);
   }
  } ts.forEachChild(node,visit);
 }visit(ast);return {errors,usages};
}
test('canonical surfaces cannot add native controls, unknown IDs or duplicate usage sites',()=>{
 const results=files.map(file=>audit(fs.readFileSync(path.join(root,file),'utf8'),file));
 assert.deepEqual(results.flatMap(r=>r.errors),[]);
 const usages=results.flatMap(r=>r.usages);assert.equal(new Set(usages).size,usages.length);
 assert.ok(usages.length>80);
});
test('audit catches a new control even inside a conditional branch',()=>{
 assert.equal(audit('const X=()=> flag ? <button>New</button> : <CanonButton canonId="SRM-UNKNOWN" usage="x"/>','test.tsx').errors.length,2);
 assert.throws(()=>canonAttributes('SRM-UNKNOWN' as CanonId,'x'));
 assert.throws(()=>canonAttributes('SRM-C02',''));
});
test('overview tokens are centralized and use the library IDs',()=>{
 assert.equal(uiCanon['SRM-C51'].name,'Wykres przeglądowy');
 const css=fs.readFileSync(path.join(root,'packages/srm-xray/src/ui-canon.css'),'utf8');
 assert.match(css,/--canon-overviewControl:24px/);assert.match(css,/width:var\(--canon-overviewControl/);
 assert.ok(css.includes('prefers-reduced-motion'));
});
