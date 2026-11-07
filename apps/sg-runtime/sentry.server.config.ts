import * as Sentry from '@sentry/nextjs'
import { observabilityOptions } from './lib/observability/config'
import { sanitizeError, sanitizeSpan, sanitizeTransaction } from './lib/observability/sanitize'
import { installTechnicalPhaseObserver } from './lib/observability/server'

const options = observabilityOptions({
  enabled: process.env.SENTRY_ENABLED, scope: process.env.SENTRY_SCOPE,
  dsn: process.env.SENTRY_DSN, projectId: process.env.SENTRY_PROJECT_ID,
  environment: process.env.APP_ENV, release: process.env.SENTRY_RELEASE ?? process.env.RENDER_GIT_COMMIT,
  service: process.env.RENDER_SERVICE_NAME, tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE,
  productionApproved: process.env.SENTRY_PRODUCTION_APPROVED,
})

if (options.enabled) {
  Sentry.init({ ...options,
    beforeSend: sanitizeError, beforeSendTransaction: sanitizeTransaction, beforeSendSpan: sanitizeSpan,
    beforeBreadcrumb: () => null,
    integrations: integrations => integrations.filter(integration => !/Session|LocalVariables/.test(integration.name)),
  })
  installTechnicalPhaseObserver()
  // A deployment can request one bounded diagnostic signal without running any
  // business process. Production never emits synthetic diagnostics.
  if (options.environment !== 'production' && /^[0-9a-f-]{36}$/i.test(process.env.SENTRY_DIAGNOSTIC_ID ?? '')) {
    Sentry.withScope(scope => {
      scope.setTag('diagnostic_id', process.env.SENTRY_DIAGNOSTIC_ID!)
      scope.setTag('operation', 'diagnostic')
      Sentry.captureMessage('SG Runtime technical diagnostic', 'info')
    })
  }
}
