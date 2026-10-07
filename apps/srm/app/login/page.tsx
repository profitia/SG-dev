import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const environment = process.env.TARGET_ENVIRONMENT === "staging" ? "Staging" : "Development";

  return <main className="srm-login">
    <div className="srm-login-layout">
      <section className="srm-login-primary" aria-label="Logowanie do SRM">
        <div>
          <div className="srm-login-brands">
            <Image src="/porr-demo/spendguru-logo.png" alt="SpendGuru" width={164} height={57} priority />
            <Image src="/porr-demo/porr-logo.svg" alt="PORR SA" width={40} height={32} priority />
          </div>
          <h1>Supplier Relationship Management</h1>
          <p className="srm-login-subtitle">Wersja testowa dla PORR SA</p>
          <p className="srm-login-description">Celem aplikacji są testy wewnętrzne udostępnianych funkcjonalności.</p>
          <form action="/api/auth/login" method="post" className="srm-login-form">
            <label htmlFor="demo-password">Hasło</label>
            <input id="demo-password" type="password" name="password" autoComplete="current-password" placeholder="Wpisz hasło" required />
            {error === "invalid" && <p className="srm-login-error" role="alert">Nieprawidłowe hasło. Spróbuj ponownie.</p>}
            {error === "configuration" && <p className="srm-login-error" role="alert">Logowanie jest chwilowo niedostępne.</p>}
            <button type="submit">Zaloguj się</button>
          </form>
        </div>
        <p className="srm-login-disclaimer">Wersja testowa jest przeznaczona tylko dla pracowników PORR SA i nie powinna być udostępniana osobom nieuprawnionym.</p>
      </section>

      <div className="srm-login-divider" aria-hidden="true" />

      <section className="srm-login-release" aria-label="Informacje o wersji">
        <div className="srm-login-release-scroll">
          <p className="srm-login-version">Wersja: 1.0 {environment}</p>
          <section><h2>Zakres obecnej wersji</h2></section>
          <section><h2>Change Log względem wersji poprzedniej</h2></section>
          <section><h2>Tematy oczekujące / planowane do kolejnej wersji</h2></section>
          <details className="srm-login-history">
            <summary>Historia wersji <span aria-hidden="true">+</span></summary>
            <div>Brak wcześniejszych wersji.</div>
          </details>
          <p className="srm-login-contact">Zgłaszanie poprawek, uwag, pomysłów:<br />
            <a href="mailto:tomasz.uscinski@profitia.pl">tomasz.uscinski@profitia.pl</a>
          </p>
        </div>
      </section>
    </div>
  </main>;
}
