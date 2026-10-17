import { CanonButton, CanonInput, CanonLink, CanonSummary, CanonElement } from "@profitia/srm-xray";
import "@profitia/srm-xray/financial-scanner.css";
import { ClerkSignIn } from "./clerk-sign-in";
import { readSrmIdentityRuntime, type SrmIdentityRuntime } from "../../src/server/identity-runtime";

export const dynamic = "force-dynamic";

const currentVersionFeatures = [
  { name: "Wyszukiwanie dostawców po NIP", description: "automatyczna identyfikacja przedsiębiorstw i pozyskiwanie danych rejestrowych." },
  { name: "Dane finansowe", description: "pobieranie historycznych sprawozdań, rachunków zysków i strat oraz bilansów." },
  { name: "Analityka finansowa", description: "interaktywny dashboard kondycji finansowej przedsiębiorstwa." },
  { name: "16 wskaźników finansowych", description: "analiza płynności, zadłużenia, rentowności i przepływów pieniężnych." },
  { name: "Historia i metodologia", description: "wykresy wieloletnie, porównania okresów i szczegóły obliczeń." },
  { name: "Podsumowanie dostawcy", description: "najważniejsze fakty finansowe i zagadnienia wymagające uwagi." },
  { name: "Compliance / KYS", description: "weryfikacja rejestrów, list sankcyjnych, PEP, beneficjentów i powiązań." },
  { name: "Eksport raportów", description: "dane finansowe w Excelu oraz szczegółowy raport KYS w PDF." },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const environment = process.env.TARGET_ENVIRONMENT === "staging" ? "Staging" : "Development";
  let identity: SrmIdentityRuntime | null = null;
  try { identity = readSrmIdentityRuntime(); }
  catch { /* A configuration error is public unavailability, never a demo fallback. */ }

  return <main className="srm-login srm-ui">
    <div className="srm-login-layout">
      <section className="srm-login-primary" aria-label="Logowanie do SRM">
          <div className="srm-login-brands">
            <CanonElement as="span" canonId="SRM-C44" usage="login:logo" data-brand-asset="SRM-L01"><img src="/spendguru/logo.svg" alt="SpendGuru" width={150} height={49} /></CanonElement>
            <CanonElement as="span" canonId="SRM-C44" usage="login:client-logo" data-brand-asset="SRM-L04"><img src="/porr-demo/porr-logo.svg" alt="PORR SA" width={60} height={48} /></CanonElement>
          </div>
          <h1><span>Supplier</span><span>Relationship</span><span>Management</span></h1>
          <p className="srm-login-subtitle">Wersja testowa dla PORR SA</p>
          <p className="srm-login-description">Celem aplikacji są testy wewnętrzne udostępnianych funkcjonalności.</p>
          {identity?.provider === "clerk" ? <ClerkSignIn publishableKey={identity.publishableKey} /> : identity?.provider === "legacy_demo" ? <form action="/api/auth/login" method="post" className="srm-login-form">
            <label htmlFor="demo-password">Hasło</label>
            <CanonInput canonId="SRM-C06" usage="login:password" id="demo-password" type="password" name="password" autoComplete="current-password" placeholder="Wpisz hasło" required />
            {error === "invalid" && <p className="srm-login-error" role="alert">Nieprawidłowe hasło. Spróbuj ponownie.</p>}
            {error === "configuration" && <p className="srm-login-error" role="alert">Logowanie jest chwilowo niedostępne.</p>}
            <CanonButton canonId="SRM-C01" usage="login:submit" type="submit">Zaloguj się</CanonButton>
          </form> : <p className="srm-login-error" role="alert">Logowanie jest chwilowo niedostępne.</p>}
        <p className="srm-login-disclaimer">Wersja testowa jest przeznaczona tylko dla pracowników PORR SA i nie powinna być udostępniana osobom nieuprawnionym.</p>
      </section>

      <div className="srm-login-divider" aria-hidden="true" />

      <section className="srm-login-release" aria-label="Informacje o wersji">
        <div className="srm-login-release-scroll">
          <p className="srm-login-version">Wersja: 1.0 {environment}</p>
          <section>
            <h2>Zakres obecnej wersji</h2>
            <ul className="srm-login-features">
              {currentVersionFeatures.map(({ name, description }) => <li key={name}><strong>{name}</strong> — {description}</li>)}
            </ul>
          </section>
          <section><h2>Change Log względem wersji poprzedniej</h2></section>
          <section><h2>Tematy oczekujące / planowane do kolejnej wersji</h2></section>
          <details className="srm-login-history">
            <CanonSummary canonId="SRM-C49" usage="login:history">Historia wersji <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></CanonSummary>
            <div>Brak wcześniejszych wersji.</div>
          </details>
          <p className="srm-login-contact">Zgłaszanie poprawek, uwag, pomysłów:<br />
            <CanonLink canonId="SRM-C55" usage="login:contact" href="mailto:tomasz.uscinski@profitia.pl">tomasz.uscinski@profitia.pl</CanonLink>
          </p>
        </div>
      </section>
    </div>
  </main>;
}
