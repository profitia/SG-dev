import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const require=createRequire(process.env.APPSHELL_TEST_RUNTIME||path.join(root,'package.json'))
const {buildSync}=require('esbuild'),{createElement}=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const build=buildSync({entryPoints:[path.join(root,'components/appshell/assistant-widget.tsx')],bundle:true,platform:'node',format:'cjs',write:false,external:['react','react-dom','react/jsx-runtime']})
const loaded={exports:{} as {AssistantWidget?:unknown}}
new Function('require','module','exports',build.outputFiles[0].text)(require,loaded,loaded.exports)
const render=(avatar:'male'|'female'|null)=>renderToStaticMarkup(createElement(loaded.exports.AssistantWidget,{locale:'pl',avatar,theme:'light',salutation:'Agnieszko'})) as string

test('saved persona has visible image in both expanded panel and collapsed ribbon without name inference',()=>{
 for(const [choice,asset]of [['male','assistant.png'],['female','assistant-female.png']] as const){
  const html=render(choice);assert.equal((html.match(new RegExp('src="/appshell/'+asset+'"','g'))||[]).length,2)
  assert(html.includes('Cześć, Agnieszko!'));assert(!html.includes('nie wybrano awatara'))
 }
})
test('missing saved choice retains a neutral canonical SpendGuru mark instead of an empty frame or invented sex',()=>{
 const html=render(null);assert(html.includes('SpendGuru — nie wybrano awatara'))
 assert(html.includes('viewBox="0 0 287 541"'));assert(!html.includes('src="/appshell/assistant'))
})
test('presentation controls are enabled while conversation controls cannot send or invent history',()=>{
 const html=render('female')
 assert.match(html,/<button[^>]*class="srm-chat-collapse"[^>]*aria-expanded="true"/)
 assert.match(html,/<button[^>]*aria-label="Otwórz asystenta w osobnym oknie"/)
 assert.doesNotMatch(html,/<button[^>]*disabled=""[^>]*aria-label="Otwórz asystenta/)
 assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="Historia rozmowy"/)
 assert.match(html,/<textarea[^>]*disabled=""/);assert.doesNotMatch(html,/<form|iframe|data-delivery|symulacja|Tomasz/)
 assert.doesNotMatch(build.outputFiles[0].text,/fetch\(|XMLHttpRequest|WebSocket|BroadcastChannel|localStorage|sessionStorage/)
})
