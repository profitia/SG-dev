export type FinancialHistoryPoint = {
  year: number;
  value: number | null;
  /** Original decimal string, when available, for lossless spreadsheet export. */
  rawValue?: string | null;
  information?: string;
};

export const historyUnit = (unit: string) => unit === 'PLN' ? 'PLN' : unit === 'PERCENT' ? '%' : unit === 'DAYS' ? 'dni' : '×';

export function historyInformation(point: FinancialHistoryPoint) {
  const information = point.information && point.information !== '—' ? point.information.replace(/Brak potwierdzonego odniesienia historycznego\.?/gi, '').trim() : '';
  if (point.value === null || !Number.isFinite(point.value)) {
    return /brak danych/i.test(information) ? information : ['Brak danych.', information].filter(Boolean).join(' ');
  }
  return information;
}

export function historyNumber(point: FinancialHistoryPoint, unit: string) {
  return point.value === null || !Number.isFinite(point.value) ? 'Brak danych' : point.value.toLocaleString('pl-PL', {
    minimumFractionDigits: unit === 'PLN' ? 2 : 0,
    maximumFractionDigits: unit === 'PLN' ? 2 : 6
  });
}

// Guard text cells against accidental spreadsheet formulas and row/column splitting.
// Signed numeric values take a separate path and remain actual numbers in Excel.
function textCell(value: string) {
  const singleLine = value.replace(/[\t\r\n]+/g, ' ').trim();
  return /^[=+\-@]/.test(singleLine) ? "'" + singleLine : singleLine;
}

function numericCell(point: FinancialHistoryPoint) {
  if (point.value === null || !Number.isFinite(point.value)) return '';
  const raw = point.rawValue?.trim().replace(',', '.');
  const originalIsNumeric = raw && /^[+\-]?\d+(?:\.\d+)?(?:e[+\-]?\d+)?$/i.test(raw) && Number(raw) === point.value;
  // Polish Excel: comma decimal separator, no thousands separators or unit suffix.
  return (originalIsNumeric ? raw : String(point.value)).replace('.', ',');
}

/** A = year, B = value, C = unit, D = information. Header + all years, not only visible rows.
 * Missing values produce empty numeric cells, with an explicit explanation in D;
 * a reported zero is the numeric value 0. CRLF and tabs paste into spreadsheet cells.
 */
export function financialHistoryTsv(points: FinancialHistoryPoint[], unit: string) {
  const rows = [...points].sort((a, b) => a.year - b.year).map(point => [
    String(point.year), numericCell(point), textCell(historyUnit(unit)), textCell(historyInformation(point))
  ]);
  return [['Rok', 'Wartość', 'Jednostka', 'Informacja'], ...rows].map(row => row.join('\t')).join('\r\n');
}

// One shared, zero-based scale. Negative values extend below zero, never as magnitudes above it.
export function historyDomain(values: number[]) {
  const low = Math.min(0, ...values),
    high = Math.max(0, ...values);
  if (low === high) return {
    min: 0,
    max: 1,
    ticks: [0],
    emptyScale: true
  };
  const rough = (high - low) / 4,
    power = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 2.5, 5, 10].find(n => n * power >= rough) ?? 10) * power;
  const min = Math.floor(low / step) * step,
    max = Math.ceil(high / step) * step;
  const ticks = Array.from({
    length: Math.round((max - min) / step) + 1
  }, (_, i) => min + step * i);
  return {
    min,
    max,
    ticks,
    emptyScale: false
  };
}
// Chronology, not financial judgement: the same Deep Ocean hue gains saturation with recency.
export function yearColor(index: number, count: number) {
  const weight = count < 2 ? 1 : .32 + .68 * index / (count - 1);
  return `rgb(${[0, 90, 156].map(channel => Math.round(255 + (channel - 255) * weight)).join(',')})`;
}
