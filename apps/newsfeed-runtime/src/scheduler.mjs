import {parseSchedule} from '../../../packages/newsfeed-contracts/index.mjs';
import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
function parts(epoch,zone){
 const d=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(epoch)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return {date:`${d.year}-${d.month}-${d.day}`,time:`${d.hour}:${d.minute}`};
}
function occurrence(date,time,zone){
 const local=Date.parse(date+'T'+time+':00Z'),offsets=new Set();
 // Observe both sides of a DST transition. A repeated wall time represents
 // one logical slot; a nonexistent local wall time is skipped explicitly.
 for(let h=-36;h<=36;h+=6){const epoch=local+h*3600000,p=parts(epoch,zone);offsets.add(Date.parse(p.date+'T'+p.time+':00Z')-epoch);}
 return [...offsets].map(o=>local-o).filter(t=>{const p=parts(t,zone);return p.date===date&&p.time===time;}).sort((a,b)=>a-b)[0]??null;
}
export function nextOccurrence(input,after){
 const {dstPolicy,...definition}=input??{};const schedule=parseSchedule(definition);
 if(!schedule||!Number.isFinite(Date.parse(after)))throw new SourceHubError('INVALID_SCHEDULE');
 let start=parts(Date.parse(after),schedule.timeZone).date;if(start<schedule.startDate)start=schedule.startDate;
 const date=new Date(start+'T00:00:00Z');
 for(let i=0;i<400;i++,date.setUTCDate(date.getUTCDate()+1)){
  const key=date.toISOString().slice(0,10);if(schedule.endDate&&key>schedule.endDate)return null;
  const weekday=date.getUTCDay()||7;
  if(schedule.frequency==='WEEKLY'&&!schedule.weekdays.includes(weekday)||schedule.frequency==='MONTHLY'&&date.getUTCDate()!==schedule.monthDay)continue;
  const when=occurrence(key,schedule.localTime,schedule.timeZone);if(when!==null&&when>Date.parse(after))return {at:new Date(when).toISOString(),localDate:key,timeZone:schedule.timeZone,key:key+'T'+schedule.localTime+'@'+schedule.timeZone};
 }
 return null;
}
