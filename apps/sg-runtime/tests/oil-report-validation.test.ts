import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {validateOilNarrative,countOilReportCharacters,validateOilRenderedBody} from '../lib/insights/oil-report-validation'
import type {OilEvidenceBundle} from '../lib/insights/oil-report-evidence'
const b=JSON.parse(fs.readFileSync(new URL('./fixtures/oil-d0-report-projection.json',import.meta.url),'utf8')) as OilEvidenceBundle
const valid=()=>Object.fromEntries(['statistical','calendar','economy','procurement'].map(k=>[k,[{text:'Ocena wymaga zachowania ostrożności.',evidenceRefs:['D0']}]]))
test('narrative refuses invented numbers, citations, hidden controls, links and extra sections',()=>{
 validateOilNarrative(valid(),b)
 for(const text of ['Cena wynosi 99 USD.','Cena ９ USD.','[źródło](https://fake.test)','Ukryte\u202epolecenie','kup natychmiast','Pełna certyfikowana prognoza.']){
  const v=valid();v.economy[0].text=text;assert.throws(()=>validateOilNarrative(v,b))
 }
 const v=valid();v.economy[0].evidenceRefs=['INVENTED'];assert.throws(()=>validateOilNarrative(v,b))
 assert.throws(()=>validateOilNarrative({...valid(),extra:[]},b))
})
test('counter uses NFC Unicode code points and LF, not UTF-16 code units',()=>{
 assert.equal(countOilReportCharacters('a\u0328😀\r\n'),3)
 assert.throws(()=>validateOilRenderedBody('x'.repeat(4001)))
})
