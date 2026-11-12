import test from 'node:test'
import assert from 'node:assert/strict'
import {entriesFrom,filterEntries,DEFAULT_FILTERS,periodRange,emptyPreferences,localDate,calendarDate,type Snapshot} from '../lib/market-calendar/model'
const pub='ecr_pub_'+'a'.repeat(64),id='ecr_evt_'+'b'.repeat(64)
const reading={observationId:'SYNTHETIC_ONLY',sequence:1,eventId:id,actual:0,previous:null,forecast:null,revised:null,unit:'MBBL',seriesId:'SYNTHETIC_ONLY',observedAt:'2030-03-04T12:00:00Z'}
function snapshot():Snapshot{return{events:[{eventId:id,publicationId:pub,title:'SYNTHETIC_ONLY',eventAt:'2030-03-04T23:30:00Z',schedule:{timePrecision:'EXACT_INSTANT',scheduleStatus:'CONFIRMED'},source:{provider:'eia',licenceRef:'SYNTHETIC_ONLY'},values:{actual:null},knownAt:'2030-03-05T01:00:00Z'} as any],publications:[],context:{items:[{eventId:id,concept:{data:{namePl:'SYNTHETIC_PL',description:'SYNTHETIC_ONLY',taxonomy:['ropa'],geography:'USA'}},results:[reading]} as any],definitions:[],unresolvedSchedules:[],nextAfter:null,coverage:{completeness:'UNKNOWN'}},more:{events:null,publications:null,context:null}}}
test('zero is a reading, not missing; provider time is localized and no publication time or history is invented',()=>{
 const [e]=entriesFrom(snapshot(),'Europe/Warsaw');assert.equal(e.date,'2030-03-05');assert.equal(e.time,'00:30');assert.equal(e.status,'published');assert.equal(e.readings[0].actual,0);assert.equal(e.readings[0].forecast,null);assert.equal(e.title,'SYNTHETIC_PL')
 assert.equal(localDate(new Date('2030-01-01T00:00:00Z'),'America/New_York'),'2029-12-31')
 assert.equal(calendarDate('2032-02-29'),'2032-02-29');for(const invalid of ['2030-02-29','2030-13-01','not-a-day'])assert.equal(calendarDate(invalid),null)
 const s=snapshot();s.context.definitions=[{kind:'measure',id:'synthetic-measure',status:'accepted',data:{namePl:'SYNTHETIC_POLISH_MEASURE'}} as any];assert.equal(entriesFrom(s,'UTC')[0].measureDefinitions?.[0].data.namePl,'SYNTHETIC_POLISH_MEASURE')
})
test('saved filters, all three views and month counts share the same selection; private favourites refer to publications',()=>{
 const rows=entriesFrom(snapshot(),'UTC'),p=emptyPreferences().preferences;p.publicationFavourites=[pub]
 const f={...DEFAULT_FILTERS,q:'synthetic',targetId:'ropa',region:'USA'},r={from:'2030-03-01',to:'2030-03-07'}
 assert.equal(filterEntries(rows,f,r,'favorites',p).length,1);assert.equal(filterEntries(rows,{...f,region:'Europa'},r,'favorites',p).length,0)
 assert.equal(filterEntries(rows,f,r,'favorites',p,'2030-03-05').length,0)
 assert.deepEqual(periodRange({...f,view:'month'},'2032-02-11',0),{from:'2032-02-01',to:'2032-02-29'})
 assert.deepEqual(periodRange({...f,period:'recent'},'2030-03-08',0),{from:'2030-03-01',to:'2030-03-07'})
 assert.equal(filterEntries(rows,f,r,'watching',p).length,0)
})
test('an aggregator next date stays an unresolved definition; missing actual remains null',()=>{
 const s=snapshot();s.events=[];s.context.items=[];s.publications=[{publicationId:pub,title:'SYNTHETIC_NEXT',source:{provider:'commodities-sh',licenceRef:'SYNTHETIC_ONLY'},unresolvedNextSchedule:{dateOnly:'2030-03-04',scheduledAt:null,timePrecision:'DATE_ONLY'},sourceUrl:'javascript:alert(1)'} as any]
 const [e]=entriesFrom(s,'UTC');assert.equal(e.event,null);assert.equal(e.status,'unresolved');assert.equal(e.sourceUrl,null);assert.equal(e.readings.length,0);assert.equal(e.date,'2030-03-04')
})
