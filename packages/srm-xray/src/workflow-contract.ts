import type {SectionEnvelope, GeneralCompanyData, FinancialData, VerclyKysData, JdgRegistryData, SupplierIdentity, SupplierReportData} from './contracts';
import type {SupplierSelection} from './supplier-search';

/** Wire projection deliberately permits absent source; absence is not invented provenance. */
export type PublicSection<T> = Omit<SectionEnvelope<T>, 'source'> & {source?: SectionEnvelope<T>['source']};
export type XRayDisplayCard = {identity:SupplierIdentity;general:PublicSection<GeneralCompanyData>;financial:PublicSection<FinancialData>;kys:PublicSection<VerclyKysData>};
export type XRaySearchResult = ({entityType:'COMPANY';card:XRayDisplayCard}|{entityType:'JDG';nip:string;section:PublicSection<JdgRegistryData>}) & {
 registryRoute?:{provider:'MGBI'|'KRS';fallbackReason?:string};krsSelection?:SupplierSelection};
export const XRAY_WORKFLOW_CONTRACT = Object.freeze({id:'profitia.srm-xray.workflow',version:'1.0.0'} as const);
export const XRAY_OPERATIONS = Object.freeze({search:'/api/xray/search',report:'/api/xray/report-data',kys:'/api/xray/kys',jdgKys:'/api/xray/jdg/kys',krsLookup:'/api/xray/krs/lookup'} as const);
export type XRayOperation = keyof typeof XRAY_OPERATIONS;
export const XRAY_RESPONSE_BYTES = 8*1024*1024;
export const XRAY_REQUEST_BYTES = 2048;
export function xrayOperation(path:string):XRayOperation|null {return (Object.keys(XRAY_OPERATIONS) as XRayOperation[]).find(key=>XRAY_OPERATIONS[key]===path)??null;}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&Object.getPrototypeOf(v)===Object.prototype;
function requireValue(ok:unknown):asserts ok {if(!ok)throw Error('XRAY_CONTRACT_INVALID');}
const text=(v:unknown)=>typeof v==='string'&&v.length<=65536;
const nullableText=(v:unknown)=>v===null||text(v);
const strings=(v:unknown)=>Array.isArray(v)&&v.length<=4096&&v.every(text);
const date=(v:unknown)=>v===null||typeof v==='string'&&/^\d{4}-\d\d-\d\d(?:T.*)?$/.test(v)&&Number.isFinite(Date.parse(v));
const statuses=['SUCCESS','EMPTY','PARTIAL','ERROR','NOT_REQUESTED','PENDING'];
const list=(v:unknown,check:(item:unknown)=>void,max=10000)=>{requireValue(Array.isArray(v)&&v.length<=max);v.forEach(check);};
function record(v:unknown,fields:readonly string[],optional:readonly string[]=[]):asserts v is Record<string,unknown>{requireValue(object(v)&&fields.every(key=>Object.hasOwn(v,key))&&Object.keys(v).every(key=>fields.includes(key)||optional.includes(key)));}
function safeTree(value:unknown,depth=0):void {
 requireValue(depth<32);
 if(value===null||typeof value==='boolean')return;
 if(typeof value==='string'){requireValue(value.length<=65536);return;}
 if(typeof value==='number'){requireValue(Number.isFinite(value));return;}
 if(Array.isArray(value)){requireValue(value.length<=20000);value.forEach(v=>safeTree(v,depth+1));return;}
 requireValue(object(value)&&Object.keys(value).length<=128);
 for(const [key,v] of Object.entries(value)){requireValue(!['__proto__','prototype','constructor'].includes(key));safeTree(v,depth+1);}
}
export function validateXRayCommand(operation:XRayOperation,value:unknown):void {
 const fields=operation==='report'?['nip','entityType']:operation==='krsLookup'?['selectionRef']:['identifier'];record(value,fields);
 if(operation==='krsLookup')requireValue(typeof value.selectionRef==='string'&&/^KRS:[0-9]{10}:[a-f0-9]{64}$/.test(value.selectionRef));
 else {requireValue(typeof value[operation==='report'?'nip':'identifier']==='string'&&/^\d{10}$/.test(value[operation==='report'?'nip':'identifier'] as string));
 if(operation==='report')requireValue(['COMPANY','JDG'].includes(value.entityType as string));}
}
function general(v:unknown):void {
 record(v,['legalName','legalForm','krs','nip','regon','registeredAddress','registeredAt','mainPkd'],['registrySource','registrationStatus','deregisteredAt','mainPkdDescription','website','registryHistory']);
 for(const key of ['legalName','legalForm','krs','nip','regon','registeredAddress','registeredAt','mainPkd','deregisteredAt','mainPkdDescription','website'])if(Object.hasOwn(v,key))requireValue(nullableText(v[key]));
 if(v.registrySource){record(v.registrySource,['provider','evidenceRef','retrievedAt','coverage']);requireValue(v.registrySource.provider==='KRS'&&text(v.registrySource.evidenceRef)&&date(v.registrySource.retrievedAt)&&v.registrySource.coverage==='PROGRESSIVE');}
 if(v.registryHistory){const h=v.registryHistory;record(h,['version','currentKrs','members','links','unlinkedKrs']);requireValue(h.version==='KRS_CONTINUITY_V1'&&text(h.currentKrs)&&strings(h.unlinkedKrs));list(h.members,m=>{record(m,['krs','legalName','legalForm','registeredAt','deregisteredAt','status']);requireValue(text(m.krs)&&nullableText(m.legalName)&&nullableText(m.legalForm)&&date(m.registeredAt)&&date(m.deregisteredAt)&&['ACTIVE','LIQUIDATION','DEREGISTERED','UNKNOWN'].includes(m.status as string));});list(h.links,l=>{record(l,['predecessorKrs','successorKrs','basis']);requireValue(text(l.predecessorKrs)&&text(l.successorKrs)&&l.basis==='KRS_FORMATION_TRANSFORMATION');});}

}
function financial(v:unknown):void {
 record(v,['periods'],['indicators','qualityRule','registryHistoryVersion','revisionRule']);
 list(v.periods,p=>{record(p,['from','to','scope','documentId','facts'],['comparativeData','sourceRegistration','effectiveRevisionId','revisionStatus','accountingStandard','accountingStandardBasis','isIasCompliant','xmlSchema','msrRows']);requireValue(object(p)&&text(p.from)&&date(p.from)&&text(p.to)&&date(p.to)&&['standalone','consolidated'].includes(p.scope as string)&&text(p.documentId));
 if(p.sourceRegistration)sourceRegistration(p.sourceRegistration);
 list(p.facts,f=>{record(f,['metricCode','amount','currency','unit']);requireValue(Object.values(f).every(text));});
 if(p.xmlSchema){record(p.xmlSchema,['name','version']);requireValue(nullableText(p.xmlSchema.name)&&nullableText(p.xmlSchema.version));}
 if(p.msrRows)list(p.msrRows,row=>{record(row,['key','label','section','amount','currency','unit','validation','dimensions']);requireValue(object(row)&&text(row.key)&&text(row.label)&&text(row.section)&&nullableText(row.amount)&&nullableText(row.currency)&&text(row.unit)&&strings(row.dimensions)&&['VALID','REVIEW'].includes(row.validation as string));});
 if(p.comparativeData)comparatives(p.comparativeData);
 });
 if(v.indicators)list(v.indicators,item=>indicator(item));
}
function person(v:unknown):void {
 record(v,['fullName','pesel','birthDate','positions','citizenship','foundIn','sanctionsMatch','pepMatch'],['peselRevealToken']);
 requireValue(text(v.fullName)&&v.pesel===null&&nullableText(v.birthDate)&&strings(v.positions)&&strings(v.citizenship)&&strings(v.foundIn));
 for(const key of ['sanctionsMatch','pepMatch'])requireValue(v[key]===null||typeof v[key]==='boolean');
 if(v.peselRevealToken!==undefined)requireValue(nullableText(v.peselRevealToken));
}
function kys(v:unknown):void {
 record(v,['correlationId','reportId','isComplete','queriedRegisters','stateAsOf'],['registryChecks','company','screenedLists','screeningSummary','relatedEntities','beneficialOwners','relatedPersons','beneficialOwnersCount','relatedPersonsCount','pepPositionsCount','pepMatches','riskLevel']);
 requireValue(nullableText(v.correlationId)&&nullableText(v.reportId)&&typeof v.isComplete==='boolean'&&strings(v.queriedRegisters)&&nullableText(v.stateAsOf));
 for(const key of ['beneficialOwners','relatedPersons'])if(v[key]!==undefined)list(v[key],person);
 if(v.company){record(v.company,['name','krs','nip','regon','legalForm','address','country','activityStatus','registeredAt','lastChangedAt','mainPkd','shareCapital','representation'],['district','municipality','voivodship','headquarterCountry','createdAt','commencedAt','registerAuthority','ownershipForm','phone']);requireValue(Object.values(v.company).every(nullableText));}
 for(const key of ['registryChecks','screeningSummary'])if(v[key]){record(v[key],[],key==='registryChecks'?['krzListed','vatActive','euVat']:['directlyRelatedSanctions','beneficiaryRelatedSanctions','otherLists']);requireValue(Object.values(v[key]).every(x=>x===null||typeof x==='boolean'));}
 if(v.screenedLists)list(v.screenedLists,row=>{record(row,['name','type','matched']);requireValue(object(row)&&text(row.name)&&text(row.type)&&typeof row.matched==='boolean');});
 if(v.relatedEntities)list(v.relatedEntities,row=>{record(row,['name','role','krs','nip','regon','relationshipStart','relationshipEnd','stakeDescription','sanctionsMatch']);requireValue(object(row)&&text(row.name)&&['role','krs','nip','regon','relationshipStart','relationshipEnd','stakeDescription'].every(k=>nullableText(row[k]))&&(row.sanctionsMatch===null||typeof row.sanctionsMatch==='boolean'));});
 for(const key of ['beneficialOwnersCount','relatedPersonsCount','pepPositionsCount'])if(v[key]!==undefined)requireValue(v[key]===null||Number.isSafeInteger(v[key])&&Number(v[key])>=0);
 if(v.riskLevel!==undefined)requireValue(nullableText(v.riskLevel));
 if(v.pepMatches)list(v.pepMatches,row=>{record(row,['personGroup','personIndex','personName','searchPhrase','matchedName','aliases','birthDate','positions','probabilityPercent','identifierMatchesPesel']);requireValue(object(row)&&['beneficialOwners','relatedPersons'].includes(row.personGroup as string)&&Number.isInteger(row.personIndex)&&Number(row.personIndex)>=0&&text(row.personName)&&nullableText(row.searchPhrase)&&nullableText(row.matchedName)&&strings(row.aliases)&&nullableText(row.birthDate)&&strings(row.positions)&&typeof row.identifierMatchesPesel==='boolean'&&(row.probabilityPercent===null||typeof row.probabilityPercent==='number'&&row.probabilityPercent>=0&&row.probabilityPercent<=100));});
}
function jdg(v:unknown):void {
 record(v,['entries']);const field=(f:unknown):void=>{record(f,['key','label','value','children']);requireValue(text(f.key)&&text(f.label)&&nullableText(f.value));list(f.children,field,1000);};
 list(v.entries,e=>{record(e,['recordId','name','status','nip','regon','fields']);requireValue(text(e.recordId)&&text(e.name)&&nullableText(e.status)&&text(e.nip)&&nullableText(e.regon));list(e.fields,field,1000);},1000);
}
function section(v:unknown,data:(v:unknown)=>void):void {
 record(v,['status','retrievedAt','effectiveAt','data','warnings'],['source']);requireValue(statuses.includes(v.status as string)&&date(v.retrievedAt)&&date(v.effectiveAt)&&strings(v.warnings));
 if(v.data!==null)data(v.data);
 if(v.source){record(v.source,['provider','model','recordId']);requireValue(['MGBI','VERCLY','CEIDG','KRS'].includes(v.source.provider as string)&&text(v.source.model)&&nullableText(v.source.recordId));}
}
export function validateXRaySearch(value:unknown):asserts value is XRaySearchResult {
 requireValue(object(value));
 if(value.entityType==='JDG'){record(value,['entityType','nip','section'],['registryRoute']);requireValue(typeof value.nip==='string'&&/^\d{10}$/.test(value.nip));section(value.section,jdg);}
 else {record(value,['entityType','card'],['registryRoute','krsSelection']);requireValue(value.entityType==='COMPANY');record(value.card,['identity','general','financial','kys']);record(value.card.identity,['krs','nip','name']);requireValue(Object.values(value.card.identity).every(nullableText));section(value.card.general,general);section(value.card.financial,financial);section(value.card.kys,kys);requireValue(object(value.card.kys)&&value.card.kys.data===null);}
 if(value.registryRoute){record(value.registryRoute,['provider'],['fallbackReason']);requireValue(['KRS','MGBI'].includes(value.registryRoute.provider as string));if(value.registryRoute.fallbackReason!==undefined)requireValue(text(value.registryRoute.fallbackReason));}
 if(value.krsSelection){record(value.krsSelection,['krs','nip','name','locality','selectionRef']);requireValue(['krs','nip','name','selectionRef'].every(k=>text((value.krsSelection as Record<string,unknown>)[k]))&&nullableText(value.krsSelection.locality));}
}
function indicator(v:unknown,extra:readonly string[]=[]):void {
 record(v,['code','periodStart','periodEnd','scope','status','value','unit','importance','reasonCode','formulaVersion',...extra]);
 requireValue(text(v.code)&&text(v.periodStart)&&date(v.periodStart)&&text(v.periodEnd)&&date(v.periodEnd)&&['standalone','consolidated'].includes(v.scope as string)&&['AVAILABLE','UNAVAILABLE'].includes(v.status as string)&&nullableText(v.value)&&['RATIO','PERCENT','PLN','DAYS'].includes(v.unit as string)&&[1,2,3].includes(v.importance as number)&&nullableText(v.reasonCode)&&text(v.formulaVersion));
}
function evidence(v:unknown):void {
 record(v,['ref','documentRef','metricCode','periodStart','periodEnd','scope','amount','sourceAmount','currency','unit','validation','normalization','normalizationRule','reasonCode']);
 requireValue(['ref','documentRef','metricCode','amount','currency','unit'].every(k=>text(v[k]))&&text(v.periodStart)&&date(v.periodStart)&&text(v.periodEnd)&&date(v.periodEnd)&&['standalone','consolidated'].includes(v.scope as string)&&nullableText(v.sourceAmount)&&nullableText(v.normalizationRule)&&nullableText(v.reasonCode)&&['VERIFIED','UNVERIFIED','UNAVAILABLE'].includes(v.validation as string)&&['NORMALIZED_CONFIRMED','SOURCE_VALUE','SOURCE_UNCONFIRMED','UNKNOWN'].includes(v.normalization as string));
}
function freshness(v:unknown):void {
 record(v,['retrievedAt','checkedAt','cacheExpiresAt','retentionUntil','freshness','readSource','lastRetrievalMethod']);
 requireValue(['retrievedAt','checkedAt','cacheExpiresAt','retentionUntil'].every(k=>date(v[k]))&&['FRESH','EXPIRED','UNKNOWN','ABSENT'].includes(v.freshness as string)&&v.readSource==='STORED'&&['PROVIDER','CACHE','UNKNOWN'].includes(v.lastRetrievalMethod as string));
}
function scanner(v:unknown):void {
 record(v,['version','methodologyVersion','qualification','sourceVersion','periods'],['referenceFrames']);
 requireValue(['1.0','1.1'].includes(v.version as string)&&['1.0.0','2.0.0','3.0.0','4.0.0'].includes(v.methodologyVersion as string)&&['PARTIAL_SOURCE_VIEW','QUALIFIED_HISTORY'].includes(v.qualification as string)&&nullableText(v.sourceVersion));
 if(v.referenceFrames)list(v.referenceFrames,f=>{record(f,['id','scope','anchorPeriodId','asOf','qualificationRule','axes']);requireValue(text(f.id)&&text(f.scope)&&text(f.anchorPeriodId)&&text(f.asOf)&&text(f.qualificationRule));list(f.axes,a=>{record(a,['code','periodIds','bestValue','worstValue','bestPeriodIds','basisKey']);requireValue(text(a.code)&&strings(a.periodIds)&&nullableText(a.bestValue)&&nullableText(a.worstValue)&&strings(a.bestPeriodIds)&&nullableText(a.basisKey));});});
 list(v.periods,p=>{record(p,['id','from','to','scope','documentRef','axes'],['referenceFrameId']);requireValue(text(p.id)&&text(p.from)&&date(p.from)&&text(p.to)&&date(p.to)&&text(p.scope)&&text(p.documentRef));list(p.axes,a=>{record(a,['code','rawValue','unit','normalizedScore','basis','reasonCode','alerts','tone'],['qualification','sourceEvidenceRef','comparisons']);requireValue(text(a.code)&&nullableText(a.rawValue)&&text(a.unit)&&nullableText(a.normalizedScore)&&text(a.basis)&&nullableText(a.reasonCode)&&strings(a.alerts)&&text(a.tone));if(a.comparisons)list(a.comparisons,c=>{record(c,['periodId','delta','deltaPercent','direction','favorable']);requireValue(text(c.periodId)&&text(c.delta)&&nullableText(c.deltaPercent)&&text(c.direction)&&text(c.favorable));});});});
}
function metadata(value:unknown):asserts value is SupplierReportData {
 record(value,['schemaVersion','nip','entityType','financial','kys'],['preferenceScope','locationSubject']);requireValue(value.schemaVersion==='1.0'&&typeof value.nip==='string'&&/^\d{10}$/.test(value.nip)&&['COMPANY','JDG'].includes(value.entityType as string));
 if(value.preferenceScope!==undefined)requireValue(text(value.preferenceScope));
 if(value.locationSubject){record(value.locationSubject,['supplierId']);requireValue(text(value.locationSubject.supplierId));}
 for(const key of ['financial','kys']){const s=value[key];requireValue(object(s)&&statuses.includes(s.status as string)&&['COMPLETE','PARTIAL','EMPTY','UNKNOWN'].includes(s.completeness as string)&&strings(s.limitations));freshness(s.freshness);}
 const f=value.financial;record(f,['status','source','freshness','completeness','limitations','mappingVersion','sourceVersion','representationVersion','periods','history'],['scanner']);requireValue(f.source==='MGBI'&&nullableText(f.mappingVersion)&&nullableText(f.sourceVersion)&&nullableText(f.representationVersion));
 list(f.periods,p=>{record(p,['from','to','year','scope','documentRef','facts'],['accountingStandard','sourceRegistration','qualityIssues','comparativeData']);requireValue(text(p.from)&&date(p.from)&&text(p.to)&&date(p.to)&&text(p.year)&&['standalone','consolidated'].includes(p.scope as string)&&text(p.documentRef));list(p.facts,evidence);if(p.qualityIssues)requireValue(strings(p.qualityIssues));if(p.sourceRegistration)sourceRegistration(p.sourceRegistration);if(p.comparativeData)comparatives(p.comparativeData);});
 list(f.history,h=>{record(h,['code','reasonCode','points']);requireValue(text(h.code)&&nullableText(h.reasonCode));list(h.points,p=>{indicator(p,['year','documentRef','definitionRef','evidence','comparison']);requireValue(object(p)&&text(p.year)&&text(p.documentRef));record(p.definitionRef,['code','formulaVersion']);requireValue(text(p.definitionRef.code)&&text(p.definitionRef.formulaVersion));list(p.evidence,evidence);record(p.comparison,['status','reasonCode','previousPeriod','delta','unit','direction']);requireValue(text(p.comparison.status)&&nullableText(p.comparison.reasonCode)&&nullableText(p.comparison.delta)&&text(p.comparison.unit)&&text(p.comparison.direction));if(p.comparison.previousPeriod){record(p.comparison.previousPeriod,['from','to']);requireValue(date(p.comparison.previousPeriod.from)&&date(p.comparison.previousPeriod.to));}});});
 if(f.scanner)scanner(f.scanner);
 const k=value.kys;record(k,['status','source','freshness','completeness','lastAttemptStatus','lastAttemptAt','limitations','reportAvailable'],['exportRef']);requireValue(k.source==='VERCLY'&&typeof k.reportAvailable==='boolean'&&[null,'PENDING','SUCCESS','NO_DATA','TIMEOUT','ERROR'].includes(k.lastAttemptStatus as string|null)&&date(k.lastAttemptAt));if(k.exportRef!==undefined)requireValue(nullableText(k.exportRef));
}
function sourceRegistration(v:unknown):void {record(v,['krs','legalName','relationship']);requireValue(text(v.krs)&&nullableText(v.legalName)&&['CURRENT','PREDECESSOR','UNCONFIRMED'].includes(v.relationship as string));}
function comparatives(v:unknown):void {record(v,['selected','dateBasis','original','restated']);requireValue(['ORIGINAL','RESTATED','UNRESOLVED'].includes(v.selected as string)&&['CALENDAR_PREVIOUS_YEAR','UNCONFIRMED'].includes(v.dateBasis as string));for(const k of ['original','restated'])list(v[k],f=>{record(f,['metricCode','amount','currency','unit']);requireValue(Object.values(f).every(text));});}
export function validateXRayData(operation:XRayOperation,value:unknown):void {
 safeTree(value);
 if(operation==='search')return validateXRaySearch(value);
 if(operation==='report')return metadata(value);
 if(operation==='krsLookup'){record(value,['result','metadata'],['pending']);if(value.pending!==undefined)requireValue(value.pending===true);validateXRaySearch(value.result);if(value.metadata!==null)metadata(value.metadata);return;}
 record(value,['section','privateReport']);section(value.section,kys);
 requireValue(object(value.section));if(value.section.data!==null)requireValue(value.privateReport!==null);
 if(value.privateReport!==undefined&&value.privateReport!==null){record(value.privateReport,['snapshotId','nip','entityType','retentionUntil','exportRef']);requireValue(text(value.privateReport.snapshotId)&&text(value.privateReport.nip)&&['COMPANY','JDG'].includes(value.privateReport.entityType as string)&&date(value.privateReport.retentionUntil)&&nullableText(value.privateReport.exportRef));}
}
export type XRayWireResponse={contract:typeof XRAY_WORKFLOW_CONTRACT;operation:XRayOperation;requestId:string;data:unknown}|{contract:typeof XRAY_WORKFLOW_CONTRACT;operation:XRayOperation;requestId:string;error:{code:string}};
export function unwrapXRayResponse(operation:XRayOperation,value:unknown,status:number):unknown {
 record(value,['contract','operation','requestId',status>=200&&status<300?'data':'error']);
 record(value.contract,['id','version']);requireValue(value.contract.id===XRAY_WORKFLOW_CONTRACT.id&&value.contract.version===XRAY_WORKFLOW_CONTRACT.version&&value.operation===operation&&typeof value.requestId==='string'&&/^[a-f0-9-]{36}$/.test(value.requestId));
 if(status>=200&&status<300){validateXRayData(operation,value.data);return value.data;}
 record(value.error,['code']);requireValue(typeof value.error.code==='string'&&/^[A-Z_]{1,64}$/.test(value.error.code));return {error:status===401?'XRAY_SESSION_REQUIRED':status===403?'XRAY_ACCESS_DENIED':value.error.code};
}
/** Bounded JSON, shared by producer and consumer, never a provider/DB client. */
export async function readXRayJson(response:Response,maximum=XRAY_RESPONSE_BYTES,signal?:AbortSignal):Promise<unknown>{
 requireValue(response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()==='application/json'&&response.body);
 const declared=response.headers.get('content-length');if(declared!==null)requireValue(/^\d+$/.test(declared)&&Number(declared)<=maximum);
 const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
 const abort=()=>{void reader.cancel();};signal?.addEventListener('abort',abort,{once:true});
 try{while(true){if(signal?.aborted)throw Error('XRAY_CANCELLED');const item=await reader.read();if(item.done)break;size+=item.value.length;requireValue(size<=maximum);chunks.push(item.value);}if(signal?.aborted)throw Error('XRAY_CANCELLED');const all=new Uint8Array(size);let offset=0;for(const part of chunks){all.set(part,offset);offset+=part.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));}
 finally{signal?.removeEventListener('abort',abort);void reader.cancel().catch(()=>{});reader.releaseLock();}
}

/** Host supplies same-origin authenticated I/O; this adapter unwraps only the
 * approved SRM wire version. It never chooses an upstream or user/tenant ID. */
export function createXRayWorkflowTransport(send:typeof fetch):typeof fetch {
 return async(input,init)=>{
  const path=typeof input==='string'?input:input instanceof URL?input.pathname:new URL(input.url).pathname;
  const operation=xrayOperation(path);if(!operation||init?.method!=='POST'||typeof init.body!=='string')throw Error('XRAY_REQUEST_INVALID');
  validateXRayCommand(operation,JSON.parse(init.body));
  const response=await send(path,init);
  const body=unwrapXRayResponse(operation,await readXRayJson(response,XRAY_RESPONSE_BYTES,init.signal??undefined),response.status);
  return Response.json(body,{status:response.status,headers:response.headers});
 };
}
