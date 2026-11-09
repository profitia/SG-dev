import {parsePublicationScheduleRequest} from '../../../../packages/platform-source-hub-contracts/commodities-v1.mjs'
import {providerText,fail,day} from '../transport.mjs'
import {schedulePayload,scheduleRecord,scheduleAnswer,correlationKey,zonedInstant} from './publication-schedules.mjs'
export const EIA_SCHEDULE_ORIGIN='https://www.eia.gov'
export const EIA_SCHEDULE_PATHS=Object.freeze({wpsr:'/petroleum/supply/weekly/schedule.php',steo:'/outlooks/steo/release_schedule.php'})
export function prepareEiaSchedule(request){const r=parsePublicationScheduleRequest(request);if(r.provider!=='eia')fail('INVALID_CONTRACT');return {request:r,url:EIA_SCHEDULE_ORIGIN+EIA_SCHEDULE_PATHS[r.criteria.publication]}}
/** @returns {never} */
function schema(){return fail('PROVIDER_SCHEMA_CHANGED',502)}
const clean=html=>html.replace(/<!--[\s\S]*?-->/g,' ').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|#160);/gi,' ').replace(/&amp;/gi,'&').replace(/&#(\d+);/g,(_,n)=>Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):' ').replace(/\s+/g,' ').trim()
/** @returns {string[][]} */
function tableRows(html,headers){
 if(typeof html!=='string'||html.length>2*1024*1024||!/<html\b/i.test(html))schema()
 const tables=[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(m=>[...m[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>[...r[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c=>clean(c[1]))))
 const matched=tables.filter(rows=>rows.some(row=>row.length===headers.length&&row.every((v,i)=>v.toLowerCase()===headers[i].toLowerCase())))
 if(matched.length!==1)schema()
 const rows=matched[0],index=rows.findIndex(r=>r.every((v,i)=>v.toLowerCase()===headers[i].toLowerCase()))
 const data=rows.slice(index+1).filter(r=>r.some(Boolean))
 if(!data.length||data.length>1000||data.some(r=>r.length!==headers.length))schema()
 return data
}
const months=['January','February','March','April','May','June','July','August','September','October','November','December']
function longDay(s){const m=/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})$/i.exec(s);if(!m)schema();return checkedDay(`${m[3]}-${String(months.findIndex(v=>v.toLowerCase()===m[1].toLowerCase())+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`)}
/** @returns {string} */
function checkedDay(s){try{return day(s)}catch{return schema()}}
const plus=(s,n)=>new Date(Date.parse(s)+n*86400000).toISOString().slice(0,10)
const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
function clock(s){const m=/^(\d{1,2}):(\d\d)\s*([ap])\.?m\.?$/i.exec(s);if(!m||+m[1]<1||+m[1]>12||+m[2]>59)schema();return `${String(+m[1]%12+(m[3].toLowerCase()==='p'?12:0)).padStart(2,'0')}:${m[2]}`}
/** @param {string} publication @param {string} date @param {{localTime?:string|null,endTime?:string|null,referencePeriod?:string|null,scheduleStatus?:string,exception?:{reason:string,standardDate:string}|null,standardSchedule?:{weekday:number,localTime:string,timeZone:string}|null}} options */
function item(publication,date,{localTime=null,endTime=null,referencePeriod=null,scheduleStatus='OFFICIAL_DATED',exception=null,standardSchedule=null}={}){
 const title=publication==='wpsr'?'Weekly Petroleum Status Report':'Short-Term Energy Outlook',sourceUrl=EIA_SCHEDULE_ORIGIN+EIA_SCHEDULE_PATHS[publication],publicationRef='eia:'+publication
 return schedulePayload({title,publicationRef,correlationKey:correlationKey('eia',publicationRef+':'+(referencePeriod??date),sourceUrl),identityStatus:'OFFICIAL_PUBLICATION_DEFINITION',sourceName:'U.S. Energy Information Administration',sourceUrl,officialSource:true,
  dateOnly:date,localDateTime:localTime?date+'T'+localTime:null,scheduledAt:localTime?zonedInstant(date+'T'+localTime):null,scheduledUntil:endTime?zonedInstant(date+'T'+endTime):null,timeZone:'America/New_York',timePrecision:endTime?'TIME_WINDOW':localTime?'INSTANT':'DATE',
  recurrence:publication==='wpsr'?'weekly':'monthly',referencePeriod,scheduleStatus,exception,standardSchedule,
  qualityFlags:['SCHEDULE_NOT_RESULT','COVERAGE_NOT_EXHAUSTIVE','NO_PROVIDER_STABLE_EVENT_ID',...(scheduleStatus==='RULE_DERIVED_UNCONFIRMED'?['STANDARD_RULE_SUBJECT_TO_UNANNOUNCED_EXCEPTIONS']:[]),...(endTime?['USUAL_RELEASE_WINDOW_NOT_GUARANTEED']:[])]})
}
export function parseEiaSchedule(html,request){
 const parsed=parsePublicationScheduleRequest(request);if(parsed.provider!=='eia')fail('INVALID_CONTRACT')
 const c=parsed.criteria,text=clean(html)
 if(c.publication==='wpsr'){
  if(!/Weekly Petroleum Status Report Schedule/i.test(text)||!/standard release time and day of the week will be at 10:30 a\.m\. eastern time on Wednesday/i.test(text))schema()
  const rows=tableRows(html,['Data for the week ending','Alternate release date','Release day','Release time','Holiday']),exceptions=new Map()
  for(const [week,release,weekday,time,reason] of rows){
   const referencePeriod=longDay(week),date=longDay(release),standardDate=plus(referencePeriod,5)
   if(new Date(referencePeriod).getUTCDay()!==5||weekday!==weekdays[new Date(date).getUTCDay()]||date<referencePeriod||Date.parse(date)-Date.parse(referencePeriod)>21*86400000||!reason||exceptions.has(standardDate))schema()
   exceptions.set(standardDate,{date,localTime:clock(time),referencePeriod,reason,standardDate})
  }
  const out=[]
  const standardSchedule={weekday:3,localTime:'10:30',timeZone:'America/New_York'}
  for(const ex of exceptions.values())if(ex.date>=c.from&&ex.date<=c.to)out.push(item('wpsr',ex.date,{localTime:ex.localTime,referencePeriod:ex.referencePeriod,scheduleStatus:'OFFICIAL_EXCEPTION',exception:{reason:ex.reason,standardDate:ex.standardDate},standardSchedule}))
  for(let standardDate=c.from;standardDate<=c.to;standardDate=plus(standardDate,1)){
   if(new Date(standardDate).getUTCDay()!==3)continue
   if(exceptions.has(standardDate))continue
   out.push(item('wpsr',standardDate,{localTime:'10:30',referencePeriod:plus(standardDate,-5),scheduleStatus:'RULE_DERIVED_UNCONFIRMED',standardSchedule}))
  }
  return out.sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt))
 }
 if(!/Short-Term Energy Outlook/i.test(text))schema()
 const hasWindow=/normally released between 12:00 pm \(noon\) and 12:15 pm/i.test(text),rows=tableRows(html,['Issue','Release date','Notes']),seen=new Set(),out=[]
 for(const [issue,release] of rows){
  const m=/^(\d{2})\/(\d{2})\/(\d{4})(?:\s*\((\w+)\))?$/.exec(release);if(!m)schema()
  const date=checkedDay(`${m[3]}-${m[1]}-${m[2]}`)
  if(seen.has(issue)||issue!==months[Number(m[1])-1]+' '+m[3]||m[4]&&m[4]!==weekdays[new Date(date).getUTCDay()])schema();seen.add(issue)
  if(date>=c.from&&date<=c.to)out.push(item('steo',date,{localTime:hasWindow?'12:00':null,endTime:hasWindow?'12:15':null,referencePeriod:m[3]+'-'+m[1]}))
 }
 return out.sort((a,b)=>a.dateOnly.localeCompare(b.dateOnly))
}
/** @param {any} request @param {{fetchImpl?:Function,signal?:AbortSignal}} options */
export async function acquireEiaSchedule(request,{fetchImpl,signal}={}){
 const p=prepareEiaSchedule(request),html=await providerText(fetchImpl,p.url,{Accept:'text/html'},{signal}),items=parseEiaSchedule(html,request).map(payload=>scheduleRecord('eia','official-schedule-v1',payload,p.url))
 return scheduleAnswer('eia',items,{limit:request.criteria.limit??100,localFilters:['publication','from','to'],providerReturned:items.length})
}
