import type {VerifiedIdentityV1} from '@profitia/krs-registry-contracts';
import type {MgbiFinancialResult} from './mgbi-financial';
import {mapMgbiFinancialRecords} from './mgbi-financial';
import {financialRecordsFromPages} from './financial-documents';

const empty=(input:MgbiFinancialResult,code:string):MgbiFinancialResult=>({section:{...input.section,status:'ERROR',data:null,warnings:[code]},facts:[],errorCode:code});
const object=(v:unknown):Record<string,unknown>=>v&&Object.getPrototypeOf(v)===Object.prototype?v as Record<string,unknown>:{};
/** Reuses the original RDF mapper after document-level legal identity filtering.
 * This function performs no I/O and never buys a second Financial or General response.
 * Historical candidates alone grant nothing: the minimum pilot admits only the selected KRS. */
export async function reconcileKrsFinancial(identity:VerifiedIdentityV1,input:MgbiFinancialResult,now:number):Promise<MgbiFinancialResult>{
  const {validateIdentityEvidence}=await import('@profitia/krs-registry-contracts');
  const verified=await validateIdentityEvidence(identity,now);
  if(verified.status!=='VERIFIED')throw Error('KRS_IDENTITY_UNVERIFIED');
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
    return identifiers.pl_krs===verified.selectedKrs&&identifiers.pl_nip===verified.identity.nip;
  });
  if(records.length&&!eligible.length)return empty(input,'FINANCIAL_COMPANY_MISMATCH');
  const at=input.section.retrievedAt;
  if(!at||!Number.isFinite(Date.parse(at)))return empty(input,'FINANCIAL_IDENTITY_EVIDENCE_MISSING');
  const mapped=mapMgbiFinancialRecords(eligible,{type:'KRS',value:verified.selectedKrs},at,eligible.length);
  mapped.section={...mapped.section,status:input.section.status==='PARTIAL'&&mapped.section.status==='SUCCESS'?'PARTIAL':mapped.section.status,
    warnings:[...new Set([...input.section.warnings,...mapped.section.warnings])]};
  if(mapped.section.data)mapped.section={...mapped.section,data:{...mapped.section.data,periods:mapped.section.data.periods.map(period=>({...period,
    sourceRegistration:{krs:verified.selectedKrs,legalName:verified.identity.officialName,relationship:'CURRENT' as const}}))}};
  if(eligible.length!==records.length)mapped.section={...mapped.section,warnings:[...mapped.section.warnings,'MGBI_FOREIGN_DOCUMENTS_EXCLUDED']};
  return {...mapped,rawResponse:{pages:input.rawResponse.pages.map(page=>{
    const p=object(page);return {...p,results:Array.isArray(p.results)?p.results.filter(r=>eligible.includes(r)):[]};
  }),recordCount:eligible.length}};
}
