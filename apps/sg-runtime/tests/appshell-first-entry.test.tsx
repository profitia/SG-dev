import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const require=createRequire(process.env.APPSHELL_TEST_RUNTIME || path.join(root,'package.json'))
const {buildSync}=require('esbuild'),{createElement}=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const built=buildSync({entryPoints:[path.join(root,'components/appshell/platform-appshell.tsx')],bundle:true,platform:'node',format:'cjs',write:false,loader:{'.css':'empty'},external:['react','react-dom','react/jsx-runtime']})
const loaded={exports:{} as {PlatformAppShell?:unknown}}
new Function('require','module','exports',built.outputFiles[0].text)(require,loaded,loaded.exports)
const view=(props:Record<string,unknown>={})=>renderToStaticMarkup(createElement(loaded.exports.PlatformAppShell,{locale:'pl',onLogout:()=>{},...props})) as string

test('three application entries are presentation only and no chat submission is possible',()=>{
 const html=view()
 for(const name of ['Benchmark Finder','X-Ray Supplier Intelligence','ADP — Arkusz Danych Podstawowych'])assert(html.includes(name))
 assert.equal((html.match(/class="as-app-card"/g)||[]).length,3)
 assert.equal((html.match(/class="as-primary-button as-launch"[^>]*disabled=""/g)||[]).length,3)
 assert.match(html,/<textarea[^>]*disabled=""/)
 assert.doesNotMatch(html,/<form|href="\/(?:pl|en)\/(?:benchmark|supplier|adp)|iframe|symulacja|Tomasz|inspektor|data-delivery|Control \+ I/i)
})
test('all greeting locations use the supplied persisted vocative, not an inflector or fixture',()=>{
 const html=view({salutation:'Agnieszko'})
 assert(html.includes('Dzień dobry, Agnieszko.'));assert.equal((html.match(/Cześć, Agnieszko!/g)||[]).length,2)
 assert.doesNotMatch(view(),/Tomasz|Tomaszu|undefined|null/)
 assert.doesNotMatch(view({salutation:'<script>alert(1)</script>'}),/<script>/)
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
