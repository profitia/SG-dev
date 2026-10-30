import type {PriceChangeIndexTheme} from './contracts'

/** UI projection only. Ownership, validation, I/O and calculations remain in the consumer. */
export interface PciBusinessComponent {
  id:string; name:string; weightPercent:number;
  benchmark:{businessBenchmarkId:string;displayName:string;providerSeries:{providerSeriesId:string};currency:string|null;unit:string|null;frequency:string|null};
  valueKind:''|'PRICE_LEVEL'|'PRICE_INDEX'
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
  preparation?:{status:'idle'|'loading'|'ready'|'error';data:PciBasePreparation|null;error:string|null};onPrepare?:()=>void;
  categorySaveStatus:'idle'|'saving'|'saved'|'error';
  onNameChange:(name:string)=>void;
  onComponentChange:(id:string,patch:Partial<Pick<PciBusinessComponent,'name'|'weightPercent'|'valueKind'>>)=>void;
  onRemove:(id:string)=>void;onPickBenchmark:(componentId:string|null)=>void;
  onPurchaseChange:(patch:Partial<PciBusinessPurchase>)=>void;
  onStep:(step:1|2|3|'result')=>void;onAnalyse:()=>void;onSaveCategory:()=>void;onClose:()=>void
}
export interface PriceChangeIndexBusinessProps {
  mode:'business';view:'pci3';controller:PciBusinessController;
  theme?:PriceChangeIndexTheme;onThemeChange?:(theme:PriceChangeIndexTheme)=>void;
  className?:string;locale?:'pl'|'en'
}
