import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {createRequire} from 'node:module';
export const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const runtime=createRequire(process.env.APPSHELL_TEST_RUNTIME||path.join(app,'package.json'));
export const publicUi=process.env.XRAY_UI_SOURCE||path.resolve(app,'../../packages/srm-xray'),platform=process.env.XRAY_PLATFORM_SOURCE||path.resolve(app,'../../packages/platform-contracts');
export async function loadXRayModule(entry:string,{browser=false,write=false,outdir=undefined as string|undefined,metafile=false}={}){
 const {build}=runtime('esbuild');
 const result=await build({entryPoints:[path.join(app,entry)],bundle:true,write,metafile,outdir,platform:browser?'browser':'node',format:browser?'esm':'cjs',jsx:'automatic',alias:{'@':app},loader:{'.css':browser?'css':'empty','.woff2':'dataurl'},
 nodePaths:[path.dirname(runtime.resolve('react/package.json')),path.join(path.dirname(process.env.APPSHELL_TEST_RUNTIME||path.join(app,'package.json')),'node_modules'),process.env.XRAY_PUBLIC_SERVER_MODULES||path.resolve(app,'../srm/node_modules')],
 external:browser?['/benchmark-visual/*']:['react','react-dom','react-dom/client','react-dom/server','react/jsx-runtime'],
 plugins:[{name:'public-xray-only',setup(b:any){
  // The Node harness evaluates CJS in memory. Preserve each real SDK source URL
  // so its unchanged migration/digest helpers retain their ESM file semantics.
  b.onLoad({filter:/\.mjs$/},(args:any)=>args.path.startsWith(platform+path.sep)?{loader:'js',resolveDir:path.dirname(args.path),contents:fs.readFileSync(args.path,'utf8').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(args.path).href))}:undefined);
  b.onResolve({filter:/^@profitia\/srm-xray(?:\/.*)?$/},(args:any)=>{const sub=args.path.split('/').slice(2).join('/')||'.',pkg=JSON.parse(fs.readFileSync(path.join(publicUi,'package.json'),'utf8')),exported=pkg.exports[sub==='.'?'.':'./'+sub];if(!exported)throw Error('Missing public X-Ray export '+sub);return {path:path.join(publicUi,typeof exported==='string'?exported:exported.default??exported.import)};});
  b.onResolve({filter:/^@profitia\/platform-contracts\/.*$/},(args:any)=>{const pkg=JSON.parse(fs.readFileSync(path.join(platform,'package.json'),'utf8')),exported=pkg.exports['./'+args.path.split('/').slice(2).join('/')];if(!exported)throw Error('Missing public platform export');return {path:path.join(platform,typeof exported==='string'?exported:exported.default??exported.import)};});
  b.onResolve({filter:/^@profitia\/srm-adp-ui(?:\/styles.css)?$/},(args:any)=>({path:path.resolve(app,'../../packages/srm-adp-ui/src/'+(args.path.endsWith('.css')?'styles.css':'index.ts'))}));
  b.onResolve({filter:/benchmark-finder-client$/},()=>({path:'finder',namespace:'fixture'}));
  b.onResolve({filter:/^(next\/(navigation|image|link)|@clerk\/react)$/},(args:any)=>({path:args.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},(args:any)=>({loader:'js',resolveDir:app,contents:args.path==='finder'?`import React from 'react';export const BenchmarkFinderClient=()=>React.createElement('div',{'data-existing-finder':true});`
  :args.path==='next/navigation'?`export const usePathname=()=>globalThis.__xrayNav.path;export const useSearchParams=()=>new URLSearchParams(globalThis.__xrayNav.search||'');export const useRouter=()=>({push:(p)=>globalThis.__xrayNav.push(p),replace:(p)=>globalThis.__xrayNav.push(p)});`
  :args.path==='@clerk/react'?`import React from 'react';export const useAuth=()=>globalThis.__xrayAuth;export const useClerk=()=>({});export const ClerkProvider=({children})=>children;export const ClerkFailed=()=>null;export const SignOutButton=({children})=>children;`
  :`import React from 'react';export default p=>React.createElement('${args.path.endsWith('image')?'img':'a'}',p);`}));
 }}]});
 if(browser||metafile)return result;
 const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(runtime,module,module.exports);return module.exports as any;
}
