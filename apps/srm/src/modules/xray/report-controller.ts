import type { JdgRegistryData, SectionEnvelope, SupplierReportData, SupplierXRayCard } from "@profitia/srm-xray";

export type DisplayCard = { identity: SupplierXRayCard["identity"]; general: Omit<SupplierXRayCard["general"], "source">;
  financial: Omit<SupplierXRayCard["financial"], "source">; kys: Omit<SupplierXRayCard["kys"], "source"> };
export type SearchResult = { entityType: "JDG"; nip: string; section: Omit<SectionEnvelope<JdgRegistryData>, "source"> }
  | { entityType: "COMPANY"; card: DisplayCard };
export type KysRenderTiming = { requestId: string; mode: "PROVIDER" | "CACHE" | "FOLLOWER" | "UNAVAILABLE"; startedAt: number; apiMs: number; serverTiming: string | null };
class ReportRequestError extends Error {
 constructor(message: string, readonly timing?: Omit<KysRenderTiming, "startedAt" | "apiMs">) { super(message); }
}
export type ReportState = {
  kysTiming?: KysRenderTiming; result: SearchResult | null; busy: boolean; error: string | null;
  kys: DisplayCard["kys"]; kysBusy: boolean; kysError: string | null;
  metadata: SupplierReportData | null; metadataBusy: boolean; metadataError: string | null };
export const emptySection = (): DisplayCard["kys"] => ({ status: "NOT_REQUESTED", retrievedAt: null, effectiveAt: null, data: null, warnings: [] });
const initialState = (): ReportState => ({ result: null, busy: false, error: null, kys: emptySection(), kysBusy: false, kysError: null,
  metadata: null, metadataBusy: false, metadataError: null });
export function supplierNip(result: SearchResult | null): string | null { return result?.entityType === "JDG" ? result.nip : result?.card.identity.nip ?? null; }
function message(error: unknown, fallback: string): string { return error instanceof Error ? error.message : fallback; }

/** Host request lifecycle only. No financial calculations, cache or provider policy. */
export class SupplierReportController {
  private state = initialState();
  private listeners = new Set<() => void>();
  private generation = 0;
  private metadataSequence = 0;
  private requests = new Set<AbortController>();
  private metadataRequest?: AbortController;
  constructor(private readonly transport: typeof fetch = (input, init) => fetch(input, init)) {}
  getSnapshot = (): ReportState => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(change: Partial<ReportState>) { this.state = { ...this.state, ...change }; for (const listener of this.listeners) listener(); }
  dispose = () => { this.generation += 1; this.metadataSequence += 1; for (const request of this.requests) request.abort(); this.requests.clear(); };
  reset = () => { this.dispose(); this.state = initialState(); for (const listener of this.listeners) listener(); };
  private async json(path: string, body: unknown, controller: AbortController): Promise<unknown> {
    this.requests.add(controller);
    try {
      const response = await this.transport(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: controller.signal });
      const payload = await response.json();
      if (path.endsWith("/kys") && payload && typeof payload === "object") {
        const requestId = response.headers.get("X-SRM-Request-Id");
        const mode = response.headers.get("X-SRM-KYS-Mode");
        if (requestId && /^[0-9a-f-]{36}$/.test(requestId)) payload.timing = { requestId, mode: ["PROVIDER", "CACHE", "FOLLOWER"].includes(mode ?? "") ? mode : "UNAVAILABLE", serverTiming: response.headers.get("Server-Timing") };
      }
      if (!response.ok) throw new ReportRequestError(typeof payload?.error === "string" ? payload.error : "Nie udało się odczytać raportu.", payload?.timing);
      return payload;
    } finally { this.requests.delete(controller); }
  }
  search = async (identifier: string) => {
    if (this.state.busy) return;
    this.reset(); const generation = this.generation;
    this.update({ busy: true });
    try {
      const payload = await this.json("/api/xray/search", { identifier }, new AbortController()) as SearchResult;
      if (generation !== this.generation) return;
      if ((payload?.entityType !== "JDG" && payload?.entityType !== "COMPANY") || supplierNip(payload) !== identifier) throw new Error("Dane dostawcy nie zgadzają się z wyszukiwanym numerem NIP.");
      this.update({ result: payload, busy: false }); await this.refreshMetadata();
    } catch (error) { if (generation === this.generation) this.update({ error: message(error, "Nie udało się pobrać raportu.") }); }
    finally { if (generation === this.generation) this.update({ busy: false }); }
  };
  refreshMetadata = async () => {
    const result = this.state.result, nip = supplierNip(result); if (!result || !nip) return;
    const generation = this.generation, sequence = ++this.metadataSequence;
    this.metadataRequest?.abort(); const request = new AbortController(); this.metadataRequest = request;
    this.update({ metadataBusy: true, metadataError: null });
    try {
      const payload = await this.json("/api/xray/report-data", { nip, entityType: result.entityType }, request) as SupplierReportData;
      if (generation !== this.generation || sequence !== this.metadataSequence) return;
      if (payload?.schemaVersion !== "1.0" || payload.nip !== nip || payload.entityType !== result.entityType) throw new Error("Nie udało się potwierdzić metadanych tego dostawcy.");
      this.update({ metadata: payload });
    } catch (error) { if (generation === this.generation && sequence === this.metadataSequence) this.update({ metadata: null, metadataError: message(error, "Metadane aktualności są niedostępne.") }); }
    finally { if (generation === this.generation && sequence === this.metadataSequence) this.update({ metadataBusy: false }); }
  };
  fetchKys = async () => {
    const result = this.state.result, nip = supplierNip(result);
    if (this.state.busy || this.state.kysBusy || !result || !nip) return;
    const generation = this.generation, startedAt = performance.now();
    this.update({ kysTiming: undefined, kysBusy: true, kysError: null, kys: { ...emptySection(), status: "PENDING" } });
    try {
      const payload = await this.json(result.entityType === "JDG" ? "/api/xray/jdg/kys" : "/api/xray/kys", { identifier: nip }, new AbortController()) as { section: DisplayCard["kys"]; timing?: Omit<KysRenderTiming, "startedAt" | "apiMs"> };
      if (generation !== this.generation) return;
      if (!payload?.section || !["SUCCESS", "PARTIAL", "EMPTY", "ERROR", "PENDING", "NOT_REQUESTED"].includes(payload.section.status)
        || (payload.section.data?.company?.nip && payload.section.data.company.nip !== nip)) throw new Error("Nie udało się potwierdzić raportu KYS tego dostawcy.");
      this.update({ kys: payload.section, kysTiming: payload.timing ? { ...payload.timing, startedAt, apiMs: performance.now() - startedAt } : undefined });
    } catch (error) { if (generation === this.generation) this.update({ kysTiming: error instanceof ReportRequestError && error.timing ? { ...error.timing, startedAt, apiMs: performance.now() - startedAt } : undefined, kysError: message(error, "Nie udało się pobrać raportu KYS."), kys: { ...emptySection(), status: "ERROR", warnings: ["REPORT_WARNING"] } }); }
    finally { if (generation === this.generation) { this.update({ kysBusy: false }); await this.refreshMetadata(); } }
  };
}
