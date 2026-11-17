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
