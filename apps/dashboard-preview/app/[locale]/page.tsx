import { getTranslations } from 'next-intl/server'

import { DashboardShell } from '@/components/dashboard-shell'
import { DashboardVariantState } from '@/components/dashboard-variant-state'
import { RawDataView } from '@/components/raw-data-view'
import {
  DEFAULT_DASHBOARD_VARIANT_ID,
  buildDashboardVariantHref,
  getStandaloneSwitcherVariants,
  readFirstSearchParamValue,
  resolveDashboardVariant,
  type DashboardVariantId,
} from '@/lib/dashboard-variants/registry'

const FORECAST_PORTFOLIO_DEFAULT_BENCHMARK = {
  seriesId: 'wocaes0074',
  displayName: 'Brent, Spot, FOB North Sea',
} as const

type LocaleHomePageProps = {
  params: {
    locale: string
  }
  searchParams?: Record<string, string | string[] | undefined>
}

export default async function LocaleHomePage({
  params: { locale },
  searchParams = {},
}: LocaleHomePageProps) {
  const t = await getTranslations({ locale, namespace: 'DashboardVariants' })
  const embedded = readFirstSearchParamValue(searchParams.embed) === '1'
  const requestedVariantId = readFirstSearchParamValue(searchParams.variantId) ?? null
  const resolution = resolveDashboardVariant({ requestedVariantId, embedded })

  const variantLabel = (variantId: DashboardVariantId) => {
    switch (variantId) {
      case 'historical-v1':
        return t('variantLabels.historicalV1')
      case 'finder-embedded-v2':
        return t('variantLabels.finderEmbeddedV2')
      case 'forecast-portfolio-v3':
        return t('variantLabels.forecastPortfolioV3')
    }
  }

  const variantSummary = (variantId: DashboardVariantId) => {
    switch (variantId) {
      case 'historical-v1':
        return t('variantSummaries.historicalV1')
      case 'finder-embedded-v2':
        return t('variantSummaries.finderEmbeddedV2')
      case 'forecast-portfolio-v3':
        return t('variantSummaries.forecastPortfolioV3')
    }
  }

  const unavailableMessage = (variantId: DashboardVariantId) => {
    switch (variantId) {
      case 'historical-v1':
        return t('unavailable.historicalV1Message')
      case 'forecast-portfolio-v3':
        return t('unavailable.forecastPortfolioV3Message')
      case 'finder-embedded-v2':
        return t('variantSummaries.finderEmbeddedV2')
    }
  }

  const activeBaselineHref = buildDashboardVariantHref({
    locale,
    searchParams,
    variantId: DEFAULT_DASHBOARD_VARIANT_ID,
  })

  const variantSwitcherHref = (variantId: DashboardVariantId) => {
    if (variantId === 'historical-v1') {
      const nextSearchParams = { ...searchParams }

      delete nextSearchParams.seriesId
      delete nextSearchParams.displayName
      delete nextSearchParams.range

      return buildDashboardVariantHref({ locale, searchParams: nextSearchParams, variantId })
    }

    if (variantId !== 'forecast-portfolio-v3') {
      return buildDashboardVariantHref({ locale, searchParams, variantId })
    }

    const nextSearchParams = { ...searchParams }

    if (!readFirstSearchParamValue(nextSearchParams.seriesId)) {
      nextSearchParams.seriesId = FORECAST_PORTFOLIO_DEFAULT_BENCHMARK.seriesId
    }

    if (!readFirstSearchParamValue(nextSearchParams.displayName)) {
      nextSearchParams.displayName = FORECAST_PORTFOLIO_DEFAULT_BENCHMARK.displayName
    }

    return buildDashboardVariantHref({ locale, searchParams: nextSearchParams, variantId })
  }

  const variantLibrary = embedded
    ? null
    : {
        kicker: t('kicker'),
        title: t('libraryTitle'),
        currentVariantLabel: t('currentVariantLabel'),
        currentVariantValue: variantLabel(resolution.resolvedVariant.id),
        currentVariantSummary: variantSummary(resolution.resolvedVariant.id),
        lifecycleLabel: t('lifecycleLabel'),
        lifecycleValue: t(`lifecycle.${resolution.resolvedVariant.lifecycle}`),
        runtimeLabel: t('runtimeLabel'),
        runtimeValue: t(`availability.${resolution.hostAvailability}`),
        switcherLabel: t('switcherLabel'),
        switcherHint: t('switcherHint'),
        switcherItems: getStandaloneSwitcherVariants().map((variant) => ({
          id: variant.id,
          label: variantLabel(variant.id),
          href: variantSwitcherHref(variant.id),
          active: variant.id === resolution.resolvedVariant.id,
        })),
      }

  const notice = resolution.resolutionReason === 'unknown-fallback' && resolution.requestedVariantId
    ? {
        title: t('notices.unknownFallbackTitle'),
        message: t('notices.unknownFallbackMessage', {
          variantId: resolution.requestedVariantId,
          fallbackLabel: variantLabel(DEFAULT_DASHBOARD_VARIANT_ID),
        }),
      }
    : null

  return (
    <DashboardShell embedded={embedded} notice={notice} variantLibrary={variantLibrary}>
      {resolution.isRunnable ? (
        <RawDataView
          embedded={embedded}
          variant={resolution.resolvedVariant.id}
          forcedBenchmarkSubject={resolution.resolvedVariant.id === 'forecast-portfolio-v3' ? FORECAST_PORTFOLIO_DEFAULT_BENCHMARK : null}
        />
      ) : (
        <DashboardVariantState
          embedded={embedded}
          title={t('unavailable.title', { variantLabel: variantLabel(resolution.resolvedVariant.id) })}
          body={unavailableMessage(resolution.resolvedVariant.id)}
          metaItems={[
            t('unavailable.runtimeStatus', { status: t(`availability.${resolution.hostAvailability}`) }),
            t('unavailable.lifecycleStatus', { status: t(`lifecycle.${resolution.resolvedVariant.lifecycle}`) }),
          ]}
          actionHref={activeBaselineHref}
          actionLabel={t('unavailable.openActiveBaseline')}
        />
      )}
    </DashboardShell>
  )
}
