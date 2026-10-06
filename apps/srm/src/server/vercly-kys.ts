import type { SectionEnvelope, VerclyKysData } from "@profitia/srm-xray";

export type VerclyKysRequest = {
  identifier: { type: "NIP"; value: string };
};

export type VerclyKysResult = {
  section: SectionEnvelope<VerclyKysData>;
  correlationId: string | null;
  reportId: string | null;
  errorCode: string | null;
};

type Options = {
  apiKey?: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
};

const MODEL = "KYS_NIP";
const source = (recordId: string | null) => ({ provider: "VERCLY" as const, model: MODEL, recordId });
const record = (input: unknown): Record<string, unknown> | null => input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : null;
const string = (input: unknown): string | null => {
  if (typeof input !== "string") return null;
  const value = input.trim();
  return value && !["---", "UNKNOWN", "NONE", "N/A", "NULL"].includes(value.toUpperCase()) ? value.slice(0, 300) : null;
};
const count = (input: unknown): number | null => typeof input === "number" && Number.isSafeInteger(input) && input >= 0 ? input : null;
const items = (input: unknown): unknown[] => Array.isArray(input) ? input : [];

function vatActive(input: unknown): boolean | null {
  const status = string(input)?.toUpperCase();
  if (["CZYNNY", "ACTIVE"].includes(status ?? "")) return true;
  if (["NIECZYNNY", "INACTIVE", "ZWOLNIONY", "EXEMPT", "NIEZAREJESTROWANY", "NOT_REGISTERED"].includes(status ?? "")) return false;
  return null;
}

function validNip(input: string | null): string | null {
  const nip = input?.replace(/^PL/i, "") ?? "";
  if (!/^[0-9]{10}$/.test(nip)) return null;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const check = weights.reduce((sum, weight, index) => sum + weight * Number(nip[index]), 0) % 11;
  return check !== 10 && check === Number(nip[9]) ? nip : null;
}

function attribute(entity: Record<string, unknown>, ...names: string[]): string | null {
  const attributes = items(entity.Attributes).map(record).filter((value): value is Record<string, unknown> => value !== null);
  for (const name of names) {
    const found = attributes.find((entry) => entry.Name === name);
    const value = string(found?.Value);
    if (value) return value;
  }
  return null;
}

function identifier(entity: Record<string, unknown>, type: string): string | null {
  const entry = items(entity.Ids).map(record).find((candidate) => candidate?.Type === type);
  return string(entry?.Value);
}

function stateDate(input: unknown): string | null {
  if (typeof input !== "number" || !Number.isFinite(input)) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapReport(report: unknown, requested: VerclyKysRequest, fallbackCorrelationId: string, retrievedAt: string): VerclyKysResult {
  const root = record(report);
  const header = record(root?.Header);
  const body = record(root?.Body);
  if (!body) throw new Error("INVALID_REPORT");
  const correlationId = string(header?.CorrelationId) ?? fallbackCorrelationId;
  if (correlationId !== fallbackCorrelationId) throw new Error("CORRELATION_MISMATCH");
  const reportId = string(header?.Id);
  const complete = body.IsComplete === true;
  const entity = record(body.Entity);
  const providerId = entity && (validNip(identifier(entity, "VatID")) ?? validNip(identifier(entity, "ID")));
  if (entity && (!providerId || providerId.replace(/\D/g, "") !== requested.identifier.value)) throw new Error("IDENTIFIER_MISMATCH");
  const entityKrs = entity ? identifier(entity, "KRS") : null;
  const entityNip = entity ? validNip(identifier(entity, "VatID")) ?? validNip(identifier(entity, "ID")) : null;

  // This is an allowlist projection. Never persist the provider response, person records,
  // free-text analysis, raw error messages or personal identifiers.
  const listResults = entity ? items(entity.Sanctions).map(record)
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .filter((entry) => typeof entry.Value === "boolean" && string(entry.ListName))
    .slice(0, 50).map((entry) => ({
      name: string(entry.ListName)!,
      type: string(entry.ListType) ?? "LIST",
      matched: entry.Value as boolean,
    })) : [];
  const company = entity ? {
    name: string(entity.Name),
    krs: entityKrs,
    nip: providerId ?? entityNip,
    regon: identifier(entity, "Regon"),
    legalForm: attribute(entity, "NormalizedDetailLegalForm", "DetailLegalForm", "MainLegalForm"),
    address: [attribute(entity, "Street", "KrsAddrStreet"), attribute(entity, "KrsAddrBuildingNo"), attribute(entity, "KrsAddrZipCode"), attribute(entity, "City", "KrsAddrCity")].filter(Boolean).join(", ") || null,
    country: attribute(entity, "Country"),
    activityStatus: attribute(entity, "ActivityStatus"),
    registeredAt: attribute(entity, "RegisterEntryDate"),
    lastChangedAt: attribute(entity, "LastModificationDate", "DateOfChange"),
    mainPkd: attribute(entity, "MainPKD"),
    shareCapital: attribute(entity, "ShareCapitalAmount"),
    representation: attribute(entity, "RepresentationForm"),
  } : undefined;
  const warnings = items(body.Errors).map(record)
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .filter((entry) => entry.Resolved !== true)
    .map((entry) => `VERCLY_SEVERITY_${count(entry.Severity) ?? "UNKNOWN"}`);
  if (entity && attribute(entity, "isAllComplete") === "false") warnings.push("VERCLY_INCOMPLETE_SOURCES");
  const queriedRegisters = items(body.QueriedRegisters).map(string).filter((value): value is string => value !== null).slice(0, 30);
  const krzCount = count(record(entity?.Krz)?.Count);
  const vat = record(entity?.Vat);
  const vies = record(entity?.Vies);
  const data: VerclyKysData = {
    correlationId, reportId, isComplete: complete, queriedRegisters,
    registryChecks: {
      krzListed: krzCount === null ? null : krzCount > 0,
      vatActive: vatActive(vat?.ActivityStatus),
      euVat: typeof vies?.EuVat === "boolean" ? vies.EuVat : null,
    },
    stateAsOf: stateDate(body.StateAsOfDate), company, screenedLists: listResults,
    beneficialOwnersCount: count(record(entity?.Beneficiaries)?.Count),
    relatedPersonsCount: count(record(entity?.DepPersons)?.Count),
    pepPositionsCount: count(record(entity?.PepPositions)?.Count),
    riskLevel: null,
  };
  return {
    section: {
      status: complete ? entity ? warnings.length ? "PARTIAL" : "SUCCESS" : "EMPTY" : "PENDING",
      source: source(reportId), retrievedAt, effectiveAt: data.stateAsOf,
      data, warnings,
    },
    correlationId, reportId, errorCode: null,
  };
}

function failure(code: string, retrievedAt: string, correlationId: string | null = null): VerclyKysResult {
  return { section: { status: "ERROR", source: source(null), retrievedAt, effectiveAt: null, data: null, warnings: [code] }, correlationId, reportId: null, errorCode: code };
}

async function jsonRequest(fetcher: typeof fetch, url: string, init: RequestInit): Promise<unknown> {
  const response = await fetcher(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  try { return await response.json(); } catch { throw new Error("INVALID_JSON"); }
}

export async function fetchVerclyKys(request: VerclyKysRequest, options: Options = {}): Promise<VerclyKysResult> {
  if (request.identifier.type !== "NIP" || !validNip(request.identifier.value)) throw new Error("A valid NIP is required");
  const apiKey = options.apiKey ?? process.env.VERCLY_API_KEY;
  const baseUrl = options.baseUrl ?? process.env.VERCLY_API_BASE_URL;
  if (!apiKey || !baseUrl) return failure("VERCLY_NOT_CONFIGURED", (options.now ?? (() => new Date()))().toISOString());
  const base = new URL(baseUrl);
  if (base.protocol !== "https:") throw new Error("Vercly API must use HTTPS");
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  let correlationId: string | null = null;
  try {
    const started = await jsonRequest(fetcher, new URL("/api/verifications", base).toString(), {
      method: "POST", headers, body: JSON.stringify([{
        Id: request.identifier.value,
        Country: "PL",
      }]),
    });
    correlationId = string(items(started)[0]);
    if (!correlationId || !/^[A-Za-z0-9_-]{8,100}$/.test(correlationId)) throw new Error("INVALID_CORRELATION_ID");
    const deadline = Date.now() + (options.pollTimeoutMs ?? 180_000);
    await sleep(options.pollIntervalMs ?? 3_000);
    while (true) {
      let payload: unknown;
      try {
        payload = await jsonRequest(fetcher, new URL(`/api/verifications/${correlationId}`, base).toString(), { method: "GET", headers });
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "HTTP_404") throw error;
        if (Date.now() >= deadline) return failure("VERCLY_REPORT_NOT_READY", now().toISOString(), correlationId);
        await sleep(options.pollIntervalMs ?? 3_000);
        continue;
      }
      if (!Array.isArray(payload) || !payload.length) throw new Error("INVALID_REPORT");
      const mapped = mapReport(payload[0], request, correlationId, now().toISOString());
      if (mapped.section.status !== "PENDING") return mapped;
      if (Date.now() >= deadline) return failure("VERCLY_TIMEOUT", now().toISOString(), correlationId);
      await sleep(options.pollIntervalMs ?? 3_000);
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "VERCLY_UNKNOWN_ERROR";
    return failure(/^HTTP_\d+$|^[A-Z_]+$/.test(code) ? code : "VERCLY_NETWORK_ERROR", now().toISOString(), correlationId);
  }
}
