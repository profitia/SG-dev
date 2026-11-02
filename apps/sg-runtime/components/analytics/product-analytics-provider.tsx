'use client'
import React, { useEffect } from 'react'
import { productAnalytics } from '@/lib/product-analytics/adapter'
import { isAllowedAnalyticsBrowser, productAnalyticsSdkOptions, TEST_CONSENT_KEY, type ProductAnalyticsConfiguration } from '@/lib/product-analytics/config'

let initialization: Promise<void> | undefined
let activeConfiguration: ProductAnalyticsConfiguration | null = null
export function hasExplicitTestConsent(): boolean {
  try { return isAllowedAnalyticsBrowser(window.location) && window.sessionStorage.getItem(TEST_CONSENT_KEY) === 'granted' } catch { return false }
}

/** Next.js 14 client boundary. Server passes only validated public SDK config.
 * Test operator opts in for this tab before reload; no consent is assumed. */
export function ProductAnalyticsProvider({ configuration, children }: { configuration: ProductAnalyticsConfiguration | null; children: React.ReactNode }) {
  useEffect(() => {
    activeConfiguration = configuration
    if (!configuration || !hasExplicitTestConsent()) return
    const permitted = () => activeConfiguration?.token === configuration.token && activeConfiguration.host === configuration.host
      && activeConfiguration.releaseSha === configuration.releaseSha && hasExplicitTestConsent()
    initialization ??= import('posthog-js/dist/module.no-external').then(({ default: sdk }) => {
      if (!permitted()) return
      sdk.init(configuration.token, productAnalyticsSdkOptions(configuration, permitted))
      productAnalytics.connect((event,properties) => { sdk.capture(event, properties) }, permitted, configuration.releaseSha, () => sdk.reset(true))
    }).catch(() => { /* No analytics failure affects the product. */ })
  }, [configuration])
  return <>{children}</>
}
