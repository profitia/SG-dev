import test from 'node:test';import assert from 'node:assert/strict';
import {nextOccurrence} from '../src/scheduler.mjs';import {parseSchedule,parseSavedSearch} from '../../../packages/newsfeed-contracts/index.mjs';
const schedule={frequency:'DAILY',timeZone:'Europe/Warsaw',localTime:'08:00',startDate:'2026-01-01',endDate:null};
test('next slot uses local timezone and an exclusive after boundary',()=>{
 assert.equal(nextOccurrence(schedule,'2026-11-10T06:00:00Z').at,'2026-11-10T07:00:00.000Z');assert.equal(nextOccurrence(schedule,'2026-11-10T07:00:00Z').at,'2026-11-11T07:00:00.000Z');
});
test('spring gap is skipped and autumn repeated wall time has exactly one logical slot',()=>{
 const s={...schedule,localTime:'02:30'};
 assert.equal(nextOccurrence(s,'2026-03-28T23:00:00Z').localDate,'2026-03-30');
 assert.equal(nextOccurrence(s,'2026-10-24T23:00:00Z').at,'2026-10-25T00:30:00.000Z');
 assert.equal(nextOccurrence(s,'2026-10-25T00:30:00Z').localDate,'2026-10-26');
});
test('weekly/monthly anchors, starts and end dates remain explicit',()=>{
 assert.equal(nextOccurrence({...schedule,frequency:'WEEKLY',weekdays:[1]},'2026-11-10T07:00:00Z').localDate,'2026-11-16');
 assert.equal(nextOccurrence({...schedule,frequency:'MONTHLY',monthDay:31},'2026-04-01T00:00:00Z').localDate,'2026-05-31');
 assert.equal(nextOccurrence({...schedule,endDate:'2026-11-10'},'2026-11-10T07:00:00Z'),null);
 assert.throws(()=>parseSchedule({...schedule,timeZone:'invalid'}));assert.throws(()=>parseSchedule({...schedule,frequency:'WEEKLY'}));
});
test('saved-search contract never accepts claimed ownership and rejects duplicate phrases',()=>{
 const value={contractVersion:'1.2.0',name:'Rynek',subjectKind:'topic',subject:'oil',request:{contractVersion:'1.0.0',family:'news-discovery',provider:'brave',operation:'search',criteria:{text:'oil'}},phrases:['oil'],schedule:null,notifications:false};
 assert.equal(parseSavedSearch(value).phrases[0],'oil');
 assert.throws(()=>parseSavedSearch({...value,ownerUserId:'claimed'}));assert.throws(()=>parseSavedSearch({...value,phrases:['oil',' OIL ']}));
});
