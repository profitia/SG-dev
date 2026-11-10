import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';

const fold=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('pl-PL').replace(/\s+/gu,' ').trim();
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const day=(value,zone)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const utcDay=value=>new Date(value+'T00:00:00Z');
/** @param {Array<{id:string,kind:string,headline?:string|null,publishedAt?:string|null,detectedAt?:string|null}>} publications
 * @param {{phrases?:string[],weeks?:number,timeZone?:string,dateBasis?:string,asOf?:string}} options */
export function publicationStatistics(publications,{phrases,weeks=4,timeZone='Europe/Warsaw',dateBasis='publishedAt',asOf=new Date().toISOString()}={}){
 if(!Array.isArray(publications)||!Array.isArray(phrases)||phrases.length<1||phrases.length>20||![4,8].includes(weeks)||!['publishedAt','detectedAt'].includes(dateBasis)||!Number.isFinite(Date.parse(asOf)))throw new SourceHubError('INVALID_STATISTICS_QUERY');
 try{day(asOf,timeZone);}catch{throw new SourceHubError('INVALID_TIME_ZONE');}
 const normalized=phrases.map(fold);
 if(normalized.some(x=>!x||x.length>200)||new Set(normalized).size!==normalized.length)throw new SourceHubError('INVALID_STATISTICS_PHRASES');
 const tests=normalized.map(p=>new RegExp('(^|[^\\p{L}\\p{N}])'+escape(p)+'($|[^\\p{L}\\p{N}])','u'));
 const end=day(asOf,timeZone),start=utcDay(end),weekday=(start.getUTCDay()+6)%7;
 start.setUTCDate(start.getUTCDate()-weekday-(weeks-1)*7);
 const dates=[];for(let d=new Date(start);d<=utcDay(end);d.setUTCDate(d.getUTCDate()+1))dates.push(d.toISOString().slice(0,10));
 const buckets=new Map(dates.map(date=>[date,{date,total:0,counts:normalized.map(()=>0)}]));
 const seen=new Set();let total=0,undated=0;const counts=normalized.map(()=>0);
 for(const p of publications){
  if(!p||!['NEWS_ARTICLE','WEB_PAGE'].includes(p.kind)||typeof p.id!=='string'||seen.has(p.id))continue;
  seen.add(p.id);
  // Counts are lexical matches in the permitted indexed title, not inferred
  // article content or a claim that the provider executed a Boolean operator.
  const title=fold(p.headline),matches=tests.map(re=>re.test(title));if(!matches.some(Boolean))continue;
  const value=dateBasis==='publishedAt'?p.publishedAt:p.detectedAt;
  if(!value||!Number.isFinite(Date.parse(value))){undated++;continue;}
  if(Date.parse(value)>Date.parse(asOf))continue;
  const bucket=buckets.get(day(value,timeZone));if(!bucket)continue;
  total++;bucket.total++;matches.forEach((yes,i)=>{if(yes){counts[i]++;bucket.counts[i]++;}});
 }
 return {contractVersion:'newsfeed-statistics/1.0.0',dateBasis,timeZone,asOf,fromDate:dates[0],throughDate:end,weeks,weekBoundary:'MONDAY_LOCAL',currentWeekPartial:true,
  matchBasis:'INDEXED_TITLE_LITERAL_PHRASE',coverage:'INDEX_ONLY_PROVIDER_COMPLETENESS_UNKNOWN',
  status:seen.size?(undated?'PARTIAL':'AVAILABLE'):'NO_HISTORY',phrases:phrases.map((label,i)=>({phrase:label.trim(),count:counts[i]})),total,undated,days:seen.size?[...buckets.values()]:[]};
}
