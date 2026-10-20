import type { GeneralCompanyData, FinancialPeriod } from "@profitia/srm-xray";
import { companyRegistration } from "./company-activity";

export const COMPANY_IDENTITY_VERSION = "KRS_CONTINUITY_V1" as const;
export type RegistryHistory = NonNullable<GeneralCompanyData["registryHistory"]>;
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown): string | null => typeof v === "string" && v.trim() && v.length <= 1000 ? v.trim() : null;
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : v == null ? [] : [v];
function values(v: unknown, key: string): string[] {
  return list(v).flatMap(item => { const value = text(item) ?? text(object(item)[key]); return value ? [value] : []; });
}
const normalized = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toUpperCase().replaceAll("Ł","L");
export function registryCalendarDate(v: unknown): string | null {
  const s = text(v), match = s && /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  const date = match ? `${match[3]}-${match[2]}-${match[1]}` : s;
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date ? date : null;
}
function predecessors(excerpt: unknown): string[] {
  const formation = object(object(object(object(excerpt).dane).dzial1).sposobPowstaniaPodmiotu);
  const kinds = values(formation.okolicznosciPowstania, "okolicznosciPowstania");
  if (!kinds.length || kinds.some(k => normalized(k) !== "PRZEKSZTALCENIE")) return [];
  return [...new Set(list(formation.podmioty).flatMap(p => {
    const v = object(p);
    return [...values(v.krs, "krs"), ...values(v.numerWRejestrzeAlboEwidencji, "numerWRejestrzeAlboEwidencji")];
  }).filter(k => /^\d{10}$/.test(k)))];
}
function candidate(record: unknown) {
  const r = object(record), ids = object(r.identifiers), content = object(r.content);
  const current = object(content.current_excerpt), full = object(content.full_excerpt);
  const header = object(current.naglowekA), fullHeader = object(full.naglowekP);
  const subject = object(object(object(current.dane).dzial1).danePodmiotu);
  const oldSubject = object(object(object(full.dane).dzial1).danePodmiotu);
  const krs = text(ids.pl_krs), nip = text(ids.pl_nip), id = text(r.id);
  if (!krs || !/^\d{10}$/.test(krs) || !id) return null;
  const identityConflict = [header.numerKRS, fullHeader.numerKRS].some(k => k != null && k !== krs)
    || (object(subject.identyfikatory).nip != null && object(subject.identyfikatory).nip !== nip);
  const registration = companyRegistration(record);
  const status = Object.keys(current).length && [header.stanPozycji, fullHeader.stanPozycji].some(s => s != null && String(s) !== "1") ? "UNKNOWN" as const : registration.status;
  const name = text(subject.nazwa) ?? values(oldSubject.nazwa, "nazwa").at(-1) ?? null;
  const form = text(subject.formaPrawna) ?? values(oldSubject.formaPrawna, "formaPrawna").at(-1) ?? null;
  const entries = list(fullHeader.wpis).map(object);
  return { record, recordId:id, identityConflict, nip, regon: text(ids.pl_regon)?.replace(/^(\d{9})00000$/, "$1") ?? null,
    member: {krs, legalName:name, legalForm:form, status, deregisteredAt:registration.deregisteredAt,
      registeredAt:registryCalendarDate(header.dataRejestracjiWKRS) ?? registryCalendarDate(entries.find(e => Number(e.numerWpisu) === 1)?.dataWpisu)},
    predecessors:[...new Set([...predecessors(current), ...predecessors(full)])] };
}

export type CompanyResolution = { record: unknown; history: RegistryHistory; error: null }
  | { record: null; history: null; error: "IDENTIFIER_MISMATCH" | "COMPANY_IDENTITY_AMBIGUOUS" };

/** Resolve exact registry identities before applying the inactive-company policy.
 * Only an explicit formation-by-transformation link admits predecessor finances.
 * Merger partners, prose/name matches, array order and largest KRS are not links. */
export function resolveCompanyRecords(records: readonly unknown[], identifier: {type:"NIP"|"KRS";value:string}): CompanyResolution {
  const error = (code: "IDENTIFIER_MISMATCH" | "COMPANY_IDENTITY_AMBIGUOUS"): CompanyResolution => ({record:null,history:null,error:code});
  const matching = records.filter(r => object(object(r).identifiers)[identifier.type === "NIP" ? "pl_nip" : "pl_krs"] === identifier.value);
  if (!matching.length) return error("IDENTIFIER_MISMATCH");
  if (matching.length > 100) return error("COMPANY_IDENTITY_AMBIGUOUS");
  const parsed = matching.map(candidate);
  if (parsed.some(c => !c || c.identityConflict)) return error("COMPANY_IDENTITY_AMBIGUOUS");
  const candidates = parsed as NonNullable<ReturnType<typeof candidate>>[];
  if (new Set(candidates.map(c => c.member.krs)).size !== candidates.length || new Set(candidates.map(c => c.recordId)).size !== candidates.length)
    return error("COMPANY_IDENTITY_AMBIGUOUS");
  const links: RegistryHistory["links"][number][] = [];
  for (const successor of candidates) for (const previousKrs of successor.predecessors) {
    const predecessor = candidates.find(c => c.member.krs === previousKrs);
    if (!predecessor) continue; // An absent register record is not sufficient financial authority.
    if (previousKrs === successor.member.krs || successor.predecessors.length !== 1
        || !predecessor.nip || predecessor.nip !== successor.nip
        || predecessor.regon && successor.regon && predecessor.regon !== successor.regon
        || predecessor.member.registeredAt && successor.member.registeredAt && predecessor.member.registeredAt >= successor.member.registeredAt)
      return error("COMPANY_IDENTITY_AMBIGUOUS");
    links.push({predecessorKrs:previousKrs,successorKrs:successor.member.krs,basis:"KRS_FORMATION_TRANSFORMATION"});
  }
  if (links.some(l => links.filter(p => p.predecessorKrs === l.predecessorKrs).length > 1)) return error("COMPANY_IDENTITY_AMBIGUOUS");
  const active = candidates.filter(c => c.member.status === "ACTIVE" || c.member.status === "LIQUIDATION");
  if (active.length > 1 || candidates.length > 1 && candidates.some(c => c.member.status === "UNKNOWN")) return error("COMPANY_IDENTITY_AMBIGUOUS");
  const terminal = candidates.filter(c => !links.some(l => l.predecessorKrs === c.member.krs));
  const selected = active[0] ?? (terminal.length === 1 ? terminal[0] : null);
  if (!selected) return error("COMPANY_IDENTITY_AMBIGUOUS");
  const members: RegistryHistory["members"][number][] = [], selectedLinks: RegistryHistory["links"][number][] = [];
  let next: typeof selected | undefined = selected;
  while (next) {
    if (members.some(m => m.krs === next!.member.krs)) return error("COMPANY_IDENTITY_AMBIGUOUS");
    members.push(next.member);
    const link = links.find(l => l.successorKrs === next!.member.krs);
    if (link) selectedLinks.push(link);
    next = link ? candidates.find(c => c.member.krs === link.predecessorKrs) : undefined;
  }
  return {record:selected.record,error:null,history:{version:COMPANY_IDENTITY_VERSION,currentKrs:selected.member.krs,members,
    links:selectedLinks,unlinkedKrs:candidates.filter(c => !members.some(m => m.krs === c.member.krs)).map(c => c.member.krs).sort()}};
}

export function financialRegistration(krs: string | null | undefined, history?: RegistryHistory): FinancialPeriod["sourceRegistration"] {
  if (!krs || !/^\d{10}$/.test(krs)) return undefined;
  const member = history?.members.find(m => m.krs === krs);
  return {krs,legalName:member?.legalName ?? null,relationship:!member || member.status==="UNKNOWN" ? "UNCONFIRMED" : krs === history?.currentKrs ? "CURRENT" : "PREDECESSOR"};
}
