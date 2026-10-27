import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'

// Local visual test harness. This script is outside the application import graph.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const runtime=process.env.APPSHELL_TEST_RUNTIME || path.join(root,'package.json')
const require=createRequire(runtime),{build}=require('esbuild')
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{PlatformAppShell}from'${path.join(root,'components/appshell/platform-appshell.tsx').replaceAll('\\','/')}';const fixture=new URLSearchParams(location.search);const view=createRoot(document.getElementById('root'));view.render(<PlatformAppShell locale="pl" organisationBranding="porr" assistantAvatar={fixture.get('avatar')==='none'?null:fixture.get('avatar')==='female'?'female':'male'} salutation={fixture.get('name')} onLogout={()=>view.unmount()}/>);`,loader:'tsx',resolveDir:root},bundle:true,write:false,external:['/benchmark-visual/*'],outdir:'/tmp/appshell-test-output',nodePaths:[path.dirname(runtime)+'/node_modules'],format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}})
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).text
const html='<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AppShell visual test</title><link rel="stylesheet" href="/app.css"><style>body{margin:0}*,*::before,*::after{box-sizing:border-box}button,textarea{margin:0}button{font:inherit}textarea{font:inherit}</style><div id="root"></div><script src="/app.js"></script></html>'
const assets=new Map([['/appshell/assistant.png','image/png'],['/appshell/assistant-female.png','image/png'],['/benchmark-visual/inter-latin.woff2','font/woff2'],['/benchmark-visual/inter-latin-ext.woff2','font/woff2']])
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost')
 if(req.method!=='GET'){res.writeHead(405).end();return}
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return}
 if(url.pathname==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(js);return}
 if(url.pathname==='/app.css'){res.setHeader('Content-Type','text/css');res.end(css);return}
 if(assets.has(url.pathname)){res.setHeader('Content-Type',assets.get(url.pathname));res.end(fs.readFileSync(path.join(root,'public',url.pathname)));return}
 res.writeHead(404).end()
}).listen(0,'127.0.0.1',function(){console.log(JSON.stringify({url:'http://127.0.0.1:'+this.address().port,scope:'LOCAL_VISUAL_TEST_ONLY'}))})
