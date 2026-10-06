import type { JdgEntry, JdgField, JdgRegistryData, SectionEnvelope } from "@profitia/srm-xray";

const endpoint = "https://dane.biznes.gov.pl/api/ceidg/v3/firma";
const labels: Record<string, string> = {
  id: "Identyfikator wpisu", nazwa: "Nazwa działalności", status: "Status działalności",
  numerStatusu: "Numer statusu", wlasciciel: "Właściciel", imie: "Imię", nazwisko: "Nazwisko",
  nip: "NIP", regon: "REGON", adresDzialalnosci: "Adres działalności",
  adresyDzialalnosciDodatkowe: "Dodatkowe adresy działalności", adresKorespondencyjny: "Adres korespondencyjny",
  ulica: "Ulica", budynek: "Numer budynku", lokal: "Numer lokalu", miasto: "Miejscowość",
  wojewodztwo: "Województwo", powiat: "Powiat", gmina: "Gmina", kraj: "Kraj", kod: "Kod pocztowy",
  skrytkaPocztowa: "Skrytka pocztowa", opisNietypowegoMiejsca: "Opis miejsca", adresat: "Adresat",
  terc: "TERC", simc: "SIMC", ulic: "ULIC", obywatelstwa: "Obywatelstwa", symbol: "Symbol",
  rokPkd: "Rok klasyfikacji PKD", pkd: "Kody PKD", pkdGlowny: "Główna działalność PKD",
  spolki: "Spółki cywilne", dataRozpoczecia: "Data rozpoczęcia", dataZawieszenia: "Data zawieszenia",
  dataZakonczenia: "Data zakończenia", dataWykreslenia: "Data wykreślenia", dataWznowienia: "Data wznowienia",
  telefon: "Telefon", email: "E-mail", www: "Strona WWW", adresDoreczenElektronicznych: "Adres do e-Doręczeń",
  innaFormaKonaktu: "Inna forma kontaktu", wspolnoscMajatkowa: "Wspólność majątkowa",
  wspolnoscMajatkowaDataUstania: "Data ustania wspólności majątkowej", dataZgonu: "Data zgonu",
  zarzadSukcesyjnyDataUstanowienia: "Ustanowienie zarządu sukcesyjnego",
  zarzadSukcesyjnyDataWygasniecia: "Wygaśnięcie zarządu sukcesyjnego",
  podstawyPrawneWykreslenia: "Podstawy wykreślenia", zakazy: "Zakazy", upadlosci: "Upadłości",
  zarzadcaSukcesyjny: "Zarządca sukcesyjny", kwalifikacjeZawodowe: "Kwalifikacje zawodowe",
  uprawnienia: "Uprawnienia", ograniczenia: "Ograniczenia", ograniczeniaZdolnosciPrawnej: "Ograniczenia zdolności prawnej",
  link: "Adres wpisu w CEIDG", dataOrzeczenia: "Data orzeczenia", rodzajInformacji: "Rodzaj informacji",
};
const statusLabels: Record<string, string> = {
  AKTYWNY: "Aktywny", ZAWIESZONY: "Zawieszony", WYKRESLONY: "Wykreślony",
  OCZEKUJE_NA_ROZPOCZECIE_DZIALANOSCI: "Oczekuje na rozpoczęcie działalności",
  WYLACZNIE_W_FORMIE_SPOLKI: "Działalność wyłącznie w formie spółki cywilnej",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fieldLabel(key: string): string {
  return labels[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function normalizedValue(value: unknown, key: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Tak" : "Nie";
  if (typeof value === "string") return key === "status" ? statusLabels[value] ?? value : value;
  return typeof value === "number" ? String(value) : null;
}

function field(key: string, value: unknown): JdgField {
  const children = Array.isArray(value)
    ? value.map((item, index) => field(String(index + 1), item))
    : isRecord(value) ? Object.entries(value).map(([childKey, childValue]) => field(childKey, childValue)) : [];
  return { key, label: /^\d+$/.test(key) ? `Pozycja ${key}` : fieldLabel(key), value: normalizedValue(value, key), children };
}

export function normalizeCeidgEntry(record: Record<string, unknown>, requestedNip: string): JdgEntry | null {
  const owner = isRecord(record.wlasciciel) ? record.wlasciciel : null;
  if (owner?.nip !== requestedNip || typeof record.id !== "string" || typeof record.nazwa !== "string") return null;
  return {
    recordId: record.id, name: record.nazwa,
    status: typeof record.status === "string" ? statusLabels[record.status] ?? record.status : null,
    nip: requestedNip, regon: typeof owner.regon === "string" ? owner.regon : null,
    fields: Object.entries(record).map(([key, value]) => field(key, value)),
  };
}

export type CeidgResult = {
  section: SectionEnvelope<JdgRegistryData>;
  snapshot: { firma: readonly Record<string, unknown>[] } | null;
  errorCode: string | null;
};

export async function fetchCeidgJdg(nip: string, options: {
  token?: string;
  fetcher?: typeof fetch;
  url?: string;
} = {}): Promise<CeidgResult> {
  const token = options.token ?? process.env.CEIDG_API_KEY ?? process.env.API_KEY_CEDG;
  const retrievedAt = new Date().toISOString();
  const source = { provider: "CEIDG" as const, model: "firma", recordId: null };
  const base = { source, retrievedAt, effectiveAt: null, warnings: [] as string[] };
  if (!token) return { section: { ...base, status: "ERROR", data: null, warnings: ["CEIDG_NOT_CONFIGURED"] }, snapshot: null, errorCode: "NOT_CONFIGURED" };
  if (!/^[0-9]{10}$/.test(nip)) throw new Error("NIP must have ten digits");

  try {
    const url = new URL(options.url ?? endpoint);
    url.searchParams.set("nip", nip);
    const response = await (options.fetcher ?? fetch)(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store", signal: AbortSignal.timeout(20000),
    });
    if (response.status === 204) return { section: { ...base, status: "EMPTY", data: null }, snapshot: null, errorCode: null };
    if (!response.ok) return { section: { ...base, status: "ERROR", data: null }, snapshot: null, errorCode: `HTTP_${response.status}` };
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.firma)) return { section: { ...base, status: "ERROR", data: null }, snapshot: null, errorCode: "INVALID_RESPONSE" };
    const records = payload.firma.filter(isRecord);
    const entries = records.map((record) => normalizeCeidgEntry(record, nip)).filter((entry): entry is JdgEntry => entry !== null);
    if (records.length && !entries.length) return { section: { ...base, status: "ERROR", data: null, warnings: ["IDENTIFIER_MISMATCH"] }, snapshot: null, errorCode: "IDENTIFIER_MISMATCH" };
    if (!entries.length) return { section: { ...base, status: "EMPTY", data: null }, snapshot: null, errorCode: null };
    const matchedRecords = records.filter((record) => isRecord(record.wlasciciel) && record.wlasciciel.nip === nip);
    return {
      section: { ...base, status: entries.length === records.length ? "SUCCESS" : "PARTIAL",
        source: { ...source, recordId: entries.length === 1 ? entries[0].recordId : null },
        data: { entries }, warnings: entries.length === records.length ? [] : ["IDENTIFIER_MISMATCH"] },
      snapshot: { firma: matchedRecords }, errorCode: null,
    };
  } catch (error) {
    return { section: { ...base, status: "ERROR", data: null }, snapshot: null,
      errorCode: error instanceof Error && error.name === "TimeoutError" ? "TIMEOUT" : "FETCH_ERROR" };
  }
}
