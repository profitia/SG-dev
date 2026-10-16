import type { GeneralCompanyData, FinancialData, SectionEnvelope } from "./contracts";
import { inactiveCompanyMessage } from "./company-activity";
export type ReportAvailability = {
  code: "AVAILABLE" | "UNSUPPORTED_IAS" | "MSR_PROCESSING_ERROR" | "MSR_DOWNLOAD_UNAVAILABLE" | "MSR_PENDING" | "LIQUIDATION" | "DEREGISTERED";
  title: string;
  message: string;
  hideDetails: boolean;
};
export const IAS_UNAVAILABLE_MESSAGE = "Dla tego sprawozdania MSR/MSSF nie są dostępne dane w obsługiwanym formacie XHTML/iXBRL. Moduł nie pobiera plików PDF.";
export const LIQUIDATION_MESSAGE = "Spółka jest w trakcie likwidacji. Supplier Intelligence Dashboard nie udostępnia dla tego podmiotu analizy finansowej ani raportów szczegółowych.";
export const AVAILABLE_REPORT: ReportAvailability = { code: "AVAILABLE", title: "", message: "", hideDetails: false };
/** Empty financial values alone never establish a legal status or accounting standard.
 * The backend supplies verified register status and a document-derived warning.
 */
export function reportAvailability(general: GeneralCompanyData | null | undefined, financial: Pick<SectionEnvelope<FinancialData>, "status" | "data" | "warnings"> | null | undefined): ReportAvailability {
  if (general?.registrationStatus === "DEREGISTERED") return {code:"DEREGISTERED",title:"Spółka wykreślona z KRS",message:inactiveCompanyMessage(general),hideDetails:true};
  if (general?.registrationStatus === "LIQUIDATION") return {code:"LIQUIDATION",title:"Spółka w trakcie likwidacji",message:LIQUIDATION_MESSAGE,hideDetails:true};
  if (financial?.status === "EMPTY" && !financial.data && financial.warnings.some(w=>w.startsWith("MSR_"))) {
    const budget=financial.warnings.some(w=>["MSR_FILE_BUDGET_EXHAUSTED","MSR_BUDGET_UNAVAILABLE"].includes(w));
    const pending=financial.warnings.some(w=>["MSR_DOWNLOAD_IN_PROGRESS","MSR_DOWNLOAD_RECONCILIATION_REQUIRED"].includes(w));
    return {code:budget?"MSR_DOWNLOAD_UNAVAILABLE":pending?"MSR_PENDING":"MSR_PROCESSING_ERROR",title:"Sprawozdania MSR / MSSF",hideDetails:false,
      message:budget ? "Nie udało się pobrać sprawozdania MSR/MSSF z powodu limitu lub niedostępności usługi pobierania. Dane finansowe nie są obecnie dostępne."
        : pending ? "Pobieranie sprawozdania MSR/MSSF trwa lub wymaga sprawdzenia wyniku poprzedniej próby. Dane finansowe nie są jeszcze dostępne."
        : "Nie udało się bezpiecznie odczytać lub potwierdzić danych sprawozdania MSR/MSSF. Dane finansowe nie są obecnie dostępne."};
  }
  if (financial?.status === "EMPTY" && !financial.data && financial.warnings.some(w => w === "MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS" || w === "FINANCIAL_INTERNATIONAL_STANDARD_UNAVAILABLE"))
    return {code:"UNSUPPORTED_IAS",title:"Sprawozdania MSR / MSSF",message:IAS_UNAVAILABLE_MESSAGE,hideDetails:false};
  return AVAILABLE_REPORT;
}
