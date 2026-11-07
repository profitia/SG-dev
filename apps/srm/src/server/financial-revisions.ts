import { createHash } from "node:crypto";
import type { FinancialSourceDocument } from "./financial-documents";

export const FINANCIAL_REVISION_RULE = "FINANCIAL_REVISIONS_V1";
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export type RevisionCell = { value: string | null; state: "VALUE" | "UNAVAILABLE" | "WITHDRAWN" | "INVALID"; source: string };
export type Revision = {
  id: string; family: string; filedAt: string; checksum: string;
  kind: "ORIGINAL" | "FULL_REPLACEMENT" | "PARTIAL_AMENDMENT" | "UNRESOLVED";
  parent?: string; evidence?: string; changedFields?: readonly string[];
  cells: Readonly<Record<string, RevisionCell>>;
};
export type EffectiveRevision = {
  id: string; status: "RESOLVED" | "UNRESOLVED"; reason: string | null;
  lineage: string[]; cells: Record<string, RevisionCell>;
};

/** Explicit revision graph. Missing values are never zero and a full replacement
 * never inherits holes. A partial amendment needs an evidenced parent AND scope.
 * The provider adapter must supply this contract; filing dates alone cannot do so. */
export function resolveFinancialRevision(revisions: readonly Revision[]): EffectiveRevision {
  const blocked = (reason: string): EffectiveRevision => ({ id: digest([FINANCIAL_REVISION_RULE, revisions, reason]), status: "UNRESOLVED", reason, lineage: [], cells: {} });
  if (!revisions.length) return blocked("REVISION_EMPTY");
  if (new Set(revisions.map(r => r.family)).size !== 1) return blocked("REVISION_FAMILY_MISMATCH");
  if (new Set(revisions.map(r => r.id)).size !== revisions.length) return blocked("REVISION_DUPLICATE_ID");
  if (revisions.some(r => !Number.isFinite(Date.parse(r.filedAt)) || !/^[a-f0-9]{64}$/.test(r.checksum))) return blocked("REVISION_METADATA_INVALID");
  const ordered = [...revisions].sort((a,b) => Date.parse(a.filedAt) - Date.parse(b.filedAt));
  if (ordered.some(r => Object.values(r.cells).some(c => !c.source || (c.state === "VALUE"
    ? c.value === null || !/^-?\d+(\.\d+)?$/.test(c.value) : c.value !== null)))) return blocked("REVISION_CELL_INVALID");
  let cells: Record<string, RevisionCell> = {}, previous: Revision | undefined;
  const lineage: string[] = [];
  for (const r of ordered) {
    if (previous && Date.parse(r.filedAt) === Date.parse(previous.filedAt)) return blocked("REVISION_ORDER_AMBIGUOUS");
    if (r.kind === "UNRESOLVED") return blocked("REVISION_RELATION_UNCONFIRMED");
    if (previous) {
      if (r.parent !== previous.id || !r.evidence) return blocked("REVISION_PARENT_UNCONFIRMED");
    } else if (r.kind !== "ORIGINAL" || r.parent) return blocked("REVISION_BASE_MISSING");
    if (r.kind === "PARTIAL_AMENDMENT") {
      const changed = r.changedFields;
      if (!changed?.length || new Set(changed).size !== changed.length ||
          changed.length !== Object.keys(r.cells).length || changed.some(k => !Object.hasOwn(r.cells,k)))
        return blocked("REVISION_AMENDMENT_SCOPE_UNCONFIRMED");
      // An explicit invalid/withdrawn/nil cell replaces the old value too.
      cells = { ...cells, ...r.cells };
    } else cells = { ...r.cells };
    lineage.push(r.id); previous = r;
  }
  return { id: digest([FINANCIAL_REVISION_RULE, ordered, cells]), status:"RESOLVED", reason:null, lineage, cells };
}

const canonicalAmount = (value: string | null) => value === null ? null : value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
/** Complete financial content, not the intersection of populated fields. Filing
 * ids, labels and checksums may differ, but period/basis/columns/rows must agree. */
export function financialContentHash(d: FinancialSourceDocument): string | null {
  if (d.validation !== "VALID" || !d.rows.length || d.rows.some(r => Object.keys(r.amounts).length === 0)) return null;
  const keys = d.rows.map(r => `${r.section}:${r.sourcePath.replaceAll(">", ".")}`);
  if (new Set(keys).size !== keys.length) return null;
  return digest([d.sourceKrs ?? null,d.scope,d.from,d.to,d.standard,d.schemaName,d.schemaVersion,d.currency,d.scale,
    [...d.columns].sort((a,b)=>a.sourceColumn.localeCompare(b.sourceColumn)),
    d.rows.map(r=>[r.section,r.sourcePath.replaceAll(">", "."),Object.entries(r.amounts).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonicalAmount(v)])])
      // Keep exactly the historical serialized comparison key and collation;
      // only prepare that immutable key once per row.
      .map(row=>({key:JSON.stringify(row.slice(0,2)),value:row}))
      .sort((a,b)=>a.key.localeCompare(b.key)).map(row=>row.value)]);
}

/** G0: MGBI's correction flag currently carries no replacement/scope evidence.
 * Only complete financial equivalence resolves such a family automatically. */
export function resolveDocumentFamily(documents: readonly FinancialSourceDocument[]): {
  status:"RESOLVED"|"UNRESOLVED"; id:string; reason:string|null;
} {
  const fingerprints = documents.map(financialContentHash);
  const validOrder = documents.every(d => !!d.filingDate && Number.isFinite(Date.parse(d.filingDate)));
  const equivalent = documents.length > 1 && fingerprints.every(h => h !== null && h === fingerprints[0]);
  const singleOriginal = documents.length === 1 && documents[0].correction === false;
  const resolved = validOrder && (equivalent || singleOriginal);
  return {status:resolved?"RESOLVED":"UNRESOLVED",id:digest([FINANCIAL_REVISION_RULE,documents.map(d=>[d.recordId,d.checksum,d.filingDate]).sort(),fingerprints]),
    reason:resolved?null:"SOURCE_REVISION_UNRESOLVED"};
}
