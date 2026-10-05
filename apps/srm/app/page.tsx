import {
  SupplierXRayMount,
  type FinancialData,
  type GeneralCompanyData,
  type SectionEnvelope,
  type SupplierXRayCard,
  type VerclyKysData,
} from "@profitia/srm-xray";

function unavailable<T>(provider: "MGBI" | "VERCLY", model: string): SectionEnvelope<T> {
  return {
    status: "NOT_REQUESTED",
    source: { provider, model, recordId: null },
    retrievedAt: null,
    effectiveAt: null,
    data: null,
    warnings: [],
  };
}

const emptyCard: SupplierXRayCard = {
  identity: { krs: null, nip: null, name: null },
  general: unavailable<GeneralCompanyData>("MGBI", "KRS-WP"),
  financial: unavailable<FinancialData>("MGBI", "KRS-RDF"),
  kys: unavailable<VerclyKysData>("VERCLY", "KYS"),
};

export default function Home() {
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
        <form className="appshield-search" aria-label="Wyszukaj firmę">
          <label htmlFor="identifier">NIP lub KRS</label>
          <div>
            <input id="identifier" name="identifier" inputMode="numeric" placeholder="Wpisz NIP lub KRS" disabled />
            <button type="button" disabled>Wyszukaj</button>
          </div>
          <small>Wyszukiwanie zostanie uruchomione po połączeniu z bazą i dostawcami danych.</small>
        </form>
        <SupplierXRayMount card={emptyCard} />
      </div>
    </main>
  );
}
