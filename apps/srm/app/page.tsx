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

function KysStep({ section, entityType, busy, error, onFetch, canFetch }: {
  section: DisplayCard["kys"];
  entityType: "COMPANY" | "JDG";
  busy: boolean;
  error: string | null;
  onFetch: () => void;
  canFetch: boolean;
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
    {section.status !== "NOT_REQUESTED" && <VerclyKysMount section={section} entityType={entityType} />}
  </>;
}

export default function Home() {
  const [registry, setRegistry] = useState<"companies" | "jdg">("companies");
  const [card, setCard] = useState<DisplayCard>(emptyCard);
  const [jdg, setJdg] = useState<{ nip: string; section: Omit<SectionEnvelope<JdgRegistryData>, "source"> } | null>(null);
  const [jdgKys, setJdgKys] = useState<DisplayCard["kys"]>(emptySection());
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
    setJdgKys(emptySection());
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
    const isJdg = registry === "jdg";
    const nip = isJdg ? jdg?.nip : card.identity.nip;
    if (busy || kysBusy || !nip) return;
    setKysBusy(true);
    setKysError(null);
    const pending = { ...emptySection(), status: "PENDING" as const };
    if (isJdg) setJdgKys(pending);
    else setCard((current) => ({ ...current, kys: pending }));
    try {
      const response = await fetch(isJdg ? "/api/xray/jdg/kys" : "/api/xray/kys", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: nip }), cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Nie udało się pobrać raportu KYS.");
      if (isJdg) setJdgKys(payload.section as DisplayCard["kys"]);
      else setCard((current) => ({ ...current, kys: payload.section as DisplayCard["kys"] }));
    } catch (cause) {
      setKysError(cause instanceof Error ? cause.message : "Nie udało się pobrać raportu KYS.");
      const failed: DisplayCard["kys"] = { ...emptySection(), status: "ERROR", retrievedAt: new Date().toISOString(), warnings: ["REPORT_WARNING"] };
      if (isJdg) setJdgKys(failed);
      else setCard((current) => ({ ...current, kys: failed }));
    } finally { setKysBusy(false); }
  }

  return (
    <main className="appshield">
      <header className="appshield-header"><h1>SRM X-Ray</h1></header>
      <div className="appshield-content">
        <nav className="registry-tabs" aria-label="Wybierz rejestr">
          <button type="button" aria-pressed={registry === "companies"} disabled={busy || kysBusy} onClick={() => { setRegistry("companies"); setSearched(false); setError(null); }}>Spółki</button>
          <button type="button" aria-pressed={registry === "jdg"} disabled={busy || kysBusy} onClick={() => { setRegistry("jdg"); setSearched(false); setError(null); }}>JDG</button>
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
          <div className="xray-card">
            <JdgRegistryMount section={jdg.section} />
            <KysStep section={jdgKys} entityType="JDG" busy={kysBusy} error={kysError} onFetch={fetchKys} canFetch={Boolean(jdg.section.data?.entries.length)} />
          </div>
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
          <KysStep section={card.kys} entityType="COMPANY" busy={kysBusy} error={kysError} onFetch={fetchKys} canFetch={Boolean(card.identity.nip)} />
          </div>
        </>}
      </div>
    </main>
  );
}
