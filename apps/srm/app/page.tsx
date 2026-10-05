import { SupplierXRayMount } from "@profitia/srm-xray";
import { emptyCard, sampleCard, validateDemoIdentifier } from "../src/demo/fixture";

type SearchParams = Promise<{ kind?: string; identifier?: string }>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const development = process.env.TARGET_ENVIRONMENT === "development";
  const kind = typeof params.kind === "string" ? params.kind : "nip";
  const rawIdentifier = typeof params.identifier === "string" ? params.identifier : "";
  const validation = development && rawIdentifier
    ? validateDemoIdentifier(kind, rawIdentifier)
    : null;
  const card = validation?.ok ? sampleCard : emptyCard;

  return (
    <main className="appshield">
      <header className="appshield-header">
        <strong>SRM</strong>
        <nav aria-label="Nawigacja">X-Ray</nav>
      </header>
      <div className="appshield-content">
        <div className="appshield-intro">
          <p className="eyebrow">Supplier Relationship Management</p>
          <h1>Prześwietlenie firmy</h1>
          <p>Wyszukaj firmę po NIP lub KRS, aby zobaczyć dane z MGBI i Vercly.</p>
        </div>
        {development && (
          <aside className="demo-notice" role="note">
            <strong>DANE TESTOWE — DEVELOPMENT</strong>
            <p>Ten formularz sprawdza format identyfikatora i pokazuje stałą próbkę modułów. Nie pobiera danych firmy z API ani nie zapisuje ich w bazie.</p>
          </aside>
        )}
        <form className="appshield-search" aria-label="Wyszukaj firmę" method="get" action="/">
          <label htmlFor="identifier">Identyfikator firmy</label>
          <div className="appshield-search-fields">
            <select name="kind" aria-label="Rodzaj identyfikatora" defaultValue={kind === "krs" ? "krs" : "nip"} disabled={!development}>
              <option value="nip">NIP</option>
              <option value="krs">KRS</option>
            </select>
            <input id="identifier" name="identifier" inputMode="numeric" placeholder="Wpisz 10 cyfr" defaultValue={rawIdentifier} disabled={!development} required />
            <button type="submit" disabled={!development}>Wyszukaj</button>
          </div>
          {validation && !validation.ok && <p className="search-error" role="alert">{validation.error}</p>}
          {validation?.ok && <p className="search-caption">Wprowadzono {validation.kind.toUpperCase()}: {validation.value}. Poniższe dane są niezależną próbką techniczną.</p>}
          {!development && <small>Wyszukiwanie zostanie uruchomione po połączeniu z bazą i dostawcami danych.</small>}
        </form>
        {development && <p className="harness-link"><a href="/harness">Sprawdź każdy moduł osobno</a></p>}
        <SupplierXRayMount card={card} />
      </div>
    </main>
  );
}
