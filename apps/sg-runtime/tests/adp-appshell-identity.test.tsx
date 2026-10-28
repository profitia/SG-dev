import test, {before, after, afterEach} from 'node:test'
import assert from 'node:assert/strict'

let dom: any, root: any, container: HTMLElement, React: any, createRoot: any, AccountLanding: any
const saved = new Map<string, PropertyDescriptor | undefined>()
const g = globalThis as any, requests: string[] = [], replacements: string[] = []
const proof = (avatar: 'male' | 'female' = 'male') => ({authenticated:true,userId:'local-account',expiresAt:new Date(Date.now()+3600000).toISOString(),assistantAvatar:avatar,salutation:{firstName:'Jan',vocative:'Janie',dictionaryVersion:'test'}})
const auth = (sessionId = 'session-a') => ({isLoaded:true,isSignedIn:true,userId:'local-subject',sessionId,getToken:async()=> 'test-only-credential'})
const redirect = (url: string) => replacements.push(url)
before(async () => {
  const harness = await import('./adp-appshell-preview.mjs'), {JSDOM} = harness.runtimeRequire('jsdom')
  dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'https://host.invalid/pl/dashboard',pretendToBeVisual:true})
  for (const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,
    HTMLDialogElement:dom.window.HTMLDialogElement,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),
    localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true})) {
    saved.set(key,Object.getOwnPropertyDescriptor(g,key));Object.defineProperty(g,key,{value,writable:true,configurable:true})
  }
  saved.set('fetch',Object.getOwnPropertyDescriptor(g,'fetch'))
  React = harness.runtimeRequire('react');({createRoot}=harness.runtimeRequire('react-dom/client'))
  ;({AccountLanding}=await harness.loadAdpModule('components/auth/account-landing.tsx'))
})
afterEach(async () => {if(root)await React.act(async()=>root.unmount());root=null;dom.window.document.body.replaceChildren();requests.length=0;replacements.length=0;dom.window.localStorage.clear()})
after(() => {dom.window.close();for(const [key,descriptor] of saved)descriptor?Object.defineProperty(g,key,descriptor):delete g[key];delete g.__adpTestAuth;delete g.__adpTestClerk;delete g.__adpTestNavigation})
function setup(fetcher = async () => Response.json(proof())) {
  g.__adpTestAuth=auth();g.__adpTestClerk={signOut:async()=>{}}
  g.__adpTestNavigation={pathname:'/pl/dashboard',search:'',router:{replace:redirect,push:(url:string)=>replacements.push(url)}}
  g.fetch=async (url:string,...args:unknown[])=>{requests.push(String(url));return fetcher(url,...args)}
  container=dom.window.document.createElement('div');dom.window.document.body.append(container);root=createRoot(container)
}
async function render(props: Record<string,unknown>={}) {await React.act(async()=>root.render(React.createElement(AccountLanding,{locale:'pl',completionUrl:'/pl/account',presentation:'workspace',dashboard:true,...props})))}
async function flush(){await React.act(async()=>{await new Promise(resolve=>setImmediate(resolve))})}

test('dashboard mounts only after current backend account proof; anonymous access never mounts ADP',async()=>{
  let resolve!: (response:Response)=>void
  setup(()=>new Promise<Response>(r=>{resolve=r}))
  g.__adpTestNavigation.pathname='/pl/dashboard/adp';await render()
  assert(!container.querySelector('.appshell'));assert(!container.querySelector('.sg-adp-ui'))
  await React.act(async()=>resolve(Response.json(proof())));await flush()
  assert(container.querySelector('.sg-adp-ui'));assert.deepEqual(requests,['/api/account'])
  g.__adpTestAuth={...auth(),isSignedIn:false};await render()
  assert(!container.querySelector('.appshell'));assert(!container.querySelector('.sg-adp-ui'))
})
test('legacy account completion redirects only after proof to the fixed requested locale dashboard',async()=>{
  setup();await render({dashboard:false})
  assert.deepEqual(replacements,['/pl/dashboard']);assert(!container.querySelector('.appshell'))
  await render({locale:'en',dashboard:false});assert.equal(replacements.at(-1),'/en/dashboard')
})
test('rejected or expired account proof fails closed without canonical redirect or module mount',async()=>{
  setup(async()=>Response.json({authenticated:false},{status:403}));await render({dashboard:false})
  assert.deepEqual(replacements,[]);assert(!container.querySelector('.appshell'));assert(container.querySelector('[role=alert]'))
})
test('session rotation removes all local module state and refresh failure removes shell and assistant',async()=>{
  setup();g.__adpTestNavigation.pathname='/pl/dashboard/adp';g.__adpTestNavigation.search='view=data'
  await render();let input=container.querySelector('input[id$="-field-name"]') as HTMLInputElement
  assert(input)
  await React.act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,'Local supplier');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))})
  assert.equal(input.value,'Local supplier')
  g.__adpTestAuth=auth('session-b');await render()
  input=container.querySelector('input[id$="-field-name"]') as HTMLInputElement
  assert.equal(input.value,'');assert(container.querySelector('.srm-chat-slot'))
  g.fetch=async()=>Response.json({authenticated:false},{status:403})
  await React.act(async()=>dom.window.dispatchEvent(new dom.window.Event('focus')));await flush()
  assert(!container.querySelector('.sg-adp-ui'));assert(!container.querySelector('.srm-chat-slot'));assert(!container.querySelector('.appshell'))
})
test('late old-session responses cannot restore a revoked identity or previous avatar',async()=>{
  let resolveOld!: (response:Response)=>void, call=0
  setup(()=>++call===1?new Promise<Response>(r=>{resolveOld=r}):Promise.resolve(Response.json(proof('female'))))
  await render();g.__adpTestAuth=auth('session-new');await render()
  assert(container.querySelector('img[src="/appshell/assistant-female.png"]'))
  await React.act(async()=>resolveOld(Response.json(proof('male'))));await flush()
  assert(container.querySelector('img[src="/appshell/assistant-female.png"]'));assert(!container.querySelector('img[src="/appshell/assistant.png"]'))
})
test('actual account-proof expiry removes the active module before a later refresh can run',async()=>{
  setup(async()=>Response.json({...proof(),expiresAt:new Date(Date.now()+150).toISOString()}))
  g.__adpTestNavigation.pathname='/pl/dashboard/adp';await render();assert(container.querySelector('.sg-adp-ui'))
  await React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,180))})
  assert(!container.querySelector('.appshell'));assert(!container.querySelector('.sg-adp-ui'));assert(container.querySelector('[role=alert]'))
})
test('sign-out failure does not restore the previous local workspace or invent a successful logout',async()=>{
  setup();g.__adpTestNavigation.pathname='/pl/dashboard/adp';g.__adpTestClerk.signOut=async()=>{throw Error('test failure')}
  await render();assert(container.querySelector('.sg-adp-ui'))
  await React.act(async()=>Array.from(container.querySelectorAll('button')).find(button=>button.textContent==='Wyloguj')!.click());await flush()
  assert(!container.querySelector('.appshell'));assert(container.querySelector('[role=alert]')?.textContent?.includes('Wylogowanie nie zostało potwierdzone'))
})
test('ordinary AppShell return retains local model and the same single assistant state',async()=>{
  setup();g.__adpTestNavigation.pathname='/pl/dashboard/adp';g.__adpTestNavigation.search='view=data';await render()
  let input=container.querySelector('input[id$="-field-name"]') as HTMLInputElement
  await React.act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,'Local supplier');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))})
  const assistant=container.querySelector('.srm-chat-slot')
  await React.act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="Schowaj asystenta"]')!.click())
  g.__adpTestNavigation.pathname='/pl/dashboard';g.__adpTestNavigation.search='';await render()
  assert.equal(container.querySelector('.srm-chat-slot'),assistant);assert(assistant!.classList.contains('is-collapsed'))
  assert.equal(container.querySelectorAll('.srm-chat-slot').length,1);assert(container.querySelector('.as-module-workspace[hidden]'))
  g.__adpTestNavigation.pathname='/pl/dashboard/adp';g.__adpTestNavigation.search='view=data';await render()
  input=container.querySelector('input[id$="-field-name"]') as HTMLInputElement
  assert.equal(input.value,'Local supplier');assert.equal(container.querySelector('.srm-chat-slot'),assistant)
  assert.equal(container.querySelectorAll('.as-launch:disabled').length,1)
})
test('the existing detached assistant keeps its one owner across module return and closes on identity invalidation',async()=>{
  setup();g.__adpTestNavigation.pathname='/pl/dashboard/adp'
  const childDocument=dom.window.document.implementation.createHTMLDocument('Assistant'), originalOpen=dom.window.open
  const child={document:childDocument,closed:false,opener:null,focus:()=>{},close:()=>{child.closed=true}}
  dom.window.open=()=>child
  try {
    await render()
    await React.act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="Otwórz asystenta w osobnym oknie"]')!.click())
    assert(container.querySelector('[aria-label="Przyłącz asystenta do biurka"]'));assert(childDocument.querySelector('.srm-chat-window'))
    g.__adpTestNavigation.pathname='/pl/dashboard';await render()
    assert.equal(child.closed,false);assert(container.querySelector('[aria-label="Przyłącz asystenta do biurka"]'));assert(childDocument.querySelector('.srm-chat-window'))
    g.__adpTestAuth={...auth(),isSignedIn:false};await render();assert.equal(child.closed,true)
  } finally {dom.window.open=originalOpen}
})
