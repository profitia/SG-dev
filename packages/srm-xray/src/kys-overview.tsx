"use client";

import React, { useEffect, useId, useState } from "react";
import { kysOverview, type KysDetailTarget, type KysOverviewInput, type KysOverviewModel } from "./kys-overview-model";

/** Recheck the existing authoritative expiry at its boundary and when a sleeping tab returns. No network reads. */
export function useKysOverview(input: KysOverviewInput): KysOverviewModel {
  const [now, setNow] = useState(() => Date.now());
  const model = kysOverview(input, Math.max(now, Date.now()));
  useEffect(() => {
    const expiry = model.expiresAt;
    const update = () => setNow(Date.now());
    const timer = expiry === null ? undefined : window.setTimeout(update, Math.min(Math.max(1, expiry - Date.now() + 1), 2_147_483_647));
    window.addEventListener("focus", update); document.addEventListener("visibilitychange", update);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, [model.expiresAt]);
  return model;
}
export function KysOverview({ model, onDetails }: { model: KysOverviewModel; onDetails: (target: KysDetailTarget) => void }) {
  const id = useId();
  if (!model.visible) return null;
  return <section className="kys-overview" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>Przegląd raportu KYS</h3><p role="status">{model.message}</p>
    {model.available && <><div className="kys-overview-groups">{model.groups.map(group => <section key={group.id} aria-labelledby={`${id}-${group.id}`}>
      <h4 id={`${id}-${group.id}`}>{group.title}</h4><ul>{group.rows.map(row => <li key={row.label}><strong>{row.label}</strong>
        {row.execution && <span className="kys-overview-execution">Wykonanie: {row.execution === "PERFORMED" ? "odnotowano w raporcie" : "nie ustalono"}</span>}
        <p>{row.result}</p>
      </li>)}</ul><div className="kys-overview-actions">{group.rows.filter((row, index, rows) => rows.findIndex(other => other.target === row.target) === index).map(row => <button key={row.target} type="button" aria-label={`Pokaż szczegóły: ${row.label}`} onClick={() => onDetails(row.target)}>{({ identity: "Dane podmiotu", registry: "Rejestry", lists: "Listy", people: "Reprezentacja", beneficiaries: "Beneficjenci", pep: "PEP", relations: "Powiązania" } as const)[row.target]}</button>)}</div></section>)}</div>
      <section className="kys-overview-completeness"><h4>Kompletność raportu</h4><details><summary>Zakres i ograniczenia</summary><ul>{model.limitations.map(note => <li key={note}>{note}</li>)}</ul></details></section>
    </>}
  </section>;
}
