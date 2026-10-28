import http from 'node:http';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=new URL('../',import.meta.url),port=Number(process.env.ADP_PREVIEW_PORT??38126);
await build({entryPoints:[fileURLToPath(new URL('../tests/preview.tsx',import.meta.url))],bundle:true,format:'esm',platform:'browser',outfile:fileURLToPath(new URL('dist/preview.js',root)),define:{'process.env.NODE_ENV':'"development"'},sourcemap:false});
const fontRoot=new URL('../../apps/sg-runtime/public/benchmark-visual/',root);
for(const name of ['inter-latin.woff2','inter-latin-ext.woff2'])fs.accessSync(new URL(name,fontRoot));
const html='<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ADP local presentation acceptance</title><link rel="stylesheet" href="/styles.css"><style>@font-face{font-family:Inter;src:url(/fonts/inter-latin.woff2) format("woff2");font-weight:400;font-style:normal;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}@font-face{font-family:Inter;src:url(/fonts/inter-latin-ext.woff2) format("woff2");font-weight:400;font-style:normal;unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}html,body{margin:0;font-family:Inter,Arial,sans-serif}button{font-family:inherit}</style><div id="adp-preview"></div><script type="module" src="/preview.js"></script></html>';
http.createServer((req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'");
 res.setHeader('Cache-Control','no-store');
 const path=new URL(req.url??'/',`http://127.0.0.1:${port}`).pathname;
 if(path==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);}
 else if(path==='/preview.js'){res.setHeader('Content-Type','text/javascript;charset=utf-8');res.end(fs.readFileSync(new URL('dist/preview.js',root)));}
 else if(path==='/styles.css'){res.setHeader('Content-Type','text/css;charset=utf-8');res.end(fs.readFileSync(new URL('src/styles.css',root)));}
 else if(['/fonts/inter-latin.woff2','/fonts/inter-latin-ext.woff2'].includes(path)){res.setHeader('Content-Type','font/woff2');res.end(fs.readFileSync(new URL(path.slice('/fonts/'.length),fontRoot)));}
 else {res.statusCode=404;res.end();}
}).listen(port,'127.0.0.1',()=>console.log(`ADP_LOCAL_PREVIEW http://127.0.0.1:${port}`));
