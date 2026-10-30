import test,{before,after,afterEach} from 'node:test'
import assert from 'node:assert/strict'
// Actual consumer composition; synthetic SDK and peer, no external calls.
let dom:any,root:any,React:any,AccountLanding:any,container:HTMLElement,makeRoot:any
const g=globalThis as any,saved=new Map<string,PropertyDescriptor|undefined>()
let token:string|null='synthetic.credential.signature',fetcher:()=>Promise<Response>
const getToken=async()=>token
const proof=()=>({authenticated:true,userId:'synthetic-account',expiresAt:new Date(Date.now()+60000).toISOString(),assistantAvatar:null,salutation:null})
const auth=()=>({isLoaded:true,isSignedIn:true,userId:'synthetic-user',sessionId:'synthetic-session',orgId:'synthetic-org',getToken})
before(async()=>{
 const h=await import('./adp-appshell-preview.mjs'),{JSDOM}=h.runtimeRequire('jsdom')
 dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://host.invalid/pl/dashboard/benchmark-finder',pretendToBeVisual:true})
 dom.window.matchMedia=()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}})
 for(const [k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,MutationObserver:dom.window.MutationObserver,HTMLDialogElement:dom.window.HTMLDialogElement,localStorage:dom.window.localStorage,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true})){
  saved.set(k,Object.getOwnPropertyDescriptor(g,k));Object.defineProperty(g,k,{value:v,writable:true,configurable:true})
 }
 saved.set('fetch',Object.getOwnPropertyDescriptor(g,'fetch'));React=h.runtimeRequire('react');makeRoot=h.runtimeRequire('react-dom/client').createRoot
 ;({AcceptanceAccount:AccountLanding}=await h.loadAdpModule(process.env.STABILIZATION_BASELINE_SOURCE||'tests/pci-live-acceptance-preview.tsx'))
})
afterEach(async()=>{if(root)await React.act(async()=>root.unmount());root=null;dom.window.document.body.replaceChildren();token='synthetic.credential.signature'})
after(()=>{dom.window.close();for(const[k,d]of saved)d?Object.defineProperty(g,k,d):delete g[k];for(const k of ['__adpTestAuth','__adpTestClerk','__adpTestNavigation'])delete g[k]})
async function render(){await React.act(async()=>root.render(React.createElement(AccountLanding,{locale:'pl',completionUrl:'/pl/account',presentation:'workspace',dashboard:true})))}
async function flush(){await React.act(async()=>{await new Promise(r=>setImmediate(r))})}
async function focus(){await React.act(async()=>dom.window.dispatchEvent(new dom.window.Event('focus')));await flush()}
async function setup(){
 g.__adpTestAuth=auth();g.__adpTestClerk={signOut:async()=>{}};g.__adpTestNavigation={pathname:'/pl/dashboard/benchmark-finder',search:'',router:{push:()=>{},replace:()=>{}}}
 fetcher=async()=>Response.json(proof());g.fetch=async(url:string)=>String(url)==='/api/account'?fetcher():Response.json({items:[]})
 container=dom.window.document.createElement('div');dom.window.document.body.append(container);root=makeRoot(container);await render();await flush()
 const input=container.querySelector<HTMLInputElement>('input[placeholder^="Szukaj benchmarku"]')!;assert(input)
 await React.act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,'Zachowany Finder');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))});return input
}
for(const failure of ['token','network','503'] as const)test(`same-scope ${failure} refresh preserves mounted Finder until proof expiry`,async()=>{
 const input=await setup(),shell=container.querySelector('.appshell')
 if(failure==='token')token=null
 if(failure==='network')fetcher=async()=>{throw Error('synthetic network interruption')}
 if(failure==='503')fetcher=async()=>Response.json({authenticated:false},{status:503})
 await focus();assert.equal(container.querySelector('.appshell'),shell);assert.equal(container.querySelector('input[placeholder^="Szukaj benchmarku"]'),input);assert.equal(input.value,'Zachowany Finder');assert.match(container.textContent!,/Odświeżenie sesji jest chwilowo niedostępne/)
 token='synthetic.refreshed.signature';fetcher=async()=>Response.json(proof());await focus();assert.equal(container.querySelector('input[placeholder^="Szukaj benchmarku"]'),input);assert.equal(input.value,'Zachowany Finder');assert.doesNotMatch(container.textContent!,/Odświeżenie sesji jest chwilowo niedostępne/)
})
for(const status of [401,403])test(`confirmed ${status} removes the workspace`,async()=>{
 await setup();fetcher=async()=>Response.json({authenticated:false},{status});await focus();assert.equal(container.querySelector('.appshell'),null);assert.equal(container.querySelector('input[placeholder^="Szukaj benchmarku"]'),null)
})
for(const field of ['userId','sessionId','orgId'] as const)test(`${field} change invalidates old scope before stale response`,async()=>{
 const input=await setup();let resolve!:(r:Response)=>void;fetcher=()=>new Promise<Response>(r=>resolve=r);await focus()
 g.__adpTestAuth={...auth(),[field]:'synthetic-different-scope'};fetcher=async()=>Response.json({...proof(),userId:'new-account'});await render();await flush();assert.notEqual(container.querySelector('input[placeholder^="Szukaj benchmarku"]'),input)
 await React.act(async()=>resolve(Response.json(proof())));await flush();assert.equal(container.querySelector<HTMLInputElement>('input[placeholder^="Szukaj benchmarku"]')?.value,'')
})
test('valid refresh and ordinary rerenders preserve workspace instance',async()=>{const input=await setup();await focus();await render();await flush();assert.equal(container.querySelector('input[placeholder^="Szukaj benchmarku"]'),input);assert.equal(input.value,'Zachowany Finder')})
