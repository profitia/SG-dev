import test from 'node:test';import assert from 'node:assert/strict';
import {publicationStatistics} from '../src/statistics.mjs';
const asOf='2026-11-10T12:00:00Z';
const p=(id,headline,publishedAt='2026-11-10T10:00:00Z',kind='NEWS_ARTICLE')=>({id,headline,publishedAt,kind,detectedAt:'2026-11-09T10:00:00Z'});
test('statistics count the union of unique publications and retain overlapping phrase series',()=>{
 const rows=[p('a','Oil and asphalt market'),p('a','Oil and asphalt market'),p('b','OIL market'),p('c','Soil analysis'),p('d','Oil calendar',asOf,'ECONOMIC_EVENT')];
 const s=publicationStatistics(rows,{phrases:['oil','asphalt'],asOf});assert.equal(s.total,2);assert.deepEqual(s.phrases.map(x=>x.count),[2,1]);assert.equal(s.days.length,23);assert.equal(new Date(s.fromDate).getUTCDay(),1);assert.equal(s.weekBoundary,'MONDAY_LOCAL');assert.equal(s.days.reduce((n,d)=>n+d.total,0),2);
});
test('missing dates remain unknown; selecting detection time is explicit',()=>{
 const rows=[p('a','Oil',null)];const a=publicationStatistics(rows,{phrases:['oil'],asOf});assert.equal(a.undated,1);assert.equal(a.total,0);
 const b=publicationStatistics(rows,{phrases:['oil'],dateBasis:'detectedAt',asOf});assert.equal(b.total,1);assert.equal(b.dateBasis,'detectedAt');
});
test('dates use the selected timezone, preserve range limits and reject invalid parameters',()=>{
 const s=publicationStatistics([p('a','oil','2026-11-09T23:30:00Z'),p('b','oil','2026-09-01T00:00:00Z'),p('c','oil','2026-11-11T00:00:00Z')],{phrases:['oil'],weeks:8,asOf});assert.equal(s.days.length,51);assert.equal(s.days.at(-1).total,1);assert.equal(s.total,1);
 for(const q of[{phrases:['oil',' OIL ']},{phrases:['']},{phrases:['oil'],weeks:5},{phrases:['oil'],timeZone:'invalid'}])assert.throws(()=>publicationStatistics([],{...q,asOf}));
});
test('phrase matching treats regex symbols literally and normalizes whitespace',()=>{
 const s=publicationStatistics([p('a','OPEC+   oil market'),p('b','OPECC oil')],{phrases:['OPEC+ oil'],asOf});assert.equal(s.total,1);
});
