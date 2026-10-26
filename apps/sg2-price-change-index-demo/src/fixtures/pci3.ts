export type Scenario='complete'|'missing'|'no-anchor'|'unpublished'|'conditions'|'fx-missing'|'stale';
export type Unit='mb'|'km'|'szt.';
export type Currency='PLN'|'EUR'|'USD';
export type Component={id:string;name:string;weight:number;benchmark:string;seriesId:string;values:number[];color:string;unit:string;currency:string;frequency:string;aggregation:string};
export type Purchase={price:string;currency:Currency;unit:Unit;month:number;tax:'netto'|'brutto';delivery:'z dostawą'|'bez dostawy';terms:string};
export type Offer={price:string;currency:Currency;unit:Unit;month:number;tax:'netto'|'brutto';delivery:'z dostawą'|'bez dostawy';supplier:string;converted:boolean;termsConfirmed:boolean};
export type Analysis={id:string;name:string;categoryId:string;components:Component[];purchase:Purchase;version:number;dataRevision:string};
export type Comparison={id:string;analysis:Analysis;offer:Offer;reference:number;normalizedOffer:number;created:string};
export const DEMO_ANCHOR_MONTH = 16; // May 2024
export const DEMO_OFFER_MONTH = 17; // June 2024
export const DEMO_LAST_AVAILABLE_MONTH = 44; // September 2026, most recent closed DEMO month
const nodeDate=(i:number)=>new Date(Date.UTC(2023,i,1));
const monthLabel=(i:number)=>nodeDate(i).toLocaleDateString('pl-PL',{month:'long',year:'numeric',timeZone:'UTC'});
export const dates=Array.from({length:45},(_,i)=>{const t=monthLabel(i);return t.charAt(0).toUpperCase()+t.slice(1)});
export const shortDates=Array.from({length:45},(_,i)=>nodeDate(i).toLocaleDateString('pl-PL',{month:'short',timeZone:'UTC'}));
export const fromDates=Array.from({length:45},(_,i)=>nodeDate(i).toLocaleDateString('pl-PL',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).replace(/^\d+\s+/,''));
export const dateLabels=Array.from({length:45},(_,i)=>nodeDate(i).toISOString().slice(0,7));
// Construct synthetic source histories with independent movement patterns.
// All DEMO series have May 2024 value 100. Two model checkpoints:
// February 2024 = 900 PLN/mb and June 2024 = 1100 PLN/mb for P0=1000.
const rel=(name:string,i:number)=>{
 const d=i-DEMO_ANCHOR_MONTH;
 if(name==='pvc')return 1+.007*d+.045*Math.sin(d*.77);
 if(name==='energy')return 1+.013*d+.10*Math.sin(d*.57);
 if(name==='labor')return 1+.006*d+.012*Math.sin(d*.35);
 if(name==='transport')return 1+.009*d+.065*Math.sin(d*.8);
 return 1+.016*d+.11*Math.sin(d*.53)+.02*(Math.cos(d*.31)-1);
};
const syntheticValue=(name:string,i:number):number=>{
 if(name==='copper'&&(i===13||i===17)){
  const target=i===13?.9:1.1;
  const other=.20*rel('pvc',i)+.10*rel('energy',i)+.07*rel('labor',i)+.03*rel('transport',i);
  return 100*(target-other)/.60;
 }
 return 100*rel(name,i);
};
const history=(name:string)=>dates.map((_,i)=>syntheticValue(name,i));
export const fmt=(n:number|null|undefined,d=2)=>n==null?'—':n.toLocaleString('pl-PL',{minimumFractionDigits:d,maximumFractionDigits:d});
export const sign=(n:number|null|undefined,d=2)=>n==null?'—':(n>0?'+':n<0?'−':'')+fmt(Math.abs(n),d);
export const sourceComponents:Component[]=[
 {id:'copper',name:'Miedź',weight:60,benchmark:'Copper price series',seriesId:'DEMO-COPPER',values:history('copper'),color:'#2450a4',unit:'USD/t',currency:'USD',frequency:'Dzienna',aggregation:'Średnia miesięczna'},
 {id:'pvc',name:'PVC / izolacja',weight:20,benchmark:'PVC price series',seriesId:'DEMO-PVC',values:history('pvc'),color:'#42a5bd',unit:'EUR/t',currency:'EUR',frequency:'Tygodniowa',aggregation:'Wybrana metoda do zamkniętego miesiąca'},
 {id:'energy',name:'Energia',weight:10,benchmark:'Industrial electricity',seriesId:'DEMO-ENERGY',values:history('energy'),color:'#ef9d45',unit:'PLN/MWh',currency:'PLN',frequency:'Miesięczna',aggregation:'Opublikowana wartość miesięczna'},
 {id:'labor',name:'Praca',weight:7,benchmark:'Labor cost indicator',seriesId:'DEMO-LABOR',values:history('labor'),color:'#9b7bb3',unit:'indeks',currency:'—',frequency:'Miesięczna',aggregation:'Opublikowana wartość miesięczna'},
 {id:'transport',name:'Transport',weight:3,benchmark:'Transport cost indicator',seriesId:'DEMO-TRANSPORT',values:history('transport'),color:'#77a76a',unit:'indeks',currency:'—',frequency:'Miesięczna',aggregation:'Opublikowana wartość miesięczna'}
];
export const cloneComponents=(cs:Component[])=>cs.map(c=>({...c,values:[...c.values]}));
export const categories=[
 {id:'cable',name:'Kabel miedziany 3 × 2,5 mm²',ready:true,revision:'CB-014 · r3',components:cloneComponents(sourceComponents)},
 {id:'steel',name:'Konstrukcje stalowe',ready:true,revision:'CB-021 · r1',components:cloneComponents(sourceComponents.filter(c=>c.id!=='pvc').map(c=>({...c,name:c.id==='copper'?'Stal':c.name,benchmark:c.id==='copper'?'Steel price series':c.benchmark,seriesId:c.id==='copper'?'DEMO-STEEL':c.seriesId,id:c.id==='copper'?'steel':c.id,weight:c.id==='copper'?65:c.id==='labor'?20:c.id==='energy'?10:5})))},
 {id:'pack',name:'Materiały opakowaniowe',ready:false,revision:'CB-033 · szkic',components:cloneComponents(sourceComponents.slice(0,2).map((c,i)=>({...c,weight:i===0?40:25,seriesId:i===1?'':c.seriesId,benchmark:i===1?'Nie przypisano benchmarku':c.benchmark})))}
];
export const defaultPurchase=():Purchase=>({price:'1000',currency:'PLN',unit:'mb',month:DEMO_ANCHOR_MONTH,tax:'netto',delivery:'z dostawą',terms:'Dostawa do magazynu · ta sama specyfikacja produktu'});
export const defaultOffer=():Offer=>({price:'1100',currency:'PLN',unit:'mb',month:DEMO_OFFER_MONTH,tax:'netto',delivery:'z dostawą',supplier:'Dostawca A',converted:false,termsConfirmed:true});
export const seedAnalysis=():Analysis=>({id:'CA-DEMO-001',name:'Kabel miedziany 3 × 2,5 mm²',categoryId:'cable',components:cloneComponents(sourceComponents),purchase:defaultPurchase(),version:1,dataRevision:'DEMO-SYNTHETIC-2026-09'});
export const snapshot=(a:Analysis):Analysis=>({...a,components:cloneComponents(a.components),purchase:{...a.purchase}});
export const isStructureReady=(cs:Component[])=>cs.length>=2&&Math.abs(cs.reduce((s,c)=>s+c.weight,0)-100)<.00001&&cs.every(c=>c.weight>0&&c.name.trim()&&c.seriesId);
export function observation(c:Component,m:number,s:Scenario='complete'):number|null{
 if(!Number.isInteger(m)||m<0||m>=dates.length)return null;
 if(s==='missing'&&m===DEMO_OFFER_MONTH&&c.id==='labor')return null;
 if(s==='no-anchor'&&m===DEMO_ANCHOR_MONTH&&(c.id==='copper'||c.id==='steel'))return null;
 if(s==='stale'&&m===DEMO_LAST_AVAILABLE_MONTH&&c.id==='energy')return null;
 return c.values[m]??null;
}
// CCI is re-based to the buyer's ACTUAL purchase month, not to the dataset start.
// Fixed cost-breakdown weights always refer to the user's purchase price.
export function cci(a:Analysis,m:number,s:Scenario='complete'):number|null{
 if(!isStructureReady(a.components))return null;
 const ratios=a.components.map(c=>{
  const base=observation(c,a.purchase.month,s),level=observation(c,m,s);
  return base===null||base<=0||level===null||level<=0?null:level/base;
 });
 if(ratios.some(r=>r===null))return null;
 return 100*ratios.reduce<number>((total,r,i)=>total+r!*a.components[i].weight/100,0);
}
export function indexedPrice(a:Analysis,m:number,s:Scenario='complete'):number|null{
 const index=cci(a,m,s),p=Number(a.purchase.price);
 return index===null||!(p>0)?null:p*index/100;
}
export function contribution(a:Analysis,c:Component,m:number,s:Scenario='complete'){
 const base=observation(c,a.purchase.month,s),value=observation(c,m,s);
 const p=Number(a.purchase.price);
 if(base===null||base<=0||value===null||value<=0||!(p>0))return {pp:null,cash:null,change:null};
 const change=(value/base-1)*100;
 const pp=c.weight*change/100;
 return {pp,cash:p*pp/100,change};
}
export function fx(from:Currency,to:Currency,m:number,s:Scenario):number|null{
 if(from===to)return 1;
 if(s==='fx-missing'||m<0||m>=dates.length)return null;
 const eur=4.2+.12*Math.sin(m*.27),usd=3.85+.18*Math.cos(m*.19);
 const rates:Record<Currency,number>={PLN:1,EUR:eur,USD:usd};
 return rates[from]/rates[to]; // DEMO FX only
}
export function unitFactor(from:Unit,to:Unit):number|null{
 if(from===to)return 1;
 if(from==='szt.'||to==='szt.')return null;
 const meters={mb:1,km:1000};return meters[to]/meters[from];
}
export function compare(a:Analysis,o:Offer,s:Scenario='complete'){
 const ref=indexedPrice(a,o.month,s),rate=fx(o.currency,a.purchase.currency,o.month,s),factor=unitFactor(o.unit,a.purchase.unit);
 const needsConversion=o.currency!==a.purchase.currency||o.unit!==a.purchase.unit;
 const taxMatch=o.tax===a.purchase.tax,deliveryMatch=o.delivery===a.purchase.delivery;
 const normalized=rate==null||factor==null?null:Number(o.price)*rate*factor;
 const comparable=o.termsConfirmed&&taxMatch&&deliveryMatch&&rate!=null&&factor!=null&&(!needsConversion||o.converted);
 const valid=Number(o.price)>0&&ref!=null&&comparable;
 const gap=valid?normalized!-ref!:null;
 return {ref,rate,factor,needsConversion,taxMatch,deliveryMatch,normalized,comparable,valid,gap,gapPct:valid?gap!/ref!*100:null,supplierChange:valid?(normalized!/Number(a.purchase.price)-1)*100:null,marketChange:ref==null?null:(ref/Number(a.purchase.price)-1)*100};
}
export const scenarios:[Scenario,string][]=[['complete','Dane kompletne'],['missing','Luka w danych'],['no-anchor','Brak danych z zakupu'],['unpublished','Okres nieopublikowany'],['conditions','Różne warunki cen'],['fx-missing','Brak kursu walutowego'],['stale','Opóźniony benchmark']];
export const canonAuthority={projectId:'460628300646219776',componentId:'460628347660177408',revisionId:'463214697194356736',name:'SRM · Biblioteka Elementów i Zachowań UX/UI',destinationProjectId:'463295321573851136',conceptVersion:2,sourceComponents:['CanonButton','CanonInput','CanonSelect','CanonHeader','CanonSideMenu','CanonHistoryDialog'],scope:'UX prototype only; synthetic series and FX; session-only persistence'};

export const suppliers = ['MetalCable Polska', 'CopperWire Industries', 'Elektra Kabel'];
export function entryAnalysis(kind:'direct'|'benchmark'|'srm'):Analysis {
    const a = seedAnalysis();
    if (kind === 'benchmark') {
      a.id = 'V3-BENCHMARK';
      a.categoryId = 'custom';
      a.name = 'Kategoria na bazie Copper';
      a.components = [{
        ...sourceComponents[0],
        weight: 60
      }];
    }
    if (kind === 'srm') {
      a.id = 'V3-SRM';
    }
    if (kind === 'direct') {
      a.id = 'V3-NEW';
      a.components = cloneComponents(a.components);
    }
    return a;
}
