import {requireThat} from '@profitia/insights-contracts';
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
/** Filters apply before pagination, inside the existing current-E1/RLS transaction. */
export function publicationQuery(options={}){
 const {search='',markets=[],fromDate='',throughDate='',order='newest',sharedOnly=false}=options;
 requireThat(typeof search==='string'&&search.length<=200&&Array.isArray(markets)&&markets.length<=20&&markets.every(x=>typeof x==='string'&&/^[a-z0-9][a-z0-9._-]{0,99}$/.test(x))&&new Set(markets).size===markets.length,'INVALID_PUBLICATION_FILTER',400);
 requireThat((fromDate===''||date(fromDate))&&(throughDate===''||date(throughDate))&&(!fromDate||!throughDate||fromDate<=throughDate)&&['newest','oldest'].includes(order)&&typeof sharedOnly==='boolean','INVALID_PUBLICATION_FILTER',400);
 return {search:search.trim(),markets:[...markets],fromDate,throughDate,order,sharedOnly};
}
