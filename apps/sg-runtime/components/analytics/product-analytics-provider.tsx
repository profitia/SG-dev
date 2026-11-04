'use client'
import React, { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { productAnalytics } from '@/lib/product-analytics/adapter'
import {isFinderContext} from '@/lib/product-analytics/surfaces'
import {startApplicationMonitoring} from '@/lib/product-analytics/monitoring'
import { isAllowedAnalyticsBrowser, isProductAnalyticsPathEnabled, productAnalyticsSdkOptions, TEST_CONSENT_KEY, type ProductAnalyticsConfiguration } from '@/lib/product-analytics/config'

let initialization: Promise<void> | undefined
let activeConfiguration: ProductAnalyticsConfiguration | null = null
export function hasExplicitTestConsent(): boolean {
  try { return isAllowedAnalyticsBrowser(window.location) && isProductAnalyticsPathEnabled(window.location.pathname)
    && !isFinderContext(window.document) && window.sessionStorage.getItem(TEST_CONSENT_KEY) === 'granted' } catch { return false }
}

/** Next.js 14 client boundary. Server passes only validated public SDK config.
 * Test operator opts in for this tab before reload; no consent is assumed. */
export function ProductAnalyticsProvider({ configuration, children }: { configuration: ProductAnalyticsConfiguration | null; children: React.ReactNode }) {
  const pathname = usePathname()
  useEffect(() => {
    if (!configuration) return
    try {return startApplicationMonitoring(window,()=>activeConfiguration===configuration && hasExplicitTestConsent(),productAnalytics)} catch { /* Optional monitoring never blocks the application. */ }
  },[configuration])
  useEffect(() => {
    activeConfiguration = configuration
    if (!configuration || !hasExplicitTestConsent()) return
    const permitted = () => activeConfiguration?.token === configuration.token && activeConfiguration.host === configuration.host
      && activeConfiguration.releaseSha === configuration.releaseSha && hasExplicitTestConsent()
    initialization ??= import('posthog-js/dist/module.no-external').then(({ default: sdk }) => {
      if (!permitted()) { initialization = undefined; return }
      sdk.init(configuration.token, productAnalyticsSdkOptions(configuration, permitted))
      productAnalytics.connect((event,properties) => { sdk.capture(event, properties) }, permitted, configuration.releaseSha, () => sdk.reset(true))
    }).catch(() => { initialization = undefined /* No analytics failure affects the product. */ })
  }, [configuration, pathname])
  return <>{children}</>
}
