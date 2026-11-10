import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'
import {AssistantMessageMarkdown} from '../components/appshell/assistant-message-markdown'
import {AssistantConversationView} from '../components/appshell/assistant-conversation-view'
import {AssistantConversationSession, type AssistantConversationSnapshot} from '../components/appshell/assistant-conversation-session'

const table = '| Grupa | Wpływ finansowy | Ryzyko dostaw | Typowe podejście |\n| --- | --- | --- | --- |\n| **Strategiczne** | wysoki | wysokie | partnerstwo długoterminowe |\n| Dźwigniowe | wysoki | niskie | negocjacje |'
const documentFor = (content: string, en = false) => new JSDOM(renderToStaticMarkup(<AssistantMessageMarkdown content={content} en={en}/>)).window.document

test('the reported response renders a semantic GFM table and ordinary Markdown', () => {
 const doc = documentFor('## Macierz Kraljica\n\n1. **Wpływ na wynik**\n2. *Ryzyka dostaw*\n\n' + table + '\n\n> Opis\n\n`kod`\n\n```sql\nSELECT 1;\n```')
 assert.equal(doc.querySelector('h2')?.textContent, 'Macierz Kraljica')
 assert.equal(doc.querySelectorAll('ol > li').length, 2)
 assert.equal(doc.querySelector('ol strong')?.textContent, 'Wpływ na wynik')
 assert.equal(doc.querySelector('ol em')?.textContent, 'Ryzyka dostaw')
 assert.equal(doc.querySelectorAll('thead th').length, 4)
 assert.equal(doc.querySelectorAll('tbody tr').length, 2)
 assert.equal(doc.querySelector('td strong')?.textContent, 'Strategiczne')
 assert.equal(doc.querySelector('[role="region"]')?.getAttribute('tabindex'), '0')
 assert.match(doc.querySelector('[role="region"]')?.getAttribute('aria-label') ?? '', /Tabela/)
 assert.equal(doc.querySelector('blockquote')?.textContent?.trim(), 'Opis')
 assert.equal(doc.querySelector('pre code')?.textContent, 'SELECT 1;\n')
 assert.doesNotMatch(doc.querySelector('table')?.textContent ?? '', /\*\*|\| ---/)
 assert.match(documentFor(table, true).querySelector('[role="region"]')?.getAttribute('aria-label') ?? '', /Table/)
})

test('model text cannot execute HTML, open unsafe links or fetch external images', () => {
 const doc = documentFor('<script>alert(1)</script>\n\n<img src="https://example.com/tracker" onerror="alert(1)">\n\n[unsafe](javascript:alert%281%29)\n\n[safe](https://example.com/report)\n\n![Opis wykresu](https://example.com/private-tracker)\n\n```html\n<img onerror="alert(1)">\n```')
 assert.equal(doc.querySelectorAll('script, img, iframe, [onerror]').length, 0)
 const links = [...doc.querySelectorAll('a')]
 assert.equal(links.length, 1)
 assert.equal(links[0].href, 'https://example.com/report')
 assert.equal(links[0].target, '_blank')
 assert.match(links[0].rel, /noopener/)
 assert.match(links[0].rel, /noreferrer/)
 assert.match(doc.body.textContent ?? '', /Opis wykresu/)
 assert.equal(doc.querySelector('pre code')?.textContent, '<img onerror="alert(1)">\n')
})

const session = () => new AssistantConversationSession({list: async () => [], load: async id => ({id, messages: []}), send: async function* () {throw Error('Rendering must not call a provider')}})
const snapshot = (content: string, status: 'complete' | 'streaming' | 'interrupted' = 'complete'): AssistantConversationSnapshot => ({
 active: true, scopeRevision: 1, conversationId: 'render-test', draft: '', history: [], loadingHistory: false, busy: status === 'streaming', error: null,
 messages: [
  {id: 'question', role: 'user', content: '**Dosłowne pytanie** <img src=x>', status: 'complete', sources: []},
  {id: 'answer', role: 'assistant', content, status, sources: [{id: 'source', label: 'Źródło testowe', asOf: null, status: 'PARTIAL'}]},
 ],
})
const view = (state: AssistantConversationSnapshot) => <AssistantConversationView session={session()} state={state} en={false} historyOpen={false} onCloseHistory={() => {}} inputId="render-test-input"/>

test('saved and interrupted assistant answers render Markdown while user text, source status and composer remain intact', () => {
 const doc = new JSDOM(renderToStaticMarkup(view(snapshot(table, 'interrupted')))).window.document
 assert.equal(doc.querySelectorAll('.srm-chat-turn-assistant table').length, 1)
 assert.equal(doc.querySelectorAll('.srm-chat-turn-user strong, .srm-chat-turn-user img').length, 0)
 assert.equal(doc.querySelector('.srm-chat-turn-user')?.textContent, '**Dosłowne pytanie** <img src=x>')
 assert.match(doc.querySelector('.srm-chat-sources')?.textContent ?? '', /Źródło testowe · Dane częściowe/)
 assert.match(doc.querySelector('small')?.textContent ?? '', /Odpowiedź zatrzymana/)
 assert(doc.querySelector('form textarea'))
 const pending = new JSDOM(renderToStaticMarkup(view(snapshot('', 'streaming')))).window.document
 assert.match(pending.querySelector('.srm-chat-turn-assistant')?.textContent ?? '', /Przygotowuję odpowiedź/)
})

test('incomplete streaming Markdown recovers into a table without remounting its scroll region', async () => {
 const dom = new JSDOM('<div id="root"></div>'), globals = globalThis as any
 const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
 const prior = keys.map(key => Object.getOwnPropertyDescriptor(globals, key))
 Object.assign(globals, {window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true})
 const root = createRoot(dom.window.document.getElementById('root')!)
 try {
  await React.act(async () => root.render(view(snapshot('**Wpływ', 'streaming'))))
  await React.act(async () => root.render(view(snapshot(table, 'streaming'))))
  const region = dom.window.document.querySelector('.srm-chat-table-scroll') as HTMLElement
  assert(region); region.scrollLeft = 45
  await React.act(async () => root.render(view(snapshot(table + '\n\nGotowe.'))))
  assert.equal(dom.window.document.querySelector('.srm-chat-table-scroll'), region)
  assert.equal(region.scrollLeft, 45)
  assert.equal(dom.window.document.querySelectorAll('tbody tr').length, 2)
  assert.match(dom.window.document.body.textContent ?? '', /Gotowe/)
 } finally {
  await React.act(async () => root.unmount()); dom.window.close()
  keys.forEach((key, i) => prior[i] ? Object.defineProperty(globals, key, prior[i]!) : delete globals[key])
 }
})

test('history shows the question and a full timestamp with seconds in canonical text roles',()=>{
 const state={...snapshot(''),history:[{id:'saved',title:'Jak zmieniły się ceny stali?',updatedAt:'2026-11-10T12:34:56.789Z'}]}
 const doc=new JSDOM(renderToStaticMarkup(<AssistantConversationView session={session()} state={state} en={false} historyOpen onCloseHistory={()=>{}} inputId="history-preview"/>)).window.document
 assert.equal(doc.querySelector('.srm-chat-history-title')?.textContent,'Jak zmieniły się ceny stali?')
 const time=doc.querySelector('time')!
 assert.equal(time.dateTime,state.history[0].updatedAt);assert.match(time.textContent??'',/\d{2}:\d{2}:56/)
 assert.equal(doc.querySelector('.srm-chat-history-title')?.getAttribute('data-canon-font'),'SRM-T14')
 assert.equal(time.getAttribute('data-canon-font'),'SRM-T02')
 assert.equal(doc.querySelector('.srm-chat-history-delete')?.getAttribute('aria-label'),'Usuń Jak zmieniły się ceny stali?')
})
