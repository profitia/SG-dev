import type {PriceChangeIndexTheme} from './contracts'

/** UI projection only. Ownership, validation, I/O and calculations remain in the consumer. */
export interface PciBusinessComponent {
  id:string; name:string; weightPercent:number;
  benchmark:{businessBenchmarkId:string;displayName:string;providerSeries:{providerSeriesId:string};currency:string|null;unit:string|null;frequency:string|null};
  valueKind:''|'PRICE_LEVEL'|'PRICE_INDEX'
  /** One component-local declaration, submitted by the host to the authoritative preparer. */
  preparationMethod?:{periodBasis?:'POINT_IN_TIME'|'END_OF_PERIOD'|'PERIOD_AVERAGE';reduction:'AUTO'|'NATIVE_VALUE'|'END_OF_PERIOD'|'AVAILABLE_OBSERVATION_AVERAGE';verified:boolean}
  /** Optional consumer-provided semantic projection; carries no calculation or access decision. */
  qualification?:{classification:string;eligibility:string|null;reason:string;status?:'SUITABLE'|'UNSUITABLE'|'VERIFY'|'NOT_EVALUATED'}
}
export interface PciBusinessPurchase {
  amount:string;currency:string;unit:string;taxBasis:''|'NET'|'GROSS';deliveryBasis:string;
  purchaseDate:string;referenceDate:string;economicPeriodApproved:boolean;
  periodBasis:''|'POINT_IN_TIME'|'END_OF_PERIOD'|'PERIOD_AVERAGE';reduction:'NATIVE_ONLY'|'END_OF_PERIOD'|'OBSERVATION_AVERAGE'
}
export interface PciBusinessNode {
  date:string;cci:number|null;price:number|null;changePercent:number|null;
  components:readonly {id:string;price:number|null;contribution:number|null;changePercent:number|null}[]
}
export interface PciBusinessResult {
  methodologyId:string;cadence:string;baseDate:string;basePrice:number;currency:string;unit:string;
  nodes:readonly PciBusinessNode[];limitations:readonly string[]
}
/** Availability projected by the host's existing CCI adapter, never calculated by the UI. */
export interface PciBasePreparation {
  cadence:string|null; cutoff:string;
  components:readonly {id:string;frequency:string|null;unit:string|null;firstDate:string|null;lastDate:string|null;status:string}[];
  periods:readonly {start:string;endExclusive:string;eligible:boolean;requiresApproval:boolean}[];
  issues:readonly {code:string;message:string}[];
  canAnalyse:boolean
}
export interface PciBusinessController {
  name:string;components:readonly PciBusinessComponent[];purchase:PciBusinessPurchase;
  step:1|2|3|'result';ready:boolean;busy:boolean;error:string|null;result:PciBusinessResult|null;
  qualificationIssue?:string|null
  smart?:PciSmartController
  preparation?:{status:'idle'|'loading'|'ready'|'error';data:PciBasePreparation|null;error:string|null};onPrepare?:()=>void;
  categorySaveStatus:'idle'|'saving'|'saved'|'error';
  onNameChange:(name:string)=>void;
  onComponentChange:(id:string,patch:Partial<Pick<PciBusinessComponent,'name'|'weightPercent'|'valueKind'|'preparationMethod'>>)=>void;
  onRemove:(id:string)=>void;onPickBenchmark:(componentId:string|null)=>void;
  onPurchaseChange:(patch:Partial<PciBusinessPurchase>)=>void;
  onStep:(step:1|2|3|'result')=>void;onAnalyse:()=>void;onSaveCategory:()=>void;onClose:()=>void
}

/** Host-supplied presentation only. No history alignment, authority or mathematics in the module. */
export interface PciSmartIssue {code:string;message:string;componentId?:string;period?:string;usedInWindow?:boolean}
export interface PciSmartComponent {
  id:string;benchmark:string;seriesId:string;provider:string;weightPercent:number
  valueKind:'PRICE_LEVEL'|'PRICE_INDEX'|null;nativeCadence:string|null;periodBasis:string|null
  evidence:readonly string[];verificationRequired:boolean;firstDate:string|null;lastDate:string|null
  unit:string|null;currency:string|null;historyFingerprint:string|null;expectedObservations:'UNKNOWN';warnings:readonly PciSmartIssue[]
}
export interface PciSmartCandidate {
  id:string;mode:'STRICT_PURCHASE_REFERENCE'|'EARLIER_MARKET_PROXY'
  period:{cadence:string;start:string;endExclusive:string};basis:string
  quality:'QUALIFIED_COMPLETE'|'QUALIFIED_PARTIAL_DISCLOSED';recommended:boolean;requiresApproval:boolean
  olderExplicitSelection:boolean;lagDays:number;canCalculateMarketIndex:true;canCalculateIndexedPrice:boolean
  analysisWindow:{start:string;endExclusive:string}
  components:readonly {id:string;method:string;methodVersion:string;sourceBasis:string|null;targetBasis:string;sourceDates:readonly string[];sourceCount:number;expectedObservations:'UNKNOWN';quality:string;value:number|null;historyFingerprint:string|null;issues:readonly PciSmartIssue[]}[]
}
export interface PciSmartPreparation {
  version:string;id:string;purchaseDate:string;cutoff:string
  state:'STRICT_PURCHASE_REFERENCE'|'EARLIER_MARKET_PROXY'|'NO_QUALIFIED_REFERENCE'|'VERIFICATION_REQUIRED'
  recommendedCandidateId:string|null;candidates:readonly PciSmartCandidate[];components:readonly PciSmartComponent[]
  issues:readonly PciSmartIssue[];historicalDiagnostics:readonly PciSmartIssue[];availableYears:readonly number[]
  recommendationPolicy:string;recommendationStart:string;analysisWindow:{start:string;endExclusive:string};limitations:readonly string[]
}
export interface PciMarketIndexResult {
  variant:'EARLIER_MARKET_PROXY';methodologyId:string;cadence:string;baseDate:string
  purchaseDate:string;purchaseAmount:number;purchaseCurrency:string;purchaseUnit:string
  comparisonStatus:'COMPARISON_AVAILABLE'|'NO_LATER_COMPARISON_POINT'
  nodes:readonly {date:string;cci:number|null;changePercent:number|null;components:readonly {id:string;contributionPP:number|null}[]}[]
  limitations:readonly string[]
}
export interface PciSmartController {
  status:'idle'|'loading'|'ready'|'error';data:PciSmartPreparation|null;error:string|null
  selectedCandidateId:string|null;strictPeriodAccepted:boolean;proxyMarketOnlyAccepted:boolean
  olderYear:number|null;marketResult:PciMarketIndexResult|null;reference:PciSmartCandidate|null
  onSelectCandidate:(id:string)=>void;onStrictPeriodAccepted:(accepted:boolean)=>void
  onProxyMarketOnlyAccepted:(accepted:boolean)=>void;onOlderYear:(year:number|null)=>void
  onRetry:()=>void
}
export interface PriceChangeIndexBusinessProps {
  mode:'business';view:'pci3';controller:PciBusinessController;
  theme?:PriceChangeIndexTheme;onThemeChange?:(theme:PriceChangeIndexTheme)=>void;
  className?:string;locale?:'pl'|'en'
}
