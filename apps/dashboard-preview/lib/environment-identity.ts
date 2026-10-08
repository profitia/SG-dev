import { assertSg2DatabaseIdentity, assertSg2Environment, assertSg2ServiceUrl } from '../../../packages/governance/src/sg2-environment-identity.mjs'
export { assertSg2Environment }
export function assertDashboardDatabaseIdentity(connectionString: string | undefined, purpose: 'market' | 'dashboard') {
  return assertSg2DatabaseIdentity({ appEnv: process.env.APP_ENV, connectionString, purpose })
}
export function resolveRuntimeServiceUrl() {
  return assertSg2ServiceUrl({ appEnv: process.env.APP_ENV, component: 'runtime', value: process.env.SG_RUNTIME_BASE_URL, nodeEnv: process.env.NODE_ENV })
}
