import { type financialUnits } from "./financial-history";
/** Decimal-string rounding for display only. The stored result is never changed. */
export function compactFinancialValue(value: string | null, unit: keyof typeof financialUnits): string {
  if (value === null || !/^-?\d+(?:\.\d+)?$/.test(value)) return "Brak danych";
  const negative = value.startsWith("-"), [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const integer = BigInt(whole), nonzero = integer !== 0n || /[1-9]/.test(fraction);
  let scale = 0, suffix = unit === "RATIO" ? "" : unit === "PERCENT" ? "%" : unit === "DAYS" ? " dni" : unit === "PERCENTAGE_POINTS" ? " p.p." : " zł";
  if (unit === "PLN") {
    if (integer >= 1000000000n) { scale = 9; suffix = " mld zł"; }
    else if (integer >= 1000000n) { scale = 6; suffix = " mln zł"; }
    else if (integer >= 1000n) { scale = 3; suffix = " tys. zł"; }
  }
  const precision = unit === "PLN" && scale === 0 ? 2 : 1;
  const digits = whole.padStart(scale + 1, "0") + fraction;
  const decimalPosition = whole.padStart(scale + 1, "0").length - scale;
  const roundingPosition = decimalPosition + precision;
  let rounded = BigInt(digits.slice(0, roundingPosition).padEnd(roundingPosition, "0"));
  if ((digits[roundingPosition] ?? "0") >= "5") rounded += 1n;
  if (rounded === 0n && nonzero) return `${negative ? ">−" : "<"}0,${"0".repeat(precision - 1)}1${suffix}`;
  const roundedText = rounded.toString().padStart(precision + 1, "0");
  const main = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(BigInt(roundedText.slice(0, -precision)));
  let decimals = roundedText.slice(-precision);
  if (unit === "PLN") decimals = decimals.replace(/0+$/, "");
  return `${negative && nonzero ? "−" : ""}${main}${decimals ? `,${decimals}` : ""}${suffix}`;
}
