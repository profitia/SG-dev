import test from 'node:test'
import assert from 'node:assert/strict'
import {calendarReference} from '../lib/assistant/calendar-period'

const input=(message:string)=>({message,reference:null})
const clock=Date.parse('2026-11-11T12:00:00.000Z')
const nextWeek=['Jakie dane makro są zaplanowane na przyszły tydzień?','jakie dane makro sa zaplanowane na przyszly tydzien?','Kalendarz makro w przyszłym tygodniu','Kalendarz makro w nastepnym tygodniu','Macro calendar next week']
for(const message of nextWeek)test('C1 original question and language variants: '+message,()=>{
 const r=calendarReference(input(message),undefined,clock,'Europe/Warsaw')
 assert.equal(r?.from,'2026-11-15T23:00:00.000Z');assert.equal(r?.to,'2026-11-22T22:59:59.999Z')
})
const vectors=[
 ['UTC','2026-11-15T23:30:00.000Z','next week','2026-11-16T00:00:00.000Z','2026-11-22T23:59:59.999Z'],
 ['Europe/Warsaw','2026-11-15T23:30:00.000Z','next week','2026-11-22T23:00:00.000Z','2026-11-29T22:59:59.999Z'],
 ['America/New_York','2026-11-16T01:30:00.000Z','next week','2026-11-16T05:00:00.000Z','2026-11-23T04:59:59.999Z'],
 ['Europe/Warsaw','2026-03-29T10:00:00.000Z','today','2026-03-28T23:00:00.000Z','2026-03-29T21:59:59.999Z'],
 ['Europe/Warsaw','2026-10-25T10:00:00.000Z','today','2026-10-24T22:00:00.000Z','2026-10-25T22:59:59.999Z'],
 ['America/New_York','2026-03-08T10:00:00.000Z','today','2026-03-08T05:00:00.000Z','2026-03-09T03:59:59.999Z'],
 ['America/New_York','2026-11-01T10:00:00.000Z','today','2026-11-01T04:00:00.000Z','2026-11-02T04:59:59.999Z'],
 ['Asia/Kolkata','2026-11-11T20:00:00.000Z','today','2026-11-11T18:30:00.000Z','2026-11-12T18:29:59.999Z'],
 ['Asia/Kathmandu','2026-11-11T20:00:00.000Z','today','2026-11-11T18:15:00.000Z','2026-11-12T18:14:59.999Z'],
 ['Pacific/Auckland','2026-09-27T08:00:00.000Z','today','2026-09-26T12:00:00.000Z','2026-09-27T10:59:59.999Z'],
 ['Europe/Warsaw','2026-12-31T23:30:00.000Z','this month','2026-12-31T23:00:00.000Z','2027-01-31T22:59:59.999Z'],
 ['UTC','2026-12-31T23:59:59.000Z','next week','2027-01-04T00:00:00.000Z','2027-01-10T23:59:59.999Z'],
 ['Europe/Warsaw','2026-11-11T12:00:00.000Z','tomorrow','2026-11-11T23:00:00.000Z','2026-11-12T22:59:59.999Z'],
 ['Europe/Warsaw','2026-11-11T12:00:00.000Z','last week','2026-11-01T23:00:00.000Z','2026-11-08T22:59:59.999Z'],
 ['UTC','2026-11-11T12:00:00.000Z','next seven days','2026-11-11T00:00:00.000Z','2026-11-17T23:59:59.999Z'],
] as const
for(const [zone,now,message,from,to]of vectors)test('C1 civil boundary '+zone+' '+now+' '+message,()=>{
 const r=calendarReference(input(message),undefined,Date.parse(now),zone)
 assert.equal(r?.from,from);assert.equal(r?.to,to)
})
test('C1 explicit dates win and an inherited December period cannot override next week',()=>{
 const prior=calendarReference(input('2026-12-04 2026-12-11'),undefined,clock)!
 assert.equal(calendarReference(input('Co to oznacza?'),prior,clock),prior)
 assert.equal(calendarReference(input('next week'),prior,clock)?.from,'2026-11-16T00:00:00.000Z')
 assert.equal(calendarReference(input('next week 16.11.2026 22.11.2026'),prior,clock,'Europe/Warsaw')?.from,'2026-11-15T23:00:00.000Z')
})
test('C1 invalid dates, missing zone and ambiguous multiple explicit dates do not invent a range',()=>{
 for(const q of ['2026-02-30','2026-12-11 2026-12-04','2026-11-01 2026-11-03 2026-11-10','in 0 days'])assert.equal(calendarReference(input(q),undefined,clock),null)
 for(const zone of ['', 'Invalid/Zone'])assert.equal(calendarReference(input('next week'),undefined,clock,zone),null)
 assert.equal(calendarReference(input('next week'),undefined,NaN),null)
 assert.equal(calendarReference(input('2011-12-30'),undefined,Date.parse('2011-12-20T12:00:00.000Z'),'Pacific/Apia'),null)
})
