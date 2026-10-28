/** Same readiness and integer allocation policy as Category Builder and its server projection. */
export function categoryDraftStatus(components: readonly { weightPercent: number }[]) {
  return components.length >= 2 && components.length <= 12
    && components.every(c => Number.isInteger(c.weightPercent) && c.weightPercent >= 0 && c.weightPercent <= 100)
    && components.reduce((total,c) => total + c.weightPercent, 0) === 100 ? 'READY' : 'DRAFT'
}
