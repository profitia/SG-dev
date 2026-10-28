import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdpWorkspace,assertPresentationContract,FIELD_DEFINITIONS,FORM_SECTIONS} from '../src/index';
import type {AdpView,AdpWorkspaceProps} from '../src/types';
import {makeModel} from './preview';
const props=():AdpWorkspaceProps=>({contractVersion:'1.0.0',instanceId:'contract-test-instance',locale:'pl',theme:'light',model:makeModel(),navigation:{view:'overview',section:'company',dataArea:'adp'},onNavigate:()=>{},onReturn:()=>{},onLocalEvent:()=>{}});
test('all eight admitted product areas render in both themes without a second application shell',()=>{
 for(const theme of ['light','dark'] as const)for(const view of ['overview','data','cooperation','activities','documents','ratings','xray','newsfeed'] as AdpView[]){const p=props();const html=renderToStaticMarkup(<AdpWorkspace {...p} theme={theme} navigation={{...p.navigation,view}}/>);assert.match(html,new RegExp(`data-theme="${theme}"`));assert.equal((html.match(/<h1/g)??[]).length,1);assert.doesNotMatch(html,/iframe|Informacje o projekcie|Scenariusz prototypu|dashboard-relations|Pokaż przykładowe|Załaduj przykładowe|SAP DEMO|Firma Demonstracyjna|Symuluj prośbę/);}
});
test('the original43 fields remain present once across all five form sections, including international IDs and signature',()=>{
 assert.equal(FIELD_DEFINITIONS.length,43);assert.equal(new Set(FIELD_DEFINITIONS.map(f=>f.id)).size,43);assert.equal(FORM_SECTIONS.length,5);
 let fieldCount=0;
 for(const section of FORM_SECTIONS){const p=props();const html=renderToStaticMarkup(<AdpWorkspace {...p} navigation={{view:'data',dataArea:'adp',section:section.id}}/>);const expected=FIELD_DEFINITIONS.filter(f=>f.tab===section.id);fieldCount+=(html.match(/for="[^"]+-field-[^"]+"/g)??[]).length;for(const f of expected)assert(html.includes(`-field-${f.id}`),f.id);}
 assert.equal(fieldCount,43);
 const p=props(),html=renderToStaticMarkup(<AdpWorkspace {...p} navigation={{view:'data',dataArea:'adp',section:'declarations'}}/>);assert.match(html,/readonly=""/);assert.doesNotMatch(html,/PODPIS DEMONSTRACYJNY|symulację podpisu|Wstaw oznaczenie/);
});
test('the mount fails closed for incompatible or incomplete presentation contracts',()=>{
 for(const patch of [{contractVersion:'2.0.0'},{instanceId:''},{locale:'de'},{theme:'inverse'},{model:{...makeModel(),contacts:null}},{model:{...makeModel(),form:{...makeModel().form,declarations:[]}}},{model:{...makeModel(),ratings:[{id:'bad',kind:'negotiation',scale:6,score:8}]}}])assert.throws(()=>assertPresentationContract({...props(),...patch} as AdpWorkspaceProps));
});
test('long, multiline, empty and zero values are preserved without treating zero as absent',()=>{
 const m=makeModel(true);const p={...props(),model:{...m,form:{...m.form,values:{...m.form.values,name:'Bardzo długa nazwa '.repeat(20),terms:'0',scope:'Pierwszy wiersz\nDrugi wiersz'}},turnover:[{year:'2026',value:'0,00 PLN'},{year:'2025',value:null}]}};
 const cooperation=renderToStaticMarkup(<AdpWorkspace {...p} navigation={{...p.navigation,view:'cooperation'}}/>);assert.match(cooperation,/0,00 PLN/);assert.match(cooperation,/Brak danych/);
 const form=renderToStaticMarkup(<AdpWorkspace {...p} navigation={{view:'data',dataArea:'adp',section:'payments'}}/>);assert.match(form,/>0<\/textarea>/);
 const activity=renderToStaticMarkup(<AdpWorkspace {...p} navigation={{view:'data',dataArea:'adp',section:'activity'}}/>);assert(activity.includes('Pierwszy wiersz\nDrugi wiersz'));
});
test('nonintegrated X-Ray has no frame or live search and Newsfeed contains no invented results',()=>{
 const p=props();const x=renderToStaticMarkup(<AdpWorkspace {...p} navigation={{...p.navigation,view:'xray'}}/>);assert.match(x,/disabled=""[^>]*>Wyszukaj/);assert.doesNotMatch(x,/https?:\/\/|iframe|mgbi|vercly/i);
 const n=renderToStaticMarkup(<AdpWorkspace {...p} navigation={{...p.navigation,view:'newsfeed'}}/>);assert.match(n,/Nie dodano jeszcze publikacji/);assert.doesNotMatch(n,/polyline|nf-chart|nf-results|przykładowe publikacje|Google|Trends/);
});
test('mounting and inactive states are actual lifecycle inputs rather than public scenario controls',()=>{
 const p=props();for(const state of ['loading','error','unavailable'] as const){const html=renderToStaticMarkup(<AdpWorkspace {...p} state={state}/>);assert.doesNotMatch(html,/KARTA DOSTAWCY|type="checkbox"/);}
 const html=renderToStaticMarkup(<AdpWorkspace {...p} active={false}/>);assert.match(html,/hidden=""/);
});
test('approved document guidance and metadata are explicit host projections rather than discarded product content',()=>{
 const p=props(),model={...p.model,form:{...p.model.form,archiveNote:'Wytyczne dokumentu klienta',privacyText:'Informacja o dokumencie',documentMetadata:['Dokument klienta · wersja testowa','Strona testowa']}};
 const html=renderToStaticMarkup(<AdpWorkspace {...p} model={model} navigation={{view:'data',dataArea:'adp',section:'declarations'}}/>);
 for(const copy of ['Wytyczne dokumentu klienta','Dokument klienta · wersja testowa','Strona testowa'])assert(html.includes(copy));
});
