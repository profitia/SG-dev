// SG2-only identity contract. Provider observations are recorded in the SG2 topology.
// No configuration switch disables these checks. Production remains RESERVED.
export const SG2_DATABASE_IDENTITIES = Object.freeze({
  development: Object.freeze({ projectId: 'autumn-waterfall-65938876', branchId: 'br-dry-hall-b294222f', endpointId: 'ep-muddy-pine-b22pdyqd', databaseName: 'neondb', role: 'neondb_owner' }),
  staging: Object.freeze({ projectId: 'autumn-waterfall-65938876', branchId: 'br-wandering-dew-b2izo8fg', endpointId: 'ep-cool-lab-b2wm8biu', databaseName: 'neondb', role: 'neondb_owner' }),
  production: Object.freeze({ projectId: 'autumn-waterfall-65938876', branchId: 'br-purple-shape-b2az1npx', endpointId: 'ep-cool-paper-b22wpbd9', databaseName: 'neondb', role: 'neondb_owner' }),
})
const workerIds = Object.freeze({
  development: Object.freeze({ CURRENT_ONLY: 'srv-dapa3vlg1s2s739vp7dg', VERIFICATION_ONLY: 'srv-dapa40ad0e5s73f8bjm0' }),
  staging: Object.freeze({ CURRENT_ONLY: 'srv-daoksvuk1f9s73cg4bk0', VERIFICATION_ONLY: 'srv-dansibrtqb8s73d0nn3g' }),
})
const serviceHosts = Object.freeze({
  development: Object.freeze({ runtime: ['sg2-development-runtime.onrender.com', 'dev-sg2.spendguru.app'], dashboard: ['sg2-development-dashboard.onrender.com', 'analytics-dev-sg2.spendguru.app'] }),
  staging: Object.freeze({ runtime: ['spendguru-porr-demo.onrender.com', 'demo-sg-porr.spendguru.app'], dashboard: ['spendguru-porr-dashboard.onrender.com', 'analytics-demo-sg-porr.spendguru.app'] }),
})
export function assertSg2Environment(value) {
  if (!['development', 'staging', 'production'].includes(value)) throw new Error('SG2_APP_ENV_REQUIRED: explicit development/staging/production identity required.')
  if (value === 'production') throw new Error('SG2_PRODUCTION_RESERVED: activation requires separate authorization.')
  return value
}
export function inspectSg2DatabaseIdentity(connectionString) {
  let url
  try { url = new URL(connectionString) } catch { throw new Error('SG2_DATABASE_URL_INVALID: database identity is missing or malformed.') }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || (url.port && url.port !== '5432')) throw new Error('SG2_DATABASE_TRANSPORT_INVALID')
  if (['host', 'hostaddr', 'port', 'dbname', 'user', 'options', 'service'].some(key => url.searchParams.has(key))) throw new Error('SG2_DATABASE_ROUTING_OVERRIDE_FORBIDDEN')
  const environment = Object.keys(SG2_DATABASE_IDENTITIES).find(key => {
    const endpoint = SG2_DATABASE_IDENTITIES[key].endpointId
    return [`${endpoint}.c-6.eu-central-1.aws.neon.tech`, `${endpoint}-pooler.c-6.eu-central-1.aws.neon.tech`].includes(url.hostname)
  })
  if (!environment) throw new Error('SG2_DATABASE_ENDPOINT_UNREGISTERED')
  let databaseName, role
  try { databaseName = decodeURIComponent(url.pathname.slice(1)); role = decodeURIComponent(url.username) } catch { throw new Error('SG2_DATABASE_IDENTITY_INVALID') }
  return { ...SG2_DATABASE_IDENTITIES[environment], databaseName, role, environment, hostname: url.hostname, schema: url.searchParams.get('schema'), pooled: url.hostname.includes('-pooler.') }
}
export function assertSg2DatabaseIdentity({ appEnv, connectionString, purpose = 'market', declaredIdentity }) {
  const environment = assertSg2Environment(appEnv)
  const actual = inspectSg2DatabaseIdentity(connectionString)
  const expected = SG2_DATABASE_IDENTITIES[environment]
  for (const key of ['projectId', 'branchId', 'databaseName', 'role']) {
    if (actual[key] !== expected[key] || (declaredIdentity && declaredIdentity[key] !== expected[key])) throw new Error(`SG2_DATABASE_${key.toUpperCase()}_MISMATCH`)
  }
  if (actual.environment !== environment) throw new Error('SG2_DATABASE_ENVIRONMENT_MISMATCH')
  const expectedSchema = purpose === 'application' ? 'sg_runtime_benchmarks' : 'public'
  if (actual.schema && actual.schema !== expectedSchema) throw new Error('SG2_DATABASE_SCHEMA_MISMATCH')
  return actual
}
export function assertSg2ServiceUrl({ appEnv, component, value, nodeEnv }) {
  const environment = assertSg2Environment(appEnv)
  let url
  try { url = new URL(value) } catch { throw new Error('SG2_SERVICE_BINDING_REQUIRED') }
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('SG2_SERVICE_BINDING_INVALID')
  const explicitLocal = environment === 'development' && nodeEnv !== 'production' && url.protocol === 'http:' && url.hostname === 'localhost' && url.port === (component === 'runtime' ? '3001' : '3002')
  if (!explicitLocal && (url.protocol !== 'https:' || url.port || !serviceHosts[environment]?.[component]?.includes(url.hostname))) throw new Error('SG2_SERVICE_ENVIRONMENT_MISMATCH')
  return value
}
export function assertSg2WorkerIdentity(env) {
  const environment = assertSg2Environment(env.APP_ENV)
  const lane = env.FORECAST_PREPARATION_WORKER_MODE
  if (!['CURRENT_ONLY', 'VERIFICATION_ONLY'].includes(lane)) throw new Error('SG2_WORKER_LANE_REQUIRED: ALL and implicit lanes are forbidden at worker entrypoints.')
  if (env.RENDER_SERVICE_ID !== workerIds[environment][lane]) throw new Error('SG2_WORKER_SERVICE_ID_MISMATCH')
  assertSg2DatabaseIdentity({ appEnv: environment, connectionString: env.MARKET_DATA_DATABASE_URL })
  return lane
}
export function assertSg2ProducerIdentity(env, seriesId, historical = false) {
  assertSg2DatabaseIdentity({ appEnv: env.APP_ENV, connectionString: env.MARKET_DATA_DATABASE_URL })
  const lanes = (env.SG2_FORECAST_PRODUCER_LANES || '').split(',').map(value => value.trim()).filter(Boolean)
  if (!lanes.length || lanes.some(lane => !['CURRENT_ONLY', 'VERIFICATION_ONLY'].includes(lane)) || !lanes.includes('CURRENT_ONLY') || (historical && !lanes.includes('VERIFICATION_ONLY'))) throw new Error('SG2_PRODUCER_LANES_REQUIRED')
  const allowedSeries = (env.SG2_FORECAST_ALLOWED_SERIES_IDS || '').split(',').map(value => value.trim()).filter(Boolean)
  if (!seriesId || !allowedSeries.includes(seriesId)) throw new Error('SG2_PRODUCER_SERIES_NOT_AUTHORIZED')
}
