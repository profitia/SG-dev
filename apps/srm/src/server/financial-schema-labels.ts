import registry from "./financial-schema-labels.json";
import type { FinancialSourceDocument, FinancialSourceRow } from "./financial-documents";

type SchemaTable = { table: string; source: number };
const schemas: Record<string, SchemaTable> = registry.schemas;
const tables: Record<string, string[][]> = registry.tables;

/** Offline official MF annotations, keyed by the full path and XML schema variant.
 * A leaf code such as A/B means different things in each statement and RZiS variant.
 * Missing variant metadata permits only labels identical in every candidate schema.
 */
export function financialRowPresentation(document: FinancialSourceDocument, row: FinancialSourceRow): {
  label: string; order: number; basis: string;
} {
  const path = row.sourcePath.replaceAll(">", ".");
  const prefix = `${document.schemaName}|${document.schemaVersion}|`;
  const systemVariant = /\((\d+)\)$/.exec(document.schemaSystemCode ?? "")?.[1];
  const conflictingVariant = Boolean(document.schemaVariant && systemVariant && document.schemaVariant !== systemVariant);
  const variants = conflictingVariant ? [] : document.schemaVariant ? [document.schemaVariant] : systemVariant ? [systemVariant] : ["1", "2"];
  const candidates = variants.flatMap(variant => schemas[prefix + variant] ? [schemas[prefix + variant]] : []);
  const entries = candidates.map(schema => tables[schema.table]);
  const matches = entries.map(rows => rows.findIndex(([sourcePath]) => sourcePath === path));
  const sourceLabel = row.label !== path && row.label !== row.sourcePath ? row.label : null;
  const labels = matches.map((index, tableIndex) => index >= 0 ? entries[tableIndex][index][1] : null);
  const verified = labels.length > 0 && labels.every(label => label !== null && label === labels[0]);
  // Custom rows sort directly after their source parent, without changing their identity.
  const parent = path.replace(/\.PozycjaUszczegolawiajaca(?:_\d+)?(?:\[\d+\])?(?:\.KwotyPozycji)?$/, "");
  const parentOrder = entries[0]?.findIndex(([sourcePath]) => sourcePath === parent) ?? -1;
  const order = matches[0] >= 0 ? matches[0] : parentOrder >= 0 ? parentOrder + 0.5 : Number.MAX_SAFE_INTEGER;
  const schema = candidates[0];
  const basis = verified && schema ? `MF_XSD: ${registry.sources[schema.source].url} · SHA256 ${registry.sources[schema.source].sha256}` : "SOURCE_LABEL";
  return { label: sourceLabel ?? (verified ? labels[0]! : "Pozycja bez potwierdzonej nazwy w źródle"), order,
    basis: sourceLabel ? "MGBI_XML_SOURCE_LABEL" : verified ? basis : "UNRESOLVED_LABEL; identyfikacja w ścieżce źródłowej komentarza" };
}
