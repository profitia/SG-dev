export type Scenario='complete'|'missing'|'no-anchor'|'unpublished'|'conditions'|'fx-missing'|'stale';
export type Unit='mb'|'km'|'szt.';
export type Currency='PLN'|'EUR'|'USD';
export type Component={id:string;name:string;weight:number;benchmark:string;seriesId:string;values:number[];color:string;unit:string;currency:string;frequency:string;aggregation:string};
export type Purchase={price:string;currency:Currency;unit:Unit;month:number;tax:'netto'|'brutto';delivery:'z dostawą'|'bez dostawy';terms:string};
export type Offer={price:string;currency:Currency;unit:Unit;month:number;tax:'netto'|'brutto';delivery:'z dostawą'|'bez dostawy';supplier:string;converted:boolean;termsConfirmed:boolean};
export type Analysis={id:string;name:string;categoryId:string;components:Component[];purchase:Purchase;version:number;dataRevision:string};
export type Comparison={id:string;analysis:Analysis;offer:Offer;reference:number;normalizedOffer:number;created:string};
export const dates=['Kwiecień 2024','Maj 2024','Czerwiec 2024','Lipiec 2024','Sierpień 2024','Wrzesień 2024'];
export const shortDates=['Kwi','Maj','Cze','Lip','Sie','Wrz'];
export const fromDates=['kwietnia 2024','maja 2024','czerwca 2024','lipca 2024','sierpnia 2024','września 2024'];
export const fmt=(n:number|null|undefined,d=2)=>n==null?'—':n.toLocaleString('pl-PL',{minimumFractionDigits:d,maximumFractionDigits:d});
export const sign=(n:number|null|undefined,d=2)=>n==null?'—':(n>0?'+':n<0?'−':'')+fmt(Math.abs(n),d);
export const sourceComponents:Component[]=[
 {id:'copper',name:'Miedź',weight:60,benchmark:'Copper price series',seriesId:'DEMO-COPPER',values:[100,105,115.5,126,120.75],color:'var(--brand)',unit:'USD/t',currency:'USD',frequency:'Dzienna',aggregation:'Średnia miesięczna'},
 {id:'pvc',name:'PVC / izolacja',weight:20,benchmark:'PVC price series',seriesId:'DEMO-PVC',values:[100,105,99.75,101.85,99.75],color:'var(--brand-light)',unit:'EUR/t',currency:'EUR',frequency:'Tygodniowa',aggregation:'Średnia obserwacji w miesiącu'},
 {id:'energy',name:'Energia',weight:10,benchmark:'Industrial electricity',seriesId:'DEMO-ENERGY',values:[100,105,112.35,117.6,115.5],color:'var(--sand)',unit:'PLN/MWh',currency:'PLN',frequency:'Miesięczna',aggregation:'Opublikowana wartość miesięczna'},
 {id:'labor',name:'Praca',weight:7,benchmark:'Labor cost indicator',seriesId:'DEMO-LABOR',values:[100,105,107.1,107.1,108.15],color:'var(--unknown)',unit:'indeks',currency:'—',frequency:'Miesięczna',aggregation:'Opublikowana wartość miesięczna'},
 {id:'transport',name:'Transport',weight:3,benchmark:'Transport cost indicator',seriesId:'DEMO-TRANSPORT',values:[100,105,110.6,100.1,97.65],color:'var(--text)',unit:'indeks',currency:'—',frequency:'Miesięczna',aggregation:'Opublikowana wartość miesięczna'}
];
export const cloneComponents=(cs:Component[])=>cs.map(c=>({...c,values:[...c.values]}));
export const categories=[
 {id:'cable',name:'Kabel miedziany 3 × 2,5 mm²',ready:true,revision:'CB-014 · r3',components:cloneComponents(sourceComponents)},
 {id:'steel',name:'Konstrukcje stalowe',ready:true,revision:'CB-021 · r1',components:cloneComponents(sourceComponents.filter(c=>c.id!=='pvc').map(c=>({...c,name:c.id==='copper'?'Stal':c.name,benchmark:c.id==='copper'?'Steel price series':c.benchmark,seriesId:c.id==='copper'?'DEMO-STEEL':c.seriesId,id:c.id==='copper'?'steel':c.id,weight:c.id==='copper'?65:c.id==='labor'?20:c.id==='energy'?10:5})))},
 {id:'pack',name:'Materiały opakowaniowe',ready:false,revision:'CB-033 · szkic',components:cloneComponents(sourceComponents.slice(0,2).map((c,i)=>({...c,weight:i===0?40:25,seriesId:i===1?'':c.seriesId,benchmark:i===1?'Nie przypisano benchmarku':c.benchmark})))}
];
export const defaultPurchase=():Purchase=>({price:'1000',currency:'PLN',unit:'mb',month:1,tax:'netto',delivery:'z dostawą',terms:'Dostawa do magazynu · ta sama specyfikacja produktu'});
export const defaultOffer=():Offer=>({price:'1100',currency:'PLN',unit:'mb',month:2,tax:'netto',delivery:'z dostawą',supplier:'Dostawca A',converted:false,termsConfirmed:true});
export const seedAnalysis=():Analysis=>({id:'CA-DEMO-001',name:'Kabel miedziany 3 × 2,5 mm²',categoryId:'cable',components:cloneComponents(sourceComponents),purchase:defaultPurchase(),version:1,dataRevision:'D-2024.08.01'});
export const snapshot=(a:Analysis):Analysis=>({...a,components:cloneComponents(a.components),purchase:{...a.purchase}});
export const isStructureReady=(cs:Component[])=>cs.length>=2&&Math.abs(cs.reduce((s,c)=>s+c.weight,0)-100)<.00001&&cs.every(c=>c.weight>0&&c.name.trim()&&c.seriesId);
export function observation(c:Component,m:number,s:Scenario='complete'):number|null{
 if(m<0||m>4)return null;
 if(s==='missing'&&m===2&&c.id==='labor')return null;
 if(s==='no-anchor'&&m===1&&(c.id==='copper'||c.id==='steel'))return null;
 if(s==='stale'&&m===4&&c.id==='energy')return null;
 return c.values[m]??null;
}
export function cci(a:Analysis,m:number,s:Scenario='complete'):number|null{
 if(!isStructureReady(a.components))return null;
 const values=a.components.map(c=>observation(c,m,s));
 if(values.some(v=>v==null))return null;
 return values.reduce<number>((sum,v,i)=>sum+v!*a.components[i].weight/100,0);
}
export function indexedPrice(a:Analysis,m:number,s:Scenario='complete'):number|null{
 const anchor=cci(a,a.purchase.month,s),target=cci(a,m,s),p=Number(a.purchase.price);
 return anchor==null||target==null||anchor<=0||p<=0?null:p*target/anchor;
}
export function contribution(a:Analysis,c:Component,m:number,s:Scenario='complete'){
 const b=cci(a,a.purchase.month,s),start=observation(c,a.purchase.month,s),end=observation(c,m,s);
 if(b==null||start==null||end==null)return {pp:null,cash:null,change:null};
 const pp=c.weight*(end-start)/b;
 return {pp,cash:Number(a.purchase.price)*pp/100,change:(end/start-1)*100};
}
export function fx(from:Currency,to:Currency,m:number,s:Scenario):number|null{
 if(from===to)return 1;
 if(s==='fx-missing'||m>4)return null;
 const r:Record<Currency,number[]>={PLN:[1,1,1,1,1],EUR:[4.28,4.3,4.32,4.35,4.3],USD:[4,4,3.9,3.8,3.85]};
 return r[from][m]/r[to][m];
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
