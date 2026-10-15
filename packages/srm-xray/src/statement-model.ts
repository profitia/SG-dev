import type { FinancialPeriod } from './contracts';
import { amountInThousands, financialLabels } from './financial-labels';
import type { FinancialHistoryPoint } from './financial-history-export';
export type StatementRow = {id:string;name:string;section:string;group:string;points:FinancialHistoryPoint[]};
/** Decimal shift, never a floating-point roundtrip, for spreadsheet export. */
export function statementRawThousands(amount:string, unit:string):string {
  if(unit==='THOUSAND_PLN') return amount;
  const negative=amount.startsWith('-'), [whole,fraction='']=amount.replace(/^-/, '').split('.');
  const padded=whole.padStart(4,'0'), integer=padded.slice(0,-3).replace(/^0+(?=\d)/,'');
  const decimal=(padded.slice(-3)+fraction).replace(/0+$/,'');
  return (negative?'-':'')+integer+(decimal?'.'+decimal:'');
}
export function statementPoints(periods:readonly FinancialPeriod[],code:string):FinancialHistoryPoint[] {
 return periods.map(p=>{
   const fact=p.facts.find(f=>f.metricCode===code);
   const validated=fact?amountInThousands(fact.amount,fact.currency,fact.unit):null;
   const rawValue=fact&&validated!==null?statementRawThousands(fact.amount,fact.unit):null;
   // Parse the shifted decimal once: dividing an already-parsed float can differ
   // by one ULP and make the shared export reject its exact source string.
   const value=rawValue===null?null:Number(rawValue);
   const source=p.sourceRegistration;
   return {year:Number(p.to.slice(0,4)),value,rawValue,...(source?{information:`Sprawozdanie: ${source.legalName ?? 'podmiot'} · KRS ${source.krs}${source.relationship==='PREDECESSOR'?' · poprzednik przed przekształceniem':''}.`}:{})};
 });
}
export function statementRows(periods:readonly FinancialPeriod[]):StatementRow[] {
 const msr=periods.length>0&&periods.every(p=>p.accountingStandard==='IAS_IFRS');
 const codes=new Set([...(msr?[]:['PALA_NRFS','PALA_OAC','PALA_NPL']),...periods.flatMap(p=>p.facts.map(f=>f.metricCode))]);
 return [...codes].filter(c=>c.startsWith('PALA_')||c.startsWith('BS_')||c==='MSR_REVENUE').map(code=>({
  id:code,name:code==='MSR_REVENUE'?'Przychody MSR/MSSF':financialLabels[code]?.label??code,
  section:financialLabels[code]?.group??(code.startsWith('BS_')?'Bilans':'Rachunek zysków i strat'),
  group:financialLabels[code]?.group??'Pozycja źródłowa',points:statementPoints(periods,code)
 }));
}
