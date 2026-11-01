import * as Sentry from '@sentry/nextjs'
import { observabilityOptions } from './lib/observability/config'
import { sanitizeError, sanitizeSpan, sanitizeTransaction } from './lib/observability/sanitize'

const options = observabilityOptions({
  enabled: process.env.SENTRY_ENABLED, scope: process.env.SENTRY_SCOPE,
  dsn: process.env.SENTRY_DSN, projectId: process.env.SENTRY_PROJECT_ID,
  environment: process.env.APP_ENV, release: process.env.SENTRY_RELEASE ?? process.env.RENDER_GIT_COMMIT,
  service: process.env.RENDER_SERVICE_NAME, tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE,
  productionApproved: process.env.SENTRY_PRODUCTION_APPROVED,
})

if (options.enabled) Sentry.init({ ...options,
  beforeSend: sanitizeError, beforeSendTransaction: sanitizeTransaction, beforeSendSpan: sanitizeSpan,
  beforeBreadcrumb: () => null,
})
