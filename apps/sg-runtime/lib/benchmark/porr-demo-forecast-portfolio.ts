export type PorrDemoForecastBenchmarkFamily = 'oil' | 'copper' | 'steel'

export type PorrDemoForecastBenchmark = {
  readonly seriesId: string
  readonly family: PorrDemoForecastBenchmarkFamily
  readonly label: {
    readonly pl: string
    readonly en: string
  }
}

/**
 * Operator-approved PORR demo portfolio.
 *
 * This is presentation configuration only. It decides which benchmarks expose
 * the prepared-read forecast experience in the PORR demo shell; it does not
 * change forecasting policy, readiness, or compute ownership.
 */
export const PORR_DEMO_FORECAST_BENCHMARKS: readonly PorrDemoForecastBenchmark[] = [
  { seriesId: 'b_c1_cl', family: 'oil', label: { pl: 'ICE Brent Crude — 1. pozycja', en: 'ICE Brent Crude — 1st Position' } },
  { seriesId: 'cl_c1_cl', family: 'oil', label: { pl: 'WTI Physical — 1. pozycja', en: 'WTI Physical — 1st Position' } },
  { seriesId: 'wocaes0074', family: 'oil', label: { pl: 'Brent Spot — Morze Północne', en: 'Brent Spot — North Sea' } },
  { seriesId: 'bz_c1_cl', family: 'oil', label: { pl: 'Brent — kontrakt kontynuacyjny', en: 'Brent — continuous contract' } },
  { seriesId: 'qm_c1_cl', family: 'oil', label: { pl: 'E-mini Crude Oil — kontrakt kontynuacyjny', en: 'E-mini Crude Oil — continuous contract' } },
  { seriesId: 'hg2027g_cl', family: 'copper', label: { pl: 'Copper — luty 2027', en: 'Copper — February 2027' } },
  { seriesId: 'lmeofcucashask', family: 'copper', label: { pl: 'LME Copper Cash Seller', en: 'LME Copper Cash Seller' } },
  { seriesId: 'hg_c1_cl', family: 'copper', label: { pl: 'Copper — kontrakt kontynuacyjny', en: 'Copper — continuous contract' } },
  { seriesId: 'ehr2027g_cl', family: 'steel', label: { pl: 'North European HRC — luty 2027', en: 'North European HRC — February 2027' } },
  { seriesId: 'hwwi_gb_ironsteel_2021_eur', family: 'steel', label: { pl: 'HWWI Iron Ore & Steel Scrap Index', en: 'HWWI Iron Ore & Steel Scrap Index' } },
  { seriesId: 'lmescusd20270226', family: 'steel', label: { pl: 'LME Steel Scrap — luty 2027', en: 'LME Steel Scrap — February 2027' } },
] as const

const PORR_DEMO_FORECAST_SERIES_IDS = new Set(
  PORR_DEMO_FORECAST_BENCHMARKS.map((benchmark) => benchmark.seriesId.toLowerCase()),
)

export function isPorrDemoForecastBenchmark(seriesId: string) {
  return PORR_DEMO_FORECAST_SERIES_IDS.has(seriesId.trim().toLowerCase())
}
