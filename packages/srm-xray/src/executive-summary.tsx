"use client";

import React, { type ReactNode } from "react";
import { executiveSummary, type ExecutiveSummaryInput, type SummaryItem } from "./executive-summary-rules";
import type { FinancialFactEvidence } from "./contracts";

/** A read-only presentation mount. The host owns selection and navigation; optional future interpretation never replaces facts. */
export function ExecutiveSummary({ input, onSource, onIndicator, onDetails, onFinance, interpretation }: {
  input: ExecutiveSummaryInput; onSource: (fact: FinancialFactEvidence) => void;
  onIndicator: (code: string, history?: boolean) => void; onDetails: () => void; onFinance: () => void; interpretation?: ReactNode;
}) {
  const model = executiveSummary(input);
  function item(observation: SummaryItem) {
    const evidence = observation.evidence;
    return <li key={observation.id} data-summary-rule={observation.id}><p>{observation.text}</p>
      {evidence ? <button type="button" aria-label={`Na czym to opieramy? ${observation.text}`} onClick={() => evidence.kind === "source" ? onSource(evidence.fact) : onIndicator(evidence.code, evidence.history)}>Na czym to opieramy?</button>
        : <details className="summary-explanation"><summary>Dlaczego?</summary><p>{observation.explanation}</p></details>}
    </li>;
  }
  return <div className="executive-summary">
    {model.period && <p className="summary-period">{model.period}</p>}
    <div className="summary-columns"><div><h3>Najważniejsze fakty</h3>
      {model.facts.length ? <ul className="summary-facts">{model.facts.map(item)}</ul> : <p className="summary-note">Brak potwierdzonych faktów finansowych do podsumowania dla tego wyboru.</p>}
      <p className="summary-kys">{model.kys}</p>
    </div><div><h3>Wymaga sprawdzenia</h3>
      {model.limitations.length ? <><ul className="summary-limitations">{model.limitations.slice(0, 3).map(item)}</ul>
        {model.limitations.length > 3 && <details className="summary-more"><summary>Pozostałe ograniczenia ({model.limitations.length - 3})</summary><ul>{model.limitations.slice(3).map(item)}</ul></details>}</>
        : <p className="summary-note">Nie wykazano ograniczeń w dostępnych statusach. To nie jest pełna ocena ryzyka dostawcy.</p>}
    </div></div>
    <div className="summary-actions"><h3>Dalsza analiza</h3>
      {model.financialContext && <button type="button" onClick={onFinance}>Zobacz wskaźniki</button>}
      <button type="button" onClick={onDetails}>{input.entityType === "JDG" ? "Przejdź do danych rejestrowych" : "Przejdź do sprawozdania"}</button>
    </div>
    {interpretation && <div className="summary-interpretation">{interpretation}</div>}
  </div>;
}
