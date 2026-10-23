import type {VerifiedIdentityV1} from '@profitia/krs-registry-contracts';
import {financialRegistration,type RegistryHistory} from './company-continuity';
import type {MgbiFinancialResult} from './mgbi-financial';
import {mapMgbiFinancialRecords} from './mgbi-financial';
import {financialRecordsFromPages} from './financial-documents';

const empty=(input:MgbiFinancialResult,code:string):MgbiFinancialResult=>({section:{...input.section,status:'ERROR',data:null,warnings:[code]},facts:[],errorCode:code});
const object=(v:unknown):Record<string,unknown>=>v&&Object.getPrototypeOf(v)===Object.prototype?v as Record<string,unknown>:{};
/** Reuses the original RDF mapper after document-level legal identity filtering.
 * This function performs no I/O and never buys a second Financial or General response.
 * Historical candidates alone grant nothing; the native caller must supply verified continuity. */
export async function reconcileKrsFinancial(identity:VerifiedIdentityV1,input:MgbiFinancialResult,now:number,history?:RegistryHistory):Promise<MgbiFinancialResult>{
  const {validateIdentityEvidence}=await import('@profitia/krs-registry-contracts');
  const verified=await validateIdentityEvidence(identity,now);
  if(verified.status!=='VERIFIED')throw Error('KRS_IDENTITY_UNVERIFIED');
  if(history&&(history.currentKrs!==verified.selectedKrs||history.members[0]?.krs!==verified.selectedKrs||history.unlinkedKrs.length))throw Error('KRS_CONTINUITY_UNVERIFIED');
  const allowed=new Set(history?.members.map(m=>m.krs)??[verified.selectedKrs]);
  if(input.section.source.provider!=='MGBI'||!['pl-krs-rdf-record','KRS-RDF'].includes(input.section.source.model))return empty(input,'FINANCIAL_SOURCE_MISMATCH');
  if(!['SUCCESS','PARTIAL','EMPTY'].includes(input.section.status))return empty(input,input.errorCode??'MGBI_FINANCIAL_UNAVAILABLE');
  if(!input.rawResponse){
    // Numeric values without the original company/document IDs cannot be adopted.
    if(input.section.data?.periods.length||input.facts.length)return empty(input,'FINANCIAL_IDENTITY_EVIDENCE_MISSING');
    return {...input,section:{...input.section,data:null},facts:[]};
  }
  const records=financialRecordsFromPages(input.rawResponse.pages);
  const eligible=records.filter(record=>{
    const identifiers=object(object(record).identifiers);
    return allowed.has(identifiers.pl_krs as string)&&identifiers.pl_nip===verified.identity.nip;
  });
  if(records.length&&!eligible.length)return empty(input,'FINANCIAL_COMPANY_MISMATCH');
  const at=input.section.retrievedAt;
  if(!at||!Number.isFinite(Date.parse(at)))return empty(input,'FINANCIAL_IDENTITY_EVIDENCE_MISSING');
  if(eligible.length===records.length){
    // The existing acquisition may already include XML, XHTML/iXBRL projections,
    // revisions and comparative periods. Once every original record is eligible,
    // retain those results rather than rebuilding a reduced RDF-only report.
    const registration={krs:verified.selectedKrs,legalName:verified.identity.officialName,relationship:'CURRENT' as const};
    const issuer=(documentId:string)=>{const id=documentId.replace(/:(cfy|pfy)$/,'');const record=eligible.find(r=>String(object(r).id)===id);const krs=object(object(record).identifiers).pl_krs;
      if(!record||typeof krs!=='string'||!allowed.has(krs))throw Error('FINANCIAL_IDENTITY_EVIDENCE_MISSING');return history?financialRegistration(krs,history):registration};
    const registered=(data:NonNullable<MgbiFinancialResult['section']['data']>)=>({...data,
      periods:data.periods.map(period=>({...period,sourceRegistration:issuer(period.documentId)}))});
    return {...input,section:{...input.section,data:input.section.data?registered(input.section.data):null},
      ...(input.sourceData?{sourceData:registered(input.sourceData)}:{})};
  }
  const mapped=mapMgbiFinancialRecords(eligible,{type:'NIP',value:verified.identity.nip},at,eligible.length,history);
  mapped.section={...mapped.section,status:input.section.status==='PARTIAL'&&mapped.section.status==='SUCCESS'?'PARTIAL':mapped.section.status,
    warnings:[...new Set([...input.section.warnings,...mapped.section.warnings])]};
  if(mapped.section.data)mapped.section={...mapped.section,data:{...mapped.section.data,periods:mapped.section.data.periods.map(period=>({...period,
    sourceRegistration:history?period.sourceRegistration:{krs:verified.selectedKrs,legalName:verified.identity.officialName,relationship:'CURRENT' as const}}))}};
  if(eligible.length!==records.length)mapped.section={...mapped.section,warnings:[...mapped.section.warnings,'MGBI_FOREIGN_DOCUMENTS_EXCLUDED']};
  return {...mapped,rawResponse:{pages:input.rawResponse.pages.map(page=>{
    const p=object(page);return {...p,results:Array.isArray(p.results)?p.results.filter(r=>eligible.includes(r)):[]};
  }),recordCount:eligible.length}};
}
