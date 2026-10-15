import { SaxesParser } from "saxes";
import { createHash } from "node:crypto";
import type { MsrOriginal } from "./msr-source";

export const MSR_MAPPING_VERSION = "2026-10-15-ixbrl-v1";
const IX = new Set(["http://www.xbrl.org/2013/inlineXBRL", "http://www.xbrl.org/2008/inlineXBRL"]);
const INSTANCE = "http://www.xbrl.org/2003/instance";
const DIM = "http://xbrl.org/2006/xbrldi";
const LINK = "http://www.xbrl.org/2003/linkbase";
const XLINK = "http://www.w3.org/1999/xlink";
const XSI = "http://www.w3.org/2001/XMLSchema-instance";
export type MsrStatement = "Bilans" | "RZiS" | "CashFlow" | "Equity" | "ComprehensiveIncome" | "Other";
export type MsrContext = { id: string; entity: string; scheme: string; from: string | null; to: string;
  instant: boolean; dimensions: Record<string, string> };
export type MsrUnit = { id: string; currency: string | null; measure: string; denominator: string | null };
export type MsrFact = {
  id: string; concept: string; namespace: string; localName: string; contextRef: string; unitRef: string | null;
  numeric: boolean; rawText: string; sourceAmount: string | null; amount: string | null;
  scale: number; sign: string | null; decimals: string | null; format: string | null;
  label: string; statements: MsrStatement[]; order: number;
  validation: "VALID" | "REVIEW"; reason: string | null;
};
export type MsrParsed = { mappingVersion: string; sourceChecksum: string; standard: "IAS_IFRS";
  contexts: MsrContext[]; units: MsrUnit[]; facts: MsrFact[]; warnings: string[];
  relationships: { role: string; arcrole: string; from: string; to: string; weight: string | null }[] };
type XNode = { uri: string; local: string; attrs: Record<string, string>; ns: Record<string, string>;
  children: (XNode | string)[]; parent: XNode | null };
export class MsrParserError extends Error {
  constructor(public code: string) { super(code); this.name = "MsrParserError"; }
}
function invalid(code: string): never { throw new MsrParserError(code); }
const attr = (node: XNode, local: string, uri = "") => node.attrs["{" + uri + "}" + local] ?? null;
const named = (node: XNode, uri: string, local: string) => node.uri === uri && node.local === local;
function walk(root: XNode): XNode[] {
  const result: XNode[] = [], pending = [root];
  while (pending.length) {
    const node = pending.pop()!; result.push(node);
    for (let i = node.children.length - 1; i >= 0; i--) if (typeof node.children[i] !== "string") pending.push(node.children[i] as XNode);
  }
  return result;
}
function descendants(root: XNode, uri: string, local: string): XNode[] { return walk(root).filter(n => named(n, uri, local)); }
function text(node: XNode): string {
  if (IX.has(node.uri) && node.local === "exclude") return "";
  return node.children.map(n => typeof n === "string" ? n : text(n)).join("");
}
function compact(value: string): string { return value.replace(/\s+/g, " ").trim(); }
function qname(node: XNode, value: string | null): { namespace: string; local: string; expanded: string } | null {
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length > 2 || parts.some(p => !p)) return null;
  const prefix = parts.length === 2 ? parts[0] : "", local = parts.at(-1)!;
  const namespace = node.ns[prefix];
  return namespace ? { namespace, local, expanded: "{" + namespace + "}" + local } : null;
}
function parseXml(xml: string): XNode {
  if (xml.length > 20_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) invalid("MSR_XML_DTD_EXCLUDED");
  const parser = new SaxesParser({ xmlns: true });
  const stack: XNode[] = []; let root: XNode | null = null, count = 0;
  parser.on("doctype", () => invalid("MSR_XML_DTD_EXCLUDED"));
  parser.on("error", () => invalid("MSR_XML_NOT_WELL_FORMED"));
  parser.on("opentag", tag => {
    if (++count > 400_000 || stack.length > 128) invalid("MSR_XML_COMPLEXITY");
    const parent = stack.at(-1) ?? null, attrs: Record<string, string> = {};
    for (const a of Object.values(tag.attributes)) attrs["{" + a.uri + "}" + a.local] = a.value;
    const node: XNode = { uri: tag.uri, local: tag.local, attrs,
      ns: Object.assign(Object.create(null), parent?.ns, tag.ns), children: [], parent };
    if (parent) parent.children.push(node); else root = node;
    stack.push(node);
  });
  const addText = (value: string) => { if (stack.length) stack.at(-1)!.children.push(value); };
  parser.on("text", addText); parser.on("cdata", addText);
  parser.on("closetag", () => { stack.pop(); });
  parser.write(xml).close();
  if (!root || stack.length) invalid("MSR_XML_NOT_WELL_FORMED");
  return root;
}
function isoDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const n = new Date(value + "T00:00:00Z");
  return Number.isFinite(n.getTime()) && n.toISOString().slice(0, 10) === value ? value : null;
}
function decimal(value: string, scale: number): string | null {
  if (!/^-?\d{1,40}(?:\.\d{1,20})?$/.test(value) || !Number.isSafeInteger(scale) || Math.abs(scale) > 12) return null;
  const negative = value.startsWith("-"), clean = value.replace(/^-/, ""), [whole, fraction = ""] = clean.split(".");
  const digits = (whole + fraction).replace(/^0+(?=\d)/, ""), point = whole.length + scale - (whole.length + fraction.length - digits.length);
  let result = point <= 0 ? "0." + "0".repeat(-point) + digits
    : point >= digits.length ? digits + "0".repeat(point - digits.length) : digits.slice(0, point) + "." + digits.slice(point);
  result = result.replace(/^0+(?=\d)/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return negative && /[1-9]/.test(result) ? "-" + result : result;
}
function numeric(node: XNode, raw: string): { source: string | null; amount: string | null; reason: string | null; scale: number } {
  const scale = Number(attr(node, "scale") ?? "0"), sign = attr(node, "sign"), format = qname(node, attr(node, "format"));
  if (["true", "1"].includes(attr(node, "nil", XSI) ?? "")) return { source: null, amount: null, reason: "NIL_VALUE", scale };
  if (sign !== null && sign !== "-") return { source: null, amount: null, reason: "INVALID_SIGN", scale };
  let lexical = raw.trim();
  if (format) {
    if (!/^http:\/\/www\.xbrl\.org\/inlineXBRL\/transformation\/\d{4}-\d{2}-\d{2}$/.test(format.namespace))
      return { source: null, amount: null, reason: "UNSUPPORTED_TRANSFORMATION", scale };
    if (format.local === "fixed-zero" || format.local === "zerodash") lexical = "0";
    else if (["num-comma-decimal", "numcommadecimal"].includes(format.local)) lexical = lexical.replace(/[\s\u00a0\u202f.]/g, "").replace(",", ".");
    else if (["num-dot-decimal", "numdotdecimal"].includes(format.local)) lexical = lexical.replace(/[\s\u00a0\u202f,]/g, "");
    else return { source: null, amount: null, reason: "UNSUPPORTED_TRANSFORMATION", scale };
  } else if (attr(node, "format")) return { source: null, amount: null, reason: "UNRESOLVED_TRANSFORMATION", scale };
  if (sign === "-" && lexical.startsWith("-")) return { source: null, amount: null, reason: "CONFLICTING_SIGN", scale };
  const source = decimal((sign === "-" ? "-" : "") + lexical, 0);
  const amount = source === null ? null : decimal(source, scale);
  return { source, amount, reason: amount === null ? "INVALID_NUMERIC_VALUE" : null, scale };
}
function statement(role: string): MsrStatement {
  if (/220000|210000|financial.?position|balance.?sheet/i.test(role)) return "Bilans";
  if (/320000|310000|profit.?or.?loss|income.?statement/i.test(role)) return "RZiS";
  if (/420000|410000|comprehensive.?income/i.test(role)) return "ComprehensiveIncome";
  if (/520000|510000|cash.?flows/i.test(role)) return "CashFlow";
  if (/610000|changes.?in.?equity/i.test(role)) return "Equity";
  return "Other";
}

/** Strict namespace-aware XML parsing only. No schema imports, scripts, URLs or external entities are executed. */
export function parseMsrOriginal(source: MsrOriginal): MsrParsed {
  const report = source.files.filter(f => /\.(xhtml|html|xbrl)$/i.test(f.name));
  if (report.length !== 1) invalid("MSR_REPORT_SET_UNSUPPORTED");
  const root = parseXml(report[0].text), nodes = walk(root);
  if (!named(root, "http://www.w3.org/1999/xhtml", "html")) invalid("MSR_XHTML_REQUIRED");
  const ids = new Map<string, XNode>();
  for (const node of nodes) {
    const id = attr(node, "id");
    if (id) { if (ids.has(id)) invalid("MSR_DUPLICATE_XML_ID"); ids.set(id, node); }
  }
  const contexts: MsrContext[] = [];
  for (const node of nodes.filter(n => named(n, INSTANCE, "context"))) {
    const identifier = descendants(node, INSTANCE, "identifier"), instants = descendants(node, INSTANCE, "instant");
    const starts = descendants(node, INSTANCE, "startDate"), ends = descendants(node, INSTANCE, "endDate");
    const from = starts.length === 1 ? isoDate(compact(text(starts[0]))) : null;
    const to = isoDate(compact(text((instants.length === 1 ? instants[0] : ends[0]) ?? node)));
    const id = attr(node, "id");
    if (!id || identifier.length !== 1 || !to || (instants.length ? instants.length !== 1 || starts.length > 0 || ends.length > 0 : !from || ends.length !== 1 || from > to))
      invalid("MSR_CONTEXT_INVALID");
    const dimensions: Record<string, string> = {};
    for (const member of walk(node).filter(n => n.uri === DIM && ["explicitMember", "typedMember"].includes(n.local))) {
      const dimension = qname(member, attr(member, "dimension"))?.expanded;
      const value = member.local === "explicitMember" ? qname(member, compact(text(member)))?.expanded : compact(text(member));
      if (!dimension || !value || dimensions[dimension]) invalid("MSR_DIMENSION_INVALID");
      dimensions[dimension] = value;
    }
    contexts.push({ id, entity: compact(text(identifier[0])), scheme: attr(identifier[0], "scheme") ?? "", from, to,
      instant: instants.length === 1, dimensions });
  }
  const units: MsrUnit[] = [];
  for (const node of nodes.filter(n => named(n, INSTANCE, "unit"))) {
    const measures = descendants(node, INSTANCE, "measure").map(n => qname(n, compact(text(n))));
    const divide = descendants(node, INSTANCE, "divide").length > 0;
    if (!attr(node, "id") || !measures.length || measures.some(m => !m) || measures.length > 2) invalid("MSR_UNIT_INVALID");
    units.push({ id: attr(node, "id")!, currency: measures[0]!.namespace === "http://www.xbrl.org/2003/iso4217" && /^[A-Z]{3}$/.test(measures[0]!.local) ? measures[0]!.local : null,
      measure: measures[0]!.expanded, denominator: divide ? measures[1]?.expanded ?? null : null });
  }
  function continued(node: XNode): string {
    const seen = new Set<XNode>(); let current: XNode | undefined = node, result = "";
    while (current) {
      if (seen.has(current) || seen.size > 512) invalid("MSR_CONTINUATION_INVALID");
      seen.add(current); result += text(current);
      if (result.length > 2_000_000) invalid("MSR_TEXT_LIMIT");
      const next = attr(current, "continuedAt");
      current = next ? ids.get(next) : undefined;
      if (next && (!current || !IX.has(current.uri) || current.local !== "continuation")) invalid("MSR_CONTINUATION_INVALID");
    }
    return compact(result);
  }
  const facts: MsrFact[] = []; let totalFactText = 0;
  for (const node of nodes.filter(n => IX.has(n.uri) && ["nonFraction", "nonNumeric", "fraction"].includes(n.local))) {
    if (facts.length >= 50_000) invalid("MSR_FACT_LIMIT");
    const concept = qname(node, attr(node, "name"));
    if (!concept) invalid("MSR_CONCEPT_NAMESPACE_INVALID");
    const contextRef = attr(node, "contextRef") ?? "", unitRef = attr(node, "unitRef");
    const raw = continued(node), isNumeric = node.local !== "nonNumeric";
    totalFactText += raw.length;
    if (totalFactText > 50_000_000) invalid("MSR_EXPANDED_FACT_TEXT_LIMIT");
    const value = node.local === "nonFraction" ? numeric(node, raw) : { source: null, amount: null, scale: 0, reason: isNumeric ? "FRACTION_UNSUPPORTED" : null };
    let reason = !contexts.some(c => c.id === contextRef) ? "MISSING_CONTEXT"
      : isNumeric && !units.some(u => u.id === unitRef) ? "MISSING_UNIT" : value.reason;
    let row: XNode | null = node;
    while (row && !named(row, "http://www.w3.org/1999/xhtml", "tr")) row = row.parent;
    const cells = row?.children.filter(n => typeof n !== "string" && ["td", "th"].includes(n.local)) as XNode[] | undefined;
    const label = cells?.map(n => compact(text(n))).find(s => s && /[\p{L}]/u.test(s))?.slice(0, 240)
      ?? concept.local.replace(/([a-z])([A-Z])/g, "$1 $2");
    facts.push({ id: attr(node, "id") ?? "fact-" + facts.length, concept: concept.expanded, namespace: concept.namespace, localName: concept.local,
      contextRef, unitRef, numeric: isNumeric, rawText: raw, sourceAmount: value.source, amount: value.amount,
      scale: value.scale, sign: attr(node, "sign"), decimals: attr(node, "decimals"), format: attr(node, "format"),
      label, statements: [], order: facts.length, validation: reason ? "REVIEW" : "VALID", reason });
  }
  if (!facts.some(f => f.numeric)) invalid("MSR_NO_IXBRL_FACTS");
  const warnings = new Set<string>();
  if (new Set(contexts.map(c => c.scheme + ":" + c.entity)).size !== 1) {
    warnings.add("MSR_ENTITY_AMBIGUOUS");
    for (const f of facts) { f.validation = "REVIEW"; f.reason = "ENTITY_AMBIGUOUS"; }
  }
  const byAspects = new Map<string, MsrFact[]>();
  for (const f of facts.filter(f => f.numeric)) {
    const c = contexts.find(c => c.id === f.contextRef), u = units.find(u => u.id === f.unitRef);
    const key = JSON.stringify([f.concept, c && { ...c, id: undefined,dimensions:Object.fromEntries(Object.entries(c.dimensions).sort(([a],[b])=>a.localeCompare(b))) }, u && { ...u, id: undefined }]);
    const group = byAspects.get(key) ?? []; group.push(f); byAspects.set(key, group);
  }
  for (const group of byAspects.values()) if (new Set(group.map(f => f.amount)).size > 1) {
    warnings.add("MSR_CONFLICTING_FACTS");
    for (const f of group) { f.validation = "REVIEW"; f.reason = "CONFLICTING_FACTS"; }
  }
  const concepts = new Map(facts.map(f => [f.concept, f]));
  const elementIds = new Map<string, string>();
  const aux = source.files.filter(f => /(_pre|_cal|_def|_lab-pl|_lab-en)\.xml$|\.xsd$/i.test(f.name)).map(f => parseXml(f.text));
  for (const xml of aux.filter(n => named(n, "http://www.w3.org/2001/XMLSchema", "schema"))) {
    const namespace = attr(xml, "targetNamespace");
    for (const el of descendants(xml, "http://www.w3.org/2001/XMLSchema", "element")) {
      const id = attr(el, "id"), name = attr(el, "name");
      if (id && name && namespace) elementIds.set(id, "{" + namespace + "}" + name);
    }
  }
  function hrefConcept(href: string): string | null {
    const fragment = href.split("#")[1];
    if (!fragment) return null;
    if (elementIds.has(fragment)) return elementIds.get(fragment)!;
    const local = fragment.replace(/^ifrs-full_/, ""), date = /\/(\d{4}-\d{2}-\d{2})\//.exec(href)?.[1];
    const matches = [...concepts.values()].filter(f => f.localName === local && /^https?:\/\/xbrl\.ifrs\.org\/taxonomy\//.test(f.namespace) && (!date || f.namespace.includes(date)));
    return matches.length === 1 ? matches[0].concept : null;
  }
  const relationships: MsrParsed["relationships"] = [];
  for (const xml of aux) for (const link of walk(xml).filter(n => n.uri === LINK && ["presentationLink", "calculationLink", "definitionLink", "labelLink"].includes(n.local))) {
    const role = attr(link, "role", XLINK) ?? "", section = statement(role);
    const locs = new Map(descendants(link, LINK, "loc").map(n => [attr(n, "label", XLINK), hrefConcept(attr(n, "href", XLINK) ?? "")]));
    for (const arc of walk(link).filter(n => n.uri === LINK && ["presentationArc", "calculationArc", "definitionArc"].includes(n.local))) {
      const from = locs.get(attr(arc, "from", XLINK)), to = locs.get(attr(arc, "to", XLINK));
      if (from && to) relationships.push({ role, arcrole: attr(arc, "arcrole", XLINK) ?? "", from, to, weight: attr(arc, "weight") });
    }
    if (link.local === "presentationLink" && section !== "Other") for (const [label, concept] of locs) {
      if (!concept) continue;
      const order = descendants(link, LINK, "presentationArc").find(n => attr(n, "to", XLINK) === label);
      for (const fact of facts.filter(f => f.concept === concept)) {
        if (!fact.statements.includes(section)) fact.statements.push(section);
        fact.order = Math.min(fact.order, Number(attr(order ?? link, "order") ?? fact.order));
      }
    }
    if (link.local === "labelLink") for (const arc of descendants(link, LINK, "labelArc")) {
      const concept = locs.get(attr(arc, "from", XLINK)), labelId = attr(arc, "to", XLINK);
      const label = descendants(link, LINK, "label").find(n => attr(n, "label", XLINK) === labelId
        && attr(n, "lang", "http://www.w3.org/XML/1998/namespace") === "pl" && /\/label$/.test(attr(n, "role", XLINK) ?? ""));
      if (concept && label) for (const fact of facts.filter(f => f.concept === concept)) fact.label = compact(text(label)).slice(0, 240);
    }
  }
  for (const fact of facts) {
    if (!fact.statements.length) fact.statements.push("Other");
    if (fact.reason) warnings.add("MSR_" + fact.reason);
  }
  return { mappingVersion: MSR_MAPPING_VERSION, sourceChecksum: source.checksum, standard: "IAS_IFRS", contexts, units, facts,
    warnings: [...warnings].sort(), relationships };
}
