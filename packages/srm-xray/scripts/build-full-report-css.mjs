import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('../src/',import.meta.url)),seen=new Set();
function read(name){
 if(seen.has(name))return '';seen.add(name);
 return fs.readFileSync(path.join(source,name),'utf8').replace(/@import\s+["']\.\/([^"']+)["'];/g,(_all,file)=>read(file));
}
// Source component styles remain independently usable. The full product gets
// one deterministic scoped bundle, so ADP/Finder/host controls cannot inherit it.
const names=['report-layout.css','supplier-locations.css','msr-financial-tables.css','financial-scanner.css','supplier-search.css'];
let css=names.map(read).join('\n'),fonts=[];
css=css.replace(/@font-face\s*\{[^}]*\}/g,font=>{fonts.push(font);return ''});
// Unbound component tokens retain their native fallback instead of inheriting
// unrelated AppShell values (for example the mobile Excel dialog padding).
const defined=new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(match=>match[1]));
const unbound=[...new Set([...css.matchAll(/var\(\s*(--[\w-]+)/g)].map(match=>match[1]))].filter(name=>!defined.has(name)).sort();
css=':scope { '+unbound.map(name=>name+':initial;').join(' ')+' }\n'+css;
const output=('/* Generated from the SRM component styles; run npm run build:presentation-css. */\n'+fonts.join('\n')+'\n@scope (.srm-xray-product) {\n'+css+'\n}\n').replace(/\bInter\b/g,'SRMXRayInter');
const logo='// Derived from assets/logo.svg; shared by both full X-Ray hosts.\nexport const XRAY_LOGO_DATA_URL=\"data:image/svg+xml;base64,'+fs.readFileSync(new URL('../assets/logo.svg',import.meta.url)).toString('base64')+'\";\n';
const assetTarget=path.join(source,'presentation-assets.ts');
const target=path.join(source,'full-report.css');
if(process.argv.includes('--check')){if(fs.readFileSync(assetTarget,'utf8')!==logo)throw Error('Shared brand asset is stale');if(fs.readFileSync(target,'utf8')!==output)throw Error('Shared full-report stylesheet is stale')}
else {fs.writeFileSync(target,output);fs.writeFileSync(assetTarget,logo)}
