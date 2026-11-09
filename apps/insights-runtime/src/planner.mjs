import {parseHubRequest} from '../../../packages/platform-source-hub-contracts/index.mjs';
import {addDays} from './calendar.mjs';
import {digest,requireThat} from '../../../packages/insights-contracts/index.mjs';
/** Business query plan, no credentials or provider transports. Unadmitted sources
 * are recorded as unavailable rather than silently activated. */
export function planData(job){const {period}=job.command,end=job.command.asOf.slice(0,10),start=addDays(period.fromDate,-21);
 const mk=(id,provider,family,operation,criteria,contractVersion='1.0.0')=>({id,command:parseHubRequest({contractVersion,provider,family,operation,criteria})});
 const queries=[mk('te-snapshot','trading-economics','market-observations','search',{mode:'snapshot',symbols:['CL1:COM','CO1:COM','BIT:COM'],limit:10}),
 mk('te-history','trading-economics','market-observations','search',{mode:'historical',symbols:['CL1:COM','CO1:COM','BIT:COM'],from:start,to:end,limit:120}),
 mk('news','newsapi','news-discovery','search',{mode:'articles',text:'oil OR crude OR bitumen OR asphalt',publishedAfter:period.fromDate+'T00:00:00Z',publishedBefore:job.command.asOf,language:'en',order:'newest',page:1,pageSize:25}),
 mk('brave','brave','news-discovery','search',{text:'oil bitumen refinery supply OPEC demand',count:15}),
 mk('te-news','trading-economics','news-discovery','search',{newsType:'markets',from:period.fromDate,to:end,text:'oil',limit:25}),
 mk('te-macro','trading-economics','indicators','search',{countries:['United States','China'],indicators:['Manufacturing PMI'],limit:10}),
 ...[['stocks','petroleum/stoc/wstk',['WCESTUS1','WDISTUS1']],['refinery','petroleum/pnp/wiup',['WPULEUS3','WCRRIUS2']],['supplied','petroleum/cons/wpsup',['WGFUPUS2','WDIUPUS2']]].map(([id,path,series])=>mk('eia-'+id,'eia','series-observations','observations',{path,frequency:'weekly',data:['value'],facets:{series},start,end,limit:12},'1.1.0')),
 mk('cftc','cftc','positioning-observations','observations',{datasetId:'72hh-3qpy',filters:[{field:'cftc_contract_market_code',op:'eq',value:'067651'}],orderBy:'report_date_as_yyyy_mm_dd',direction:'desc',limit:10},'1.1.0'),
 mk('calendar','commodities-sh','publication-calendar','calendar',{limit:100},'1.1.0')];
 requireThat(!queries.some(q=>q.command.family==='economic-calendar'||q.command.family==='external-forecasts'),'EXCLUDED_FAMILY');
 return {version:'oil-planner/1.0',queries:queries.map(q=>({...q,requestHash:digest(q.command)})),marketSeries:['cl_c1_cl','b_c1_cl'],forecastHorizon:'7D',asOf:job.command.asOf}}
