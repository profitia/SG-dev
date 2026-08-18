export type DashboardVariantId = 'historical-v1' | 'finder-embedded-v2' | 'forecast-portfolio-v3'
export type DashboardVariantLifecycle = 'legacy' | 'active' | 'planned'
export type DashboardVariantRuntimeStatus = 'runnable' | 'provenance-only' | 'planned'
export type DashboardVariantHost = 'standalone' | 'embedded'
export type DashboardVariantHostAvailability = 'runnable' | 'provenance-only' | 'planned'
export type DashboardVariantResolutionReason = 'default' | 'requested' | 'unknown-fallback'

export type DashboardVariantRegistration = {
  id: DashboardVariantId
  label: string
  summary: string
  lifecycle: DashboardVariantLifecycle
  runtimeStatus: DashboardVariantRuntimeStatus
  materialized: boolean
  hostAvailability: Record<DashboardVariantHost, DashboardVariantHostAvailability>
  showInStandaloneSwitcher: boolean
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
    label: 'Historical v1',
    summary: 'Recovered legacy dashboard-first historical and forecast-accuracy experience.',
    lifecycle: 'legacy',
    runtimeStatus: 'provenance-only',
    materialized: false,
    hostAvailability: {
      standalone: 'provenance-only',
      embedded: 'provenance-only',
    },
    showInStandaloneSwitcher: false,
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
    showInStandaloneSwitcher: true,
  },
  {
    id: 'forecast-portfolio-v3',
    label: 'Forecast Portfolio v3',
    summary: 'Reserved registry slot for the future Forecast Core UX without runtime implementation yet.',
    lifecycle: 'planned',
    runtimeStatus: 'planned',
    materialized: false,
    hostAvailability: {
      standalone: 'planned',
      embedded: 'planned',
    },
    showInStandaloneSwitcher: false,
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
    (variant) => variant.showInStandaloneSwitcher
      && variant.runtimeStatus === 'runnable'
      && variant.hostAvailability.standalone === 'runnable',
  )
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