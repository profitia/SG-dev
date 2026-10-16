import { assertSg2DatabaseIdentity, assertSg2Environment, assertSg2ProducerIdentity, assertSg2ServiceUrl, assertSg2WorkerIdentity } from '../../../packages/governance/src/sg2-environment-identity.mjs'
export { assertSg2Environment, assertSg2ProducerIdentity, assertSg2WorkerIdentity }
export function assertRuntimeDatabaseIdentity(connectionString: string | undefined, purpose: 'market' | 'application') {
  return assertSg2DatabaseIdentity({ appEnv: process.env.APP_ENV, connectionString, purpose })
}
export function resolveDashboardServiceUrl() {
  return assertSg2ServiceUrl({ appEnv: process.env.APP_ENV, component: 'dashboard', value: process.env.DASHBOARD_PREVIEW_BASE_URL, nodeEnv: process.env.NODE_ENV })
}
