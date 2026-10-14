import type { GeneralCompanyData, JdgRegistryData } from "./contracts";
export const INACTIVE_COMPANY_MESSAGE = "Spółka została wykreślona z KRS. Supplier Intelligence Dashboard nie udostępnia dla tego podmiotu analizy finansowej ani raportów szczegółowych.";
export function isRestrictedRegistrationStatus(status: GeneralCompanyData["registrationStatus"]): boolean {
  return status === "DEREGISTERED" || status === "LIQUIDATION";
}
export function isCompanyReportRestricted(data: GeneralCompanyData | null | undefined): boolean {
  return isRestrictedRegistrationStatus(data?.registrationStatus);
}
export function isDeregisteredCompany(data: GeneralCompanyData | null | undefined): boolean {
  return data?.registrationStatus === "DEREGISTERED";
}

export function inactiveCompanyMessage(data: GeneralCompanyData | null | undefined): string {
  const value = data?.deregisteredAt;
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return INACTIVE_COMPANY_MESSAGE;
  const date = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) return INACTIVE_COMPANY_MESSAGE;
  return `Spółka została wykreślona z KRS ${value.slice(8,10)}.${value.slice(5,7)}.${value.slice(0,4)} r. Supplier Intelligence Dashboard nie udostępnia dla tego podmiotu analizy finansowej ani raportów szczegółowych.`;
}

/** A suspended or unknown entry, or any active entry for this NIP, prevents a removal verdict. */
export function jdgDeregistration(data: JdgRegistryData | null | undefined): { deregistered: boolean; deregisteredAt: string | null } {
  const entries = data?.entries;
  const removed = !!entries?.length && entries.every(entry => entry.status?.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toUpperCase() === "WYKRESLONY");
  if (!removed) return { deregistered: false, deregisteredAt: null };
  const dates = entries!.map(entry => entry.fields.find(field => field.key === "dataWykreslenia")?.value);
  if (dates.some(value => !value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + "T00:00:00Z")) || new Date(value + "T00:00:00Z").toISOString().slice(0,10) !== value || Date.parse(value + "T00:00:00Z") > Date.now()))
    return { deregistered: true, deregisteredAt: null };
  return { deregistered: true, deregisteredAt: dates.sort().at(-1)! };
}
export function isDeregisteredJdg(data: JdgRegistryData | null | undefined): boolean { return jdgDeregistration(data).deregistered; }
export function inactiveJdgMessage(data: JdgRegistryData | null | undefined): string {
  const date = jdgDeregistration(data).deregisteredAt;
  return `Działalność jest wykreślona z CEIDG${date ? ` od ${date.slice(8,10)}.${date.slice(5,7)}.${date.slice(0,4)} r.` : ""} i jest nieaktywna. Moduł publikuje dane finansowe i raporty tylko dla aktywnych podmiotów.`;
}
