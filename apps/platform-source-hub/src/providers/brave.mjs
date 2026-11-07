import {fields,text,list,integer,day,domain,optionalText,url,providerJson,credential,record,result,fail} from '../transport.mjs';
export const BRAVE_ORIGIN='https://api.search.brave.com';
export const BRAVE_PATH='/res/v1/web/search';
export const BRAVE_COUNTRIES=Object.freeze(['ALL','AR','AU','AT','BE','BR','CA','CL','DK','FI','FR','DE','GR','HK','IN','ID','IT','JP','KR','MY','MX','NL','NZ','NO','CN','PL','PT','PH','RU','SA','ZA','ES','SE','CH','TW','TR','GB','US']);
export const BRAVE_LANGUAGES=Object.freeze(['ar','eu','bn','bg','ca','zh-hans','zh-hant','hr','cs','da','nl','en','et','fi','fr','gl','de','el','gu','he','hi','hu','is','it','jp','kn','ko','lv','lt','ms','ml','mr','nb','pl','pt','pa','ro','ru','sr','sk','sl','es','sv','ta','te','th','tr','uk','vi']);
export function prepareBrave(criteria){
 fields(criteria,['text','resultType','country','language','uiLanguage','freshness','count','offset','safeSearch','spellcheck','extraSnippets','domains','excludedDomains']);
 const c=structuredClone(criteria),kind=c.resultType??'web';if(!['web','news'].includes(kind))fail('UNSUPPORTED_CRITERIA');
 let q=text(c.text,600);if(q.split(/\s+/).length>75)fail();
 const included=c.domains===undefined?[]:list(c.domains).map(domain),excluded=c.excludedDomains===undefined?[]:list(c.excludedDomains).map(domain);
 if(included.some(d=>excluded.includes(d)))fail('INCOMPATIBLE_CRITERIA');
 if(included.length)q+=' ('+included.map(d=>'site:'+d).join(' OR ')+')';if(excluded.length)q+=' '+excluded.map(d=>'NOT site:'+d).join(' ');
 if(q.length>600||q.split(/\s+/).length>75)fail();
 const p=new URLSearchParams({q,result_filter:kind,text_decorations:'false',operators:'true'});
 if(c.country!==undefined){const v=text(c.country).toUpperCase();if(!BRAVE_COUNTRIES.includes(v))fail('UNSUPPORTED_CRITERIA');p.set('country',v);}
 if(c.language!==undefined){if(!BRAVE_LANGUAGES.includes(c.language))fail('UNSUPPORTED_CRITERIA');p.set('search_lang',c.language);}
 if(c.uiLanguage!==undefined){const v=text(c.uiLanguage,10);if(!/^[a-z]{2}-[A-Z]{2}$/.test(v))fail();p.set('ui_lang',v);}
 if(c.safeSearch!==undefined){if(!['off','moderate','strict'].includes(c.safeSearch))fail();p.set('safesearch',c.safeSearch);}
 for(const [key,param]of [['spellcheck','spellcheck'],['extraSnippets','extra_snippets']])if(c[key]!==undefined){if(typeof c[key]!=='boolean')fail();p.set(param,String(c[key]));}
 if(c.freshness!==undefined){const v=text(c.freshness,24);if(!['pd','pw','pm','py'].includes(v)){const parts=v.split('to');if(parts.length!==2||day(parts[0])>day(parts[1]))fail();}p.set('freshness',v);}
 if(kind==='news'&&(c.count!==undefined||c.offset!==undefined))fail('UNSUPPORTED_CRITERIA');
 const count=kind==='web'?integer(c.count??20,1,20):null,offset=kind==='web'?integer(c.offset??0,0,9):null;
 if(kind==='web'){p.set('count',String(count));p.set('offset',String(offset));}
 return {url:BRAVE_ORIGIN+BRAVE_PATH+'?'+p.toString(),kind,count,offset,included,excluded};
}
/** @param {{apiKey?:string,fetchImpl?:Function,now?:()=>string}} options */
export function createBraveProvider({apiKey,fetchImpl,now=()=>new Date().toISOString()}={}){
 const key=credential(apiKey);
  return Object.freeze({/** @param {any} criteria @param {{signal?:AbortSignal}} options */
 async search(criteria,{signal=undefined}={}){
  const plan=prepareBrave(criteria),raw=await providerJson(fetchImpl,plan.url,{'X-Subscription-Token':key},{signal});
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.type==='ErrorResponse')fail('INVALID_RESPONSE',502);
  if(typeof raw.type!=='string'||!raw.query||typeof raw.query!=='object')fail('INVALID_RESPONSE',502);
  const group=raw[plan.kind];if(group===undefined)fail('CAPABILITY_NOT_CONFIRMED',503);if(!group||!Array.isArray(group.results))fail('INVALID_RESPONSE',502);
  const rows=group.results;if(rows.length>1000)fail('RESPONSE_TOO_LARGE',502);const retrievedAt=now();
  const items=rows.map(row=>{
   const sourceUrl=url(row.url,true);let publishedAt=null;
   // Page-age dates can describe publication OR modification. Never label them as publication.
   const payload={kind:plan.kind==='news'?'NEWS_ARTICLE':'WEB_PAGE',title:optionalText(row.title),description:optionalText(row.description),url:sourceUrl,
    publisher:row.meta_url?{id:null,name:optionalText(row.meta_url.hostname)}:null,publishedAt,modifiedAt:null,indexedAt:null,language:null,publisherCountry:null,eventGeography:null,
    providerDateMetadata:{age:optionalText(row.age),pageAge:optionalText(row.page_age)},extraSnippets:Array.isArray(row.extra_snippets)?row.extra_snippets.map(optionalText):[]};
   return record('news-discovery','brave','res/v1/web/search',payload,{retrievedAt,sourceUrl});
  }).filter(item=>{const host=new URL(item.payload.url).hostname.toLowerCase();const matches=d=>host===d||host.endsWith('.'+d);return (!plan.included.length||plan.included.some(matches))&&!plan.excluded.some(matches);});
  const answer=result('news-discovery','brave',items,{retrievedAt,page:plan.offset===null?null:plan.offset+1,pageSize:plan.count,more:plan.kind==='web'&&typeof raw.query?.more_results_available==='boolean'?raw.query.more_results_available:null});
  answer.coverage={scope:'PROVIDER_RETURNED_SUBSET',completeness:'UNKNOWN',providerReturned:rows.length,matchedLocally:items.length,returned:items.length,nativeFilters:Object.keys(criteria).filter(k=>!['text','domains','excludedDomains'].includes(k)),localFilters:[...(plan.included.length?['domains']:[]),...(plan.excluded.length?['excludedDomains']:[])],operatorSemantics:'EXPERIMENTAL_UNVERIFIED',providerQueryAltered:typeof raw.query.altered==='string'&&typeof raw.query.original==='string'?raw.query.altered!==raw.query.original:null};
  return answer;
 }});
}
