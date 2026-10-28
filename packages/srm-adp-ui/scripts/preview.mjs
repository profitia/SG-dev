import http from 'node:http';
import fs from 'node:fs';
import {build} from 'esbuild';
const root=new URL('../',import.meta.url),port=Number(process.env.ADP_PREVIEW_PORT??38126);
await build({entryPoints:[new URL('../tests/preview.tsx',import.meta.url).pathname],bundle:true,format:'esm',platform:'browser',outfile:new URL('dist/preview.js',root).pathname,define:{'process.env.NODE_ENV':'"development"'},sourcemap:false});
const html='<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ADP local presentation acceptance</title><link rel="stylesheet" href="/styles.css"><style>html,body{margin:0;font-family:Inter,Arial,sans-serif}button{font-family:inherit}</style><div id="adp-preview"></div><script type="module" src="/preview.js"></script></html>';
http.createServer((req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'");
 res.setHeader('Cache-Control','no-store');
 const path=new URL(req.url??'/',`http://127.0.0.1:${port}`).pathname;
 if(path==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);}
 else if(path==='/preview.js'){res.setHeader('Content-Type','text/javascript;charset=utf-8');res.end(fs.readFileSync(new URL('dist/preview.js',root)));}
 else if(path==='/styles.css'){res.setHeader('Content-Type','text/css;charset=utf-8');res.end(fs.readFileSync(new URL('src/styles.css',root)));}
 else {res.statusCode=404;res.end();}
}).listen(port,'127.0.0.1',()=>console.log(`ADP_LOCAL_PREVIEW http://127.0.0.1:${port}`));
