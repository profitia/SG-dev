import test,{before,after,afterEach} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
const require=createRequire(import.meta.url),{build}=require('esbuild')
const React=require('react'),{createRoot}=require('react-dom/client')
const {JSDOM}=createRequire(process.env.ORGANISATION_TEST_JSDOM||import.meta.url)('jsdom')
let dom:any,root:any,container:any,AccountLanding:any
const globals=globalThis as any,saved=new Map<string,PropertyDescriptor|undefined>()
const first='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',second='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
let organisationId=first,denial=0,outage=false,lifetime=25000,mounts=0,selection=false
let requestedSlugs:(string|null)[]=[]
const token=async()=>'synthetic.original.session'
before(async()=>{
 dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://sg2.example.test/pl/dashboard'})
 for(const[k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){
  saved.set(k,Object.getOwnPropertyDescriptor(globals,k));Object.defineProperty(globals,k,{value:v,configurable:true,writable:true})
 }
 saved.set('fetch',Object.getOwnPropertyDescriptor(globals,'fetch'))
 globals.__organisationAuth={isLoaded:true,isSignedIn:true,userId:'synthetic-user',sessionId:'synthetic-session',getToken:token}
 globals.__organisationMount=()=>mounts++
 const mocks:any={
  '@clerk/react':"export const useAuth=()=>globalThis.__organisationAuth;export const useClerk=()=>({signOut:async()=>{}})",
  'next/navigation':"export const useRouter=()=>({replace:()=>{}})",
  'next/image':"import React from 'react';export default p=>React.createElement('img',p)",
  '@/components/appshell/appshell-dashboard':"import React from 'react';export function AppShellDashboard(p){React.useEffect(()=>{globalThis.__organisationMount()},[]);return React.createElement('section',{'data-scope':p.assistantScope},React.createElement('input',{'aria-label':'Preserved user work',defaultValue:''}))}",
  '@/lib/appshell/adp-navigation':"export const dashboardPath=locale=>'/'+locale+'/dashboard'",
  '@/lib/product-analytics/adapter':"export const productAnalytics={begin:()=>null,finish:()=>{},once:()=>{}}"
 }
 const b=await build({entryPoints:[path.resolve('components/auth/account-landing.tsx')],bundle:true,write:false,platform:'node',format:'cjs',external:['react','react/jsx-runtime'],
  plugins:[{name:'external-services-only',setup(b:any){b.onResolve({filter:/.*/},(a:any)=>mocks[a.path]?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},(a:any)=>({contents:mocks[a.path],loader:'js'}))}}]})
 const m={exports:{} as any};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);AccountLanding=m.exports.AccountLanding
})
afterEach(async()=>{if(root)await React.act(async()=>root.unmount());root=null;dom.window.document.body.replaceChildren();organisationId=first;denial=0;outage=false;lifetime=25000;mounts=0;selection=false;requestedSlugs=[];dom.window.history.replaceState(null,'','/pl/dashboard')})
after(()=>{dom.window.close();for(const[k,d]of saved)d?Object.defineProperty(globals,k,d):delete globals[k];delete globals.__organisationAuth;delete globals.__organisationMount})
async function flush(){await React.act(async()=>{await new Promise(r=>setImmediate(r))})}
async function setup(selectionMode=false){
 selection=selectionMode
 globals.fetch=async(url:string,options?:any)=>{
  if(url==='/api/account')return Response.json({authenticated:true,userId:'canonical-user',expiresAt:new Date(Date.now()+60000).toISOString(),assistantAvatar:'male',salutation:null})
  assert.equal(url,'/api/account/organisation-access')
  if(outage)return Response.json({status:'UNAVAILABLE'},{status:503})
  if(denial)return Response.json({status:'UNAVAILABLE'},{status:denial})
  if(selection){
   const slug=JSON.parse(options?.body??'{}').slug??null;requestedSlugs.push(slug)
   if(slug===null)return Response.json({status:'SELECTION_REQUIRED',choices:[{slug:'alpha',name:'Alpha'},{slug:'beta',name:'Beta'}],expiresAt:new Date(Date.now()+lifetime).toISOString()})
   if(!['alpha','beta'].includes(slug))return Response.json({status:'UNAVAILABLE'},{status:403})
   organisationId=slug==='alpha'?first:second
   return Response.json({status:'READY',organisationId,slug,expiresAt:new Date(Date.now()+lifetime).toISOString()})
  }
  return Response.json({status:'READY',organisationId,expiresAt:new Date(Date.now()+lifetime).toISOString()})
 }
 container=dom.window.document.createElement('div');dom.window.document.body.append(container);root=createRoot(container)
 await React.act(async()=>root.render(React.createElement(AccountLanding,{locale:'pl',completionUrl:'https://identity.example.test/account/sg2/account-pl/login',presentation:'workspace',dashboard:true,organisationAccess:true})))
 await flush();return container.querySelector('input')
}
async function focus(){await React.act(async()=>dom.window.dispatchEvent(new dom.window.Event('focus')));await flush()}
test('same account and organisation renew without losing the mounted workspace',async()=>{
 const input=await setup();assert(input);input.value='My current work';const scope=container.querySelector('[data-scope]').dataset.scope
 await focus();assert.equal(container.querySelector('input'),input);assert.equal(input.value,'My current work');assert.equal(mounts,1)
 assert.equal(container.querySelector('[data-scope]').dataset.scope,scope)
})
test('canonical organisation change resets the prior workspace and assistant scope',async()=>{
 const input=await setup();input.value='Private previous organisation';organisationId=second;await focus()
 assert.notEqual(container.querySelector('input'),input);assert.equal(container.querySelector('input').value,'');assert.equal(mounts,2)
 assert(container.querySelector('[data-scope]').dataset.scope.includes(second));assert(!container.querySelector('[data-scope]').dataset.scope.includes(first))
})
for(const status of [401,403,409])test('confirmed access denial '+status+' clears the old workspace',async()=>{await setup();denial=status;await focus();assert.equal(container.querySelector('input'),null)})
test('temporary failure retains work only until the original bounded lease expires',async()=>{
 lifetime=300;const input=await setup();assert(input);outage=true;await focus();assert.equal(container.querySelector('input'),input)
 await React.act(async()=>{await new Promise(r=>setTimeout(r,400))});assert.equal(container.querySelector('input'),null)
})

test('multiple own organisations show a choice and mount no workspace before selecting one',async()=>{
 assert.equal(await setup(true),null)
 assert.equal(mounts,0);assert(container.textContent.includes('Wybierz organizację'))
 const button=[...container.querySelectorAll('button')].find((b:any)=>b.textContent==='Beta') as HTMLButtonElement
 assert(button)
 await React.act(async()=>button.click());await flush()
 assert(container.querySelector('input'));assert.equal(mounts,1)
 assert(container.querySelector('[data-scope]').dataset.scope.includes(second))
 assert.equal(new URL(dom.window.location.href).searchParams.get('organisation'),'beta')
 assert.deepEqual(requestedSlugs,[null,'beta'])
})
test('a direct organisation address is revalidated instead of opening an implicit different workspace',async()=>{
 dom.window.history.replaceState(null,'','/pl/dashboard?organisation=beta')
 assert(await setup(true));assert.equal(mounts,1)
 assert.deepEqual(requestedSlugs,['beta'])
 assert(container.querySelector('[data-scope]').dataset.scope.includes(second))
})
test('an unrecognised direct organisation address never mounts the old workspace',async()=>{
 dom.window.history.replaceState(null,'','/pl/dashboard?organisation=foreign')
 assert.equal(await setup(true),null);assert.equal(mounts,0)
 assert.deepEqual(requestedSlugs,['foreign'])
})
