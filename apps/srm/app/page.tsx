"use client";

import { useRef, useState, type FormEvent } from "react";
import { FinancialDataMount, GeneralCompanyDataMount, JdgRegistryMount, latestAvailableFinancialYear, VerclyKysMount, type JdgRegistryData, type SectionEnvelope, type SupplierXRayCard } from "@profitia/srm-xray";

type DisplayCard = {
  identity: SupplierXRayCard["identity"];
  general: Omit<SupplierXRayCard["general"], "source">;
  financial: Omit<SupplierXRayCard["financial"], "source">;
  kys: Omit<SupplierXRayCard["kys"], "source">;
};
type JdgSearchResult = { entityType: "JDG"; nip: string; section: Omit<SectionEnvelope<JdgRegistryData>, "source"> };
type CompanySearchResult = { entityType: "COMPANY"; card: DisplayCard };
type SearchResult = JdgSearchResult | CompanySearchResult;

const emptySection = () => ({ status: "NOT_REQUESTED" as const, retrievedAt: null, effectiveAt: null, data: null, warnings: [] });

function KysStep({ section, entityType, busy, error, onFetch, canFetch, onRevealPesel }: {
  section: DisplayCard["kys"];
  entityType: "COMPANY" | "JDG";
  busy: boolean;
  error: string | null;
  onFetch: () => void;
  canFetch: boolean;
  onRevealPesel: (token: string) => Promise<string>;
}) {
  return <>
    <div className="kys-step">
      <h2>Raport KYS</h2>
      <p>Raport KYS jest pobierany dopiero na Twoje żądanie.</p>
      <button type="button" onClick={onFetch} disabled={busy || !canFetch}>
        {busy ? "Przygotowywanie raportu KYS…" : section.status === "NOT_REQUESTED" ? "Pobierz raport KYS" : "Pobierz raport KYS ponownie"}
      </button>
      {error && <p className="search-error" role="alert">{error}</p>}
    </div>
    {section.status !== "NOT_REQUESTED" && <VerclyKysMount section={section} entityType={entityType} onRevealPesel={onRevealPesel} />}
  </>;
}

export default function Home() {
  const reportGeneration = useRef(0);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [kys, setKys] = useState<DisplayCard["kys"]>(emptySection());
  const [busy, setBusy] = useState(false);
  const [kysBusy, setKysBusy] = useState(false);
  const [kysError, setKysError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  function newReport() {
    if (busy) return;
    reportGeneration.current += 1;
    setResult(null);
    setKys(emptySection());
    setKysBusy(false);
    setKysError(null);
    setError(null);
  }
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || kysBusy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    setKysError(null);
    setResult(null);
    setKys(emptySection());
    try {
      const response = await fetch("/api/xray/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Nie udało się pobrać raportu.");
      if (payload.entityType !== "JDG" && payload.entityType !== "COMPANY") throw new Error("Nie udało się ustalić typu podmiotu.");
      setResult(payload as SearchResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się pobrać raportu.");
    } finally { setBusy(false); }
  }

  async function fetchKys() {
    const isJdg = result?.entityType === "JDG";
    const nip = isJdg ? result.nip : result?.entityType === "COMPANY" ? result.card.identity.nip : null;
    if (busy || kysBusy || !nip) return;
    const generation = reportGeneration.current;
    setKysBusy(true);
    setKysError(null);
    const pending = { ...emptySection(), status: "PENDING" as const };
    setKys(pending);
    try {
      const response = await fetch(isJdg ? "/api/xray/jdg/kys" : "/api/xray/kys", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: nip }), cache: "no-store",
      });
      const payload = await response.json();
      if (generation !== reportGeneration.current) return;
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Nie udało się pobrać raportu KYS.");
      setKys(payload.section as DisplayCard["kys"]);
    } catch (cause) {
      if (generation !== reportGeneration.current) return;
      setKysError(cause instanceof Error ? cause.message : "Nie udało się pobrać raportu KYS.");
      const failed: DisplayCard["kys"] = { ...emptySection(), status: "ERROR", retrievedAt: new Date().toISOString(), warnings: ["REPORT_WARNING"] };
      setKys(failed);
    } finally { if (generation === reportGeneration.current) setKysBusy(false); }
  }

  async function revealPesel(token: string): Promise<string> {
    const response = await fetch("/api/xray/kys/pesel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }), cache: "no-store",
    });
    if (!response.ok) throw new Error("PESEL reveal failed");
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("pesel" in payload) ||
      typeof payload.pesel !== "string" || !/^\d{11}$/.test(payload.pesel)) throw new Error("Invalid PESEL response");
    return payload.pesel;
  }

  return (
    <main className="appshield">
      <header className="appshield-header">
        <h1>SRM X-Ray</h1>
        <div className="appshield-actions">
          {result && <button type="button" className="appshield-new-report" onClick={newReport} disabled={busy}>Nowy raport</button>}
          <form action="/api/auth/logout" method="post"><button type="submit" className="appshield-new-report">Wyloguj się</button></form>
        </div>
      </header>
      <div className="appshield-content">
        {!result && <form className="appshield-search" aria-label="Wyszukaj firmę" onSubmit={search}>
          <label htmlFor="identifier">Wpisz numer NIP</label>
          <div className="appshield-search-fields">
            <input id="identifier" name="identifier" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="Wpisz numer NIP" required />
          </div>
          <button type="submit" disabled={busy || kysBusy}>{busy ? "Sprawdzanie rejestru i pobieranie danych…" : "Pokaż dane firmy"}</button>
          {error && <p className="search-error" role="alert">{error}</p>}
        </form>}
        {result?.entityType === "JDG" && !busy && <>
          <section className="company-summary" aria-label="Podsumowanie działalności">
            <div><h2>{result.section.data?.entries[0]?.name ?? "brak danych"}</h2><p>NIP: {result.nip} · Rejestr: JDG</p></div>
            <span className="company-report-pill">{result.section.data?.entries[0]?.status ?? "Brak danych"}</span>
          </section>
          <div className="xray-card">
            <JdgRegistryMount section={result.section} />
            <KysStep section={kys} entityType="JDG" busy={kysBusy} error={kysError} onFetch={fetchKys} canFetch={Boolean(result.section.data?.entries.length)} onRevealPesel={revealPesel} />
          </div>
        </>}
        {result?.entityType === "COMPANY" && !busy && <>
          <section className="company-summary" aria-label="Podsumowanie spółki">
            <div><h2>{result.card.general.data?.legalName ?? result.card.identity.name ?? "brak danych"}</h2>
              <p>NIP: {result.card.identity.nip ?? "brak danych"} · KRS: {result.card.identity.krs ?? "brak danych"}</p>
            </div>
            <span className="company-report-pill">Ostatni dostępny raport: {latestAvailableFinancialYear(result.card.financial.data) ?? "brak danych"}</span>
          </section>
          <div className="xray-card">
          <GeneralCompanyDataMount section={result.card.general} />
          <FinancialDataMount section={result.card.financial} />
          <KysStep section={kys} entityType="COMPANY" busy={kysBusy} error={kysError} onFetch={fetchKys} canFetch={Boolean(result.card.identity.nip)} onRevealPesel={revealPesel} />
          </div>
        </>}
      </div>
    </main>
  );
}
