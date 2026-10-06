"use client";

import { useEffect, useState, type FormEvent } from "react";
import { SupplierXRayMount, type SupplierXRayCard } from "@profitia/srm-xray";
import { emptyCard } from "../src/demo/fixture";

export default function Home() {
  const [card, setCard] = useState<SupplierXRayCard>(emptyCard);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [access, setAccess] = useState<"checking" | "locked" | "ready">("checking");

  useEffect(() => {
    let active = true;
    fetch("/api/development-access", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { authorized: false })
      .then((state) => { if (active) setAccess(state.authorized ? "ready" : "locked"); })
      .catch(() => { if (active) setAccess("locked"); });
    return () => { active = false; };
  }, []);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const code = String(new FormData(form).get("code") ?? "");
    form.reset();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/development-access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }), cache: "no-store",
      });
      if (!response.ok) throw new Error("Nieprawidłowy kod dostępu do Development.");
      setAccess("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się odblokować Development.");
    } finally { setBusy(false); }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
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
      if (response.status === 401) setAccess("locked");
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Nie udało się pobrać raportu.");
      setCard(payload as SupplierXRayCard);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się pobrać raportu.");
    } finally { setBusy(false); }
  }

  return (
    <main className="appshield">
      <header className="appshield-header"><strong>SRM</strong><nav aria-label="Nawigacja">X-Ray</nav></header>
      <div className="appshield-content">
        <div className="appshield-intro">
          <p className="eyebrow">Supplier Relationship Management</p>
          <h1>Prześwietlenie firmy</h1>
          <p>Wyszukaj firmę po NIP albo KRS i zobacz dane rejestrowe, finansowe oraz raport KYS.</p>
        </div>
        <aside className="demo-notice" role="note">
          <strong>DEVELOPMENT — RZECZYWISTE DANE MGBI I VERCLY</strong>
          <p>Do danych MGBI wystarczy NIP lub KRS. Dla pełnego raportu KYS Vercly podaj dodatkowo telefon firmy. Nazwę pobierzemy z MGBI, jeśli jest dostępna. Brakujące pola oznaczamy „brak danych”.</p>
        </aside>
        {access === "checking" && <p role="status">Sprawdzanie dostępu do Development…</p>}
        {access === "locked" && <form className="appshield-search development-unlock" aria-label="Dostęp do Development" onSubmit={unlock}>
          <h2>Otwórz środowisko Development</h2>
          <p>Kod wpisujesz raz na czas sesji. Wyszukiwanie firm nie wymaga ponownego wpisywania kodu.</p>
          <label htmlFor="development-code">Kod dostępu Development</label>
          <input id="development-code" name="code" type="password" autoComplete="off" required />
          <button type="submit" disabled={busy}>{busy ? "Sprawdzanie…" : "Otwórz"}</button>
          {error && <p className="search-error" role="alert">{error}</p>}
        </form>}
        {access === "ready" && <>
        <form className="appshield-search" aria-label="Wyszukaj firmę" onSubmit={search}>
          <label htmlFor="identifier">Identyfikator firmy</label>
          <div className="appshield-search-fields">
            <select name="kind" aria-label="Rodzaj identyfikatora" defaultValue="krs"><option value="nip">NIP</option><option value="krs">KRS</option></select>
            <input id="identifier" name="identifier" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="10 cyfr" required />
          </div>
          <div className="kys-input-grid">
            <label>Nazwa firmy (opcjonalnie)<input name="name" maxLength={200} placeholder="Nazwa prawna" /></label>
            <label>Telefon firmy (dla KYS)<input name="phone" type="tel" maxLength={40} placeholder="+48..." /></label>
          </div>
          <button type="submit" disabled={busy}>{busy ? "Pobieranie danych…" : "Prześwietl firmę"}</button>
          {error && <p className="search-error" role="alert">{error}</p>}
        </form>
        <p className="harness-link"><a href="/harness">Sprawdź próbki techniczne modułów</a></p>
        {searched && !busy && !error && <SupplierXRayMount card={card} />}
        </>}
      </div>
    </main>
  );
}
