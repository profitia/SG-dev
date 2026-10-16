import test from 'node:test'
import assert from 'node:assert/strict'
import { SG2_DATABASE_IDENTITIES, assertSg2Environment, assertSg2DatabaseIdentity, assertSg2ServiceUrl, assertSg2WorkerIdentity, assertSg2ProducerIdentity } from '../../../packages/governance/src/sg2-environment-identity.mjs'
const url = (environment, role = 'neondb_owner') => `postgresql://${role}:dummy@${SG2_DATABASE_IDENTITIES[environment].endpointId}-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require`
for (const environment of ['development', 'staging']) test(`accept exact ${environment} project/branch/role`, () => assert.equal(assertSg2DatabaseIdentity({ appEnv: environment, connectionString: url(environment) }).branchId, SG2_DATABASE_IDENTITIES[environment].branchId))
test('missing, malformed and reserved environment fail closed', () => { for (const value of [undefined, '', 'prod', 'production']) assert.throws(() => assertSg2Environment(value)) })
test('reject foreign branch/project, role, database and routing overrides without disclosing secrets', () => {
 for (const value of [url('staging'), url('production'), url('development', 'foreign_role'), url('development').replace('/neondb?', '/wrong?'), url('development').replace('ep-muddy-pine-b22pdyqd', 'ep-foreign-project'), url('development')+'&host=other']) {
  assert.throws(() => assertSg2DatabaseIdentity({ appEnv: 'development', connectionString: value }), error => !error.message.includes('dummy') && !error.message.includes('postgresql://'))
 }
 const declaredIdentity = { ...SG2_DATABASE_IDENTITIES.development, projectId: 'foreign-project' }
 assert.throws(() => assertSg2DatabaseIdentity({ appEnv: 'development', connectionString: url('development'), declaredIdentity }), /PROJECTID/)
})
test('legacy and cross-environment service bridges are rejected', () => {
 for (const value of ['https://dashboards-library.onrender.com', 'https://analytics-demo-sg-porr.spendguru.app', undefined]) assert.throws(() => assertSg2ServiceUrl({ appEnv: 'development', component: 'dashboard', value, nodeEnv: 'production' }))
 assert.equal(assertSg2ServiceUrl({ appEnv: 'staging', component: 'runtime', value: 'https://demo-sg-porr.spendguru.app', nodeEnv: 'production' }), 'https://demo-sg-porr.spendguru.app')
})
test('workers require exact environment/service/lane before claim or compute', () => {
 const env = { APP_ENV: 'development', FORECAST_PREPARATION_WORKER_MODE: 'CURRENT_ONLY', RENDER_SERVICE_ID: 'srv-dapa3vlg1s2s739vp7dg', MARKET_DATA_DATABASE_URL: url('development') }
 assert.equal(assertSg2WorkerIdentity(env), 'CURRENT_ONLY')
 for (const patch of [{ APP_ENV: undefined }, { FORECAST_PREPARATION_WORKER_MODE: undefined }, { FORECAST_PREPARATION_WORKER_MODE: 'ALL' }, { FORECAST_PREPARATION_WORKER_MODE: 'VERIFICATION_ONLY' }, { RENDER_SERVICE_ID: 'srv-daoksvuk1f9s73cg4bk0' }, { MARKET_DATA_DATABASE_URL: url('staging') }]) assert.throws(() => assertSg2WorkerIdentity({ ...env, ...patch }))
})
test('producer permissions are bounded by explicit lanes and series', () => {
 const env = { APP_ENV: 'development', MARKET_DATA_DATABASE_URL: url('development'), SG2_FORECAST_PRODUCER_LANES: 'CURRENT_ONLY', SG2_FORECAST_ALLOWED_SERIES_IDS: 'fixture-series' }
 assertSg2ProducerIdentity(env, 'fixture-series')
 assert.throws(() => assertSg2ProducerIdentity(env, 'other-series'))
 assert.throws(() => assertSg2ProducerIdentity(env, 'fixture-series', true))
 assert.throws(() => assertSg2ProducerIdentity({ ...env, SG2_FORECAST_PRODUCER_LANES: undefined }, 'fixture-series'))
})
