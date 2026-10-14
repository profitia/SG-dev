"use client";

import React, { useEffect, useId, useState } from "react";
import { CanonButton } from "./ui-canon";
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
  return <section className="kys-overview srm-kys-overview" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>Przegląd raportu KYS</h3>{!model.available && <p role="status">{model.message}</p>}
    {model.available && <><div className="srm-kys-overview-grid">{model.groups.map(group => <section className="srm-kys-overview-card" key={group.id} aria-labelledby={`${id}-${group.id}`}>
      <h4 id={`${id}-${group.id}`}>{group.title}</h4><ul>{group.rows.map(row => <li key={row.label}><strong>{row.label}</strong>
        {row.target === "pep" && row.execution && <span className="kys-overview-execution">Wykonanie: {row.execution === "PERFORMED" ? "odnotowano w raporcie" : "nie ustalono"}</span>}
        <p>{row.result}</p>
      </li>)}</ul><div className="kys-overview-actions">{group.rows.filter((row, index, rows) => rows.findIndex(other => other.target === row.target) === index).map(row => <CanonButton canonId="SRM-C55" usage="kys-overview:details" className="srm-text-link" key={row.target} type="button" aria-label={`Pokaż szczegóły: ${row.label}`} onClick={() => onDetails(row.target)}>{({ identity: "Dane podmiotu", registry: "Rejestry", lists: "Listy", people: "Reprezentacja", beneficiaries: "Beneficjenci", pep: "PEP", relations: "Powiązania" } as const)[row.target]}</CanonButton>)}</div></section>)}</div>

    </>}
  </section>;
}
