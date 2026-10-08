"use client";

import React, { useId, useRef } from "react";
import type { FinancialPeriodSelection } from "@profitia/srm-xray";

/** Display only: preserve the full canonical pair, order and host selection. */
export function financialPeriodLabel(period: FinancialPeriodSelection, periods: readonly FinancialPeriodSelection[]): string {
  const year = period.to.slice(0, 4);
  const calendarYear = period.from === `${year}-01-01` && period.to === `${year}-12-31`;
  const uniqueYear = periods.filter(item => item.to.slice(0, 4) === year).length === 1;
  return calendarYear && uniqueYear ? year : `${period.from} – ${period.to}`;
}

export function FinancialPeriodSelector({ periods, selected, onSelect }: {
  periods: readonly FinancialPeriodSelection[];
  selected: FinancialPeriodSelection | null;
  onSelect: (period: FinancialPeriodSelection) => void;
}) {
  const id = useId(), group = useRef<HTMLDivElement>(null);
  if (!periods.length) return null;
  return <div className="financial-period-selector">
    <p id={id}>Okres sprawozdawczy</p>
    <div className="financial-periods" role="group" aria-labelledby={id} ref={group} onKeyDown={event => {
      const buttons = Array.from(group.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
      const index = buttons.indexOf(event.target as HTMLButtonElement);
      if (index < 0) return;
      const next = event.key === "ArrowRight" ? Math.min(index + 1, buttons.length - 1)
        : event.key === "ArrowLeft" ? Math.max(index - 1, 0)
        : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault(); buttons[next].focus(); buttons[next].click();
    }}>
      {periods.map(period => <button key={`${period.from}:${period.to}`} type="button"
        data-financial-period={`${period.from}:${period.to}`}
        aria-pressed={selected?.from === period.from && selected?.to === period.to}
        aria-label={`Okres ${period.from} – ${period.to}`} title={`${period.from} – ${period.to}`}
        onClick={() => onSelect(period)}>{financialPeriodLabel(period, periods)}</button>)}
    </div>
    <p className="financial-period-current">Wybrany okres: {selected ? `${selected.from} – ${selected.to}` : "nie ustalono"}</p>
  </div>;
}
