"use client";
import { FinancialHistoryDialog as StatementDialog } from './FinancialHistoryDialog';
import { CanonElement, CanonButton, CanonInput } from './ui-canon';
import React, { useState } from 'react';
import { FinancialHistoryView } from './FinancialHistoryView';
import { yearColor } from './FinancialHistoryChart';
import { historyNumber, type FinancialHistoryPoint } from './financial-history-export';
export type StatementRow = {
  id: string;
  section: string;
  group: string;
  name: string;
  points: FinancialHistoryPoint[];
};
const unit = 'PLN_THOUSANDS';
export function StatementIcon({
  kind = 'chart'
}: {
  kind?: 'chart' | 'plus' | 'expand' | 'search';
}) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === 'plus' ? <path d="M12 5v14M5 12h14" /> : kind === 'expand' ? <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /> : kind === 'search' ? <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></> : <><path d="M3 21h18" /><rect x="4" y="12" width="3" height="6" rx="1.5" /><rect x="10" y="7" width="3" height="11" rx="1.5" /><rect x="16" y="3" width="3" height="15" rx="1.5" /></>}</svg>;
}
export function StatementHistory({
  row,
  onClose
}: {
  row: StatementRow;
  onClose: () => void;
}) {
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null);
  return <StatementDialog title={row.name} subtitle={row.section + ' · tys. zł'} onClose={onClose} actions={<div ref={setToolbar} />}><div className="srm-history-detail-body"><div className="srm-history-summary"><p className="srm-history-definition">Wartości z kolejnych sprawozdań finansowych. Kwoty w tys. zł.</p></div><FinancialHistoryView name={row.name} unit={unit} points={row.points}  toolbarTarget={toolbar} /><footer className="srm-history-detail-footer"><span>Wartości zaokrąglone do 0,01 tys. zł</span><span>{row.group}</span></footer></div></StatementDialog>;
}
export function AddChartTile({
  onClick
}: {
  onClick: () => void;
}) {
  return <CanonButton canonId="SRM-C46" usage="StatementWorkspace:03" type="button" className="srm-add-chart-tile" onClick={onClick} aria-haspopup="dialog"><span className="srm-add-chart-plus"><StatementIcon kind="plus" /></span><strong>Dodaj wykres</strong><span>Wybierz pozycję<br />sprawozdania lub bilansu</span></CanonButton>;
}
export function StatementPicker({
  rows,
  added,
  onAdd,
  onClose
}: {
  rows: StatementRow[];
  added: string[];
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(''),
    [selected, setSelected] = useState('');
  const filtered = rows.filter(r => (r.name + ' ' + r.section + ' ' + r.group).toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl')));
  const sections = Array.from(new Set(rows.map(r => r.section)));
  return <StatementDialog compact title="Dodaj własny wykres" subtitle="Wybierz jedną pozycję ze sprawozdania finansowego." onClose={onClose}><div className="srm-picker-body"><label className="srm-statement-search"><StatementIcon kind="search" /><span className="srm-sr-only">Szukaj pozycji sprawozdania</span><CanonInput canonId="SRM-C06" usage="StatementWorkspace:04" placeholder="Szukaj pozycji sprawozdania…" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="srm-picker-results">{sections.map(section => {
          const choices = filtered.filter(r => r.section === section);
          return choices.length > 0 && <fieldset key={section}><legend>{section}</legend>{choices.map(row => <label className={'srm-chart-option' + (selected === row.id ? ' is-selected' : '')} key={row.id}><CanonInput canonId="SRM-C50" usage="StatementWorkspace:05" type="radio" name="statement-chart" value={row.id} checked={selected === row.id} disabled={added.includes(row.id)} onChange={() => setSelected(row.id)} /><span><strong>{row.name}</strong><small>{row.group}</small></span>{added.includes(row.id) && <small>Już na widoku</small>}</label>)}</fieldset>;
        })}{!filtered.length && <div className="srm-picker-empty"><strong>Brak pasujących pozycji</strong><p>Spróbuj wpisać inną nazwę.</p></div>}</div><footer className="srm-picker-footer"><span>Wykres korzysta z dostępnych lat sprawozdawczych.</span><CanonButton canonId="SRM-C02" usage="StatementWorkspace:06" type="button" className="srm-btn" onClick={onClose}>Anuluj</CanonButton><CanonButton canonId="SRM-C01" usage="StatementWorkspace:07" type="button" className="srm-btn primary" disabled={!selected} onClick={() => onAdd(selected)}><StatementIcon kind="plus" />Dodaj wykres</CanonButton></footer></div></StatementDialog>;
}
const titles: Record<string, string> = {
  PALA_NRFS: 'Przychody',
  PALA_OAC: 'Koszty',
  PALA_NPL: 'Wynik finansowy netto'
};
export function StatementChartCard({
  row,
  onExpand
}: {
  row: StatementRow;
  onExpand: () => void;
}) {
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null);
  return <CanonElement as="article" canonId="SRM-C51" usage="StatementWorkspace:13" className="srm-statement-chart-card is-overview-card" data-statement-chart={row.id}><header><div className="srm-statement-card-title"><h4 title={row.name}>{titles[row.id] ?? row.name}</h4><p>tys. zł · {Math.min(...row.points.map(p => p.year))}–{Math.max(...row.points.map(p => p.year))}</p></div><div className="srm-statement-card-actions"><div ref={setToolbar} /><CanonButton canonId="SRM-C04" usage="StatementWorkspace:08" type="button" className="srm-statement-icon" onClick={onExpand} title={'Powiększ: ' + row.name} aria-label={'Powiększ: ' + row.name}><StatementIcon kind="expand" /></CanonButton></div></header><FinancialHistoryView compact overview toolbarTarget={toolbar} name={row.name} unit={unit} points={row.points} /></CanonElement>;
}
export function StatementTable({
  title,
  rows,
  years,
  onChart
}: {
  title: string;
  rows: StatementRow[];
  years: number[];
  onChart: (row: StatementRow) => void;
}) {
  return <section className="srm-statement-table-block"><div className="srm-statement-table-heading"><h3>{title}</h3><span>Kwoty w tys. zł · kolumny według roku sprawozdania</span></div><div className="srm-statement-table-scroll" role="region" aria-label={'Tabela: ' + title} tabIndex={0}><CanonElement as="table" canonId="SRM-C48" usage="StatementWorkspace:09" className="srm-statement-table"><thead><tr><th scope="col">Pozycja sprawozdania</th>{years.map((y, i) => <th scope="col" key={y}><CanonElement as="span" canonId="SRM-C26" usage="StatementWorkspace:10" className="srm-history-year-bar" style={{
                background: yearColor(years.length - 1 - i, years.length),
                color: i < years.length * .42 ? 'white' : '#003366'
              }}>{y}</CanonElement></th>)}<th scope="col">Wykres</th></tr></thead><tbody>{rows.map((row, index) => <React.Fragment key={row.id}>{(index === 0 || rows[index - 1].group !== row.group) && <tr className="srm-statement-group"><th scope="rowgroup" colSpan={years.length + 2}>{row.group}</th></tr>}<tr><th scope="row">{row.name}</th>{years.map(y => {
                const p = row.points.find(p => p.year === y) ?? {
                  year: y,
                  value: null
                };
                return <td key={y} className={p.value === null ? 'is-missing' : ''}>{historyNumber(p, unit)}</td>;
              })}<td><CanonButton canonId="SRM-C04" usage="StatementWorkspace:11" type="button" className="srm-statement-icon srm-row-chart" aria-label={'Pokaż wykres: ' + row.name} title={'Pokaż wykres: ' + row.name} onClick={() => onChart(row)}><StatementIcon /></CanonButton></td></tr></React.Fragment>)}</tbody></CanonElement></div><p className="srm-table-scroll-hint">Przewiń poziomo, aby zobaczyć wcześniejsze lata.</p></section>;
}
export function StatementWorkspace({
  rows,
  years,
  showTables = true
}: {
  rows: StatementRow[];
  years: number[];
  showTables?: boolean;
}) {
  const [added, setAdded] = useState(['PALA_NRFS', 'PALA_OAC', 'PALA_NPL']),
    [picker, setPicker] = useState(false),
    [history, setHistory] = useState<StatementRow | null>(null),
    [message, setMessage] = useState('');
  return <div className="srm-statement-workspace"><div className={"srm-statement-chart-grid" + (added.length > 3 ? " has-extra" : "")}>{added.map(id => {
        const row = rows.find(r => r.id === id);
        return row && <StatementChartCard key={id} row={row} onExpand={() => setHistory(row)} />;
      })}<AddChartTile onClick={() => setPicker(true)} /></div><CanonElement as="p" canonId="SRM-C54" usage="StatementWorkspace:12" className="srm-statement-feedback" role="status">{message}</CanonElement>{showTables && Array.from(new Set(rows.map(r => r.section))).map(section => <StatementTable key={section} title={section} rows={rows.filter(r => r.section === section)} years={years} onChart={setHistory} />)}{picker && <StatementPicker rows={rows} added={added} onClose={() => setPicker(false)} onAdd={id => {
      setAdded(previous => previous.includes(id) ? previous : [...previous, id]);
      setPicker(false);
      setMessage('Dodano wykres: ' + rows.find(r => r.id === id)?.name);
    }} />}{history && <StatementHistory row={history} onClose={() => setHistory(null)} />}</div>;
}