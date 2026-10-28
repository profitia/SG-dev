import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {buildSync} from 'esbuild';
import {JSDOM} from 'jsdom';
const root=path.resolve(import.meta.dirname,'..');
test('the actual browser import graph excludes all fixtures, design helpers, registries and service transports',()=>{
 const built=buildSync({entryPoints:[path.join(root,'src/index.ts')],bundle:true,format:'esm',platform:'browser',external:['react','react-dom'],write:false,metafile:true,minify:true});
 for(const input of Object.keys(built.metafile.inputs)){assert(!/\b(tests|evidence)\b/.test(input),input);assert(!/(Delivery|Assistant|DashboardRelations|WorkspaceInfo|library-registry|spacing-contract)/.test(input),input);}
 const code=built.outputFiles.map(x=>x.text).join('\n');
 assert.doesNotMatch(code,/data-delivery|data-canon|data-library-component|465415479037693952|465859267208024064|DeliveryRuntime|Control\s*\+\s*I|Firma Demonstracyjna|SAP DEMO-001|Oceniający A|Inwestycja demonstracyjna|2026-10-26|designs\.magicpath|mgbi\.pl|vercly/i);
 assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|document\.body\.style|documentElement|<iframe|sendBeacon/);
 assert.doesNotMatch(code,/prototype scenario|Scenariusz prototypu|Informacje o projekcie|Wstaw oznaczenie demonstracyjne|Załaduj przykładowe|Symuluj prośbę/);
});
test('styles are scoped to the public mount and import no remote resources or fonts',()=>{
 const css=fs.readFileSync(path.join(root,'src/styles.css'),'utf8');assert.doesNotMatch(css,/@import|@font-face|url\(\s*['"]?https?:|data-canon|data-delivery|:root|documentElement/i);
 const dom=new JSDOM('<!doctype html><style></style><p id="outside">Outside</p>');dom.window.document.querySelector('style')!.textContent=css;
 const sheet=dom.window.document.styleSheets[0];assert(sheet,'CSS must parse');let rules=0;
 function inspect(items:CSSRuleList){for(const rule of Array.from(items)){if('selectorText' in rule){rules++;for(const selector of String(rule.selectorText).split(/,(?![^()]*\))/))assert(selector.trim().startsWith('.sg-adp-ui'),selector);}else if('cssRules' in rule)inspect(rule.cssRules as CSSRuleList);}}
 inspect(sheet.cssRules as unknown as CSSRuleList);assert(rules>100);dom.window.close();
});
test('the complete1472-row qualification is outside client imports and has no unknown decisions',()=>{
 const matrix=JSON.parse(fs.readFileSync(path.join(root,'evidence/source-transfer-matrix.json'),'utf8'));
 assert.equal(matrix.rows.length,1472);assert.equal(new Set(matrix.rows.map((r:{elementRef:string})=>r.elementRef)).size,1472);
 for(const row of matrix.rows){assert(['WYKLUCZYĆ','WDROŻYĆ PRODUKT','OBSŁUGA LOCAL DEMO','ZASTOSOWAĆ JAKO SPECYFIKACJĘ'].includes(row.decision),row.elementRef);assert(['produkt','tylko projekt','symulacja'].includes(row.ui));assert(['produkt','tylko projekt','symulacja'].includes(row.data));assert(['produkt','tylko projekt','symulacja'].includes(row.behavior));if(row.decision!=='WYKLUCZYĆ')assert(row.proposedTarget?.startsWith('packages/srm-adp-ui/src/'));}
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));assert.deepEqual(Object.keys(manifest.exports).sort(),['.','./styles.css']);assert(!Object.values(manifest.exports).some(v=>/evidence|tests|source-contract/.test(String(v))));
});
