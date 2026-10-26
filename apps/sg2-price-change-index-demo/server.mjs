import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
const configuredBase=process.env.PCI_BASE_PATH??'/';
if(!configuredBase.startsWith('/')||configuredBase.includes('..')||configuredBase.includes('?')||configuredBase.includes('#'))throw new Error('PCI_BASE_PATH must be an absolute URL path');
const base=configuredBase.replace(/\/+$/,'')+'/';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json'};
const headers={'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()'};
const server=http.createServer((req,res)=>{
 for(const [key,value]of Object.entries(headers))res.setHeader(key,value);
 if(!['GET','HEAD'].includes(req.method??'')){res.writeHead(405);res.end();return;}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url??'/','http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(pathname.includes('\0')||pathname.split('/').includes('..')){res.writeHead(400);res.end();return;}
 if(pathname===base.slice(0,-1)&&base!=='/'){res.writeHead(308,{Location:base});res.end();return;}
 if(!pathname.startsWith(base)){res.writeHead(404);res.end();return;}
 const relative=pathname.slice(base.length);let file=path.join(root,relative);
 if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return;}
 if(!path.extname(relative)){
  if(!['','v1','v2','v3','portable'].includes(relative.replace(/\/$/,''))){res.writeHead(404);res.end();return;}
  file=path.join(root,'index.html');
 }
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',mime[path.extname(file)]??'application/octet-stream');
 res.setHeader('Cache-Control',file.includes(path.sep+'assets'+path.sep)?'public, max-age=31536000, immutable':'no-store');
 res.writeHead(200);if(req.method==='HEAD'){res.end();return;}fs.createReadStream(file).pipe(res);
});
server.listen(Number(process.env.PORT??3672),'0.0.0.0');
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));process.on('SIGINT',()=>server.close(()=>process.exit(0)));
