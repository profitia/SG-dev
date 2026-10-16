const obj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export const isThousandSchema = (name: string): boolean => /WTysiacach(?:Zlotych)?$/i.test(name);
export function verifiedXmlMultiplier(record: unknown, schemaName: string): 1 | 1000 | null {
  if (/WZlotych$/i.test(schemaName)) return 1;
  const meta = obj(obj(record).meta);
  return isThousandSchema(schemaName) && meta.is_extracted_fields_multiplier_validated === true
    && (meta.extracted_fields_multiplier === 1 || meta.extracted_fields_multiplier === 1000)
    ? meta.extracted_fields_multiplier : null;
}
/** Exact decimal shift used to corroborate normalized provider values, never to guess their units. */
export function multiplySourceAmount(text: string, multiplier: 1 | 1000): string | null {
  if (!/^-?\d{1,20}(?:\.\d{1,4})?$/.test(text)) return null;
  if (multiplier === 1) return text;
  const negative = text.startsWith("-"), [whole, fraction = ""] = text.replace(/^-/, "").split(".");
  const value = BigInt(whole + fraction.padEnd(4, "0")) * 1000n, digits = value.toString().padStart(5, "0");
  const integer = digits.slice(0, -4), decimals = digits.slice(-4).replace(/0+$/, "");
  if (integer.length > 20) return null;
  return (negative && value !== 0n ? "-" : "") + integer + (decimals ? "." + decimals : "");
}
export function equalAmounts(a: string, b: string): boolean {
  const normalize = (v: string) => v.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "").replace(/^-0$/, "0");
  return normalize(a) === normalize(b);
}
