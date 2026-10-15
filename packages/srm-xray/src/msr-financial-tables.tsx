"use client";
import React from "react";
import type { FinancialPeriod } from "./contracts";
import { CanonElement, CanonSummary } from "./ui-canon";

type MsrRow = NonNullable<FinancialPeriod["msrRows"]>[number];
const sections: readonly [MsrRow["section"],string][] = [
  ["RZiS","Rachunek zysków i strat"],["Bilans","Bilans"],["CashFlow","Przepływy pieniężne"],
  ["ComprehensiveIncome","Całkowite dochody"],["Equity","Zmiany w kapitale własnym"],["Other","Pozostałe oznaczone pozycje"],
];
export function formatMsrAmount(value:string|null):string {
  if (value === null || !/^-?\d+(?:\.\d+)?$/.test(value)) return "brak danych";
  const [whole,fraction] = value.split(".");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g,"\u00a0") + (fraction ? "," + fraction : "");
}
/** Financial-module-owned variant: shared report controls/dashboard remain in the host. */
export function MsrFinancialTables({periods}:{periods:readonly FinancialPeriod[]}) {
  const msr = periods.filter(p => p.accountingStandard === "IAS_IFRS");
  return <div className="srm-msr-financial" data-financial-standard="IAS_IFRS">
    <p className="srm-msr-financial-notice">MSR/MSSF · dane z XHTML/iXBRL. Wartości w jednostkach wskazanych przy pozycji, z zachowaniem znaków źródłowych. Brak danych nie oznacza zera.</p>
    {sections.map(([section,title]) => {
      const rows = new Map<string,MsrRow>();
      for (const period of msr) for (const row of period.msrRows ?? []) if (row.section === section && !rows.has(row.key)) rows.set(row.key,row);
      if (!rows.size) return null;
      return <details className="financial-accordion srm-msr-financial-section" open key={section}>
        <CanonSummary canonId="SRM-C49" usage="msr-financial-tables:01">{title}</CanonSummary>
        <div className="financial-accordion-body financial-table-scroll" tabIndex={0} aria-label={title + " MSR/MSSF"}>
          <CanonElement as="table" canonId="SRM-C48" usage="msr-financial-tables:02" className="financial-table srm-msr-financial-table">
            <thead><tr><th scope="col">Pozycja sprawozdania</th><th scope="col">Jednostka</th>{msr.map(p=><th scope="col" key={p.from+p.to} title={p.from+" – "+p.to}>{p.to.slice(0,4)}</th>)}</tr></thead>
            <tbody>{[...rows.values()].map(row=><tr key={row.key}>
              <th scope="row">{row.label}</th><td>{row.currency ?? row.unit.replace(/\{[^}]+\}/g,"")}</td>
              {msr.map(p=>{const item=p.msrRows?.find(r=>r.key===row.key && r.section===section);
                return <td key={p.from+p.to} title={item?.validation === "REVIEW" ? "Wartość wymaga weryfikacji źródła" : undefined}>
                  {item?.validation === "VALID" ? formatMsrAmount(item.amount) : "brak zweryfikowanych danych"}
                </td>;})}
            </tr>)}</tbody>
          </CanonElement>
        </div>
      </details>;
    })}
  </div>;
}
