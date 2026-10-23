import type {CompanySnapshot,VerifiedIdentityV1} from '@profitia/krs-registry-contracts';
import type {SupplierCandidate,SupplierSelection,SupplierReportData,SupplierXRayCard} from '@profitia/srm-xray';
import type {MgbiFinancialResult} from './mgbi-financial';
import {krsGeneral} from './krs-general';
import {reconcileKrsFinancial} from './krs-financial';
import {validRequestIdempotencyKey} from '@profitia/platform-contracts/request-ledger';
import {isOperationDenied} from '@profitia/platform-contracts/operation-context';
import {sanitizedLookupFailure} from './lookup-diagnostics';
import {measureSupplierStage} from './supplier-telemetry';

export type AcceptedKrsSelection=Readonly<{snapshot:CompanySnapshot;identity:VerifiedIdentityV1}>;
/** These ports are supplied by accepted native E1 hosts, never HTTP/body authority.
 * Reads require current identity/membership/product, protected projection and outcome audit.
 * verify performs a real admitted CURRENT retrieval/publication, not a timestamp rewrite. */
export type KrsNamePorts=Readonly<{
  registry:{search(request:Request,query:string):Promise<readonly SupplierCandidate[]>;
    verify(request:Request,krs:string):Promise<AcceptedKrsSelection>;
    readSelection(request:Request,evidenceRef:string):Promise<AcceptedKrsSelection>};
  financial:{acquire(request:Request,identity:VerifiedIdentityV1,key:string):Promise<MgbiFinancialResult & {workPending?:true}>;
    publishEligible(request:Request,identity:VerifiedIdentityV1,result:MgbiFinancialResult):Promise<SupplierReportData|null>};
  now?:()=>number;
}>;
const unavailableFinancial=(at:string,code:string):SupplierXRayCard['financial']=>({status:'ERROR',source:{provider:'MGBI',model:'pl-krs-rdf-record',recordId:null},retrievedAt:at,effectiveAt:null,data:null,warnings:[code]});
const publicSection=<T>(value:{source:unknown}&T)=>{const {source,...rest}=value;return rest};
/** Orchestration only; existing E1 Request/Source/Work and their durable receipts own effects/retries. */
export function createKrsNameSearch(ports:KrsNamePorts){
  if(typeof window!=='undefined')throw Error('SERVER_ONLY');
  const now=ports.now??Date.now,registry=ports.registry,financial=ports.financial;
  async function checked(request:Request,ref:string){
    const selected=await registry.readSelection(request,ref);
    if(selected.identity.evidenceRef!==ref)throw Error('KRS_SELECTION_MISMATCH');
    await krsGeneral(selected.snapshot,selected.identity,now());return selected;
  }
  return Object.freeze({
    async search(request:Request,query:string){
      if(query.trim().length<2||query.length>150)throw Error('INVALID_REQUEST');
      const candidates=await registry.search(request,query.trim());
      if(candidates.length>10||new Set(candidates.map(c=>c.krs)).size!==candidates.length)throw Error('INVALID_CATALOG_PROJECTION');
      return {candidates,coverage:'PROGRESSIVE' as const};
    },
    async verify(request:Request,krs:string):Promise<SupplierSelection>{
      if(!/^\d{10}$/.test(krs))throw Error('INVALID_REQUEST');
      const selected=await registry.verify(request,krs);
      if(selected.identity.selectedKrs!==krs)throw Error('KRS_SELECTION_MISMATCH');
      await krsGeneral(selected.snapshot,selected.identity,now());
      return {krs,name:selected.identity.identity.officialName,nip:selected.identity.identity.nip,
        locality:selected.snapshot.address?.city??null,selectionRef:selected.identity.evidenceRef};
    },
    async lookup(request:Request,selectionRef:string,key:string){
      if(!/^KRS:[0-9]{10}:[a-f0-9]{64}$/.test(selectionRef)||!validRequestIdempotencyKey(key))throw Error('INVALID_REQUEST');
      const selected=await checked(request,selectionRef),general=await krsGeneral(selected.snapshot,selected.identity,now());
      let section=unavailableFinancial(new Date(now()).toISOString(),'MGBI_FINANCIAL_UNAVAILABLE'),metadata:SupplierReportData|null=null,workPending=false;
      try{
        // Fresh accepted identity at dispatch; the native port must admit current
        // Request/Source/Work, budget and this exact logical selection once.
        const acquired=await measureSupplierStage('FINANCIAL_ACQUIRE',()=>financial.acquire(request,selected.identity,key));
        const current=await checked(request,selectionRef);
        if(current.identity.selectedKrs!==selected.identity.selectedKrs||current.identity.identity.nip!==selected.identity.identity.nip
          ||current.identity.source.rawDigest!==selected.identity.source.rawDigest||current.identity.source.contentDigest!==selected.identity.source.contentDigest
          ||current.identity.source.sourceVersion!==selected.identity.source.sourceVersion||current.identity.source.retrievedAt!==selected.identity.source.retrievedAt)throw Error('KRS_SELECTION_SUPERSEDED');
        const eligible=await reconcileKrsFinancial(current.identity,acquired,now());
        workPending=acquired.workPending===true&&!eligible.errorCode;
        // Only filtered records/facts enter the existing native financial writer.
        if(!eligible.errorCode&&!workPending){
          const published=await measureSupplierStage('FINANCIAL_PUBLICATION',()=>financial.publishEligible(request,current.identity,eligible));
          if(published&&(published.nip!==current.identity.identity.nip||published.entityType!=='COMPANY'))throw Error('FINANCIAL_METADATA_MISMATCH');
          metadata=published;
        }
        section=workPending?{...eligible.section,status:'PENDING',data:null,warnings:['MSR_PROCESSING_PENDING']}:eligible.section;
      }catch(error){
        metadata=null;
        console.error(JSON.stringify({event:'srm_financial_failure',reason:isOperationDenied(error)?error.reasonCode:'FINANCIAL_FAILED',...sanitizedLookupFailure(error)}));
        /* A failed Financial acquisition never purchases General or reveals a failed projection. */
      }
      // Current protected read also fences publication after a revoked membership.
      await checked(request,selectionRef);
      return {...(workPending?{pending:true as const}:{}),result:{entityType:'COMPANY' as const,card:{identity:{krs:selected.identity.selectedKrs,nip:selected.identity.identity.nip,name:selected.identity.identity.officialName},
        general:publicSection(general),financial:publicSection(section),kys:{status:'NOT_REQUESTED' as const,retrievedAt:null,effectiveAt:null,data:null,warnings:[]}}},metadata};
    },
  });
}
