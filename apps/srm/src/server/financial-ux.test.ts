import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FinancialScannerMount } from "@profitia/srm-xray";
import { financialHistoryTsv, historyDomain, historyInformation, yearColor } from "../../../../packages/srm-xray/src/financial-history-export";
import { createConversationRequest, type AssistantApplicationContext } from "../../../../packages/srm-xray/src/assistant-context";

test("history export preserves decimals, negative and zero values, separates missing data and neutralizes text cells", () => {
  const tsv=financialHistoryTsv([
    {year:2025,value:123456789.1234,rawValue:"123456789.123400"},
    {year:2021,value:null,information:"Brak potwierdzonego odniesienia historycznego."},
    {year:2022,value:0,rawValue:"0"},
    {year:2023,value:-42.51,rawValue:"-42.5100",information:"=HYPERLINK(unsafe)\tsecond\nrow"},
  ],"PLN");
  const rows=tsv.split("\r\n").map(r=>r.split("\t"));
  assert.deepEqual(rows[0],["Rok","Wartość","Jednostka","Informacja"]);
  assert.deepEqual(rows.map(r=>r.length),[4,4,4,4,4]);
  assert.equal(rows[1][1],"");assert.equal(rows[1][3],"Brak danych.");
  assert.equal(rows[2][1],"0");assert.equal(rows[3][1],"-42,5100");
  assert.equal(rows[3][3],"'=HYPERLINK(unsafe) second row");assert.equal(rows[4][1],"123456789,123400");
  assert.doesNotMatch(tsv,/Brak potwierdzonego/);
  assert.equal(historyInformation({year:2025,value:-1,information:"Strata netto"}),"Strata netto");
});
test("chart scale includes zero and preserves negative sign; missing and all-zero series never fabricate a bar",()=>{
  for(const values of [[],[0,0]]) assert.deepEqual(historyDomain(values),{min:0,max:1,ticks:[0],emptyScale:true});
  const mixed=historyDomain([-20,40]);assert.ok(mixed.min<=-20&&mixed.max>=40);assert.ok(mixed.ticks.includes(0));
  const negative=historyDomain([-7,-2]);assert.equal(negative.max,0);assert.ok(negative.min<=-7);
  assert.equal(yearColor(8,9),"rgb(0,90,156)");assert.equal(yearColor(0,1),"rgb(0,90,156)");assert.notEqual(yearColor(0,9),yearColor(8,9));
});
test("future question captures an immutable context, independent of later dashboard changes",()=>{
  const context:AssistantApplicationContext={schemaVersion:1,dashboardInstanceId:"test",application:"SRM",source:{kind:"financial-data-module",version:"one",capturedOn:null,statementScope:"standalone"},supplier:{id:"supplier-a",name:"Test",nip:null,krs:null},view:{page:"supplier-intelligence-dashboard",radar:{year:2025,comparisonYear:2024,referenceSelection:"history",referenceKind:"history",referenceStatus:"unconfirmed"},indicators:{tab:"custom",label:"Własne",items:[{code:"CURRENT_RATIO",name:"Płynność",year:2023,value:"1.2",unit:"RATIO",availability:"available",reason:null}]},history:null},financialSummary:[]};
  const request=createConversationRequest("session-a"," Pytanie ",context);
  context.view.radar.year=2020;context.view.indicators.items[0].year=2019;
  assert.equal(request.contextSnapshot.view.radar.year,2025);assert.equal(request.contextSnapshot.view.indicators.items[0].year,2023);
  assert.equal(request.text,"Pytanie");assert.ok(Object.isFrozen(request.contextSnapshot.view.indicators.items[0]));
  assert.throws(()=>createConversationRequest("session-a","   ",context));
});
test("assistant SSR displays supplied identity and explicit no-data, without browser access or invented AI analysis",()=>{
  const html=renderToStaticMarkup(React.createElement(FinancialScannerMount,{report:null,assistant:{name:"Supplier without data",avatars:{male:"/male.png",anna:"/female.png"}}}));
  assert.match(html,/Cześć! Jestem SpendGuru/);assert.match(html,/Supplier without data/);assert.match(html,/Brak dostępnego okresu finansowego/);
  assert.match(html,/Otwórz czat w osobnym oknie/);assert.match(html,/Wyślij wiadomość[^>]*disabled/);
  assert.doesNotMatch(html,/Unilever|5213390341|542|przykładowa analiza|magicpath-prototype/);
  assert.equal((html.match(/data-radar-sector=/g)||[]).length,6);
});

import { load } from 'cheerio';
import { FinancialDataMount, type FinancialData } from '@profitia/srm-xray';
import { StatementChartCard, type StatementRow } from '../../node_modules/@profitia/srm-xray/src/statement-workspace';
const data: FinancialData = {periods: [2025,2024].map(year => ({
  from:`${year}-01-01`,to:`${year}-12-31`,scope:'standalone',documentId:`doc-${year}`,
  facts:['PALA_NRFS','PALA_OAC','PALA_NPL','BS_A_TA'].map(metricCode => ({metricCode,amount:'100000',currency:'PLN',unit:'PLN'}))
}))};
test('statement and balance keep all values without a selected-year column; export belongs to heading', () => {
  const $ = load(renderToStaticMarkup(React.createElement(FinancialDataMount, {
    section:{status:'SUCCESS',data,retrievedAt:null,effectiveAt:null,warnings:[]},
    selectedPeriod:{from:'2025-01-01',to:'2025-12-31'},onDownloadExcel:async()=>{}
  })));
  assert.equal($('.financial-table').length,2);
  assert.equal($('.financial-table [data-selected-period], .financial-table [aria-current]').length,0);
  assert.equal($('.financial-table th').filter((_,el)=>$(el).text()==='2025').length,2);
  assert.equal($('.xray-section-header button').text(),'Pobierz do Excela');
  assert.equal($('details summary').filter((_,el)=>$(el).text()==='Pobierz do Excela').length,0);
});
test('remove control is available only on custom charts, even if a built-in receives a callback', () => {
  for (const id of ['PALA_NRFS','PALA_OAC','PALA_NPL','BS_A_TA']) {
    const row:StatementRow={id,name:id,section:'Bilans',group:'Aktywa',points:[{year:2025,value:100}]};
    const $=load(renderToStaticMarkup(React.createElement(StatementChartCard,{row,onExpand:()=>{},onRemove:()=>{}})));
    assert.equal($('button[aria-label^="Usuń wykres"]').length,id==='BS_A_TA'?1:0);
    assert.equal($('button[aria-label^="Powiększ"]').length,1);
  }
});

import { FinancialHistoryChart } from '../../node_modules/@profitia/srm-xray/src/FinancialHistoryChart';
import { FinancialHistoryDialog } from '../../node_modules/@profitia/srm-xray/src/FinancialHistoryDialog';
test('history keeps signs, zero and missing distinct while all values sit outside bars with no selected-year strip', () => {
  const points=[{year:2022,value:-42},{year:2023,value:0},{year:2024,value:null},{year:2025,value:100}];
  for(const overview of [false,true]) {
    const $=load(renderToStaticMarkup(React.createElement(FinancialHistoryChart,{name:'Wynik',unit:'PLN',selectedYear:2025,points,overview})));
    assert.equal($('.srm-history-readout').length,0);
    assert.equal($('.srm-history-bar-label.above-bar').length,4);
    assert.equal($('.srm-history-bar-fill').length,2);
    assert.equal($('[data-year="2022"] .is-negative').length,1);
    assert.match($('[data-year="2022"] .srm-history-bar-label').text(),/-42/);
    assert.match($('[data-year="2023"] .srm-history-bar-label').text(),/^0/);
    assert.match($('[data-year="2024"] .srm-history-bar-label').text(),/Brak danych/);
    assert.equal($('.srm-overview-tooltip').length,0);
  }
});
test('history dialog close is the shared icon control with an accessible name and no visible text', () => {
  const $=load(renderToStaticMarkup(React.createElement(FinancialHistoryDialog,{title:'Historia',onClose:()=>{},children:'Dane'})));
  const close=$('button[aria-label="Zamknij"]');
  assert.equal(close.length,1);assert.equal(close.text(),'');assert.equal(close.find('svg').length,1);
  assert.equal(close.attr('data-library-component'),'SRM-C60');
});
