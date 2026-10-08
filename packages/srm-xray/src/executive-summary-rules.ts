import type { FinancialFactEvidence, FinancialPeriod, SectionStatus, SupplierReportData } from "./contracts";
import type { FinancialPeriodSelection } from "./financial-dashboard";
import { financialReason, indicatorPresentation } from "./financial-indicator-content";
import { financialValue } from "./financial-history";

export type SummaryEvidence = { kind: "source"; fact: FinancialFactEvidence } | { kind: "indicator"; code: string; history?: boolean };
export type SummaryItem = { id: string; text: string; explanation: string; evidence?: SummaryEvidence };
export type ExecutiveSummaryInput = {
  nip: string; entityType: "COMPANY" | "JDG"; metadata: SupplierReportData | null;
  scope: FinancialPeriod["scope"] | null; selectedPeriod: FinancialPeriodSelection | null;
  loading?: boolean; kysStatus: SectionStatus; kysHasData: boolean;
};
export type ExecutiveSummaryModel = { period: string | null; facts: SummaryItem[]; limitations: SummaryItem[]; kys: string; financialContext: boolean };
const decimal = (value: string | null) => value !== null && /^-?\d+(?:\.\d+)?$/.test(value);
const verified = (fact: FinancialFactEvidence) => fact.validation === "VERIFIED" &&
  ["NORMALIZED_CONFIRMED", "SOURCE_VALUE"].includes(fact.normalization) && decimal(fact.amount) && fact.unit === "PLN" && fact.currency === "PLN";

/** Presentation selection over canonical stored results. No financial arithmetic, fetching or persistence. */
export function executiveSummary(input: ExecutiveSummaryInput): ExecutiveSummaryModel {
  const { metadata, selectedPeriod, scope } = input;
  const model: ExecutiveSummaryModel = { period: null, facts: [], limitations: [], kys: "Raport KYS nie został jeszcze pobrany.", financialContext: false };
  const add = (id: string, text: string, explanation: string, evidence?: SummaryEvidence) => {
    if (!model.limitations.some(item => item.id === id)) model.limitations.push({ id, text, explanation, evidence });
  };
  const finish = () => {
    const priority = ["metadata", "period", "quality", "freshness", "partial", "comparison", "missing-results", "jdg", "kys-partial"];
    model.limitations.sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id));
    return model;
  };
  const bound = metadata?.nip === input.nip && metadata.entityType === input.entityType ? metadata : null;
  if (input.kysStatus === "PENDING") model.kys = "Trwa przygotowywanie raportu KYS.";
  else if (input.kysStatus !== "NOT_REQUESTED") {
    if (bound?.kys.freshness.freshness === "EXPIRED" || (bound?.kys.freshness.retentionUntil && Date.parse(bound.kys.freshness.retentionUntil) <= Date.now())) {
      model.kys = "Poprzedni raport KYS stracił ważność; jego wyniki nie są przedstawiane jako aktualne.";
    } else if (input.kysHasData && bound?.kys.reportAvailable && bound.kys.freshness.freshness === "FRESH") {
      model.kys = "Raport KYS jest dostępny w tym widoku.";
      if (input.kysStatus === "PARTIAL" || bound.kys.completeness === "PARTIAL") add("kys-partial", "Raport KYS jest częściowy.", "Nie wszystkie sprawdzenia zwróciły dane. Zakres dostępnych wyników znajduje się w pełnym raporcie.");
    } else model.kys = "Nie można potwierdzić dostępności aktualnego raportu KYS w tym widoku.";
  }
  if (input.entityType === "JDG") {
    add("jdg", "Dla JDG nie jest dostępne sprawozdanie finansowe typowe dla spółki.", "Dostępne informacje rejestrowe pozostają w danych szczegółowych. Brak sprawozdania nie jest oceną kondycji przedsiębiorcy.");
    return finish();
  }
  if (!bound || input.loading) {
    add("metadata", input.loading ? "Przygotowywanie zapisanych wyników…" : "Nie można potwierdzić danych do podsumowania.", "Nie przedstawiamy liczb bez potwierdzonego powiązania ze sprawozdaniem. Dostępne zestawienia pozostają w danych szczegółowych.");
    return finish();
  }
  const financial = bound.financial;
  const periods = financial.periods.filter(period => period.scope === scope && period.from === selectedPeriod?.from && period.to === selectedPeriod?.to);
  if (periods.length !== 1 || !periods[0].documentRef) {
    add("period", "Nie ustalono jednoznacznego sprawozdania dla podsumowania.", "Wymagany jest jeden wybrany dokument o zgodnym pełnym okresie i zakresie. Nie zastępujemy go danymi innego roku ani zakresu.");
    return finish();
  }
  const period = periods[0];
  model.financialContext = true;
  model.period = `${period.from} – ${period.to} · ${scope === "standalone" ? "Jednostkowe" : "Skonsolidowane"}`;
  const matches = (fact: FinancialFactEvidence) => fact.documentRef === period.documentRef && fact.scope === period.scope && fact.periodStart === period.from && fact.periodEnd === period.to;
  const source = (code: string) => {
    const facts = period.facts.filter(fact => fact.metricCode === code);
    return facts.length === 1 && matches(facts[0]) && verified(facts[0]) ? facts[0] : null;
  };
  const point = (code: string) => {
    const histories = financial.history.filter(history => history.code === code);
    if (histories.length !== 1) return null;
    const points = histories[0].points.filter(p => p.scope === period.scope && p.periodStart === period.from && p.periodEnd === period.to);
    return points.length === 1 && points[0].documentRef === period.documentRef ? points[0] : null;
  };
  const result = (code: string, fields: string[]) => {
    const p = point(code);
    if (!p || p.code !== code || p.status !== "AVAILABLE" || !decimal(p.value) || p.reasonCode || p.unit !== indicatorPresentation[code].unit ||
      !p.formulaVersion || p.definitionRef.code !== code || p.definitionRef.formulaVersion !== p.formulaVersion ||
      !p.evidence.length || p.evidence.some(fact => !verified(fact) || fact.scope !== period.scope || fact.documentRef !== period.documentRef)) return null;
    if (code === "NET_WORKING_CAPITAL" && p.evidence.some(fact => !matches(fact))) return null;
    if (!fields.every(code => p.evidence.filter(fact => fact.metricCode === code && matches(fact)).length === 1)) return null;
    // Each disclosed current input must agree with the selected canonical representation.
    if (!p.evidence.filter(matches).every(fact => source(fact.metricCode)?.ref === fact.ref && source(fact.metricCode)?.amount === fact.amount)) return null;
    return p;
  };
  const representationKnown = !!financial.mappingVersion && !!financial.representationVersion && !financial.limitations.includes("MAPPING_VERSION_OUTDATED") && ["SUCCESS", "PARTIAL"].includes(financial.status);
  if (representationKnown) {
    const revenue = source("PALA_NRFS"), net = source("PALA_NPL"), workingCapital = result("NET_WORKING_CAPITAL", ["BS_A_CA", "BS_LAE_LAPFL_STL"]);
    if (revenue) model.facts.push({ id: "revenue", text: `Przychody za wybrany okres wynoszą ${financialValue(revenue.amount, "PLN")}.`, explanation: "Zweryfikowana pozycja przychodów z wybranego sprawozdania.", evidence: { kind: "source", fact: revenue } });
    if (net) model.facts.push({ id: "net", text: `Wynik netto za wybrany okres wynosi ${financialValue(net.amount, "PLN")}.`, explanation: "Zweryfikowana pozycja wyniku netto z wybranego sprawozdania; znak wartości pozostaje bez zmian.", evidence: { kind: "source", fact: net } });
    if (workingCapital) model.facts.push({ id: "working-capital", text: `Kapitał obrotowy netto wynosi ${financialValue(workingCapital.value, "PLN")}.`, explanation: "Zapisany wynik backendu, oparty na zweryfikowanych aktywach obrotowych i zobowiązaniach krótkoterminowych.", evidence: { kind: "indicator", code: "NET_WORKING_CAPITAL" } });
    // A revenue growth value is not the difference between two revenue-growth percentages.
    // Only the backend-confirmed comparison enables an additional historical assertion.
    const growth = result("REVENUE_YOY", ["PALA_NRFS"]);
    const prior = growth?.comparison.previousPeriod;
    if (revenue && growth?.comparison.status === "COMPARABLE" && prior && growth.evidence.length === 2 && growth.evidence.filter(fact => fact.metricCode === "PALA_NRFS" && fact.periodStart === prior.from && fact.periodEnd === prior.to).length === 1) {
      model.facts[0] = { id: "revenue", text: `${model.facts[0].text} Zmiana przychodów rok do roku: ${financialValue(growth.value, "PERCENT")}.`, explanation: "Zapisany wskaźnik zmiany przychodów, nie zmiana wartości tego wskaźnika. Backend potwierdził porównywalność okresów; ich pełne daty i dane wejściowe są w historii.", evidence: { kind: "indicator", code: "REVENUE_YOY", history: true } };
    }
  }
  if (!representationKnown || financial.limitations.includes("FINANCIAL_FACTS_UNVERIFIED") || period.facts.some(fact => !verified(fact))) {
    add("quality", "Część danych wymaga potwierdzenia przed wykorzystaniem w analizie.", "Niepotwierdzone wartości, normalizacja lub pochodzenie nie stanowią podstawy twierdzeń liczbowych. Statusy danych są dostępne w metodologii wskaźników.");
  }
  if (financial.freshness.freshness === "EXPIRED") add("freshness", "Dane finansowe wymagają ponownego sprawdzenia aktualności.", "Wyniki dotyczą wskazanego okresu sprawozdania. Nie potwierdzają bieżącej sytuacji dostawcy; samo wyświetlenie nie odświeża danych.");
  else if (financial.freshness.freshness !== "FRESH") add("freshness", "Nie potwierdzono aktualności danych finansowych.", "Okres sprawozdania i aktualność danych to różne informacje. Nie odtwarzamy brakujących dat.");
  if (financial.completeness === "PARTIAL" || financial.status === "PARTIAL") add("partial", "Dane finansowe są częściowe.", "Dostępne wyniki pozostają widoczne; brak danych nie oznacza wartości zero ani negatywnej oceny dostawcy.");
  const selectedPoints = financial.history.flatMap(history => history.points.filter(p => p.scope === period.scope && p.periodStart === period.from && p.periodEnd === period.to && p.documentRef === period.documentRef));
  const comparisons = selectedPoints.filter(p => p.status === "AVAILABLE");
  if (comparisons.some(p => p.comparison.status !== "COMPARABLE")) add("comparison", "Nie wszystkie okresy finansowe można bezpiecznie porównać.", "Porównywalność części wyników nie została potwierdzona lub porównanie jest niedozwolone. Dostępne punkty historyczne nie są automatycznie ciągłym trendem.");
  const unavailable = selectedPoints.filter(p => p.status === "UNAVAILABLE");
  if (unavailable.length || selectedPoints.length < Object.keys(indicatorPresentation).length) {
    const example = unavailable.find(p => p.reasonCode);
    add("missing-results", "Część wskaźników jest niedostępna do analizy.", example ? financialReason(example.reasonCode) : "Brak zapisanego wyniku dla części wskaźników. Dostępne powody i metodologia pozostają przy ich kartach.");
  }
  return finish();
}
