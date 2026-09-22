export const PREFERRED_HISTORICAL_VERIFICATION_ORIGIN_START_DATE = '2024-01-01'
export const MINIMUM_ADAPTIVE_HISTORICAL_VERIFICATION_ORIGINS = 24
// Eight comparisons are the existing moderate-confidence boundary. Non-daily
// results can therefore become useful before the 24-origin FULL target completes.
export const MINIMUM_NON_DAILY_FAST_HISTORICAL_VERIFICATION_ORIGINS = 8
export const ADAPTIVE_HISTORICAL_VERIFICATION_ORIGIN_POLICY_VERSION =
  'ADAPTIVE_PREFERRED_2024_MINIMUM_24@historical-verification-origin-policy-v1'

export const FAST_HISTORICAL_VERIFICATION_POLICY_VERSION =
  'PPF1_FAST_VERIFICATION_PER_HORIZON_AVAILABLE_HISTORY_V4'
