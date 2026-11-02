/** Read raw configuration: serverEnv's Development fallback must never enable analytics. */
import type { PostHogConfig } from 'posthog-js/dist/module.no-external'
import { filterSdkEvent } from './contract'
export type ProductAnalyticsConfiguration = { token: string; host: string; releaseSha?: string }
export const DEVELOPMENT_SERVICE = 'srv-dapa3tid0e5s73f8bc5g'
export const DEVELOPMENT_HOSTS = ['sg2-development-runtime.onrender.com', 'dev-sg2.spendguru.app'] as const
export const TEST_CONSENT_KEY = 'sg2.product-analytics.explicit-test.v1'

export function readProductAnalyticsConfiguration(env: Record<string, string | undefined>): ProductAnalyticsConfiguration | null {
  if (env.SG2_PRODUCT_ANALYTICS_ENABLED !== 'true' || env.APP_ENV !== 'development'
    || env.RENDER_SERVICE_ID !== DEVELOPMENT_SERVICE || env.SG2_PRODUCT_ANALYTICS_CONSENT_MODE !== 'explicit_test'
    || env.POSTHOG_PROJECT_ID !== '329829' || env.POSTHOG_HOST !== 'https://eu.i.posthog.com'
    || !/^phc_[A-Za-z0-9]{30,100}$/.test(env.POSTHOG_PROJECT_TOKEN ?? '')) return null
  return { token: env.POSTHOG_PROJECT_TOKEN!, host: env.POSTHOG_HOST,
    ...(/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT ?? '') ? { releaseSha: env.RENDER_GIT_COMMIT } : {}) }
}

export function isAllowedAnalyticsBrowser(location: { hostname: string; protocol: string }): boolean {
  return location.protocol === 'https:' && DEVELOPMENT_HOSTS.some(host => host === location.hostname)
}

export function productAnalyticsSdkOptions(configuration: ProductAnalyticsConfiguration, permitted: () => boolean): Partial<PostHogConfig> {
  return {
    api_host: configuration.host, persistence: 'memory', disable_persistence: true, person_profiles: 'never',
    autocapture: false, capture_pageview: false, capture_pageleave: false, capture_dead_clicks: false,
    capture_performance: false, capture_heatmaps: false, capture_exceptions: false,
    disable_session_recording: true, enable_recording_console_log: false, disable_external_dependency_loading: true,
    advanced_disable_flags: true, advanced_disable_feature_flags: true, advanced_disable_feature_flags_on_first_load: true,
    disable_surveys: true, disable_conversations: true, disable_product_tours: true, disable_web_experiments: true,
    opt_in_site_apps: false, save_campaign_params: false, save_referrer: false, ip: false,
    request_batching: false, debug: false,
    before_send: data => filterSdkEvent(data, permitted(), configuration.token),
  }
}
