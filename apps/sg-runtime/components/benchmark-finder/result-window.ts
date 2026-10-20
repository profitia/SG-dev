export const RESULT_PREVIEW_LIMIT = 5
export const RESULT_BATCH_SIZE = 5
export const SEARCH_RESULTS_FETCH_LIMIT = 25

/** Presentation only: retain provider order and the existing bounded candidate set. */
export function nextVisibleResultCount(current: number, total: number) {
  return Math.min(current + RESULT_BATCH_SIZE, total)
}
