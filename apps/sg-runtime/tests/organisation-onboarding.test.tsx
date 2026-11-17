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
let organisationId=first,denial=0,outage=false,lifetime=25000,mounts=0
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
afterEach(async()=>{if(root)await React.act(async()=>root.unmount());root=null;dom.window.document.body.replaceChildren();organisationId=first;denial=0;outage=false;lifetime=25000;mounts=0})
after(()=>{dom.window.close();for(const[k,d]of saved)d?Object.defineProperty(globals,k,d):delete globals[k];delete globals.__organisationAuth;delete globals.__organisationMount})
async function flush(){await React.act(async()=>{await new Promise(r=>setImmediate(r))})}
async function setup(){
 globals.fetch=async(url:string)=>{
  if(url==='/api/account')return Response.json({authenticated:true,userId:'canonical-user',expiresAt:new Date(Date.now()+60000).toISOString(),assistantAvatar:'male',salutation:null})
  assert.equal(url,'/api/account/organisation-access')
  if(outage)return Response.json({status:'UNAVAILABLE'},{status:503})
  if(denial)return Response.json({status:'UNAVAILABLE'},{status:denial})
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
