import { alignCciMarketData } from './node-alignment'
import type { CciAlignmentResult, CciMarketDataRequest } from './market-data-contracts'

export type CciCorePreparation = CciAlignmentResult & {
  /** Preparation readiness is deliberately separate from execution of the monthly Core. */
  readonly coreCompatibility: 'MONTHLY_PREPARATION_READY' | 'CORE_CADENCE_NOT_SUPPORTED' | 'BLOCKED'
}

/**
 * Accept the existing market-history contract through parameters. Importing the
 * market-data service would also expose hydration/provider writes; this boundary
 * deliberately performs no source retrieval or authorization of private models.
 * Non-monthly data never become a fabricated monthly CciInput.
 */
export function prepareCciMarketData(input: CciMarketDataRequest): CciCorePreparation {
  const alignment = alignCciMarketData(input)
  return { ...alignment, coreCompatibility: alignment.status === 'COMPLETE' || alignment.status === 'INCOMPLETE'
    ? alignment.analysisCadence === 'MONTHLY' ? 'MONTHLY_PREPARATION_READY' : 'CORE_CADENCE_NOT_SUPPORTED'
    : 'BLOCKED' }
}
