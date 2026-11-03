import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createNewsApiProvider,DiscoveryError} from '../src/newsapi.mjs';

// No credentials in arguments, URL, request log, evidence or exception details.
// Deliberately sequential: maximum 24 provider calls, no retry, stop on auth/quota/rate failures.
const output = fileURLToPath(new URL('../docs/newsapi-live-evidence.json',import.meta.url));
const key = process.env.NEWSAPI_API_KEY?.trim();
const report = {schemaVersion:'1.0',provider:'newsapi',targetEnvironment:'development',startedAt:new Date().toISOString(),status:'IN_PROGRESS',accountPlan:'NOT_VERIFIED',requestBudget:24,requestsPerformed:0,articleContentsPersisted:false,keyPersisted:false,qualityOrPolishCoverageEvaluated:false,cases:[]};
const save = async()=>fs.writeFile(output,JSON.stringify(report,null,2)+'\n',{mode:0o644});
if (process.env.TARGET_ENVIRONMENT !== 'development' || !key) {
  report.status = key ? 'BLOCKED_ENVIRONMENT' : 'BLOCKED_MISSING_CREDENTIAL';
  await save();console.log(JSON.stringify({status:report.status,requestsPerformed:0}));process.exitCode=2;
} else {
  let stop=false,lastEvent=null;
  const boundedFetch=async(url,options)=>{if(report.requestsPerformed>=report.requestBudget)throw new DiscoveryError('PROBE_BUDGET_EXHAUSTED');report.requestsPerformed++;return fetch(url,options);};
  const provider=createNewsApiProvider({apiKey:key,targetEnvironment:'development',fetchImpl:boundedFetch,onEvent:event=>{lastEvent=event;}});
  const current=new Date(),before=new Date(current.getTime()-86400000).toISOString(),after=new Date(current.getTime()-8*86400000).toISOString();
  const interval={publishedAfter:after,publishedBefore:before,pageSize:5};
  report.articleWindow={publishedAfter:after,publishedBefore:before,meaning:'seven available days ending24 hours before this probe; not a verified account-plan entitlement'};
  const record = async(id,operation,run,check=()=>[])=>{
    if(stop||report.requestsPerformed>=report.requestBudget)return null;
    const entry={id,operation,checkedAt:new Date().toISOString(),outcome:'PENDING'};report.cases.push(entry);lastEvent=null;
    try{
      const result=await run();const items=result.items;
      entry.outcome=items.length?'ACCEPTED_WITH_RESULTS':'ACCEPTED_EMPTY';entry.returnedCount=items.length;entry.totalAvailable=result.totalAvailable??null;entry.httpStatus=lastEvent?.httpStatus??200;
      entry.returnedModelFields=items.length?Object.keys(items[0]).sort():[];
      entry.fieldRepresentation=operation.startsWith('raw-')?'PROVIDER_RESPONSE':'NEUTRAL_CONNECTOR_MODEL';
      entry.constraintViolations=check(result);
      entry.semanticEvidence=operation==='raw-negative'?'NO_SUPPORTED_FILTER_CLAIM':items.length?'CHECK_AVAILABLE_RETURNED_FIELDS':'NOT_PROVEN_EMPTY';
      if(entry.constraintViolations.length)entry.outcome='OBSERVED_FILTER_MISMATCH';
      return result;
    }catch(error){
      const safe=error instanceof DiscoveryError?error.toJSON():{code:'PROBE_ERROR'};
      entry.outcome='ERROR';entry.error=safe;
      if(['AUTHENTICATION_FAILED','QUOTA_EXHAUSTED','RATE_LIMITED','INVALID_CONFIGURATION','DEVELOPMENT_ONLY'].includes(safe.code))stop=true;
      return null;
    }finally{await save();}
  };
  const sourceCheck=criteria=>result=>result.items.flatMap(s=>Object.entries(criteria).filter(([field,value])=>s[field]!==value).map(([field])=>field));
  const dateCheck=result=>result.items.flatMap(item=>!item.publishedAt?['missingPublishedAt']:Date.parse(item.publishedAt)<Date.parse(after)||Date.parse(item.publishedAt)>Date.parse(before)?['publicationDateOutsideWindow']:[]);
  const newestCheck=result=>dateCheck(result).concat(result.items.some((a,i,items)=>i>0&&Date.parse(items[i-1].publishedAt)<Date.parse(a.publishedAt))?['orderNotDescending']:[]);
  const domainCheck=(include=[],exclude=[])=>result=>dateCheck(result).concat(result.items.flatMap(item=>{
    const host=new URL(item.url).hostname.toLowerCase();const matches=d=>host===d||host.endsWith('.'+d);
    return [...(include.length&&!include.some(matches)?['articleUrlDoesNotMatchSelectedDomain']:[]),...(exclude.some(matches)?['articleUrlMatchesExcludedDomain']:[])];
  }));
  const publisherCheck=ids=>result=>dateCheck(result).concat(result.items.some(item=>item.publisher.id!==null&&!ids.includes(item.publisher.id))?['returnedPublisherIdOutsideSelection']:[]);
  // Raw probes are isolated negative/undocumented-behaviour experiments. They do not bypass
  // or extend supported connector criteria, even if a provider accepts an unknown parameter.
  const raw=async(endpoint,params)=>{
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
    try{
      const r=await boundedFetch('https://newsapi.org/v2/'+endpoint+'?'+new URLSearchParams(params),{headers:{'X-Api-Key':key,Accept:'application/json'},redirect:'error',signal:controller.signal});
      let body;try{body=await r.json();}catch{throw new DiscoveryError('INVALID_RESPONSE',[],r.status);}const known=['apiKeyDisabled','apiKeyExhausted','apiKeyInvalid','apiKeyMissing','rateLimited','parameterInvalid','parametersMissing','sourcesTooMany','sourceDoesNotExist','maximumResultsReached','parameterRequired','parameterValueInvalid'];
      if(!r.ok||body.status!=='ok'){
        const code=known.includes(body.code)?body.code:null;
        const kind=code==='apiKeyExhausted'?'QUOTA_EXHAUSTED':r.status===401||['apiKeyDisabled','apiKeyInvalid','apiKeyMissing'].includes(code)?'AUTHENTICATION_FAILED':r.status===429?'RATE_LIMITED':r.status===426?'PLAN_RESTRICTED':code==='maximumResultsReached'?'PLAN_LIMIT':'PROVIDER_REJECTED_CRITERIA';
        throw new DiscoveryError(kind,[],r.status,code);
      }
      lastEvent={httpStatus:r.status};return {items:body.articles??body.sources??[],totalAvailable:body.totalResults??null};
    }catch(e){if(e instanceof DiscoveryError)throw e;throw new DiscoveryError(controller.signal.aborted?'TIMEOUT':'NETWORK_ERROR');}finally{clearTimeout(timer);}
  };
  try{
    const catalogue=await record('sources-all','publishers',()=>provider.listPublishers());
    if(catalogue)report.publisherCatalogue={count:catalogue.items.length,countries:[...new Set(catalogue.items.map(s=>s.publisherCountry))].sort(),languages:[...new Set(catalogue.items.map(s=>s.language))].sort(),polishPublishers:catalogue.items.filter(s=>s.publisherCountry==='pl').map(({id,name,language,publisherCountry})=>({id,name,language,publisherCountry}))};
    await record('sources-business-en-gb','publishers',()=>provider.listPublishers({category:'business',language:'en',publisherCountry:'gb'}),sourceCheck({category:'business',language:'en',publisherCountry:'gb'}));
    await record('sources-poland','publishers',()=>provider.listPublishers({publisherCountry:'pl'}),sourceCheck({publisherCountry:'pl'}));
    await record('sources-pl-language-undocumented','raw-negative',()=>raw('top-headlines/sources',{language:'pl'}));
    await record('headlines-us-business','headlines',()=>provider.search({mode:'headlines',category:'business',editionCountry:'us',pageSize:5}));
    await record('headlines-pl-business-undocumented','raw-negative',()=>raw('top-headlines',{country:'pl',category:'business',q:'budownictwo',pageSize:'5'}));
    const allPublishers=catalogue?.items??[];
    const ids=[...new Set([...allPublishers.filter(s=>['bbc-news','reuters','associated-press','business-insider'].includes(s.id)),...allPublishers].map(s=>s.id))].slice(0,2);
    report.selectedPublisherIds=ids;
    report.skippedCases=ids.length?[]:['headlines-publishers','headlines-conflicting-filters','everything-multiple-publishers'];
    if(ids.length){
      await record('headlines-publishers','headlines',()=>provider.search({mode:'headlines',publisherIds:ids,pageSize:5}));
      await record('headlines-conflicting-filters','raw-negative',()=>raw('top-headlines',{sources:ids.join(','),country:'us',category:'business',pageSize:'5'}));
    }
    await record('everything-company','articles',()=>provider.search({mode:'articles',text:'Budimex',...interval,order:'newest'}),newestCheck);
    await record('everything-exact-phrase','articles',()=>provider.search({mode:'articles',terms:{phrases:['Budimex SA']},...interval}),dateCheck);
    await record('everything-boolean-title-description-relevance','articles',()=>provider.search({mode:'articles',text:'construction AND (investment OR contract) NOT sports',fields:['headline','summary'],language:'en',order:'relevance',...interval}),dateCheck);
    await record('everything-required-excluded-body-popularity','articles',()=>provider.search({mode:'articles',text:'+construction -sports',fields:['body'],order:'publisherPopularity',...interval}),dateCheck);
    await record('everything-domain-selection','articles',()=>provider.search({mode:'articles',text:'construction',domains:['bbc.co.uk','reuters.com'],order:'newest',...interval}),domainCheck(['bbc.co.uk','reuters.com']));
    await record('everything-domain-exclusion','articles',()=>provider.search({mode:'articles',text:'construction',excludedDomains:['bbc.co.uk'],...interval}),domainCheck([],['bbc.co.uk']));
    if(ids.length)await record('everything-multiple-publishers','articles',()=>provider.search({mode:'articles',text:'construction',publisherIds:ids,...interval}),publisherCheck(ids));
    const firstPage=await record('everything-page-one','articles',()=>provider.search({mode:'articles',text:'construction',order:'newest',...interval}),newestCheck);
    const secondPage=await record('everything-page-two','articles',()=>provider.search({mode:'articles',text:'construction',order:'newest',...interval,page:2}),newestCheck);
    if(firstPage&&secondPage)report.paginationObservation={pageOneCount:firstPage.items.length,pageTwoCount:secondPage.items.length,overlappingUrls:firstPage.items.filter(a=>secondPage.items.some(b=>a.url===b.url)).length,interpretation:'Overlap or empty pages requires interpretation; results may change and totalAvailable is not a plan entitlement.'};
    await record('everything-polish-text-no-language','articles',()=>provider.search({mode:'articles',text:'inwestycje',...interval}),dateCheck);
    await record('everything-region-text-not-geographic','articles',()=>provider.search({mode:'articles',terms:{all:['inwestycje'],any:['Mazowieckie','Mazowsze']},...interval}),dateCheck);
    await record('everything-pl-language-undocumented','raw-negative',()=>raw('everything',{q:'inwestycje',language:'pl',pageSize:'5'}));
    await record('everything-history-40-days-plan-probe','raw-plan',()=>raw('everything',{q:'construction',from:new Date(current.getTime()-40*86400000).toISOString(),to:before,pageSize:'1'}));
    await record('everything-invalid-sort','raw-negative',()=>raw('everything',{q:'construction',sortBy:'not-a-sort',pageSize:'1'}));
    await record('everything-high-page-plan-probe','raw-plan',()=>raw('everything',{q:'construction',page:'101',pageSize:'100'}));
    report.unexpectedFailures=report.cases.filter(c=>(c.operation==='articles'||c.operation==='headlines'||c.operation==='publishers')&&['ERROR','OBSERVED_FILTER_MISMATCH'].includes(c.outcome)).length;
    report.status=stop?'STOPPED_PROVIDER_LIMIT_OR_AUTH':report.unexpectedFailures||report.skippedCases.length?'COMPLETED_WITH_GAPS':'COMPLETED';
    report.completedAt=new Date().toISOString();
    report.interpretation='ACCEPTED_EMPTY proves request acceptance only. Undocumented parameters accepted by HTTP do not become supported filters. No article quality or Polish media coverage claim. Account plan and exact quota remain unverified unless independently established.';
  }catch{report.status='PROBE_FAILED';process.exitCode=1;}
  await save();console.log(JSON.stringify({status:report.status,requestsPerformed:report.requestsPerformed,cases:report.cases.map(c=>({id:c.id,outcome:c.outcome}))}));
  if(stop)process.exitCode=2;
}
