import { notFound } from "next/navigation";
import {
  FinancialDataMount,
  GeneralCompanyDataMount,
  VerclyKysMount,
} from "@profitia/srm-xray";
import { sampleCard } from "../../src/demo/fixture";

type SearchParams = Promise<{ module?: string }>;

export default async function Harness({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.TARGET_ENVIRONMENT !== "development") notFound();
  const params = await searchParams;
  const moduleName = params.module === "financial" || params.module === "kys"
    ? params.module
    : "general";

  return (
    <main className="appshield">
      <header className="appshield-header">
        <strong>SRM</strong>
        <nav aria-label="Nawigacja"><a href="/">X-Ray</a></nav>
      </header>
      <div className="appshield-content">
        <p className="eyebrow">Development · osobne montowanie</p>
        <h1>Moduły X-Ray</h1>
        <aside className="demo-notice" role="note">
          <strong>DANE TESTOWE — DEVELOPMENT</strong>
          <p>Każda opcja montuje tylko jeden publiczny komponent. Dane są stałą próbką techniczną.</p>
        </aside>
        <nav className="harness-nav" aria-label="Wybór modułu">
          <a href="/harness?module=general" aria-current={moduleName === "general" ? "page" : undefined}>Dane ogólne</a>
          <a href="/harness?module=financial" aria-current={moduleName === "financial" ? "page" : undefined}>Dane finansowe</a>
          <a href="/harness?module=kys" aria-current={moduleName === "kys" ? "page" : undefined}>Raport KYS</a>
        </nav>
        <div className="harness-module">
          {moduleName === "general" && <GeneralCompanyDataMount section={sampleCard.general} />}
          {moduleName === "financial" && <FinancialDataMount section={sampleCard.financial} />}
          {moduleName === "kys" && <VerclyKysMount section={sampleCard.kys} />}
        </div>
      </div>
    </main>
  );
}
