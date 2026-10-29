/** Synthetic external authority, real application React composition and CCI.
 * Loopback acceptance only. No customer identity or product persistence. */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import {execFileSync} from 'node:child_process'
import {bundleAdp,appRoot,runtimeRequire} from './adp-appshell-preview.mjs'
import {createPriceChangeIndexHandler} from '../lib/cost-analysis/price-change-index-operation.ts'
export const organisation='11111111-1111-4111-8111-111111111111'
const provider={providerCode:'MACROBOND',displayName:'Macrobond'}
const candidates=['Copper','Energy','Oil','Steel','Aluminium','Gas','Electricity','Plastic','Transport','Labor','Packaging','Water','Nickel'].map((displayName,i)=>({candidateId:'macrobond:s'+i,displayName,description:null,provider,providerSeries:{provider,providerSeriesId:'s'+i,providerSeriesKey:'s'+i},frequency:'daily',currency:'USD',unit:'index',source:'SYNTHETIC BROWSER FIXTURE',region:'World',metadata:{},lastObservationDate:'2024-01-03'}))
const saved=c=>({selectionId:'selection-'+c.candidateId,businessBenchmarkId:c.providerSeries.providerSeriesId,organizationId:organisation,displayName:c.displayName,provider,providerSeries:c.providerSeries,frequency:c.frequency,currency:c.currency,unit:c.unit,source:c.source,selectedAt:'2024-01-01T00:00:00.000Z'})
const history=c=>({providerSeries:c.providerSeries,displayName:c.displayName,frequency:'DAILY',currency:'USD',unit:'index',source:c.source,range:'ALL',latestValue:120,historical:[0,1,2].map((n)=>({date:'2024-01-0'+(n+1),value:c.displayName==='Energy'?[110,100,90][n]:[80,100,120][n]}))})
const outdir=process.env.JOURNEY_PREVIEW_OUTPUT
if(!outdir||!path.isAbsolute(outdir))throw Error('Own absolute acceptance output required')
fs.mkdirSync(outdir,{recursive:true})
execFileSync(process.execPath,[runtimeRequire.resolve('tailwindcss/lib/cli.js'),'-i','app/globals.css','-o',path.join(outdir,'tailwind.css'),'--minify'],{cwd:appRoot,stdio:'pipe'})
await bundleAdp('tests/integrated-buyer-journey-preview.tsx',{browser:true,write:true,outdir})
let selections=[]
const handler=createPriceChangeIndexHandler({isClerk:()=>true,now:()=> '2024-01-04T00:00:00.000Z',selections:async()=>Response.json({items:selections}),history:async r=>Response.json(history(candidates.find(c=>c.providerSeries.providerSeriesId===r.nextUrl.searchParams.get('seriesId'))))})
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/tailwind.css"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>'
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://127.0.0.1'),route=u.pathname
 const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks).toString()
 const json=(value,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value))}
 if(route==='/__acceptance/reset'&&req.method==='POST'){selections=[];return json({reset:true})}
 if(route==='/api/benchmark/search')return json({items:candidates.filter(c=>c.displayName.toLowerCase().includes((u.searchParams.get('q')||'').toLowerCase()))})
 if(route==='/api/benchmark/metadata')return json({items:[]})
 if(route.includes('/api/benchmark/metadata/'))return json({items:[]})
 if(route==='/api/benchmark/context')return json({items:[]})
 if(route==='/api/benchmark/selection'){
  if(req.method==='POST'){const c=JSON.parse(body).candidate,x=saved(c);if(!selections.some(b=>b.businessBenchmarkId===x.businessBenchmarkId))selections.push(x);return json(x)}return json({items:selections})
 }
 if(route==='/api/benchmark/preview'){const c=candidates.find(c=>c.providerSeries.providerSeriesId===u.searchParams.get('seriesName'));return json({...history(c),range:u.searchParams.get('range'),changeMetrics:{'1M':1,'3M':2,'1Y':3}})}
 if(route==='/api/benchmark/analytics-eligibility')return json({eligible:false,reason:'SYNTHETIC_NO_FORECAST_FIXTURE'})
 if(route==='/api/category')return json({...JSON.parse(body),id:'33333333-3333-4333-8333-333333333333',organizationId:organisation},201)
 if(route==='/api/cost-analysis/price-change-index'){const r=await handler(new Request('http://127.0.0.1'+route,{method:'POST',headers:req.headers,body}));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());return}
 if(route.startsWith('/api/'))return json({error:'Unimplemented test transport'},503)
 if(/^\/(?:pl|en)\/dashboard(?:\/(?:adp|benchmark-finder))?\/?$/.test(route)){res.setHeader('content-type','text/html');res.end(html);return}
 const output=route==='/tailwind.css'?path.join(outdir,'tailwind.css'):route==='/fixture.js'||route==='/fixture.css'?path.join(outdir,'integrated-buyer-journey-preview'+path.extname(route)):null
 const asset=/^\/(?:appshell\/[\w.-]+|benchmark-visual\/inter-latin(?:-ext)?\.woff2)$/.test(route)?path.join(appRoot,'public',route):null
 const file=output||asset;if(!file||!fs.existsSync(file)){res.statusCode=404;res.end();return}
 res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file))
}catch(e){console.error(e);res.statusCode=500;res.end('Fixture failed')}})
server.listen(Number(process.env.JOURNEY_PREVIEW_PORT||33577),'127.0.0.1',()=>console.log('Synthetic journey preview ready'))
