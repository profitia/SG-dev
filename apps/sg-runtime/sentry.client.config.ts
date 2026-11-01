import * as Sentry from '@sentry/nextjs'
import { observabilityOptions } from './lib/observability/config'
import { sanitizeError, sanitizeSpan, sanitizeTransaction } from './lib/observability/sanitize'

const options = observabilityOptions({
  enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED,
  scope: process.env.NEXT_PUBLIC_SENTRY_SCOPE,
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  projectId: process.env.NEXT_PUBLIC_SENTRY_PROJECT_ID,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  service: process.env.NEXT_PUBLIC_SENTRY_SERVICE,
  tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  productionApproved: process.env.NEXT_PUBLIC_SENTRY_PRODUCTION_APPROVED,
})

if (options.enabled) Sentry.init({ ...options,
  tracePropagationTargets: [new RegExp('^' + window.location.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:/|$)'), /^\/(?!\/)/],
  beforeSend: sanitizeError, beforeSendTransaction: sanitizeTransaction, beforeSendSpan: sanitizeSpan,
  beforeBreadcrumb: () => null,
  integrations: integrations => integrations.filter(integration => !/Session|Replay|Feedback/.test(integration.name)),
  replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0,
})
