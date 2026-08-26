export type DashboardVariantId = 'historical-v1' | 'finder-embedded-v2' | 'forecast-portfolio-v3'
export type DashboardVariantLifecycle = 'legacy' | 'active' | 'experimental' | 'planned'
export type DashboardVariantRuntimeStatus = 'runnable' | 'provenance-only' | 'planned'
export type DashboardVariantHost = 'standalone' | 'embedded'
export type DashboardVariantHostAvailability = 'runnable' | 'provenance-only' | 'planned'
export type DashboardVariantResolutionReason = 'default' | 'requested' | 'unknown-fallback'

export type DashboardVariantExperienceDescription = {
  name: string
  purpose: string
  businessContext: string
  mainComponents: string[]
  mainControls: string[]
  supportedModels: string[]
  verificationHorizons: string[]
  initialConsumer: string
  status: string
  keyDifference: string
}

export type DashboardVariantRegistration = {
  id: DashboardVariantId
  label: string
  summary: string
  lifecycle: DashboardVariantLifecycle
  runtimeStatus: DashboardVariantRuntimeStatus
  materialized: boolean
  hostAvailability: Record<DashboardVariantHost, DashboardVariantHostAvailability>
  standaloneDisplayOrder: number
  experience: DashboardVariantExperienceDescription
}

export type DashboardVariantResolution = {
  host: DashboardVariantHost
  requestedVariantId: string | null
  requestMatchedRegistry: boolean
  resolutionReason: DashboardVariantResolutionReason
  resolvedVariant: DashboardVariantRegistration
  hostAvailability: DashboardVariantHostAvailability
  isRunnable: boolean
  fallbackFromVariantId: string | null
}

export type DashboardVariantSearchParams = Record<string, string | string[] | undefined>

export const DEFAULT_DASHBOARD_VARIANT_ID: DashboardVariantId = 'finder-embedded-v2'

const DASHBOARD_VARIANTS: DashboardVariantRegistration[] = [
  {
    id: 'historical-v1',
    label: 'Dashboard Preview v1',
    summary: 'Recovered legacy dashboard-first historical and forecast-accuracy experience preserved as a runnable standalone reference.',
    lifecycle: 'legacy',
    runtimeStatus: 'runnable',
    materialized: true,
    hostAvailability: {
      standalone: 'runnable',
      embedded: 'provenance-only',
    },
    standaloneDisplayOrder: 1,
    experience: {
      name: 'Dashboard Preview v1',
      purpose: 'Recovered historical dashboard lineage reference kept runnable for side-by-side UX comparison.',
      businessContext: 'Preserves the earlier dashboard-first component workflow with legacy forecast and forecast-accuracy controls.',
      mainComponents: ['analysis workspace', 'component selector', 'benchmark selector', 'time-series chart', 'legacy forecast-accuracy overlays'],
      mainControls: ['component selector', 'benchmark selector', 'show forecast', 'show forecast accuracy', 'forecast horizon', 'chart range'],
      supportedModels: [],
      verificationHorizons: ['1M', '3M', '6M', '12M'],
      initialConsumer: 'Standalone Dashboard Experience Library review',
      status: 'LEGACY / RUNNABLE',
      keyDifference: 'Legacy component-oriented dashboard-first experience preserved as a standalone reference instead of a benchmark-first embed surface.',
    },
  },
  {
    id: 'finder-embedded-v2',
    label: 'Finder Embedded v2',
    summary: 'Current chart-first benchmark experience with embedded host compatibility.',
    lifecycle: 'active',
    runtimeStatus: 'runnable',
    materialized: true,
    hostAvailability: {
      standalone: 'runnable',
      embedded: 'runnable',
    },
    standaloneDisplayOrder: 2,
    experience: {
      name: 'Finder Embedded',
      purpose: 'Fast historical benchmark review with stable embed compatibility.',
      businessContext: 'Supports chart-first benchmark inspection in standalone preview and embedded Finder host flows.',
      mainComponents: ['benchmark header', 'time-series chart', 'chart range controls', 'loading and error states'],
      mainControls: ['chart range'],
      supportedModels: [],
      verificationHorizons: [],
      initialConsumer: 'Standalone preview and embedded Finder host',
      status: 'ACTIVE / RUNNABLE',
      keyDifference: 'Historical Actual only baseline with no current forecast or forecast verification layers.',
    },
  },
  {
    id: 'forecast-portfolio-v3',
    label: 'Forecast Portfolio v3',
    summary: 'First standalone forecast dashboard combining Historical Actual, Historical Forecast Verification, Delta, and Current Forecast on one time axis.',
    lifecycle: 'experimental',
    runtimeStatus: 'runnable',
    materialized: true,
    hostAvailability: {
      standalone: 'runnable',
      embedded: 'planned',
    },
    standaloneDisplayOrder: 3,
    experience: {
      name: 'Forecast Portfolio',
      purpose: 'First dashboard that combines Historical Actual, Historical Forecast Verification, and Current Forecast on one shared timeline.',
      businessContext: 'Supports benchmark review for historical price context, forward price direction, and historical forecast verifiability for the selected model.',
      mainComponents: [
        'benchmark header',
        'time-series chart',
        'chart range controls',
        'forecast toggle',
        'verification toggle',
        'model selector',
        'target basis selector',
        'verification horizon selector',
        'legend',
        'loading and error states',
      ],
      mainControls: ['chart range', 'show forecast', 'model selector', 'target basis selector', 'show forecast verification', 'verification horizon'],
      supportedModels: ['Naive', 'Damped Holt', 'ETS', 'ARIMA'],
      verificationHorizons: ['1M', '3M', '6M', '12M'],
      initialConsumer: 'Standalone Dashboard Preview only',
      status: 'EXPERIMENTAL / RUNNABLE',
      keyDifference: 'Unlike finder-embedded-v2, it layers Historical Actual with Current Forecast and Historical Forecast Verification while making Target Basis a first-class user-facing selector.',
    },
  },
]

export const DASHBOARD_VARIANT_REGISTRY = Object.freeze(
  DASHBOARD_VARIANTS.reduce<Record<DashboardVariantId, DashboardVariantRegistration>>((registry, variant) => {
    registry[variant.id] = variant
    return registry
  }, {} as Record<DashboardVariantId, DashboardVariantRegistration>),
)

export function isDashboardVariantId(value: string): value is DashboardVariantId {
  return value in DASHBOARD_VARIANT_REGISTRY
}

export function getDashboardVariantRegistrations() {
  return DASHBOARD_VARIANTS
}

export function getStandaloneSwitcherVariants() {
  return DASHBOARD_VARIANTS.filter(
    (variant) => variant.runtimeStatus === 'runnable'
      && variant.hostAvailability.standalone === 'runnable',
  ).sort((left, right) => left.standaloneDisplayOrder - right.standaloneDisplayOrder)
}

export function readFirstSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export function buildDashboardVariantHref({
  locale,
  searchParams = {},
  variantId,
}: {
  locale: string
  searchParams?: DashboardVariantSearchParams
  variantId: DashboardVariantId
}) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'variantId') {
      continue
    }

    if (typeof value === 'string') {
      params.set(key, value)
      continue
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry)
      }
    }
  }

  if (variantId !== DEFAULT_DASHBOARD_VARIANT_ID) {
    params.set('variantId', variantId)
  }

  const query = params.toString()

  return query.length > 0 ? `/${locale}?${query}` : `/${locale}`
}

type ResolveDashboardVariantOptions = {
  requestedVariantId?: string | null
  embedded?: boolean
}

export function resolveDashboardVariant({
  requestedVariantId,
  embedded = false,
}: ResolveDashboardVariantOptions): DashboardVariantResolution {
  const trimmedVariantId = requestedVariantId?.trim() ?? ''
  const normalizedRequestedVariantId = trimmedVariantId.length > 0 ? trimmedVariantId : null
  const host: DashboardVariantHost = embedded ? 'embedded' : 'standalone'

  if (!normalizedRequestedVariantId) {
    const resolvedVariant = DASHBOARD_VARIANT_REGISTRY[DEFAULT_DASHBOARD_VARIANT_ID]
    const hostAvailability = resolvedVariant.hostAvailability[host]

    return {
      host,
      requestedVariantId: null,
      requestMatchedRegistry: true,
      resolutionReason: 'default',
      resolvedVariant,
      hostAvailability,
      isRunnable: resolvedVariant.runtimeStatus === 'runnable' && hostAvailability === 'runnable',
      fallbackFromVariantId: null,
    }
  }

  if (isDashboardVariantId(normalizedRequestedVariantId)) {
    const resolvedVariant = DASHBOARD_VARIANT_REGISTRY[normalizedRequestedVariantId]
    const hostAvailability = resolvedVariant.hostAvailability[host]

    return {
      host,
      requestedVariantId: normalizedRequestedVariantId,
      requestMatchedRegistry: true,
      resolutionReason: 'requested',
      resolvedVariant,
      hostAvailability,
      isRunnable: resolvedVariant.runtimeStatus === 'runnable' && hostAvailability === 'runnable',
      fallbackFromVariantId: null,
    }
  }

  const resolvedVariant = DASHBOARD_VARIANT_REGISTRY[DEFAULT_DASHBOARD_VARIANT_ID]
  const hostAvailability = resolvedVariant.hostAvailability[host]

  return {
    host,
    requestedVariantId: normalizedRequestedVariantId,
    requestMatchedRegistry: false,
    resolutionReason: 'unknown-fallback',
    resolvedVariant,
    hostAvailability,
    isRunnable: resolvedVariant.runtimeStatus === 'runnable' && hostAvailability === 'runnable',
    fallbackFromVariantId: normalizedRequestedVariantId,
  }
}