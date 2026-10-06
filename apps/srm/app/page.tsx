"use client";

import { useState, type FormEvent } from "react";
import { FinancialDataMount, GeneralCompanyDataMount, VerclyKysMount, type SupplierXRayCard } from "@profitia/srm-xray";
import { emptyCard } from "../src/demo/fixture";

export default function Home() {
  const [card, setCard] = useState<SupplierXRayCard>(emptyCard);
  const [busy, setBusy] = useState(false);
  const [kysBusy, setKysBusy] = useState(false);
  const [kysError, setKysError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || kysBusy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    setKysError(null);
    setCard(emptyCard);
    setSearched(true);
    try {
      const response = await fetch("/api/xray/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Nie udało się pobrać raportu.");
      setCard(payload as SupplierXRayCard);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się pobrać raportu.");
    } finally { setBusy(false); }
  }

  async function fetchKys() {
    if (busy || kysBusy || !card.identity.nip) return;
    setKysBusy(true);
    setKysError(null);
    setCard((current) => ({ ...current, kys: { ...current.kys, status: "PENDING", warnings: [] } }));
    try {
      const response = await fetch("/api/xray/kys", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: card.identity.nip }), cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Nie udało się pobrać raportu KYS.");
      setCard((current) => ({ ...current, kys: payload.section as SupplierXRayCard["kys"] }));
    } catch (cause) {
      setKysError(cause instanceof Error ? cause.message : "Nie udało się pobrać raportu KYS.");
      setCard((current) => ({ ...current, kys: { ...current.kys, status: "ERROR", retrievedAt: new Date().toISOString(), data: null, warnings: ["VERCLY_REQUEST_FAILED"] } }));
    } finally { setKysBusy(false); }
  }

  return (
    <main className="appshield">
      <header className="appshield-header"><strong>SRM</strong><nav aria-label="Nawigacja">X-Ray</nav></header>
      <div className="appshield-content">
        <div className="appshield-intro">
          <p className="eyebrow">Supplier Relationship Management</p>
          <h1>Prześwietlenie firmy</h1>
          <p>Podaj NIP, aby zobaczyć dane firmy i jej sprawozdania finansowe. Raport KYS pobierzesz osobno.</p>
        </div>
        <aside className="demo-notice" role="note">
          <strong>DEVELOPMENT — RZECZYWISTE DANE MGBI I VERCLY</strong>
          <p>Najpierw pobieramy dane MGBI. Raport KYS z Vercly uruchamiasz osobnym przyciskiem; jego przygotowanie może potrwać dłużej. Brakujące pola oznaczamy „brak danych”.</p>
        </aside>
        <form className="appshield-search" aria-label="Wyszukaj firmę" onSubmit={search}>
          <label htmlFor="identifier">NIP firmy</label>
          <div className="appshield-search-fields">
            <input id="identifier" name="identifier" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="10 cyfr NIP" required />
          </div>
          <button type="submit" disabled={busy || kysBusy}>{busy ? "Pobieranie danych MGBI…" : "Pokaż dane firmy"}</button>
          {error && <p className="search-error" role="alert">{error}</p>}
        </form>
        <p className="harness-link"><a href="/harness">Sprawdź próbki techniczne modułów</a></p>
        {searched && !busy && !error && <div className="xray-card">
          <GeneralCompanyDataMount section={card.general} />
          <FinancialDataMount section={card.financial} />
          <div className="kys-step">
            <h2>Raport KYS</h2>
            <p>Raport Vercly jest pobierany dopiero na Twoje żądanie.</p>
            <button type="button" onClick={fetchKys} disabled={kysBusy || !card.identity.nip}>
              {kysBusy ? "Przygotowywanie raportu KYS…" : card.kys.status === "NOT_REQUESTED" ? "Pobierz raport KYS" : "Pobierz raport KYS ponownie"}
            </button>
            {kysError && <p className="search-error" role="alert">{kysError}</p>}
          </div>
          {card.kys.status !== "NOT_REQUESTED" && <VerclyKysMount section={card.kys} />}
        </div>}
      </div>
    </main>
  );
}
