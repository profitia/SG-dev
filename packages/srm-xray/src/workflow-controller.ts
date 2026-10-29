import { isDeregisteredJdg, isCompanyReportRestricted } from "./company-activity";
import type { JdgRegistryData, SectionEnvelope, SupplierReportData, SupplierXRayCard } from "./contracts";
import type {SupplierSelection} from "./supplier-search";

export type {XRayDisplayCard as DisplayCard,XRaySearchResult as SearchResult} from './workflow-contract';
import type {XRayDisplayCard as DisplayCard,XRaySearchResult as SearchResult} from './workflow-contract';
export type KysRenderTiming = { requestId: string; mode: "PROVIDER" | "CACHE" | "FOLLOWER" | "UNAVAILABLE"; startedAt: number; apiMs: number; serverTiming: string | null };
class ReportRequestError extends Error {
 constructor(message: string, readonly timing?: Omit<KysRenderTiming, "startedAt" | "apiMs">, readonly status?:number) { super(message); }
}
export type ReportState = {
  /** Time the user requested the displayed KYS; never source freshness or export identity. */
  kysRequestedAt?: string;
  reportTiming?: {traceId:string;lastFragmentId:string|null;startedAt:number;controllerCompleteMs:number};
  registryRoute?: {provider:"KRS"|"MGBI";fallbackReason?:string};
  kysTiming?: KysRenderTiming; result: SearchResult | null; busy: boolean; error: string | null;
  kys: DisplayCard["kys"]; kysBusy: boolean; kysError: string | null;
  metadata: SupplierReportData | null; metadataBusy: boolean; metadataError: string | null };
export const emptySection = (): DisplayCard["kys"] => ({ status: "NOT_REQUESTED", retrievedAt: null, effectiveAt: null, data: null, warnings: [] });
const initialState = (): ReportState => ({ result: null, busy: false, error: null, kys: emptySection(), kysBusy: false, kysError: null,
  metadata: null, metadataBusy: false, metadataError: null });
export function inactiveSupplier(result: SearchResult | null): boolean { return result?.entityType === "JDG" ? isDeregisteredJdg(result.section.data) : result?.entityType === "COMPANY" && isCompanyReportRestricted(result.card.general.data); }
export function supplierNip(result: SearchResult | null): string | null { return result?.entityType === "JDG" ? result.nip : result?.card.identity.nip ?? null; }
function message(error: unknown, fallback: string): string { return error instanceof Error ? error.message : fallback; }
type PrivateKysReference={snapshotId:string;nip:string;entityType:'COMPANY'|'JDG';retentionUntil:string;exportRef:string|null;retrievedAt:string}
function privateReference(value:unknown,nip:string,entityType:'COMPANY'|'JDG',section:DisplayCard['kys'],now:Date):PrivateKysReference|null{
 if(value===null)return null
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join(',')!=='entityType,exportRef,nip,retentionUntil,snapshotId')throw Error('Nie udało się potwierdzić wersji prywatnego raportu.')
 const v=value as Omit<PrivateKysReference,'retrievedAt'>
 if(v.nip!==nip||v.entityType!==entityType||!section.retrievedAt||!Number.isFinite(Date.parse(section.retrievedAt))
  ||Date.parse(section.retrievedAt)>now.getTime()||!Number.isFinite(Date.parse(v.retentionUntil))||Date.parse(v.retentionUntil)<=now.getTime()
  ||typeof v.snapshotId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.snapshotId)
  ||v.exportRef!==null&&(typeof v.exportRef!=='string'||!/^[a-f0-9]{64}$/.test(v.exportRef)))throw Error('Nie udało się potwierdzić wersji prywatnego raportu.')
 return {...v,retrievedAt:new Date(section.retrievedAt).toISOString()}
}
/** This expiry is issued by the current private HUMAN read after the server
 * clamps retention to its KYS TTL. Public Financial metadata is not evidence
 * of private availability, and cannot replace this snapshot's authority. */
function privateKysMetadata(current:SupplierReportData['kys'],section:DisplayCard['kys'],ref:PrivateKysReference|null,
 nip:string,entityType:'COMPANY'|'JDG',now:Date):SupplierReportData['kys']{
 const valid=ref&&ref.nip===nip&&ref.entityType===entityType&&Date.parse(ref.retentionUntil)>now.getTime()
  &&Date.parse(ref.retrievedAt)===Date.parse(section.retrievedAt??'')&&Date.parse(ref.retrievedAt)<=now.getTime()
  &&section.data!==null&&['SUCCESS','PARTIAL'].includes(section.status);
 if(!valid)return {...current,reportAvailable:false,exportRef:null};
 return {...current,status:section.status,reportAvailable:true,exportRef:ref.exportRef,
  completeness:section.status==='SUCCESS'&&section.data?.isComplete===true?'COMPLETE':'PARTIAL',
  limitations:[...section.warnings],freshness:{...current.freshness,retrievedAt:ref.retrievedAt,
   cacheExpiresAt:ref.retentionUntil,retentionUntil:ref.retentionUntil,readSource:'STORED',freshness:'FRESH'}};
}

/** Host request lifecycle only. No financial calculations, cache or provider policy. */
export class SupplierReportController {
  private state = initialState();
  private listeners = new Set<() => void>();
  private generation = 0;
  private metadataSequence = 0;
  private requests = new Set<AbortController>();
  private metadataRequest?: AbortController;
  private logicalKeys=new Map<string,string>();
  private privateKysReference:PrivateKysReference|null|undefined;
  private lastIdentifier:string|null=null;
  private nameSelection:SupplierSelection|null=null;
  private diagnosticExecution:string|null=null;
  private diagnosticParent:string|null=null;
  private diagnosticUserStartMs:number|null=null;
  constructor(private readonly transport: typeof fetch = (input, init) => fetch(input, init),
    private readonly now: () => Date = () => new Date(),
    private readonly newRequestKey:()=>string=()=>crypto.randomUUID()) {}
  getSnapshot = (): ReportState => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(change: Partial<ReportState>) { this.state = { ...this.state, ...change }; for (const listener of this.listeners) listener(); }
  dispose = () => { this.generation += 1; this.metadataSequence += 1; for (const request of this.requests) request.abort(); this.requests.clear(); this.logicalKeys.clear(); this.privateKysReference=undefined; };
  reset = () => { this.dispose(); this.nameSelection=null; this.diagnosticExecution=null;this.diagnosticParent=null;this.diagnosticUserStartMs=null;this.state = initialState(); for (const listener of this.listeners) listener(); };
  /** Versioned peer denials clear the integrated workspace; standalone legacy
   * metadata failures retain their existing independent presentation semantics. */
  private clearUnauthorized(error:unknown,generation:number):boolean {
    if(generation!==this.generation||!(error instanceof ReportRequestError)||![401,403].includes(error.status??0)||!['XRAY_SESSION_REQUIRED','XRAY_ACCESS_DENIED'].includes(error.message))return false;
    this.reset();this.update({error:error.status===401?'XRAY_SESSION_REQUIRED':'XRAY_ACCESS_DENIED'});return true;
  }
  private diagnosticComplete(generation:number){
    if(generation!==this.generation||!this.diagnosticExecution||this.diagnosticUserStartMs===null)return;
    try{console.info(JSON.stringify({event:'srm_diagnostic_client_complete',schema:'srm.diagnostic-trace/1.0',traceId:this.diagnosticExecution,
      lastFragmentId:this.diagnosticParent,clock:'BROWSER_PERFORMANCE_NOW_NOT_SERVER_CLOCK',startMs:this.diagnosticUserStartMs,endMs:performance.now(),
      status:this.state.error||this.state.metadataError?'ERROR':'OK',includesBrowserNetworkAndScheduling:true}));}catch{}
    if(!this.state.error&&!this.state.metadataError&&this.state.result&&this.state.metadata)
      this.update({reportTiming:{traceId:this.diagnosticExecution,lastFragmentId:this.diagnosticParent,
        startedAt:this.diagnosticUserStartMs,controllerCompleteMs:performance.now()}});
    this.diagnosticUserStartMs=null;
  }
  private async json(path: string, body: unknown, controller: AbortController): Promise<unknown> {
    const diagnosticGeneration=this.generation;
    const diagnosticStart=performance.now();let diagnosticHeaders:number|null=null,diagnosticBody:number|null=null,diagnosticResponse:Response|undefined;
    const logical=path+':'+JSON.stringify(body),key=this.logicalKeys.get(logical)??this.newRequestKey();
    this.logicalKeys.set(logical,key);
    this.requests.add(controller);
    try {
      const response = await this.transport(path, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key":key,...(this.diagnosticExecution?{"X-SRM-Diagnostic-Execution":this.diagnosticExecution}:{}),...(this.diagnosticParent?{"X-SRM-Diagnostic-Parent":this.diagnosticParent}:{}) }, body: JSON.stringify(body), cache: "no-store", signal: controller.signal });
      diagnosticResponse=response;diagnosticHeaders=performance.now();
      const execution=response.headers.get("X-SRM-Diagnostic-Execution"),fragment=response.headers.get("X-SRM-Diagnostic-Fragment");
      if(diagnosticGeneration===this.generation&&execution&&/^[a-f0-9-]{36}$/i.test(execution))this.diagnosticExecution=execution;
      if(diagnosticGeneration===this.generation&&fragment&&/^[a-f0-9-]{36}$/i.test(fragment))this.diagnosticParent=fragment;
      const payload = await response.json();
      diagnosticBody=performance.now();
      if (path.endsWith("/kys") && payload && typeof payload === "object") {
        const requestId = response.headers.get("X-SRM-Request-Id");
        const mode = response.headers.get("X-SRM-KYS-Mode");
        if (requestId && /^[0-9a-f-]{36}$/.test(requestId)) payload.timing = { requestId, mode: ["PROVIDER", "CACHE", "FOLLOWER"].includes(mode ?? "") ? mode : "UNAVAILABLE", serverTiming: response.headers.get("Server-Timing") };
      }
      if (!response.ok) throw new ReportRequestError(typeof payload?.error === "string" ? payload.error : "Nie udało się odczytać raportu.", payload?.timing,response.status);
      if(response.status!==202&&!(path.endsWith('/kys')&&payload?.section?.status==='PENDING')&&this.logicalKeys.get(logical)===key)this.logicalKeys.delete(logical);
      return payload;
    } finally {
      try{
        const traceId=diagnosticResponse?.headers.get('X-SRM-Diagnostic-Execution'),fragmentId=diagnosticResponse?.headers.get('X-SRM-Diagnostic-Fragment');
        const route=path==='/api/xray/search'?'search':path==='/api/xray/krs/lookup'?'krs_lookup':path==='/api/xray/report-data'?'report_data':null;
        if(route&&traceId&&fragmentId&&/^[a-f0-9-]{36}$/i.test(traceId)&&/^[a-f0-9-]{36}$/i.test(fragmentId))console.info(JSON.stringify({event:'srm_diagnostic_client_request',schema:'srm.diagnostic-trace/1.0',traceId,fragmentId,route,
          clock:'BROWSER_PERFORMANCE_NOW_NOT_SERVER_CLOCK',startMs:diagnosticStart,headersAtMs:diagnosticHeaders,bodyAtMs:diagnosticBody,endMs:performance.now(),status:diagnosticResponse?.ok&&diagnosticBody!==null?'OK':'ERROR'}));
      }catch{}
      this.requests.delete(controller);
    }
  }
  retrySearch = async () => {
    if(this.state.busy)return;
    if(this.nameSelection)return this.searchKrs(this.nameSelection);
    if(this.lastIdentifier)return this.search(this.lastIdentifier,true);
  };
  /** Inactivation cancels delivery; a retry keeps its uncertain logical key. */
  suspend = () => {
    this.generation++;this.metadataSequence++;
    for(const request of this.requests)request.abort();this.requests.clear();
    this.update({busy:false,kysBusy:false,metadataBusy:false,...(this.state.busy?{error:"XRAY_INTERRUPTED"}:{}),...(this.state.kysBusy?{kys:emptySection(),kysError:"XRAY_INTERRUPTED"}:{}),...(this.state.metadataBusy?{metadataError:"XRAY_INTERRUPTED"}:{})});
  };
  expirePrivate = () => {
    if(this.privateKysReference&&Date.parse(this.privateKysReference.retentionUntil)<=this.now().getTime()){
      this.privateKysReference=null;this.update({kys:emptySection(),kysRequestedAt:undefined,kysTiming:undefined});
      if(this.state.metadata)this.update({metadata:{...this.state.metadata,kys:{...this.state.metadata.kys,reportAvailable:false,exportRef:null,freshness:{...this.state.metadata.kys.freshness,freshness:"EXPIRED"}}}});
    }
  };
  search = async (identifier: string, retry=false) => {
    if (this.state.busy) return;
    const retained=retry&&this.lastIdentifier===identifier?new Map(this.logicalKeys):null;
    this.reset();this.lastIdentifier=identifier;if(retained)this.logicalKeys=retained;this.diagnosticUserStartMs=performance.now();const generation = this.generation;
    this.update({ busy: true });
    try {
      const payload = await this.json("/api/xray/search", { identifier }, new AbortController()) as SearchResult & {krsSelection?:SupplierSelection;registryRoute?:ReportState["registryRoute"]};
      if (generation !== this.generation) return;
      if ((payload?.entityType !== "JDG" && payload?.entityType !== "COMPANY") || supplierNip(payload) !== identifier) throw new Error("Dane dostawcy nie zgadzają się z wyszukiwanym numerem NIP.");
      const route=payload.registryRoute
      if(route&&!['KRS','MGBI'].includes(route.provider))throw Error('Nieprawidłowe źródło danych rejestrowych.')
      this.update({ result: payload, busy: false,registryRoute:route });
      if(payload.krsSelection){
       const selection=payload.krsSelection
       if(payload.entityType!=='COMPANY'||route?.provider!=='KRS'||selection.nip!==identifier||selection.krs!==payload.card.identity.krs)throw Error('Dane wyboru spółki są niezgodne.')
       await this.searchKrs(selection,payload,route);return
      }
      if(payload.metadata!==undefined){
        const report=payload.metadata;
        if(payload.entityType!=='COMPANY'||report?.schemaVersion!=='1.0'||report.nip!==identifier||report.entityType!=='COMPANY'
          ||!report.financial||!Array.isArray(report.financial.periods)||!Array.isArray(report.financial.history)||!report.financial.scanner
          ||report.kys?.status!=='NOT_REQUESTED'||report.kys.reportAvailable!==false)throw Error('Nie udało się potwierdzić kompletności gotowego raportu.');
        this.update({metadata:report,metadataBusy:false,metadataError:null});
      }else if (!inactiveSupplier(payload)) await this.refreshMetadata();
    } catch (error) { if(this.clearUnauthorized(error,generation))return; if (generation === this.generation) this.update({ error: message(error, "Nie udało się pobrać raportu.") }); }
    finally { if (generation === this.generation) this.update({ busy: false });this.diagnosticComplete(generation); }
  };
  /** Name selections use only their protected BFF path. Never classify by NIP or invoke the NIP lookup. */
  searchKrs = async (selection:SupplierSelection,initial?:SearchResult,registryRoute:ReportState["registryRoute"]={provider:"KRS"}) => {
    if(this.state.busy)return;
    const path='/api/xray/krs/lookup',body={selectionRef:selection.selectionRef},logical=path+':'+JSON.stringify(body);
    const retryKey=this.logicalKeys.get(logical);
    const diagnosticExecution=initial?this.diagnosticExecution:null,diagnosticParent=initial?this.diagnosticParent:null;
    const diagnosticUserStart=initial?this.diagnosticUserStartMs:performance.now();
    this.reset();this.diagnosticExecution=diagnosticExecution;this.diagnosticParent=diagnosticParent;this.diagnosticUserStartMs=diagnosticUserStart;this.nameSelection=selection;
    const requestKey=retryKey??this.newRequestKey();this.logicalKeys.set(logical,requestKey);
    const generation=this.generation;this.update({busy:true,...(initial?{result:initial}:{}),registryRoute});
    try{
      for(let step=0;step<20;step++){
      const response=await this.json(path,body,new AbortController()) as {pending?:true;result:SearchResult;metadata:SupplierReportData|null};
      if(generation!==this.generation)return;
      const payload=response?.result;
      if(payload?.entityType!=='COMPANY'||supplierNip(payload)!==selection.nip||payload.card.identity.krs!==selection.krs
        ||payload.card.general.data?.krs!==selection.krs||payload.card.general.data.nip!==selection.nip
        ||response.metadata&&(response.metadata.nip!==selection.nip||response.metadata.entityType!=='COMPANY'))throw Error('Dane raportu nie zgadzają się z wybraną spółką.');
      this.update({result:payload,metadata:response.metadata,busy:response.pending===true});
      if(generation!==this.generation)return;
      if(response.pending!==true)return;
      this.logicalKeys.set(logical,requestKey);
      await new Promise(resolve=>setTimeout(resolve,250));
      if(generation!==this.generation)return;
      }
      throw Error('Przygotowanie dokumentów trwa dłużej. Spróbuj ponownie, aby kontynuować zapisane pobranie.');
    }catch(error){if(this.clearUnauthorized(error,generation))return;if(generation===this.generation){this.logicalKeys.set(logical,requestKey);this.update({error:message(error,'Nie udało się pobrać raportu wybranej spółki.')});}}
    finally{if(generation===this.generation)this.update({busy:false});this.diagnosticComplete(generation);}
  };
  refreshMetadata = async () => {
    // The exact private read already returned snapshot-specific validity.
    // A company admission cannot supply or renew authority for KYS.
    if(this.nameSelection){
      const metadata=this.state.metadata,ref=this.privateKysReference;
      if(metadata&&ref!==undefined)this.update({metadata:{...metadata,kys:privateKysMetadata(metadata.kys,this.state.kys,ref,
        this.nameSelection.nip,'COMPANY',this.now())}});
      return;
    }
    const result = this.state.result, nip = supplierNip(result); if (!result || !nip || inactiveSupplier(result)) return;
    const generation = this.generation, sequence = ++this.metadataSequence;
    this.metadataRequest?.abort(); const request = new AbortController(); this.metadataRequest = request;
    this.update({ metadataBusy: true, metadataError: null });
    try {
      const payload = await this.json("/api/xray/report-data", { nip, entityType: result.entityType }, request) as SupplierReportData;
      if (generation !== this.generation || sequence !== this.metadataSequence) return;
      if (payload?.schemaVersion !== "1.0" || payload.nip !== nip || payload.entityType !== result.entityType) throw new Error("Nie udało się potwierdzić metadanych tego dostawcy.");
      if(this.privateKysReference!==undefined){
        payload.kys=privateKysMetadata(payload.kys,this.state.kys,this.privateKysReference,nip,result.entityType,this.now());
      }
      this.update({ metadata: payload });
    } catch (error) { if(this.clearUnauthorized(error,generation))return; if (generation === this.generation && sequence === this.metadataSequence) this.update({ metadata: null, metadataError: message(error, "Metadane aktualności są niedostępne.") }); }
    finally { if (generation === this.generation && sequence === this.metadataSequence) this.update({ metadataBusy: false }); }
  };
  fetchKys = async () => {
    const result = this.state.result, nip = supplierNip(result);
    if (this.state.busy || this.state.kysBusy || !result || !nip || inactiveSupplier(result)) return;
    const generation = this.generation, startedAt = performance.now(), requestedAt = this.now().toISOString();
    if(this.privateKysReference!==undefined)this.privateKysReference=null;
    this.update({ kysRequestedAt: undefined, kysTiming: undefined, kysBusy: true, kysError: null, kys: { ...emptySection(), status: "PENDING" } });
    try {
      const payload = await this.json(result.entityType === "JDG" ? "/api/xray/jdg/kys" : "/api/xray/kys", { identifier: nip }, new AbortController()) as { section: DisplayCard["kys"]; privateReport?:unknown; timing?: Omit<KysRenderTiming, "startedAt" | "apiMs"> };
      if (generation !== this.generation) return;
      if (!payload?.section || !["SUCCESS", "PARTIAL", "EMPTY", "ERROR", "PENDING", "NOT_REQUESTED"].includes(payload.section.status)
        || (payload.section.data?.company?.nip && payload.section.data.company.nip !== nip)) throw new Error("Nie udało się potwierdzić raportu KYS tego dostawcy.");
      if(Object.hasOwn(payload,'privateReport')){
        this.privateKysReference=null;
        this.privateKysReference=privateReference(payload.privateReport,nip,result.entityType,payload.section,this.now());
      }else this.privateKysReference=undefined;
      this.update({ kys: payload.section, kysRequestedAt: payload.section.data && ["SUCCESS", "PARTIAL"].includes(payload.section.status) ? requestedAt : undefined, kysTiming: payload.timing ? { ...payload.timing, startedAt, apiMs: performance.now() - startedAt } : undefined });
    } catch (error) { if(this.clearUnauthorized(error,generation))return; if (generation === this.generation) this.update({ kysTiming: error instanceof ReportRequestError && error.timing ? { ...error.timing, startedAt, apiMs: performance.now() - startedAt } : undefined, kysError: message(error, "Nie udało się pobrać raportu KYS."), kys: { ...emptySection(), status: "ERROR", warnings: ["REPORT_WARNING"] } }); }
    finally { if (generation === this.generation) { this.update({ kysBusy: false }); await this.refreshMetadata(); } }
  };
}
