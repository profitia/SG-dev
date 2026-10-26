import React from 'react';
import { fontRoles } from './library-names';
/** Typography values come from the same pinned role registry as the SRM library. */
const bindings: [string, string][] = [['.cci-section-title h2,.cci-home-subhead h2,.cci-provenance summary h3,.cci-method h3,.cci-dialog-section-title', 'SRM-T03'], ['.cci-kpi>div>span,.cci-model-values small,.cci-detail-kpis small', 'SRM-T03'], ['.cci-kpi>strong,.cci-model-values strong,.cci-model-values b,.cci-detail-kpis strong', 'SRM-T04'], ['.cci-kpi>p,.cci-section-title p,.cci-panel-caption,.cci-chart-footnote,.cci-drivers>p,.cci-demo-disclaimer,.cci-footer,.cci-model-meta dt,.cci-fields label>small,.cci-source-category>small,.cci-source-category>span', 'SRM-T05'], ['.cci-table th,.cci-table th>small,.cci-drivers-caption,.cci-chart-legend,.cci-chart-bottom>span', 'SRM-T10'], ['.cci-table td,.cci-table td>strong,.cci-drivers-total>strong', 'SRM-T09'], ['.cci-table td>button strong,.cci-model-card h3,.cci-category-main h3', 'SRM-T03'], ['.cci-table td>button small,.cci-table td>small,.cci-category-main p,.cci-model-card>p,.cci-model-meta dd', 'SRM-T05'], ['.cci-driver-label>span,.cci-driver-label>strong,.cci-driver-label>strong>small', 'SRM-T17'], ['.cci-driver-label>span>small,.cci-drivers-total>span,.cci-snapshot-tag,.cci-lock-tag,.cci-analysis-strip', 'SRM-T02'], ['.cci-fields :is(input,textarea),.cci-readonly', 'SRM-T15'], ['.cci-fields label>span,.cci-currency>legend,.cci-currency>label strong,.cci-readiness li strong', 'SRM-T15'], ['.cci-currency>label small,.cci-readiness li small,.cci-source-category>strong,.cci-advanced>div,.cci-notice p,.cci-notice strong', 'SRM-T05'], ['.cci-provenance dt,.cci-version-meta dt,.cci-detail-values small', 'SRM-T10'], ['.cci-provenance dd,.cci-provenance dd small,.cci-version-meta dd,.cci-method,.cci-price-intro', 'SRM-T27'], ['.cci-price-result>strong,.cci-detail-values strong', 'SRM-T18'], ['.cci-range>button', 'SRM-T33'], ['.cci-month-picks>button', 'SRM-T22']];
const colorVariables: Record<string, string> = {
  '#003366': 'var(--brand-dark)',
  '#005A9C': 'var(--brand)',
  '#526A82': 'var(--muted)',
  '#294D70': 'var(--text)',
  '#FFFFFF': 'var(--surface)'
};
export function CCICanonStyles() {
  const rules = bindings.map(([selectors, id]) => {
    const r = fontRoles.find(x => x.id === id)!;
    return selectors.split(',').map(s => '.cci-root ' + s).join(',') + '{font-family:' + r.family + ';font-size:' + r.size / 16 + 'rem;font-weight:' + r.weight + ';line-height:' + r.lineHeight + ';color:' + (colorVariables[r.color] ?? r.color) + ';}';
  }).join('\n');
  return <style>{rules + `
 .cci-root .cci-page-title h1,.cci-root .cci-dashboard-title h1{font:650 1.6875rem/1.3 Inter,Arial,sans-serif;letter-spacing:-.65px;color:var(--brand-dark)}
 .cci-root .cci-kpi,.cci-root .cci-model-card{border-radius:var(--canon-cardRadius);background:var(--surface)}
 .cci-root .cci-driver-label>strong.is-down{color:var(--success-text)}
.cci-root .cci-kpi-primary{border-color:var(--brand-light)}
 .cci-root .cci-kpi>div>svg{display:none}
 .cci-root .cci-range>button[aria-pressed=true]{font-weight:700;border:0;background:none}
 .cci-root .cci-month-picks>button[aria-pressed=true]{background:var(--brand);color:var(--surface)}
 .cci-root .cci-dialog-body{min-height:0;overflow:auto;padding:var(--srm-space-base) var(--srm-space-medium)}
 .cci-root .srm-history{border:1px solid var(--line);border-radius:14px;color:var(--brand-dark);background:var(--surface);font-family:Inter,Arial,sans-serif;box-shadow:0 20px 80px #122f4d30}
 .cci-root .srm-history::backdrop{background:#16334e55;backdrop-filter:blur(3px)}
 .cci-root .srm-history-detail-head h2{font-weight:550;letter-spacing:-.5px}
 .cci-root .srm-history-detail-head p{font-size:11px;color:var(--muted)}
 .cci-root .srm-close-window{display:inline-grid;place-items:center;width:2rem;height:2rem;padding:0;border:.75px solid var(--line);border-radius:6px;background:var(--surface);color:var(--brand-dark)}
 .cci-root .srm-close-window svg{width:1rem;height:1rem}
 .cci-root .cci-icon-button{--srm-hover-scale:1.07}
 .cci-root .cci-breadcrumb button,.cci-root .cci-inline-link,.cci-root .cci-text-action{--srm-hover-scale:1.025}
 @media(max-width:760px){.cci-root .cci-page-title h1,.cci-root .cci-dashboard-title h1{font-size:1.3125rem}.cci-root .cci-kpi>div>span,.cci-root .cci-section-title h2{font-size:.8125rem}.cci-root .cci-table td{font-size:.75rem}}
 `}</style>;
}
