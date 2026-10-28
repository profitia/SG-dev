import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AdpWorkspace,FIELD_DEFINITIONS} from '../src/index';
import type {AdpLocalEvent,AdpNavigation,AdpPresentationModel,AdpTheme} from '../src/types';

const approvedDocumentCopy={declarations:[
 'Znamy Kodeks postępowania dla partnerów biznesowych (https://porr-group.com/group/einkauf) i uznajemy oraz popieramy zawarte w nim wartości i zasady.',
 'Potwierdzamy, że w naszym łańcuchu dostaw nie ma pracy dzieci i zobowiązujemy się do przestrzegania zasad UN Global Compact (https://unglobalcompact.org/what-is-gc/mission/principles) w obszarach praw człowieka, pracy, środowiska i przeciwdziałania korupcji.'
],privacyText:"(Proszę NIE wypełniać odręcznie. Szczegóły na temat przetwarzania danych można znaleźć pod adresem: https://www.porr-group.com/datenschutz)",archiveNote:"Zewnętrzne i wewnętrzne podpisanie dokumentu w systemie SAP z podaniem daty wygaśnięcia (data podpisania +3 lata lub +1 rok w przypadku dostawców o znaczeniu istotnym) należy zarchiwizować. W przypadku rezygnacji z wewnętrznego podpisania archiwizacja w systemie SAP stanowi potwierdzenie wewnętrznej kontroli przeprowadzonej przez osobę odpowiedzialną za archiwizację.",documentMetadata:["Dokumentacja zarządzania(Public) · FC Główny Arkusz Danych Podstawowych · GP00000", "13/03/2026 10:00:57 · FC_SP02_01_001015_GP00000_pl · Bayer Philip/Mroczkowska Magdalena · 1/1"]};
export function makeModel(filled=false):AdpPresentationModel{
 const values:Record<string,string>=Object.fromEntries(FIELD_DEFINITIONS.map(f=>[f.id,'']));
 if(filled)Object.assign(values,{name:'Alfa — karta testowa',country:'Polska',terms:'0',scope:'Pierwszy wiersz\nDrugi wiersz'});
 return {organizationDisplayName:'Organizacja testowa',form:{values,roles:[],answers:{},...approvedDocumentCopy},owner:'',ownerOptions:['Opiekun testowy 1','Opiekun testowy 2'],categoryOptions:['Kategoria testowa A','Kategoria testowa B'],categories:[],categorySuggestions:[],contacts:[],locations:[],relations:[],activities:[],documents:[],projects:[],turnover:[],ratings:[],warning:null,warningHistory:[],plan:{year:'2026',goal:'',result:''},keywords:[]};
}
const localId=()=>`local-${crypto.randomUUID()}`;
export function reducePreview(m:AdpPresentationModel,e:AdpLocalEvent):AdpPresentationModel{
 if(e.type==='form.change')return {...m,form:{...m.form,values:{...m.form.values,[e.field]:e.value}}};
 if(e.type==='form.role')return {...m,form:{...m.form,roles:e.selected?[...new Set([...m.form.roles,e.role])]:m.form.roles.filter(x=>x!==e.role)}};
 if(e.type==='form.answer')return {...m,form:{...m.form,answers:{...m.form.answers,[e.index]:e.value}}};
 if(e.type==='owner.select')return {...m,owner:e.owner};
 if(e.type==='category.assign')return {...m,categories:[...new Set([...m.categories,e.value])]};
 if(e.type==='category.remove')return {...m,categories:m.categories.filter(x=>x!==e.value)};
 if(e.type==='category.suggest')return {...m,categorySuggestions:[...m.categorySuggestions,e.value]};
 if(e.type==='activity.complete')return {...m,activities:m.activities.map(a=>a.id===e.id?{...a,done:!a.done}:a)};
 if(e.type==='keyword.add')return {...m,keywords:[...m.keywords,{id:localId(),text:e.text}]};
 if(e.type==='keyword.edit')return {...m,keywords:m.keywords.map(k=>k.id===e.id?{...k,text:e.text}:k)};
 if(e.type==='keyword.remove')return {...m,keywords:m.keywords.filter(k=>k.id!==e.id)};
 if(!('values' in e))return m;
 const v=e.values,id=localId(),when='2026-10-28';
 if(e.type==='contact.add')return {...m,contacts:[...m.contacts,{id,name:v.name,role:v.role??'',email:v.email??'',phone:v.phone??''}]};
 if(e.type==='location.add')return {...m,locations:[...m.locations,{id,name:v.name,address:v.address,scope:v.scope??''}]};
 if(e.type==='relation.add')return {...m,relations:[...m.relations,{id,name:v.name,type:v.type,source:v.source,when}]};
 if(e.type==='activity.add')return {...m,activities:[{id,type:v.type,title:v.title,when:v.when,people:v.people??'',body:v.body,next:v.next??'',due:v.due??'',owner:v.owner??'',done:false,fileName:v.fileName??''},...m.activities]};
 if(e.type==='document.add')return {...m,documents:[...m.documents,{id,type:v.type,name:v.name,when:v.when,note:v.body??'',signed:v.signed??''}]};
 if(e.type==='rating.add')return {...m,ratings:[{id,kind:v.kind==='fulfilment'?'fulfilment':'negotiation',score:Number(v.score),scale:6,direction:'higher',comment:v.comment??'',project:v.project??'',author:'Autor testowy',when},...m.ratings]};
 if(e.type==='plan.change')return {...m,plan:{...m.plan,goal:v.goal,result:v.result??''}};
 if(e.type==='warning.add'){const warning={id,body:v.body,author:'Autor testowy',when,action:'Dodano ostrzeżenie'};return {...m,warning,warningHistory:[...m.warningHistory,warning]};}
 if(e.type==='warning.remove')return {...m,warning:null,warningHistory:[...m.warningHistory,{id,body:v.body,author:'Autor testowy',when,action:'Zdjęto ostrzeżenie'}]};
 return m;
}
export function PreviewHost({filled=false,theme='light',locale='pl',onEvent}:{filled?:boolean;theme?:AdpTheme;locale?:'pl'|'en';onEvent?:(e:AdpLocalEvent)=>void}){
 const [model,setModel]=useState(()=>makeModel(filled)),[navigation,setNavigation]=useState<AdpNavigation>({view:'overview',section:'company',dataArea:'adp'}),[active,setActive]=useState(true);
 return <><button id="preview-return" hidden={active} onClick={()=>setActive(true)}>Powrót do karty</button><AdpWorkspace contractVersion="1.0.0" instanceId="local-preview-instance" locale={locale} theme={theme} model={model} navigation={navigation} active={active} onNavigate={setNavigation} onReturn={()=>setActive(false)} onLocalEvent={(event,instance)=>{if(instance!=='local-preview-instance')return;onEvent?.(event);setModel(m=>reducePreview(m,event));}}/></>;
}
if(typeof document!=='undefined'){
 const target=document.getElementById('adp-preview');
 if(target){const q=new URLSearchParams(window.location.search);createRoot(target).render(<PreviewHost filled={q.get('filled')==='1'} theme={q.get('theme')==='dark'?'dark':'light'} locale={q.get('locale')==='en'?'en':'pl'}/>);}
}
