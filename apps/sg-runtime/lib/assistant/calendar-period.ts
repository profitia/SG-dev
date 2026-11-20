import {contextDate,readContextReference,type ContextReference,type EconomicCalendarReference} from '../../../../packages/assistant-context-contracts/src/index.mjs'

/** Civil calendar arithmetic belongs to the trusted host. A day is not always
 * 24 hours in the account/application zone; provider times remain UTC instants. */
function calendar(now:number,timeZone:string){
 if(!Number.isFinite(now)||!Number.isFinite(new Date(now).getTime())||typeof timeZone!=='string'||!timeZone.length)throw TypeError('Calendar clock and zone required')
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'})
 const localDay=(instant:number)=>{
  const p=Object.fromEntries(formatter.formatToParts(instant).map(p=>[p.type,p.value]))
  return contextDate(p.year.padStart(4,'0')+'-'+p.month+'-'+p.day)
 }
 const today=localDay(now)
 const shift=(day:string,n:number)=>contextDate(new Date(Date.parse(day+'T00:00:00.000Z')+n*86400000).toISOString().slice(0,10))
 // Find the first instant of a local date. This also handles midnight DST
 // transitions; a skipped date is not silently reinterpreted as another day.
 const boundary=(day:string,requirePresent=true)=>{
  const centre=Date.parse(contextDate(day)+'T00:00:00.000Z')
  let low=centre-2*86400000,high=centre+2*86400000
  while(low<high){const middle=Math.floor((low+high)/2);if(localDay(middle)<day)low=middle+1;else high=middle}
  if(requirePresent&&localDay(low)!==day)throw TypeError('Local date unavailable')
  return low
 }
 return {today,shift,day:(n:number)=>shift(today,n),interval:(from:string,to:string)=>({
  from:new Date(boundary(from)).toISOString(),to:new Date(boundary(shift(to,1),false)-1).toISOString(),
 })}
}

export function calendarReference(turn:{message:string;reference:ContextReference|null},prior:ContextReference|undefined,now:number,timeZone='UTC'):EconomicCalendarReference|null{
 try{
  const c=calendar(now,timeZone)
  const dateHints=[...turn.message.matchAll(/(?<!\d)(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})(?!\d)/g)].map(m=>m[1].includes('.')?m[1].split('.').reverse().join('-'):m[1])
  if(dateHints.length>2)return null
  const q=turn.message.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replaceAll('ł','l')
  const upcoming=/najbliz|nadchod|przyszl|nastepn|upcoming|next|kiedy|when/.test(q),past=/ostatni|najnows|opublikowan|wynik|odczyt|ubiegl|zeszl|poprzedni|minion|latest|last|actual|result|released/.test(q)
  const weekDay=(new Date(c.today+'T00:00:00.000Z').getUTCDay()+6)%7
  let relative:{from:string;to:string}|undefined
  if(/jutro|tomorrow/.test(q))relative={from:c.day(1),to:c.day(1)}
  else if(/dzisiaj|dzis|\btoday\b/.test(q))relative={from:c.day(0),to:c.day(0)}
  else if(/\b(?:przyszl\w*|nastepn\w*)\s+ty(?:dzien|godni\w*)\b|\bnext\s+week\b/.test(q))relative={from:c.day(7-weekDay),to:c.day(13-weekDay)}
  else if(/\b(?:ubiegl\w*|zeszl\w*|poprzedni\w*|minion\w*|ostatni\w*)\s+ty(?:dzien|godni\w*)\b|\blast\s+week\b/.test(q))relative={from:c.day(-7-weekDay),to:c.day(-1-weekDay)}
  else if(/tym tygodniu|this week/.test(q))relative={from:c.day(-weekDay),to:c.day(6-weekDay)}
  else if(/najblizsz.{0,10}tydzien|najblizsz.{0,10}tygod|next seven days/.test(q))relative={from:c.day(0),to:c.day(6)}
  else if(/tym miesiacu|this month|przyszl.{0,8}miesiac|next month/.test(q)){
   const current=new Date(c.today+'T00:00:00.000Z'),shift=/przyszl|next month/.test(q)?1:0
   relative={from:new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()+shift,1)).toISOString().slice(0,10),to:new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()+shift+1,0)).toISOString().slice(0,10)}
  }else{
   const days=/(?<!\d)(\d{1,4})\s*(?:dni|days)(?!\p{L})/u.exec(q)
   if(days){const n=Number(days[1]);if(!n)return null
    relative=/\bza\s+\d|\bin\s+\d/.test(q)?{from:c.day(n),to:c.day(n)}:{from:c.day(past?1-n:0),to:c.day(past?0:n-1)}
   }
  }
  if(!dateHints.length&&!upcoming&&!past&&!relative&&prior?.source==='ECONOMIC_CALENDAR')return prior
  const chart=turn.reference?.source==='BENCHMARK_CHART'?turn.reference:null
  const from=contextDate(dateHints[0]??relative?.from??(!upcoming&&!past&&chart?chart.from:c.day(upcoming?0:past?-30:-7)))
  const to=contextDate(dateHints.at(-1)??relative?.to??(!upcoming&&!past&&chart?chart.to:c.day(past?0:30)))
  return readContextReference({version:'2.1.0',source:'ECONOMIC_CALENDAR',targetType:null,targetId:null,
   ...c.interval(from,to),asKnownAt:null,after:null}) as EconomicCalendarReference
 }catch{return null}
}
