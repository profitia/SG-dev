"use client";

import { useState, type FormEvent } from "react";
import { SupplierXRayMount, type SupplierXRayCard } from "@profitia/srm-xray";
import { emptyCard } from "../src/demo/fixture";

export default function Home() {
  const [card, setCard] = useState<SupplierXRayCard>(emptyCard);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [accessToken, setAccessToken] = useState("");

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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
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

  return (
    <main className="appshield">
      <header className="appshield-header"><strong>SRM</strong><nav aria-label="Nawigacja">X-Ray</nav></header>
      <div className="appshield-content">
        <div className="appshield-intro">
          <p className="eyebrow">Supplier Relationship Management</p>
          <h1>Prześwietlenie firmy</h1>
          <p>Wyszukaj firmę po NIP albo KRS i pobierz raport KYS bezpośrednio z Vercly.</p>
        </div>
        <aside className="demo-notice" role="note">
          <strong>DEVELOPMENT — RZECZYWISTE DANE VERCLY</strong>
          <p>Raport FULL wymaga obecnie nazwy, strony WWW i telefonu firmy. Połączenie z MGBI ma później uzupełniać te dane automatycznie. Brakujące pola raportu są oznaczone „brak danych”.</p>
        </aside>
        <form className="appshield-search" aria-label="Wyszukaj firmę" onSubmit={search}>
          <label htmlFor="identifier">Identyfikator firmy</label>
          <div className="appshield-search-fields">
            <select name="kind" aria-label="Rodzaj identyfikatora" defaultValue="krs"><option value="nip">NIP</option><option value="krs">KRS</option></select>
            <input id="identifier" name="identifier" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="10 cyfr" required />
          </div>
          <div className="kys-input-grid">
            <label>Nazwa firmy<input name="name" maxLength={200} placeholder="Nazwa prawna" required /></label>
            <label>Strona WWW<input name="website" type="url" maxLength={300} placeholder="https://..." required /></label>
            <label>Telefon firmy<input name="phone" type="tel" maxLength={40} placeholder="+48..." required /></label>
            <label>Kod dostępu Development<input value={accessToken} onChange={(event) => setAccessToken(event.target.value)} type="password" autoComplete="off" required /></label>
          </div>
          <button type="submit" disabled={busy}>{busy ? "Pobieranie raportu…" : "Pobierz raport KYS"}</button>
          <small>Kod dostępu jest używany tylko do bieżącego zapytania i nie jest zapisywany w przeglądarce.</small>
          {error && <p className="search-error" role="alert">{error}</p>}
        </form>
        <p className="harness-link"><a href="/harness">Sprawdź próbki techniczne modułów</a></p>
        {searched && !busy && !error && <SupplierXRayMount card={card} />}
      </div>
    </main>
  );
}
