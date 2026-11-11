import type {CalendarEvent,PublicationData,Preferences,PreferenceEnvelope,MarketCalendarSelection,PublicationWatch} from '../../../../packages/economic-calendar-contracts/index.mjs'

export type View=MarketCalendarSelection['view']
export type Status='planned'|'published'|'revised'|'unresolved'
export type Filters=MarketCalendarSelection
export type Watch=PublicationWatch
export type PrivatePreferences=Preferences
export type PrivateEnvelope=Omit<PreferenceEnvelope,'preferences'>&{preferences:PrivatePreferences}
export type Semantic={kind:string;id:string;version:number;status:string;data:Record<string,any>;evidence:Array<{ref:string;reason:string}>;recordedAt:string}
export type Reading={observationId:string;sequence:number;eventId:string|null;conceptId:string;measureId:string;seriesId:string;referencePeriod:string;geography:string;unit:string;actual:string|number|null;previous:string|number|null;forecast:string|number|null;revised:string|number|null;publishedAt:string|null;sourceUpdatedAt:string|null;sourceRetrievedAt:string;observedAt:string;receiptRef:string;sourceRecordRef:string;sourceUrl:string|null;licenceRef:string;storageBasisRef:string;valueMeaning:string;correlationStatus:string}
export type TimelineItem={eventId:string;event:CalendarEvent;knownAt:string;concept:Semantic|null;mapping:Semantic;results:Reading[];relevance:Semantic[]}
export type Page<T>={items:T[];nextAfter:string|null;coverage?:Record<string,any>}
export type Context=Page<TimelineItem>&{definitions:Semantic[];unresolvedSchedules:Array<{publication:PublicationData;meaning:Array<{concept:Semantic|null;certainty:string}>}>;coverage:Record<string,any>}
export type Snapshot={events:CalendarEvent[];publications:PublicationData[];context:Context;more:{events:string|null;publications:string|null;context:string|null}}
export type Entry={measureDefinitions?:Semantic[];evidenceLoaded?:boolean;id:string;publicationId:string|null;title:string;originalTitle:string;description:string|null;relevanceReasons:string[];region:string;topics:string[];date:string|null;time:string|null;timeLabel:string;timing:string;provider:string;sourceUrl:string|null;status:Status;event:CalendarEvent|null;publication:PublicationData|null;meaning:Semantic|null;readings:Reading[];observedAt:string|null;sourceRetrievedAt:string|null;licenceRef:string|null}
export const DEFAULT_FILTERS:Filters={q:'',targetId:'all',region:'all',status:'all',period:'next',view:'list'}
export const emptyPreferences=():PrivateEnvelope=>({version:0,preferences:{watchedCountries:[],watchedIndicators:[],watchedTopics:[],savedFilters:[],display:{},publicationFavourites:[],publicationWatches:[]},createdAt:null,updatedAt:null})
export const statusLabel=(s:Status)=>({planned:'Zaplanowane',published:'Odczyt dostępny',revised:'Zaobserwowana zmiana odczytu',unresolved:'Termin niepotwierdzony'}[s])
export const providerLabel=(s:string)=>({'eia':'EIA','commodities-sh':'commodities.sh','trading-economics':'Trading Economics'}[s]??s)
export function localDate(value:Date|string,timeZone:string){return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))}
export function calendarDate(value:string|null):string|null{if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===value?value:null}
export const addDays=(date:string,days:number)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10)
export function periodRange(filters:Filters,anchor:string,offset:number):{from:string;to:string}{
 if(filters.view==='month'){const d=new Date(anchor+'T12:00:00Z'),a=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+offset,1,12));return{from:a.toISOString().slice(0,10),to:new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+1,0,12)).toISOString().slice(0,10)}}
 const from=addDays(anchor,(filters.period==='recent'?-7:0)+offset*7);return{from,to:addDays(from,6)}
}
export function safeUrl(value:unknown):string|null{try{if(typeof value!=='string')return null;const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}}
export function formatDate(date:string,locale='pl'){return new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'))}
function timing(event:CalendarEvent|null,publication:PublicationData|null,timeZone:string){
 const s=(event?.schedule??publication?.unresolvedNextSchedule??{}) as Record<string,any>,at=event?.eventAt??s.scheduledAt??null
 const exact=['EXACT','EXACT_INSTANT','EXACT_TIME','INSTANT'].includes(s.timePrecision)&&['CONFIRMED','OFFICIAL_DATED','OFFICIAL_EXCEPTION'].includes(s.scheduleStatus)
 const date=at?localDate(at,timeZone):typeof s.dateOnly==='string'?s.dateOnly:typeof s.localDateTime==='string'?s.localDateTime.slice(0,10):null
 const precision=s.timePrecision??(event?.dateSpan===0?'PROVIDER_TIME':'UNKNOWN'),time=at?new Intl.DateTimeFormat('pl',{timeZone,hour:'2-digit',minute:'2-digit'}).format(new Date(at)):null
 const uncertain=s.scheduleStatus==='RULE_DERIVED_UNCONFIRMED'||(Array.isArray(s.qualityFlags)&&s.qualityFlags.some((x:string)=>/UNCONFIRMED|RULE_DERIVED/.test(x)))
 return{date,time,timeLabel:date?time?time+' · '+timeZone+(uncertain?' (z reguły)':''): 'Data bez potwierdzonej godziny':'Termin nieznany',timing:uncertain?'Termin wyprowadzony z reguły — niepotwierdzony':exact?'Termin potwierdzony przez źródło':String(precision)+' · '+String(s.scheduleStatus??'Brak potwierdzenia czasu'),uncertain}
}
export function entriesFrom(snapshot:Snapshot,timeZone:string):Entry[]{
 const definitions=new Map(snapshot.publications.map(p=>[p.publicationId,p]))
 const meanings=new Map(snapshot.context.items.map(i=>[i.eventId,i]))
 const definitionMeanings=new Map(snapshot.context.unresolvedSchedules.map(i=>[i.publication.publicationId,i.meaning.find(m=>m.certainty==='CONFIRMED')?.concept??null]))
 const rows:Entry[]=snapshot.events.map(event=>{
  const item=meanings.get(event.eventId),publication=event.publicationId?definitions.get(event.publicationId)??null:null,concept=item?.concept??null,t=timing(event,publication,timeZone)
  const readings=item?.results??[],changed=readings.some(r=>r.sequence>1||r.revised!==null)
  return{id:event.eventId,publicationId:event.publicationId??null,title:concept?.data.namePl??event.title??'Publikacja bez nazwy',originalTitle:event.title??'',description:concept?.data.description??null,
   relevanceReasons:(item?.relevance??[]).map(r=>r.data.reason).filter((r):r is string=>typeof r==='string'),region:concept?.data.geography??event.country??'Nieustalony',topics:concept?.data.taxonomy??[],...t,provider:event.source.provider,sourceUrl:safeUrl(event.sourceUrl),
   status:changed?'revised':readings.some(r=>r.actual!==null)||event.values.actual!==null?'published':t.uncertain||!t.date?'unresolved':'planned',event,publication,meaning:concept,readings,
   observedAt:event.knownAt??item?.knownAt??null,sourceRetrievedAt:event.observation?.sourceRetrievedAt??null,licenceRef:event.source.licenceRef,measureDefinitions:snapshot.context.definitions.filter(d=>d.kind==='measure'&&d.status==='accepted')}
 })
 for(const publication of snapshot.publications){
  // A definition without a stable release identity remains a definition, even
  // when an aggregator supplies a moving next date. Never fabricate an event.
  if(!publication.unresolvedNextSchedule)continue
  rows.push(publicationEntry(publication,definitionMeanings.get(publication.publicationId)??null,timeZone))
 }
 return rows
}
export function filterEntries(entries:Entry[],filters:Filters,range:{from:string;to:string},section:string,prefs:PrivatePreferences,day:string|null=null){
 const q=filters.q.toLocaleLowerCase('pl').trim()
 return entries.filter(e=>(day?e.date===day:!e.date||e.date>=range.from&&e.date<=range.to)
  &&(filters.targetId==='all'||e.topics.includes(filters.targetId))&&(filters.region==='all'||e.region===filters.region)
  &&(filters.status==='all'||filters.status==='planned'?filters.status==='all'||['planned','unresolved'].includes(e.status):e.status===filters.status)
  &&(!q||[e.title,e.originalTitle,e.description,e.provider,e.region,...e.topics,...e.readings.map(r=>r.seriesId)].join(' ').toLocaleLowerCase('pl').includes(q))
  &&(section==='favorites'?(!!e.publicationId&&prefs.publicationFavourites?.includes(e.publicationId)):section==='watching'?(!!e.publicationId&&prefs.publicationWatches?.some(w=>w.publicationId===e.publicationId)):true)
  &&(filters.period!=='recent'||['published','revised'].includes(e.status)))
  .sort((a,b)=>(a.date??'9999').localeCompare(b.date??'9999')||(a.time??'').localeCompare(b.time??'')||a.id.localeCompare(b.id))
}

export function publicationEntry(publication:PublicationData,concept:Semantic|null,timeZone:string):Entry{
 const t=timing(null,publication,timeZone),retained=publication as PublicationData&{knownAt?:string;observation?:{sourceRetrievedAt:string}}
 return{id:publication.publicationId,publicationId:publication.publicationId,title:concept?.data.namePl??publication.title,originalTitle:publication.title,description:concept?.data.description??null,relevanceReasons:[],region:concept?.data.geography??'Nieustalony',topics:concept?.data.taxonomy??[],...t,provider:publication.source.provider,sourceUrl:safeUrl(publication.sourceUrl),status:'unresolved',event:null,publication,meaning:concept,readings:[],observedAt:retained.knownAt??null,sourceRetrievedAt:retained.observation?.sourceRetrievedAt??null,licenceRef:publication.source.licenceRef,evidenceLoaded:true}
}
export function evidenceEntry(value:{event:CalendarEvent;results:Reading[];meaning:Array<{concept:Semantic|null;certainty:string;mapping:Semantic}>},timeZone:string,definitions:Semantic[]=[]):Entry{
 const meaning=value.meaning.find(m=>m.certainty==='CONFIRMED'),event=value.event
 const context={items:[{eventId:event.eventId,event,knownAt:event.knownAt,concept:meaning?.concept??null,mapping:meaning?.mapping,results:value.results,relevance:[]}],unresolvedSchedules:[],definitions,coverage:{completeness:'UNKNOWN'},nextAfter:null} as Context
 return{...entriesFrom({events:[event],publications:[],context,more:{events:null,publications:null,context:null}},timeZone)[0],evidenceLoaded:true}
}
