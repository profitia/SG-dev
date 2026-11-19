// SYNTHETIC_ONLY: compatibility of the existing reader, no published artifact changes.
import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeLegacyReportTables as normalize} from '../lib/procurement-insights/report-markdown'
const table='| Indicator | Reading |\n| --- | ---: |\n| SYNTHETIC_A | 12 |\n| SYNTHETIC_B | 8 |'
const legacy=table.replaceAll('\n','\n\n')
test('legacy producer rows become one table while surrounding narrative remains unchanged',()=>{
 const before='## SYNTHETIC_SECTION\n\nA paragraph.\n\n',after='\n\nSource: example.test.\n\nAnother paragraph.'
 assert.equal(normalize(before+legacy+after),before+table+after)
 assert.equal(legacy,table.replaceAll('\n','\n\n'),'input artifact stays unchanged')
})
test('separate tables retain separate headers and normal tables remain byte-identical',()=>{
 assert.equal(normalize(table),table)
 const second=table.replaceAll('SYNTHETIC','OTHER')
 assert.equal(normalize(legacy+'\n\n'+second.replaceAll('\n','\n\n')),table+'\n\n'+second)
})
test('pipe prose, incomplete separators and mismatched row widths retain their paragraphs',()=>{
 for(const text of ['text | prose\n\nmore | prose', '| A | B |\n\n| - | - |\n\n| 1 | 2 |','| A | B |\n\n| --- | --- |\n\n| 1 | 2 | 3 |','| A | B |\n\n| --- | --- |','before\n| A | B |\n\n| --- | --- |\n\n| 1 | 2 |'])assert.equal(normalize(text),text)
})
test('table-looking code in backtick and tilde fences remains unchanged',()=>{
 for(const marker of ['```','~~~~']){const text=marker+'text\n\n'+legacy+'\n\n'+marker;assert.equal(normalize(text),text)}
})
test('blank row spacing and Windows newlines preserve prose and idempotency',()=>{
 const input='Intro\r\n\r\n'+legacy.replaceAll('\n','\r\n')+'\r\n\r\nEnd'
 const output='Intro\r\n\r\n'+table.replaceAll('\n','\r\n')+'\r\n\r\nEnd'
 assert.equal(normalize(input),output);assert.equal(normalize(output),output)
})

import React, {createElement, Fragment} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {JSDOM} from 'jsdom'
import {ReportText} from '../components/procurement-insights/report-text'

const citedReport = '## SYNTHETIC_SECTION\n\nA supported claim[^source] and another reference[^source].\n\n'
 + legacy + '\n\n[^source]: [Reference](https://example.test/evidence) · 2026-11-10.'

function renderReport(text: string, locale: 'pl' | 'en' = 'pl') {
 const dom = new JSDOM(renderToStaticMarkup(createElement(ReportText, {text, locale})))
 return dom.window.document
}

test('stored report renders readable tables and linked source notes without modifying the artifact', () => {
 const original = citedReport
 const document = renderReport(citedReport)
 assert.equal(citedReport, original)
 assert.equal(document.querySelector('h3')?.textContent, 'SYNTHETIC_SECTION')
 assert.equal(document.querySelectorAll('table tbody tr').length, 2)
 assert.deepEqual([...document.querySelectorAll('table th')].map(cell => cell.textContent), ['Indicator', 'Reading'])
 const region = document.querySelector('[role="region"]')
 assert.equal(region?.getAttribute('aria-label'), 'Tabela — przewijanie poziome')
 assert.equal(region?.getAttribute('tabindex'), '0')
 assert.equal(document.querySelector('[data-footnotes] h4')?.textContent, 'Przypisy')
 const references = [...document.querySelectorAll('a[data-footnote-ref]')]
 assert.equal(references.length, 2)
 for (const reference of references) {
  const note = document.getElementById(reference.getAttribute('href')!.slice(1))
  assert.match(note?.textContent ?? '', /Reference.*2026-11-10/)
  assert.equal(reference.getAttribute('target'), null, 'source note stays in this reader')
  assert.equal(document.getElementById(reference.getAttribute('aria-describedby')!)?.textContent, 'Przypisy')
 }
 const backReferences = [...document.querySelectorAll('a[data-footnote-backref]')]
 assert.equal(backReferences.length, 2)
 for (const back of backReferences) {
  assert.ok(document.getElementById(back.getAttribute('href')!.slice(1))?.hasAttribute('data-footnote-ref'))
  assert.match(back.getAttribute('aria-label')!, /^Wróć do odwołania /)
 }
 const source = document.querySelector('a[href="https://example.test/evidence"]')
 assert.equal(source?.getAttribute('target'), '_blank')
 assert.equal(source?.getAttribute('rel'), 'noopener noreferrer')
 assert.ok(!document.body.textContent?.includes('[^source]'))
})

test('two readers keep their own footnotes, return links and accessible labels in PL and EN', () => {
 const document = new JSDOM(renderToStaticMarkup(createElement(Fragment, null,
  createElement(ReportText, {text: citedReport, locale: 'pl'}),
  createElement(ReportText, {text: citedReport, locale: 'en'}),
 ))).window.document
 const ids = [...document.querySelectorAll('[id]')].map(node => node.id)
 assert.equal(new Set(ids).size, ids.length, 'no anchor collides with another reader')
 const readers = [...document.querySelectorAll('.pi-report-text')]
 for (const reader of readers) {
  for (const link of reader.querySelectorAll('a[href^="#"]')) {
   assert.ok(reader.contains(document.getElementById(link.getAttribute('href')!.slice(1))))
   const description = link.getAttribute('aria-describedby')
   if (description) assert.ok(reader.contains(document.getElementById(description)))
  }
 }
 assert.equal(readers[1].querySelector('[data-footnotes] h4')?.textContent, 'Source notes')
 assert.equal(readers[1].querySelector('[role="region"]')?.getAttribute('aria-label'), 'Table — horizontal scrolling')
 assert.match(readers[1].querySelector('[data-footnote-backref]')?.getAttribute('aria-label') ?? '', /^Back to reference /)
})

test('unresolved references and code stay literal, while report HTML, image requests and unsafe links stay inactive', () => {
 const text = 'Unknown[^missing]. Inline: `[^code]`.\n\n'
  + '```text\n[^inside]: code, not a note\n```\n\n'
  + '![Image description](https://example.test/tracker.png)\n\n'
  + '[Unsafe](javascript:alert%281%29)\n\n'
  + '<img src="https://example.test/raw.png" onerror="alert(1)">\n\n<script>alert(1)</script>'
 const document = renderReport(text)
 assert.match(document.body.textContent ?? '', /Unknown\[\^missing\]/)
 assert.match(document.querySelector('code')?.textContent ?? '', /\[\^code\]/)
 assert.match(document.querySelector('pre')?.textContent ?? '', /\[\^inside\]: code/)
 assert.match(document.body.textContent ?? '', /Image description/)
 assert.equal(document.querySelectorAll('[data-footnotes],img,script,iframe').length, 0)
 assert.equal(document.querySelector('a[href^="javascript:"]'), null)
})
