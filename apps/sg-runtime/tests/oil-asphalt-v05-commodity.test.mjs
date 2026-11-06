import test from 'node:test';
import assert from 'node:assert/strict';
import {eiaWeeklyPair,cftcWtiPair,confirmedOilCalendar} from '../lib/insights/oil-asphalt-v05-commodity.mjs';
const asOf='2026-11-06T22:00:00Z';
const meta=providerId=>({providerId,retrievedAt:asOf,availableAt:asOf,sourceRecordRef:'SYNTHETIC_NOT_LIVE',contentFingerprint:'SYNTHETIC',usageReceiptRef:'SYNTHETIC',licenceRef:'SYNTHETIC',sourceUrl:'https://example.test'});
const eia=(period,value,changes={})=>({metadata:meta('eia'),payload:{datasetId:'petroleum/stoc/wstk',frequency:'weekly',dimensions:{series:'TEST_COMMERCIAL_CRUDE',duoarea:'NUS'},referencePeriod:period,measures:[{field:'value',value,unit:'thousand barrels'}],publishedAt:null,revisionStatus:'TEST_CURRENT_SNAPSHOT',...changes}});
const eiaOptions={datasetId:'petroleum/stoc/wstk',dimensions:{series:'TEST_COMMERCIAL_CRUDE',duoarea:'NUS'},unit:'thousand barrels',asOf};
test('stocks compare consecutive identical weeks, never aggregate another stock series',()=>{
 const r=eiaWeeklyPair([eia('2026-10-30','412500'),eia('2026-10-23','410000'),eia('2026-10-30','999999',{dimensions:{series:'TEST_SPR',duoarea:'NUS'}})],eiaOptions);
 assert.equal(r.change,2500);assert.equal(r.records.discarded,1);assert.equal(r.latest.publicationAt,'UNKNOWN');
 assert.equal(eiaWeeklyPair([eia('2026-10-30',1),eia('2026-10-16',2)],eiaOptions).change,'UNKNOWN');
});
test('conflicting revisions fail rather than average; exact duplicates are counted',()=>{
 assert.throws(()=>eiaWeeklyPair([eia('2026-10-30',1),eia('2026-10-30',2)],eiaOptions),/CONFLICTING_REVISION/);
 assert.equal(eiaWeeklyPair([eia('2026-10-30',1),eia('2026-10-30',1)],eiaOptions).records.deduplicated,1);
});
test('missing values, future knowledge, impossible dates and incompatible units fail closed',()=>{
 assert.throws(()=>eiaWeeklyPair([eia('2026-10-30','-')],eiaOptions),/MISSING_NUMERIC/);
 assert.throws(()=>eiaWeeklyPair([eia('2026-02-30',1)],eiaOptions),/INVALID_DATE/);
 assert.throws(()=>eiaWeeklyPair([eia('2026-11-13',1)],eiaOptions),/OBSERVATION_AFTER_AS_OF/);
 assert.throws(()=>eiaWeeklyPair([eia('2026-10-30',1,{measures:[{field:'value',value:1,unit:'barrels per day'}]})],eiaOptions),/NONCOMPARABLE_UNITS/);
 const x=eia('2026-10-30',1);x.metadata.retrievedAt='2026-11-07T00:00:00Z';assert.throws(()=>eiaWeeklyPair([x],eiaOptions),/RETRIEVAL_AFTER_AS_OF/);
});
const name='WTI-PHYSICAL - NEW YORK MERCANTILE EXCHANGE';
const cot=(reportDate,long,short,oi,changes={})=>({metadata:meta('cftc'),payload:{datasetId:'72hh-3qpy',contractCode:'TEST_CODE',contractName:name,reportDate,publicationAt:null,columns:{m_money_positions_long_all:long,m_money_positions_short_all:short,open_interest_all:oi},...changes}});
const cotOptions={asOf,contractCode:'TEST_CODE',contractName:name};
test('Managed Money net and comparable Open Interest preserve signs and report dates',()=>{
 const r=cftcWtiPair([cot('2026-11-03','100','130','1000'),cot('2026-10-27','150','100','900')],cotOptions);
 assert.equal(r.latest.net,-30);assert.equal(r.netChange,-80);assert.equal(r.openInterestChange,100);assert.equal(r.latest.publicationAt,'UNKNOWN');
 assert.equal(r.kind,'FUTURES_POSITIONING_NOT_PHYSICAL_DEMAND');
});
test('CFTC rejects mixed variants, conflicting duplicates and invalid contract counts',()=>{
 assert.throws(()=>cftcWtiPair([cot('2026-11-03',1,2,10)],{...cotOptions,datasetId:'kh3c-gbw2'}),/EXACT_WTI_FUTURES_ONLY/);
 assert.throws(()=>cftcWtiPair([cot('2026-11-03',1,2,10),cot('2026-11-03',1,3,10)],cotOptions),/CONFLICTING_POSITION_RECORD/);
 assert.throws(()=>cftcWtiPair([cot('2026-11-03',-1,2,10)],cotOptions),/INVALID_CONTRACT_COUNT/);
 assert.equal(cftcWtiPair([cot('2026-11-03',1,2,10),cot('2026-10-20',2,3,20)],cotOptions).netChange,'UNKNOWN');
});
const calendar=(id,title,scheduledAt,dateOnly=null)=>({metadata:meta('commodities-sh'),payload:{scheduleId:id,title,scheduledAt,dateOnly,kind:'PUBLICATION_SCHEDULE',recurrence:'weekly'}});
const window={asOf,fromDate:'2026-11-10',throughDate:'2026-11-16'};
test('calendar never expands a recurrence, and excludes unrelated or out-of-window schedules',()=>{
 const r=confirmedOilCalendar([calendar('a','EIA petroleum report',null),calendar('b','USDA wheat','2026-11-12T15:00:00Z'),calendar('c','CFTC COT','2026-11-13T20:30:00Z'),calendar('d','Crude oil report','2026-11-20T15:30:00Z')],window);
 assert.equal(r.events.length,1);assert.equal(r.events[0].date,'2026-11-13');assert.equal(r.excluded.length,3);
});
test('calendar respects Warsaw midnight and preserves unknown time for a real date-only event',()=>{
 const r=confirmedOilCalendar([calendar('a','Crude oil report','2026-11-09T23:30:00Z'),calendar('b','EIA STEO',null,'2026-11-10')],window);
 assert.equal(r.events.length,2);assert.equal(r.events[0].date,'2026-11-10');assert.equal(r.events[1].scheduledAt,'UNKNOWN');
 assert.equal(confirmedOilCalendar([calendar('a','EIA petroleum',null)],window).status,'NO_CONFIRMED_OIL_RELEASE_DATES');
});
