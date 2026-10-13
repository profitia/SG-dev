import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FinancialPeriod } from '@profitia/srm-xray';
import { statementPoints, statementRows, statementRawThousands } from '../../node_modules/@profitia/srm-xray/src/statement-model';
import { financialHistoryTsv } from '../../node_modules/@profitia/srm-xray/src/financial-history-export';
import { StatementChartCard } from '../../node_modules/@profitia/srm-xray/src/statement-workspace';
const period=(year:number,amount:string|null,unit='PLN',currency='PLN'):FinancialPeriod=>({from:`${year}-01-01`,to:`${year}-12-31`,scope:'standalone',documentId:String(year),facts:amount===null?[]:[{metricCode:'PALA_NPL',amount,unit,currency}]});
test('statement history preserves zero, missing and negative values, source unit and decimal export',()=>{
 const points=statementPoints([period(2025,'-1250.12345'),period(2024,'0'),period(2023,null),period(2022,'2.75','THOUSAND_PLN'),period(2021,'300','PLN','EUR')],'PALA_NPL');
 assert.deepEqual(points.map(p=>p.value),[-1.25012345,0,null,2.75,null]);
 assert.equal(points[0].rawValue,'-1.25012345');
 const lines=financialHistoryTsv(points,'PLN_THOUSANDS').split('\r\n');
 assert.ok(lines.includes('2024\t0\ttys. zł\t'));
 assert.ok(lines.includes('2025\t-1,25012345\ttys. zł\t'));
 assert.ok(lines.some(line=>line.startsWith('2023\t\ttys. zł\tBrak danych.')));
 assert.equal(statementRawThousands('0.01','PLN'),'0.00001');
 assert.equal(statementRawThousands('1234567890123.45','PLN'),'1234567890.12345');
});
test('picker includes available statement and balance facts without inventing accounting names',()=>{
 const p=period(2025,'0');p.facts=[...p.facts,{metricCode:'BS_A_CA',amount:'123',currency:'PLN',unit:'PLN'},{metricCode:'BS_UNKNOWN_SOURCE',amount:'2',currency:'PLN',unit:'PLN'}];
 const rows=statementRows([p]);assert.equal(rows.find(r=>r.id==='BS_A_CA')?.name,'Aktywa obrotowe');
 assert.equal(rows.find(r=>r.id==='BS_UNKNOWN_SOURCE')?.name,'BS_UNKNOWN_SOURCE');
 assert.equal(rows.filter(r=>r.id==='PALA_NPL').length,1);
 assert.equal(rows.find(r=>r.id==='PALA_NRFS')?.points[0].value,null);
});
test('overview card has no selected-year headline and exposes compact table and expand controls',()=>{
 const row=statementRows([period(2025,'-1000'),period(2024,'0'),period(2023,null)]).find(r=>r.id==='PALA_NPL')!;
 const html=renderToStaticMarkup(React.createElement(StatementChartCard,{row,onExpand:()=>{}}));
 assert.ok(html.includes('data-library-component="SRM-C51"'));
 assert.ok(html.includes('aria-label="Pokaż tabelę"'));
 assert.ok(html.includes('aria-label="Powiększ:'));
 assert.ok(!html.includes('srm-history-readout'));
 assert.ok(html.includes('data-value="0"')&&html.includes('data-value="missing"')&&html.includes('is-negative'));
});
