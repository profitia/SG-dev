import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {makeOilEvidenceBundle,oilEvidenceCoverage,type OilEvidenceBundle} from '../lib/insights/oil-report-evidence'
const b=JSON.parse(fs.readFileSync(new URL('./fixtures/oil-d0-report-projection.json',import.meta.url),'utf8')) as OilEvidenceBundle
test('synthetic input is never represented as the licensed immutable pilot package',()=>assert.throws(()=>makeOilEvidenceBundle(b.forecast,[],b.asOf),/UNVERIFIED/))
test('missing market intelligence remains missing; no news or released outcome is invented',()=>{
 const c=oilEvidenceCoverage(b)
 assert.equal(c.verifiedSources,0);assert.equal(c.completedEvents,0);assert.equal(c.scheduledEvents,0);assert.equal(c.unavailableIsNotNoNews,true)
})
