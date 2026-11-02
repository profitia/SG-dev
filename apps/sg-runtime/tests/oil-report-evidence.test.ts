import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {makeOilEvidenceBundle,oilEvidenceCoverage,type OilEvidenceBundle} from '../lib/insights/oil-report-evidence'
import {projectFrozenOilD0} from '../lib/forecast/oil-d0-report-projection'
const b=JSON.parse(fs.readFileSync(new URL('./fixtures/oil-d0-report-projection.json',import.meta.url),'utf8')) as OilEvidenceBundle
test('synthetic input is never represented as the licensed immutable pilot package',()=>assert.throws(()=>makeOilEvidenceBundle(b.forecast,[],b.asOf),/UNVERIFIED/))
test('missing market intelligence remains missing; no news or released outcome is invented',()=>{
 const c=oilEvidenceCoverage(b)
 assert.equal(c.verifiedSources,0);assert.equal(c.completedEvents,0);assert.equal(c.scheduledEvents,0);assert.equal(c.unavailableIsNotNoNews,true)
})
test('local frozen evidence seals nested values and denies future publications/outcomes',{skip:!process.env.OIL_D0_READONLY_FILE},()=>{
 const f=projectFrozenOilD0(fs.readFileSync(process.env.OIL_D0_READONLY_FILE!)),bundle=makeOilEvidenceBundle(f,[],b.asOf)
 assert(Object.isFrozen(bundle));assert(Object.isFrozen(bundle.evidenceIds));assert(Object.isFrozen(bundle.market))
 assert.throws(()=>bundle.evidenceIds.push('FORGED'))
 const source={id:'NEWS_TEST',publisher:'SYNTHETIC_TEST_ONLY',title:'test',url:'https://example.test/release',publicationDate:'2026-11-03',eventDate:'2026-11-04',retrievedAt:b.asOf,summary:'Synthetic test only',licence:'TEST_ONLY',verification:'INDEPENDENTLY_VERIFIED' as const,kind:'COMPLETED' as const,availableAt:'2026-11-03T12:00:00Z'}
 assert.throws(()=>makeOilEvidenceBundle(f,[source],b.asOf),/LOOKAHEAD/)
 assert.throws(()=>makeOilEvidenceBundle(f,[{...source,publicationDate:'2026-11-02',availableAt:'2026-11-02T10:00:00Z'}],b.asOf),/WINDOW/)
})
