import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {renderOilReport} from '../lib/insights/oil-report-renderer'
import type {OilEvidenceBundle} from '../lib/insights/oil-report-evidence'
import type {OilNarrative} from '../lib/insights/oil-report-contract'
const bundle=()=>JSON.parse(fs.readFileSync(new URL('./fixtures/oil-d0-report-projection.json',import.meta.url),'utf8')) as OilEvidenceBundle
const n=()=>Object.fromEntries(['statistical','calendar','economy','procurement'].map(k=>[k,[{text:'Zakupy zależą od ekspozycji i warunków kontraktu.',evidenceRefs:['D0']}]])) as OilNarrative
test('renderer inserts deterministic separate futures tables, dates, caveats and full visible count',()=>{
 const r=renderOilReport(n(),bundle())
 assert(r.body.includes('WTI 10,00'));assert(r.body.includes('Brent 20,00'));assert(r.body.includes('2026-11-06'))
 assert(r.body.includes('NOT_AVAILABLE'));assert(r.body.includes('Latest-vintage'));assert(r.characterCount<=4000)
 assert.equal(r.publicationStatus,'HUMAN_REVIEW_REQUIRED');assert.equal(r.bodySha256.length,64)
 assert.equal(r.characterCount,Array.from(r.body).length)
})
test('an overlong model result is rejected, never silently trimmed or manually polished',()=>{
 const v=n();for(const s of Object.values(v))s[0].text='Ostrożna analiza. '.repeat(70)
 assert.throws(()=>renderOilReport(v,bundle()),/CHARACTER_LIMIT/)
})
