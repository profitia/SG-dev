"use client";

import { useState, type FormEvent } from "react";
import { FinancialDataMount, GeneralCompanyDataMount, JdgRegistryMount, latestAvailableFinancialYear, VerclyKysMount, type JdgRegistryData, type SectionEnvelope, type SupplierXRayCard } from "@profitia/srm-xray";

type DisplayCard = {
  identity: SupplierXRayCard["identity"];
  general: Omit<SupplierXRayCard["general"], "source">;
  financial: Omit<SupplierXRayCard["financial"], "source">;
  kys: Omit<SupplierXRayCard["kys"], "source">;
};

const emptySection = () => ({ status: "NOT_REQUESTED" as const, retrievedAt: null, effectiveAt: null, data: null, warnings: [] });
const emptyCard: DisplayCard = {
  identity: { krs: null, nip: null, name: null },
  general: emptySection(), financial: emptySection(), kys: emptySection(),
};

export default function Home() {
  const [registry, setRegistry] = useState<"companies" | "jdg">("companies");
  const [card, setCard] = useState<DisplayCard>(emptyCard);
  const [jdg, setJdg] = useState<{ nip: string; section: Omit<SectionEnvelope<JdgRegistryData>, "source"> } | null>(null);
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
    setJdg(null);
    setSearched(true);
    try {
      const response = await fetch(registry === "jdg" ? "/api/xray/jdg" : "/api/xray/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Nie udało się pobrać raportu.");
      if (registry === "jdg") setJdg(payload as { nip: string; section: Omit<SectionEnvelope<JdgRegistryData>, "source"> });
      else setCard(payload as DisplayCard);
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
      setCard((current) => ({ ...current, kys: payload.section as DisplayCard["kys"] }));
    } catch (cause) {
      setKysError(cause instanceof Error ? cause.message : "Nie udało się pobrać raportu KYS.");
      setCard((current) => ({ ...current, kys: { ...current.kys, status: "ERROR", retrievedAt: new Date().toISOString(), data: null, warnings: ["REPORT_WARNING"] } }));
    } finally { setKysBusy(false); }
  }

  return (
    <main className="appshield">
      <header className="appshield-header"><h1>SRM X-Ray</h1></header>
      <div className="appshield-content">
        <nav className="registry-tabs" aria-label="Wybierz rejestr">
          <button type="button" aria-pressed={registry === "companies"} onClick={() => { setRegistry("companies"); setSearched(false); setError(null); }}>Spółki</button>
          <button type="button" aria-pressed={registry === "jdg"} onClick={() => { setRegistry("jdg"); setSearched(false); setError(null); }}>JDG</button>
        </nav>
        <form className="appshield-search" aria-label="Wyszukaj firmę" onSubmit={search}>
          <label htmlFor="identifier">Wpisz numer NIP</label>
          <div className="appshield-search-fields">
            <input id="identifier" name="identifier" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="Wpisz numer NIP" required />
          </div>
          <button type="submit" disabled={busy || kysBusy}>{busy ? "Pobieranie danych…" : registry === "jdg" ? "Pokaż dane JDG" : "Pokaż dane firmy"}</button>
          {error && <p className="search-error" role="alert">{error}</p>}
        </form>
        {registry === "jdg" && searched && !busy && !error && jdg && <>
          <section className="company-summary" aria-label="Podsumowanie działalności">
            <div><h2>{jdg.section.data?.entries[0]?.name ?? "brak danych"}</h2><p>NIP: {jdg.nip} · Rejestr: JDG</p></div>
            <span className="company-report-pill">{jdg.section.data?.entries[0]?.status ?? "Brak danych"}</span>
          </section>
          <div className="xray-card"><JdgRegistryMount section={jdg.section} /></div>
        </>}
        {registry === "companies" && searched && !busy && !error && <>
          <section className="company-summary" aria-label="Podsumowanie spółki">
            <div><h2>{card.general.data?.legalName ?? card.identity.name ?? "brak danych"}</h2>
              <p>NIP: {card.identity.nip ?? "brak danych"} · KRS: {card.identity.krs ?? "brak danych"}</p>
            </div>
            <span className="company-report-pill">Ostatni dostępny raport: {latestAvailableFinancialYear(card.financial.data) ?? "brak danych"}</span>
          </section>
          <div className="xray-card">
          <GeneralCompanyDataMount section={card.general} />
          <FinancialDataMount section={card.financial} />
          <div className="kys-step">
            <h2>Raport KYS</h2>
            <p>Raport KYS jest pobierany dopiero na Twoje żądanie.</p>
            <button type="button" onClick={fetchKys} disabled={kysBusy || !card.identity.nip}>
              {kysBusy ? "Przygotowywanie raportu KYS…" : card.kys.status === "NOT_REQUESTED" ? "Pobierz raport KYS" : "Pobierz raport KYS ponownie"}
            </button>
            {kysError && <p className="search-error" role="alert">{kysError}</p>}
          </div>
          {card.kys.status !== "NOT_REQUESTED" && <VerclyKysMount section={card.kys} />}
          </div>
        </>}
      </div>
    </main>
  );
}
