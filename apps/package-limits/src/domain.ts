export class Fault extends Error {
  constructor(
    public status: number,
    public code: string,
    message = code,
  ) {
    super(message);
  }
}
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };
export type Dict = { [key: string]: Json };
export const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
export const UNITS = ["DAY", "WEEK", "MONTH", "YEAR", "CONTRACT"] as const;
export function object(v: unknown): Record<string, unknown> {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.getPrototypeOf(v) !== Object.prototype
  )
    throw new Fault(400, "INVALID_INPUT");
  return v as Record<string, unknown>;
}
export function closed(v: unknown, keys: string[]): Record<string, unknown> {
  const d = object(v);
  if (Object.keys(d).some((k) => !keys.includes(k)))
    throw new Fault(400, "UNKNOWN_FIELD");
  return d;
}
export function text(v: unknown, max = 256): string {
  if (
    typeof v !== "string" ||
    !v.trim() ||
    v.trim().length > max ||
    /[\u0000-\u001f\u007f]/u.test(v) ||
    /(?:sk_(?:live|test)_|gh[pousr]_|postgres(?:ql)?:\/\/|Bearer\s+)/i.test(v)
  )
    throw new Fault(400, "INVALID_TEXT");
  return v.trim();
}
export function id(v: unknown): string {
  const s = text(v, 36);
  if (!UUID.test(s)) throw new Fault(400, "INVALID_ID");
  return s;
}
export function code(v: unknown): string {
  const s = text(v, 64);
  if (!CODE.test(s)) throw new Fault(400, "INVALID_CODE");
  return s;
}
export function choice(v: unknown, allowed: readonly string[]): string {
  if (typeof v !== "string" || !allowed.includes(v))
    throw new Fault(400, "INVALID_CHOICE");
  return v;
}
export function integer(v: unknown): number {
  if (!Number.isSafeInteger(v) || Number(v) < 1)
    throw new Fault(400, "INVALID_REVISION");
  return Number(v);
}
export function decimal(v: unknown): string {
  const s = typeof v === "number" ? String(v) : v;
  if (
    typeof s !== "string" ||
    !/^(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,6})?$/.test(s)
  )
    throw new Fault(400, "INVALID_VALUE");
  return s;
}
export function date(v: unknown, optional = false): string | null {
  if (optional && (v === null || v === "")) return null;
  const s = text(v, 10);
  if (
    !/^\d{4}-\d\d-\d\d$/.test(s) ||
    !Number.isFinite(Date.parse(s + "T00:00:00Z")) ||
    new Date(s + "T00:00:00Z").toISOString().slice(0, 10) !== s ||
    s < "2000-01-01" ||
    s > "2100-12-31"
  )
    throw new Fault(400, "INVALID_DATE");
  return s;
}
export function zone(v: unknown): string {
  const s = text(v, 64);
  try {
    new Intl.DateTimeFormat("en", { timeZone: s }).format();
  } catch {
    throw new Fault(400, "INVALID_TIMEZONE");
  }
  return s;
}
export function list(v: unknown, max = 64): unknown[] {
  if (!Array.isArray(v) || v.length > max) throw new Fault(400, "INVALID_LIST");
  return v;
}
export function unique<T>(v: T[]): T[] {
  if (new Set(v).size !== v.length) throw new Fault(400, "DUPLICATE_ITEM");
  return v;
}
export function limit(v: unknown): Dict {
  const d = closed(v, [
    "metricId",
    "mode",
    "value",
    "period",
    "anchor",
    "timezone",
    "warningPercent",
  ]);
  const mode = choice(d.mode, ["LIMITED", "UNMETERED", "DISABLED"]);
  let warning: Json = null;
  if (
    d.warningPercent !== null &&
    d.warningPercent !== undefined &&
    d.warningPercent !== ""
  ) {
    warning = Number(d.warningPercent);
    if (!Number.isFinite(warning) || warning <= 0 || warning > 100)
      throw new Fault(400, "INVALID_WARNING");
  }
  return {
    metricId: code(d.metricId),
    mode,
    value: mode === "LIMITED" ? decimal(d.value) : null,
    period: choice(d.period, UNITS),
    anchor: choice(d.anchor, ["CALENDAR", "ASSIGNMENT"]),
    timezone: zone(d.timezone),
    warningPercent: warning,
  };
}
export function packageSnapshot(v: unknown): Dict {
  const d = closed(v, ["name", "capabilities", "limits", "price", "currency"]);
  const capabilities = unique(list(d.capabilities).map(code));
  const limits = list(d.limits).map(limit);
  unique(limits.map((x) => x.metricId));
  const price = d.price === null || d.price === "" ? null : decimal(d.price);
  if (
    price !== null &&
    (typeof d.currency !== "string" || !/^[A-Z]{3}$/.test(d.currency))
  )
    throw new Fault(400, "INVALID_CURRENCY");
  return {
    name: text(d.name),
    capabilities,
    limits,
    price,
    currency: price === null ? null : String(d.currency),
  };
}
export function terms(v: unknown): Dict {
  const d = closed(v, [
    "contractStart",
    "contractEnd",
    "assignmentStart",
    "assignmentEnd",
    "usageStart",
    "usageCycle",
    "usageAnchor",
    "billingStart",
    "billingEnd",
    "invoiceDate",
    "dueDate",
    "timezone",
    "basis",
    "reference",
    "purchaseType",
  ]);
  const out: Dict = {};
  for (const k of [
    "contractStart",
    "contractEnd",
    "assignmentStart",
    "assignmentEnd",
    "usageStart",
    "billingStart",
    "billingEnd",
  ])
    out[k] = date(d[k]);
  for (const k of ["invoiceDate", "dueDate"]) out[k] = date(d[k], true);
  out.timezone = zone(d.timezone);
  out.usageCycle = choice(d.usageCycle, ["MONTH", "YEAR"]);
  out.usageAnchor = choice(d.usageAnchor, ["CALENDAR", "ASSIGNMENT"]);
  out.basis = choice(d.basis, ["MANUAL_CONTRACT", "DEVELOPMENT_TEST"]);
  out.reference = text(d.reference);
  out.purchaseType = choice(d.purchaseType, ["ONE_OFF", "MANUAL_SUBSCRIPTION"]);
  for (const [a, b] of [
    ["contractStart", "contractEnd"],
    ["assignmentStart", "assignmentEnd"],
    ["billingStart", "billingEnd"],
  ])
    if (String(out[a!]) >= String(out[b!]))
      throw new Fault(400, "INVALID_INTERVAL");
  if (
    String(out.assignmentStart) < String(out.contractStart) ||
    String(out.assignmentEnd) > String(out.contractEnd) ||
    String(out.usageStart) < String(out.assignmentStart) ||
    String(out.usageStart) >= String(out.assignmentEnd)
  )
    throw new Fault(400, "OUTSIDE_CONTRACT");
  if (
    out.invoiceDate &&
    out.dueDate &&
    String(out.dueDate) < String(out.invoiceDate)
  )
    throw new Fault(400, "INVALID_DUE_DATE");
  return out;
}
export const WRITE_OPS = [
  "capability.create",
  "metric.create",
  "package.create",
  "draft.save",
  "version.create",
  "version.publish",
  "package.archive",
  "package.restore",
  "assignment.create",
  "assignment.change",
  "assignment.status",
] as const;
export function command(v: unknown): {
  operation: string;
  requestId: string;
  data: Dict;
} {
  const e = closed(v, ["operation", "requestId", "data"]);
  const operation = choice(e.operation, WRITE_OPS);
  const requestId = id(e.requestId);
  let data: Dict;
  const raw = object(e.data);
  switch (operation) {
    case "capability.create": {
      const d = closed(raw, ["id", "name", "description", "products"]);
      data = {
        id: code(d.id),
        name: text(d.name),
        description: text(d.description, 1000),
        products: unique(
          list(d.products, 2).map((x) =>
            choice(x, ["SPENDGURU", "SRM_STANDALONE"]),
          ),
        ),
      };
      if (!(data.products as Json[]).length)
        throw new Fault(400, "PRODUCT_REQUIRED");
      break;
    }
    case "metric.create": {
      const d = closed(raw, [
        "id",
        "name",
        "unit",
        "description",
        "source",
        "capabilityId",
      ]);
      data = {
        id: code(d.id),
        name: text(d.name),
        unit: text(d.unit, 32),
        description: text(d.description, 1000),
        source: text(d.source, 64),
        capabilityId: code(d.capabilityId),
      };
      break;
    }
    case "package.create": {
      const d = closed(raw, ["name", "productId"]);
      data = {
        name: text(d.name),
        productId: choice(d.productId, ["SPENDGURU", "SRM_STANDALONE"]),
      };
      break;
    }
    case "draft.save": {
      const d = closed(raw, ["versionId", "revision", "snapshot"]);
      data = {
        versionId: id(d.versionId),
        revision: integer(d.revision),
        snapshot: packageSnapshot(d.snapshot),
      };
      break;
    }
    case "version.create": {
      const d = closed(raw, ["packageId", "fromVersionId"]);
      data = { packageId: id(d.packageId), fromVersionId: id(d.fromVersionId) };
      break;
    }
    case "version.publish": {
      const d = closed(raw, ["versionId", "revision"]);
      data = { versionId: id(d.versionId), revision: integer(d.revision) };
      break;
    }
    case "package.archive":
    case "package.restore": {
      const d = closed(raw, ["packageId", "reason"]);
      data = { packageId: id(d.packageId), reason: text(d.reason, 1000) };
      break;
    }
    case "assignment.create":
    case "assignment.change": {
      const d = closed(raw, [
        "assignmentId",
        "revision",
        "organisationId",
        "packageVersionId",
        "terms",
        "overrides",
        "reason",
        "effectiveFrom",
      ]);
      const overrides = list(d.overrides).map(limit);
      unique(overrides.map((x) => x.metricId));
      data = {
        organisationId: id(d.organisationId),
        packageVersionId: id(d.packageVersionId),
        terms: terms(d.terms),
        overrides,
        reason: text(d.reason, 1000),
        effectiveFrom: date(d.effectiveFrom),
      };
      if (operation === "assignment.change") {
        data.assignmentId = id(d.assignmentId);
        data.revision = integer(d.revision);
      }
      break;
    }
    case "assignment.status": {
      const d = closed(raw, [
        "assignmentId",
        "revision",
        "status",
        "reason",
        "effectiveFrom",
      ]);
      data = {
        assignmentId: id(d.assignmentId),
        revision: integer(d.revision),
        status: choice(d.status, ["ENABLED", "SUSPENDED", "CANCELLED"]),
        reason: text(d.reason, 1000),
        effectiveFrom: date(d.effectiveFrom),
      };
      break;
    }
    default:
      throw new Fault(400, "UNKNOWN_OPERATION");
  }
  return { operation, requestId, data };
}
export const isOverlap = (a: string, b: string, c: string, d: string) =>
  a < d && c < b;
