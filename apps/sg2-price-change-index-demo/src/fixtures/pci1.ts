export type Scenario = 'ready'|'empty'|'no-categories'|'partial'|'missing-base'|'stale'|'fx';
export type CurrencyPolicy = 'original'|'PLN'|'EUR';
export type Screen = 'home'|'select'|'configure'|'dashboard'|'category';
export type View = 'index'|'cumulative'|'monthly';
export type Component = {id:string;name:string;weight:number;benchmark:string;currency:string;unit:string;frequency:string;aggregation:string;values:number[];color:string};
export type Category = {id:string;name:string;description:string;ready:boolean;revision:string;components:Component[]};
export type Definition = {id:string;name:string;categoryId:string;version:number;base:number;currency:CurrencyPolicy;description:string;dataRevision:string;components:Component[];created:string};
export const months=['Maj 2024','Czerwiec 2024','Lipiec 2024'];
export const monthShort=['Maj','Cze','Lip'];
export const categories:Category[]=[{
 id:'cable',name:'Copper Cable 3 × 2,5 mm²',description:'Kabel miedziany · materiały i koszty przetworzenia',ready:true,revision:'CB-014 · r3',components:[
 {id:'copper',name:'Copper',weight:60,benchmark:'Copper price series',currency:'USD',unit:'USD/t',frequency:'Dzienna',aggregation:'Średnia miesięczna',values:[100,110,120],color:'#005A9C'},
 {id:'pvc',name:'PVC',weight:20,benchmark:'PVC price series',currency:'EUR',unit:'EUR/t',frequency:'Tygodniowa',aggregation:'Średnia obserwacji w miesiącu',values:[100,98,95],color:'#66B2FF'},
 {id:'energy',name:'Energy',weight:10,benchmark:'Industrial electricity',currency:'PLN',unit:'PLN/MWh',frequency:'Miesięczna',aggregation:'Opublikowana wartość miesięczna',values:[100,105,110],color:'#D2B48C'},
 {id:'labor',name:'Labor',weight:7,benchmark:'Labor cost indicator',currency:'—',unit:'indeks źródłowy',frequency:'Miesięczna',aggregation:'Opublikowana wartość miesięczna',values:[100,101,102],color:'#718191'},
 {id:'transport',name:'Transport',weight:3,benchmark:'Transport cost indicator',currency:'—',unit:'indeks źródłowy',frequency:'Miesięczna',aggregation:'Opublikowana wartość miesięczna',values:[100,103,105],color:'#294D70'}
 ]
},{id:'steel',name:'Steel Structures',description:'Konstrukcje stalowe · profil demonstracyjny',ready:true,revision:'CB-021 · r1',components:[
 {id:'steel',name:'Steel',weight:55,benchmark:'Steel price series',currency:'EUR',unit:'EUR/t',frequency:'Dzienna',aggregation:'Średnia miesięczna',values:[100,106,114],color:'#005A9C'},
 {id:'labor',name:'Labor',weight:25,benchmark:'Labor cost indicator',currency:'—',unit:'indeks źródłowy',frequency:'Miesięczna',aggregation:'Opublikowana wartość miesięczna',values:[100,101,102],color:'#718191'},
 {id:'energy',name:'Energy',weight:15,benchmark:'Industrial electricity',currency:'PLN',unit:'PLN/MWh',frequency:'Miesięczna',aggregation:'Opublikowana wartość miesięczna',values:[100,105,110],color:'#D2B48C'},
 {id:'transport',name:'Transport',weight:5,benchmark:'Transport cost indicator',currency:'—',unit:'indeks źródłowy',frequency:'Miesięczna',aggregation:'Opublikowana wartość miesięczna',values:[100,103,105],color:'#294D70'}
 ]
},{id:'pack',name:'Packaging Materials',description:'Opakowania · struktura wymaga uzupełnienia',ready:false,revision:'CB-033 · r1',components:[
 {id:'paper',name:'Paper',weight:40,benchmark:'Paper price series',currency:'EUR',unit:'EUR/t',frequency:'Miesięczna',aggregation:'Wartość miesięczna',values:[100,102,104],color:'#005A9C'},
 {id:'plastic',name:'Plastic',weight:25,benchmark:'Nie przypisano',currency:'—',unit:'—',frequency:'—',aggregation:'—',values:[100,101,102],color:'#66B2FF'}
 ]}];
export const fmt=(n:number|null|undefined,d=2)=>n==null?'—':n.toLocaleString('pl-PL',{minimumFractionDigits:d,maximumFractionDigits:d});
export const signed=(n:number|null|undefined,d=2)=>n==null?'—':(n>0?'+':n<0?'−':'')+fmt(Math.abs(n),d);
export const categoryOf=(d:Definition)=>categories.find(c=>c.id===d.categoryId)!;
export function createDefinition(categoryId='cable',base=0,currency:CurrencyPolicy='original',version=1):Definition {
 const c=categories.find(c=>c.id===categoryId)!;
 return {id:'CCI-DEMO-001',name:c.name+' — CCI',categoryId,version,base,currency,description:'',dataRevision:'D-2024.07.01',components:c.components.map(x=>({...x,values:[...x.values]})),created:'20.10.2026'};
}
// All observations and identifiers in this prototype are synthetic. No provider request.
export function fxFactor(c:Component,month:number,policy:CurrencyPolicy) {
 if(policy==='original'||c.currency==='—')return 1;
 const toPln:Record<string,number[]>={USD:[4,3.9,3.8],EUR:[4.3,4.32,4.35],PLN:[1,1,1]};
 const pln=toPln[c.currency]?.[month]??1;
 return policy==='PLN'?pln:pln/toPln.EUR[month];
}
export function componentIndex(c:Component,d:Definition,month:number,scenario:Scenario='ready'):number|null {
 if(d.base<0||scenario==='missing-base')return null;
 if(scenario==='partial'&&d.base===1&&c.id==='labor')return null;
 if(scenario==='fx'&&d.currency!=='original')return null;
 if(scenario==='partial'&&month===1&&c.id==='labor')return null;
 return c.values[month]*fxFactor(c,month,d.currency)/(c.values[d.base]*fxFactor(c,d.base,d.currency))*100;
}
export function totalIndex(d:Definition,month:number,scenario:Scenario='ready') {
 const values=d.components.map(c=>componentIndex(c,d,month,scenario));
 if(values.some(v=>v==null))return null;
 return values.reduce<number>((sum,v,i)=>sum+v!*d.components[i].weight/100,0);
}
export function monthlyChange(d:Definition,month:number,s:Scenario='ready') {
 if(month<=d.base)return null;
 const a=totalIndex(d,month,s),b=totalIndex(d,month-1,s);
 return a==null||b==null?null:(a/b-1)*100;
}
export function dataStatus(d:Definition,s:Scenario) {
 return d.base<0||s==='missing-base'||(s==='partial'&&d.base===1)||(s==='fx'&&d.currency!=='original')?'blocked':s==='partial'?'partial':'ready';
}
export const scenarioOptions:[Scenario,string][]=[['ready','Pełne dane'],['empty','Brak modeli'],['no-categories','Brak kategorii'],['missing-base','Brak danych bazowych'],['partial','Luka w czerwcu'],['stale','Opóźnione dane'],['fx','Brak kursów FX']];
export const currencyLabel=(p:CurrencyPolicy)=>p==='original'?'Oryginalne waluty benchmarków':'Ekspozycja kosztowa w '+p;
export const canonSource={sourceProjectId:'460628300646219776',sourceComponentId:'460628347660177408',revisionId:'463214697194356736',referenceProjectId:'463019127557226496',referenceRevisionId:'463222717299171328',destinationProjectId:'463295321573851136',importedOn:'2026-10-20',synchronization:'Explicit snapshot; no edits to source projects',canonicalAuthority:'SRM · Biblioteka Elementów i Zachowań UX/UI',secondaryReference:'Benchmark Finder is a usage example, not a second authority',reusedComponents:['CanonButton','CanonInput','CanonSelect','CanonTextarea','CanonHeader','CanonHistoryDialog','CanonSideMenu'],localAdaptations:['Header title slot','Menu destination labels and callbacks'],fontAuthority:'fontRoles from library-names.ts',colorAuthority:'srm-color-tokens.css',reused:['SpendGuruLogo','CanonElements','CanonDropdown','palette','spacing','menu/dock pattern','typography','motion'],localCompositions:['CCI chart: discrete monthly observations, base 100, missing data gaps','Cost drivers in percentage points','CCI readiness and version snapshots']};
