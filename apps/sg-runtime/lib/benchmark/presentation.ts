const TECHNICAL_IDENTIFIER_PREFIX = /^(src|rel|alt)_[a-z0-9_./-]+$/i
const TECHNICAL_IDENTIFIER_COMPACT = /^[a-z0-9]{8,}$/
const TECHNICAL_IDENTIFIER_DELIMITED = /^[a-z0-9_./-]{12,}$/

function getMetadataString(metadata: unknown, keys: string[]) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }

  for (const key of keys) {
    const value = (metadata as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return null
}

export function isSuppressedProviderIdentity(value: string | null | undefined) {
  if (!value) {
    return false
  }

  return value.toLowerCase().includes('macrobond')
}

export function isTechnicalIdentifier(value: string | null | undefined) {
  if (!value) {
    return false
  }

  const normalized = value.trim()
  if (!normalized) {
    return false
  }

  if (TECHNICAL_IDENTIFIER_PREFIX.test(normalized)) {
    return true
  }

  if (normalized === normalized.toLowerCase() && TECHNICAL_IDENTIFIER_COMPACT.test(normalized)) {
    return /\d/.test(normalized) || normalized.length >= 12
  }

  return normalized === normalized.toLowerCase()
    && TECHNICAL_IDENTIFIER_DELIMITED.test(normalized)
    && /[_./-]/.test(normalized)
}

export function sanitizeUserFacingPublisher(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  if (!normalized || isSuppressedProviderIdentity(normalized) || isTechnicalIdentifier(normalized)) {
    return null
  }

  return normalized
}

export function sanitizeUserFacingResolvedLabel(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  if (!normalized || isSuppressedProviderIdentity(normalized) || isTechnicalIdentifier(normalized)) {
    return null
  }

  return normalized
}

export function formatDisplayMeasurement(currency: string | null | undefined, unit: string | null | undefined) {
  const normalizedCurrency = currency?.trim() || null
  const normalizedUnit = unit?.trim() || null
  const displayCurrency = normalizedCurrency ? normalizedCurrency.toUpperCase() : null

  if (displayCurrency && normalizedUnit) {
    const uppercaseUnit = normalizedUnit.toUpperCase()

    if (uppercaseUnit === displayCurrency) {
      return displayCurrency
    }

    if (uppercaseUnit.startsWith(`${displayCurrency}/`) || uppercaseUnit.startsWith(`${displayCurrency} `)) {
      return `${displayCurrency}${normalizedUnit.slice(displayCurrency.length)}`
    }

    return `${displayCurrency} ${normalizedUnit}`
  }

  if (normalizedUnit) {
    const prefixedCurrencyMatch = normalizedUnit.match(/^([a-z]{3})(?=(?:\/|\s|$))(.*)$/i)
    if (prefixedCurrencyMatch) {
      return `${prefixedCurrencyMatch[1].toUpperCase()}${prefixedCurrencyMatch[2]}`
    }
  }

  return normalizedUnit ?? displayCurrency ?? null
}

export function resolveSavedBenchmarkDisplayName(params: {
  displayName: string | null | undefined
  description: string | null | undefined
  title: string | null | undefined
  sourceLabel: string | null | undefined
  metadata: unknown
}) {
  const directCandidates = [
    params.displayName,
    params.description,
    params.title,
    getMetadataString(params.metadata, ['Title', 'PrimName', 'Name']),
    getMetadataString(params.metadata, ['Description', 'FullDescription']),
  ]

  for (const candidate of directCandidates) {
    const sanitized = sanitizeUserFacingResolvedLabel(candidate)
    if (sanitized) {
      return sanitized
    }
  }

  const publisher = sanitizeUserFacingPublisher(params.sourceLabel)
  if (publisher) {
    return `${publisher} benchmark`
  }

  return 'Benchmark'
}