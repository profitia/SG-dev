import type { CciAlignmentResult, CciPreparationMethod } from './market-data-contracts'

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/** Freeze only objects owned by this integration, never the caller's request. */
export function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

export function preparationDefinition(alignment: CciAlignmentResult, mappingVersion: 'CCI_MONTHLY_MAPPING_V1' | 'CCI_NODE_MAPPING_V1' = 'CCI_MONTHLY_MAPPING_V1') {
  return {
    mappingVersion,
    ...(mappingVersion === 'CCI_NODE_MAPPING_V1' ? { analysisCadence: alignment.analysisCadence } : {}),
    alignmentVersion: alignment.methodologyVersion,
    calendar: 'UTC_CALENDAR' as const,
    nodeBasis: alignment.nodeBasis,
    currencyPolicy: 'NATIVE_CURRENCY_RELATIVES' as const,
    missingDataPolicy: 'NULL_WITHOUT_FILL_OR_REWEIGHT' as const,
    components: [...alignment.series].sort((a, b) => compare(a.componentId, b.componentId)).map(series => {
      const methods = new Map<string, CciPreparationMethod>()
      for (const node of alignment.nodes) {
        const component = node.components.find(value => value.componentId === series.componentId)
        if (component?.method) {
          const { id, version, approvalRef } = component.method
          const method = { id, version, approvalRef }
          methods.set(JSON.stringify(method), method)
        }
      }
      const { valueKind, periodBasis, calendar, evidenceRef } = series.qualification
      const policy = series.preparationPolicy
      return {
        componentId: series.componentId,
        provider: series.provider,
        seriesId: series.seriesId,
        nativeCadence: series.nativeCadence,
        excludedZeroWeight: series.weightPercent === 0,
        qualification: { valueKind, periodBasis, calendar, evidenceRef },
        reductionPolicy: policy.method === 'NATIVE_ONLY' ? { method: policy.method } : { method: policy.method, approvalRef: policy.approvalRef },
        // Include every actual method/version/approval, including those used before base.
        methods: [...methods.entries()].sort(([a], [b]) => compare(a, b)).map(([, method]) => method),
      }
    }),
  }
}

export interface CciPreparationMethodology {
  readonly id: string
  readonly scope: 'PREPARATION_METHODOLOGY_NOT_IMMUTABLE_SNAPSHOT'
  readonly definition: ReturnType<typeof preparationDefinition>
}
