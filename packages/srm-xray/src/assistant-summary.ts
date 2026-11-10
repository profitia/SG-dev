import {readSharedFinancialSummary} from './shared-financial-summary'
import type {SupplierReportData,VerclyKysData} from './contracts'

export type SupplierAssistantSelection=Readonly<{nip:string;entityType:'COMPANY'|'JDG';krs:string|null;year:number|null;comparisonYear:number|null;statementScope:'standalone'|'consolidated'}>
export type AssistantKysRead=Readonly<{status:'OK'|'PARTIAL'|'EMPTY'|'DENIED'|'UNAVAILABLE'|'STALE';
 section?:{status:string;retrievedAt:string|null;effectiveAt:string|null;data:VerclyKysData|null;warnings:readonly string[]};
 retentionUntil?:string|null}>
const invalid=():never=>{throw TypeError('Invalid supplier assistant selection')}
export function readSupplierAssistantSelection(value:unknown):SupplierAssistantSelection{
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)return invalid()
 const v=value as Record<string,unknown>
 if(Object.keys(v).sort().join(',')!=='comparisonYear,entityType,krs,nip,statementScope,year'||typeof v.nip!=='string'||!/^\d{10}$/.test(v.nip)
  ||!['COMPANY','JDG'].includes(String(v.entityType))||v.krs!==null&&(typeof v.krs!=='string'||!/^\d{10}$/.test(v.krs))
  ||v.year!==null&&(!Number.isInteger(v.year)||Number(v.year)<1800||Number(v.year)>2200)
  ||v.comparisonYear!==null&&(!Number.isInteger(v.comparisonYear)||Number(v.comparisonYear)<1800||Number(v.comparisonYear)>2200)
  ||!['standalone','consolidated'].includes(String(v.statementScope)))return invalid()
 return Object.freeze({...v}) as SupplierAssistantSelection
}
/** The existing financial projector and native KYS reader own facts and
 * decisions. This bounded projection performs no formulas, acquisition,
 * entity matching by name or permission checks. Hosts must authorize inputs. */
export function projectSupplierAssistantSummary(input:{selection:SupplierAssistantSelection;financial:SupplierReportData;kys:AssistantKysRead}){
 const selection=readSupplierAssistantSelection(input.selection)
 const report=readSharedFinancialSummary(input.financial,{nip:selection.nip,entityType:selection.entityType})
 const financial=report.financial,available=financial.periods.filter(p=>p.scope===selection.statementScope)
 const chosenYear=selection.year===null?available.map(p=>Number(p.year)).filter(Number.isSafeInteger).sort((a,b)=>b-a)[0]??null:selection.year
 const selectedPeriods=available.filter(p=>Number(p.year)===chosenYear||selection.comparisonYear!==null&&Number(p.year)===selection.comparisonYear)
 const periods=selectedPeriods.slice(0,2)
 const current=periods.map(p=>p.sourceRegistration).find(r=>r?.relationship==='CURRENT')
 const kys=input.kys,section=kys.section
 if(!['OK','PARTIAL','EMPTY','DENIED','UNAVAILABLE','STALE'].includes(kys.status))return invalid()
 const safeKys=(kys.status==='OK'||kys.status==='PARTIAL')&&section?.data?section.data:null
 if(safeKys?.company?.nip!==undefined&&safeKys.company.nip!==null&&safeKys.company.nip!==selection.nip)return invalid()
 const company=safeKys?.company
 const facts=periods.map(p=>({from:p.from,to:p.to,year:p.year,statementScope:p.scope,documentRef:p.documentRef,
  accountingStandard:p.accountingStandard??'UNKNOWN',qualityIssues:p.qualityIssues??[],
  facts:p.facts.slice(0,12).map(f=>({ref:f.ref,metricCode:f.metricCode,amount:f.amount,currency:f.currency,unit:f.unit,
   validation:f.validation,normalization:f.normalization,reasonCode:f.reasonCode})),
  omittedFacts:Math.max(0,p.facts.length-12)}))
 const indicators=financial.history.slice(0,8).map(h=>({code:h.code,reasonCode:h.reasonCode,
  points:h.points.filter(p=>p.scope===selection.statementScope&&(Number(p.year)===chosenYear||selection.comparisonYear!==null&&Number(p.year)===selection.comparisonYear)).slice(0,2).map(p=>({
   code:p.code,year:p.year,from:p.periodStart,to:p.periodEnd,statementScope:p.scope,status:p.status,value:p.value,unit:p.unit,
   reasonCode:p.reasonCode,formulaVersion:p.formulaVersion,comparison:p.comparison,documentRef:p.documentRef}))}))
 const hasPrivate=!!safeKys
 if(hasPrivate&&(!kys.retentionUntil||!Number.isFinite(Date.parse(kys.retentionUntil))||Date.parse(kys.retentionUntil)<=Date.now()))return invalid()
 const partial=!facts.length||financial.status!=='SUCCESS'||financial.completeness!=='COMPLETE'||financial.freshness.freshness!=='FRESH'
  ||!hasPrivate||kys.status!=='OK'||facts.some(p=>p.omittedFacts>0)||financial.history.length>8||selectedPeriods.length>2
 const asOf=financial.freshness.checkedAt??financial.freshness.retrievedAt
 return {
  version:'srm-assistant-summary-v1' as const,
  status:facts.length||hasPrivate?partial?'PARTIAL' as const:'OK' as const:'EMPTY' as const,
  identity:{nip:selection.nip,entityType:selection.entityType,krs:company?.krs??current?.krs??null,name:company?.name??current?.legalName??null},
  selection:{year:selection.year,comparisonYear:selection.comparisonYear,statementScope:selection.statementScope},asOf,
  financial:{status:financial.status,source:financial.source,sourceVersion:financial.sourceVersion,
   mappingVersion:financial.mappingVersion,representationVersion:financial.representationVersion,freshness:financial.freshness,
   completeness:financial.completeness,limitations:financial.limitations,selectedYear:chosenYear,periods:facts,indicators,
   omittedIndicatorDefinitions:Math.max(0,financial.history.length-8),omittedPeriods:Math.max(0,selectedPeriods.length-2)},
  kys:{status:kys.status,source:'VERCLY',sectionStatus:section?.status??null,
   retrievedAt:section?.retrievedAt??null,effectiveAt:section?.effectiveAt??null,retentionUntil:kys.retentionUntil??null,
   isComplete:safeKys?.isComplete??null,stateAsOf:safeKys?.stateAsOf??null,
   riskLevel:safeKys?.riskLevel??null,registryChecks:safeKys?.registryChecks??null,screeningSummary:safeKys?.screeningSummary??null,
   screenedLists:safeKys?.screenedLists?.slice(0,20)??[],warnings:section?.warnings.slice(0,8)??[]},
  meaning:'Authorised stored SRM financial projection and separately authorised private KYS only. Financial amounts and indicators retain the producer units, periods, quality and statement scope. Missing/denied KYS or finances are not evidence of adverse condition. No PESEL, person records, reveal token, PDF, provider call, formula or new report was produced.',
 }
}
