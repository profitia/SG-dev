"use client";
import { CanonButton, CanonElement, CanonTextarea } from './ui-canon';
import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FinancialHistoryChart, yearColor } from './FinancialHistoryChart';
import { financialHistoryTsv, historyInformation, historyNumber, historyUnit } from './financial-history-export';
import type { FinancialHistoryPoint } from './financial-history-export';
type Props = {
  compact?: boolean;
  overview?: boolean;
  toolbarTarget?: HTMLElement | null;
  name: string;
  unit: string;
  selectedYear?: number;
  points: FinancialHistoryPoint[];
};
function ViewIcon({
  kind
}: {
  kind: 'chart' | 'table' | 'copy' | 'check';
}) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'table' && <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18M3 14h18M10 9v11" /></>}
    {kind === 'chart' && <><path d="M4 20h16" /><rect x="5" y="12" width="3" height="5" rx="1.5" /><rect x="10.5" y="7" width="3" height="10" rx="1.5" /><rect x="16" y="3" width="3" height="14" rx="1.5" /></>}
    {kind === 'copy' && <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>}
    {kind === 'check' && <path d="m5 12 4 4L19 6" />}
  </svg>;
}
function copyWithSelection(text: string, container: HTMLElement) {
  const doc = container.ownerDocument;
  const previous = doc.activeElement as HTMLElement | null;
  const textarea = doc.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  // Inside the modal so native dialog inertness does not prevent selection.
  container.appendChild(textarea);
  try {
    textarea.focus({
      preventScroll: true
    });
    textarea.select();
    return doc.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    previous?.focus({
      preventScroll: true
    });
  }
}
export function FinancialHistoryView({
  name,
  unit,
  selectedYear,
  points,
  toolbarTarget,
  compact = false,
  overview = false
}: Props) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'success' | 'manual'>('idle');
  const [copyMessage, setCopyMessage] = useState('');
  const copyReset = useRef<ReturnType<typeof setTimeout> | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const manualCopy = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const tsv = financialHistoryTsv(sorted, unit);
  const hasInformation = sorted.some(point => Boolean(historyInformation(point)));
  useEffect(() => () => {
    if (copyReset.current) clearTimeout(copyReset.current);
  }, []);
  useEffect(() => {
    if (copyState === 'manual') {
      manualCopy.current?.focus({
        preventScroll: true
      });
      manualCopy.current?.select();
    }
  }, [copyState]);
  async function copyTable() {
    if (copyReset.current) clearTimeout(copyReset.current);
    setCopyState('copying');
    setCopyMessage('');
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(tsv);
        copied = true;
      }
    } catch {/* Embedded previews may restrict Clipboard API; keep a usable fallback. */}
    if (!copied && container.current) copied = copyWithSelection(tsv, container.current);
    if (copied) {
      setCopyState('success');
      setCopyMessage(`Skopiowano wszystkie lata (${sorted.length}) i nagłówki. Wklej dane do Excela.`);
      copyReset.current = setTimeout(() => setCopyState('idle'), 3000);
    } else {
      setCopyState('manual');
      setCopyMessage('Kopiowanie automatyczne jest niedostępne. Skopiuj zaznaczone dane skrótem ⌘C lub Ctrl+C.');
    }
  }
  const toolbar = <div className={"srm-history-view-toolbar" + (overview ? " is-overview-toolbar" : "")}>
      <div className="srm-history-view-switch" role="group" aria-label="Widok historii">
        <CanonButton canonId="SRM-C28" usage="FinancialHistoryView:01" type="button" aria-pressed={view === 'chart'} aria-controls={`${id}-chart`} onClick={() => setView('chart')} aria-label="Pokaż wykres" title="Pokaż wykres"><ViewIcon kind="chart" />{!overview && "Wykres"}</CanonButton>
        <CanonButton canonId="SRM-C28" usage="FinancialHistoryView:02" type="button" aria-pressed={view === 'table'} aria-controls={`${id}-table`} onClick={() => setView('table')} aria-label="Pokaż tabelę" title="Pokaż tabelę"><ViewIcon kind="table" />{!overview && "Tabela"}</CanonButton>
      </div>
      {view === 'table' && <CanonButton canonId="SRM-C29" usage="FinancialHistoryView:03" type="button" className="srm-history-copy" aria-label="Skopiuj do schowka" title="Skopiuj do schowka" onClick={copyTable} disabled={!sorted.length || copyState === 'copying'}><ViewIcon kind={copyState === 'success' ? 'check' : 'copy'} />{!overview && (copyState === 'success' ? 'Skopiowano' : copyState === 'copying' ? 'Kopiowanie…' : compact ? 'Kopiuj' : 'Skopiuj do schowka')}</CanonButton>}
    </div>;
  return <div className={"srm-history-view" + (compact ? " is-compact" : "") + (overview ? " is-overview" : "")} ref={container}>
    {toolbarTarget ? createPortal(toolbar, toolbarTarget) : toolbar}
    <div id={`${id}-chart`} className="srm-history-presentation" hidden={view !== 'chart'}>
      <FinancialHistoryChart name={name} unit={unit} selectedYear={selectedYear} points={points} overview={overview} />
    </div>
    <div id={`${id}-table`} className="srm-history-presentation" hidden={view !== 'table'}>
      <div className="srm-history-table-scroll" role="region" aria-label={'Tabela historii: ' + name} tabIndex={0}>
        <CanonElement as="table" canonId="SRM-C25" usage="FinancialHistoryView:04" className={"srm-history-value-table" + (hasInformation ? "" : " is-values-only")}>
          <caption className="srm-sr-only">{name} — wartości historyczne od najstarszego do najnowszego roku</caption>
          <thead><tr><th scope="col">Rok</th><th scope="col">Wartość</th><th scope="col">Jednostka</th>{hasInformation && <th scope="col">Informacja</th>}</tr></thead>
          <tbody>{sorted.map((point, index) => {
              const isSelected = point.year === selectedYear;
              const color = yearColor(index, sorted.length);
              const ink = index / Math.max(1, sorted.length - 1) > .58 || sorted.length === 1 ? '#FFFFFF' : '#003366';
              return <tr key={point.year} className={isSelected ? 'is-selected-year' : ''}>
              <th scope="row"><CanonElement as="span" canonId="SRM-C26" usage="FinancialHistoryView:05" className="srm-history-year-bar" style={{
                    backgroundColor: color,
                    color: ink
                  }} aria-current={isSelected ? 'true' : undefined} title={isSelected ? `${point.year} · wybrany okres` : String(point.year)}>{point.year}{isSelected && <span className="srm-sr-only"> · wybrany okres</span>}</CanonElement></th>
              <td className={'srm-history-table-number' + (point.value === null ? ' is-missing-value' : '')}>{historyNumber(point, unit)}</td>
              <td className="srm-history-table-unit">{historyUnit(unit)}</td>
              {hasInformation && <td className="srm-history-table-information">{historyInformation(point)}</td>}
            </tr>;
            })}</tbody>
        </CanonElement>
        {!sorted.length && <p className="srm-history-chart-empty">Brak okresów sprawozdawczych.</p>}
      </div>
      <div className="srm-history-table-caption"><span>Pełne wartości · gotowe do wklejenia do Excela</span></div>
      <CanonElement as="p" canonId="SRM-C30" usage="FinancialHistoryView:06" className="srm-history-copy-message" role="status" aria-live="polite">{copyMessage}</CanonElement>
      {copyState === 'manual' && <div className="srm-history-manual-copy"><label htmlFor={`${id}-copy`}>Dane do skopiowania</label><CanonTextarea canonId="SRM-C06" usage="FinancialHistoryView:07" id={`${id}-copy`} ref={manualCopy} value={tsv} readOnly rows={5} /></div>}
    </div>
  </div>;
}