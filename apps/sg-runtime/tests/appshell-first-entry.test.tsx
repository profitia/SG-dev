import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {animateCardPositions,cancelCardAnimations,captureCardPositions,type CardAnimations} from '../components/appshell/appshell-card-motion'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const require=createRequire(process.env.APPSHELL_TEST_RUNTIME || path.join(root,'package.json'))
const {buildSync}=require('esbuild'),{createElement}=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const built=buildSync({entryPoints:[path.join(root,'components/appshell/platform-appshell.tsx')],bundle:true,platform:'node',format:'cjs',write:false,loader:{'.css':'empty'},external:['react','react-dom','react/jsx-runtime']})
const loaded={exports:{} as {PlatformAppShell?:unknown}}
new Function('require','module','exports',built.outputFiles[0].text)(require,loaded,loaded.exports)
const view=(props:Record<string,unknown>={})=>renderToStaticMarkup(createElement(loaded.exports.PlatformAppShell,{locale:'pl',onLogout:()=>{},...props})) as string

test('four application entries are presentation only and no chat submission is possible',()=>{
 const html=view()
 for(const name of ['Benchmark Finder','X-Ray Supplier Intelligence','ADP — Arkusz Danych Podstawowych','Procurement Insight'])assert(html.includes(name))
 assert.equal((html.match(/class="as-app-card"/g)||[]).length,4)
 assert.equal((html.match(/class="as-primary-button as-launch"[^>]*disabled=""/g)||[]).length,4)
 assert.match(html,/<textarea[^>]*disabled=""/)
 assert.doesNotMatch(html,/<form|href="\/(?:pl|en)\/(?:benchmark|supplier|adp)|iframe|symulacja|Tomasz|inspektor|data-delivery|Control \+ I/i)
})
test('all greeting locations use the supplied persisted vocative, not an inflector or fixture',()=>{
 const html=view({salutation:'Agnieszko'})
 assert(html.includes('Dzień dobry, Agnieszko.'));assert.equal((html.match(/Cześć, Agnieszko!/g)||[]).length,2)
 assert.doesNotMatch(view(),/Tomasz|Tomaszu|undefined|null/)
 assert.doesNotMatch(view({salutation:'<script>alert(1)</script>'}),/<script>/)
})
test('the adopted host enables only the ADP entry and keeps other business modules disconnected',()=>{
 const html=view({onLaunchAdp:()=>{}})
 assert.equal((html.match(/class="as-primary-button as-launch"[^>]*disabled=""/g)||[]).length,3)
 assert.match(html,/<button class="as-primary-button as-launch" type="button" aria-label="Uruchom ADP/)
 assert.doesNotMatch(html,/iframe|\/api\/|href="https?:/)
})

test('Procurement Insight uses the approved product copy and closed launch state in both locales',()=>{
 for(const [locale,copy] of [['pl',['BUDUJ WŁASNE RAPORTY','Łącz dane zakupowe w przejrzyste raporty. Odkrywaj trendy i wspieraj decyzje zakupowe.','Własne raporty','Analiza zakupów','Wkrótce']],['en',['BUILD YOUR OWN REPORTS','Turn procurement data into clear reports. Discover trends and support purchasing decisions.','Custom reports','Procurement analysis','Coming soon']]] as const){
  const html=view({locale,onLaunchAdp(){},onLaunchXray(){},onLaunchBenchmark(){}})
  for(const text of copy)assert(html.includes(text))
  assert.equal((html.match(/class="as-primary-button as-launch"[^>]*disabled=""/g)||[]).length,1)
  assert.match(html,/disabled="" aria-label="Procurement Insight — /)
  assert.equal((html.match(/data-canon-id="SRM-C106"/g)||[]).length,4)
  assert.match(html,/data-canon-motion="SRM-B68 MOT-01"/)
 }
})

test('card reflow retains its painted origin on interruption, reverses cascade and cancels for reduced motion',()=>{
 const {JSDOM}=require('jsdom'),dom=new JSDOM('<div id="stack">'+Array(4).fill('<article class="as-app-card"></article>').join('')+'</div>')
 const stack=dom.window.document.getElementById('stack') as HTMLElement,cards=Array.from(stack.children) as HTMLElement[],animations:CardAnimations=new Map()
 let collapsed=false,painted=false,cancels=0
 const calls:{index:number;frames:Keyframe[];options:KeyframeAnimationOptions}[]=[]
 cards.forEach((card,index)=>{
  card.getBoundingClientRect=()=>({left:painted&&index>=2?150:collapsed&&index>=2?500:0,top:painted&&index>=2?240:collapsed&&index>=2?(index-2)*170:index*170,width:480,height:154}) as DOMRect
  card.animate=((frames:Keyframe[],options:KeyframeAnimationOptions)=>{calls.push({index,frames,options});return {cancel(){painted=false;cancels++},finished:new Promise(()=>{})} as unknown as Animation}) as typeof card.animate
 })
 try{
  const initial=captureCardPositions(stack);collapsed=true;animateCardPositions(stack,initial,true,animations,false)
  assert.deepEqual(calls.map(x=>[x.index,x.options.delay]),[[2,110],[3,260]])
  assert.deepEqual(calls[0].options,{duration:680,delay:110,fill:'backwards'})
  assert.equal(calls[0].frames[0].transform,'translate(-500px,340px)')
  assert.equal(calls[0].frames[1].offset,.28);assert.equal(calls[0].frames[1].transform,'translate(-449px,309.40000000000003px)')
  assert.equal(calls[1].frames[1].transform,'translate(-447px,309.40000000000003px)')
  assert(calls.every(x=>x.frames.every(f=>!Object.keys(f).some(k=>/width|height|scale/.test(k)))))
  // A second click captures the actual intermediate visual position before cancellation.
  painted=true;const interrupted=captureCardPositions(stack);collapsed=false;calls.length=0
  animateCardPositions(stack,interrupted,false,animations,false)
  assert.equal(cancels,2);assert.deepEqual(calls.map(x=>[x.index,x.options.delay]),[[2,260],[3,110]])
  assert.equal(calls[0].frames[0].transform,'translate(150px,-100px)')
  assert.equal(calls[1].frames[0].transform,'translate(150px,-270px)')
  calls.length=0;animateCardPositions(stack,captureCardPositions(stack),true,animations,true)
  assert.equal(cancels,4);assert.equal(animations.size,0);assert.equal(calls.length,0)
  cancelCardAnimations(animations)
 }finally{dom.window.close()}
})

test('desk toggles preserve the single assistant, draft, focus, theme and existing module launches',async()=>{
 const React=require('react'),{JSDOM}=require('jsdom'),{createRoot}=require('react-dom/client')
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dev-sg2.spendguru.app/pl/dashboard'}),g=globalThis as any
 const previous=Object.fromEntries(['window','document','HTMLElement','localStorage','requestAnimationFrame','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,g[k]]))
 Object.assign(g,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,requestAnimationFrame:(cb:()=>void)=>setTimeout(cb,0),IS_REACT_ACT_ENVIRONMENT:true})
 let workspaceWidth=1200
 dom.window.HTMLElement.prototype.getBoundingClientRect=function(){return {left:0,top:0,width:this.classList.contains('as-workspace')?workspaceWidth:0,height:0} as DOMRect}
 const root=createRoot(document.getElementById('root')),launched:string[]=[]
 const click=async(selector:string)=>React.act(async()=>{(document.querySelector(selector) as HTMLButtonElement).click();await new Promise(r=>setTimeout(r,5))})
 try{
  await React.act(async()=>root.render(createElement(loaded.exports.PlatformAppShell,{locale:'pl',onLogout(){},onLaunchBenchmark(){launched.push('benchmark')},onLaunchXray(){launched.push('xray')},onLaunchAdp(){launched.push('adp')}})))
  const original=document.querySelector('.srm-chat-slot'),panel=document.querySelector('.srm-chat-motion'),input=document.querySelector('textarea') as HTMLTextAreaElement
  const workspace=document.querySelector('.as-workspace') as HTMLElement
  assert.equal(workspace.style.getPropertyValue('--as-workspace-width'),'1200px')
  input.value='Zachowany szkic'
  workspaceWidth=1215 // Removing a document scrollbar must not widen the cards.
  await click('[aria-label="Schowaj asystenta"]');assert(document.querySelector('.as-workspace')!.classList.contains('is-chat-collapsed'));assert.equal(document.activeElement,document.querySelector('.srm-chat-ribbon'))
  assert.equal(workspace.style.getPropertyValue('--as-workspace-width'),'1200px')
  Object.defineProperty(dom.window,'innerWidth',{value:900,configurable:true});workspaceWidth=840
  dom.window.dispatchEvent(new dom.window.Event('resize'));assert.equal(workspace.style.getPropertyValue('--as-workspace-width'),'840px')
  await click('[title="Ciemny motyw"]');assert.equal(document.querySelector('.appshell')!.getAttribute('data-theme'),'dark')
  await click('[aria-label="Pokaż asystenta"]');assert(!document.querySelector('.as-workspace')!.classList.contains('is-chat-collapsed'));assert.equal(document.activeElement,document.querySelector('.srm-chat-collapse'))
  for(let i=0;i<3;i++){await click('[aria-label="Schowaj asystenta"]');await click('[aria-label="Pokaż asystenta"]')}
  assert.equal(document.querySelector('.srm-chat-slot'),original);assert.equal(document.querySelector('.srm-chat-motion'),panel);assert.equal(document.querySelector('textarea'),input);assert.equal(input.value,'Zachowany szkic')
  assert.equal(document.querySelectorAll('.as-assistant-portal').length,1);assert.equal(document.querySelectorAll('.srm-chat-slot').length,1)
  for(const name of ['Benchmark Finder','X-Ray Supplier Intelligence','ADP — Arkusz Danych Podstawowych'])await click(`[aria-label="Uruchom ${name}"]`)
  await click('[aria-label="Procurement Insight — Wkrótce"]');assert.deepEqual(launched,['benchmark','xray','adp'])
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(g,previous)}
})
test('avatar comes only from the saved explicit choice, independently of the salutation',()=>{
 const female=view({salutation:'Marku',assistantAvatar:'female'})
 assert(female.includes('/appshell/assistant-female.png'));assert(!female.includes('src="/appshell/assistant.png"'))
 const male=view({salutation:'Agnieszko',assistantAvatar:'male'})
 assert(male.includes('src="/appshell/assistant.png"'));assert(!male.includes('/appshell/assistant-female.png'))
 assert.doesNotMatch(view({assistantAvatar:null}),/src="\/appshell\/assistant/)
})
test('organisation branding is host-supplied presentation and never an organisation identifier',()=>{
 assert(!view().includes('aria-label="PORR"'));assert(view({organisationBranding:'porr'}).includes('aria-label="PORR"'))
 assert.doesNotMatch(built.outputFiles[0].text,/organisationId|organizationId|fetch\(|XMLHttpRequest|WebSocket|launchTimer|preparedReply|DeliveryRuntime|DeliveryVisibility|CanonHistoryDialog/)
})
