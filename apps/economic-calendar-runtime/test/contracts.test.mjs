import test from 'node:test'
import assert from 'node:assert/strict'
import {CalendarError, calendarObservation, canonicalEventId, calendarFilter, changeKinds, preferences} from '@profitia/economic-calendar-contracts'
import {sourceResponse} from './fixtures.mjs'
import {loadConfiguration} from '../src/config.mjs'
test('runtime and first-install operator provenance stay distinct; product binding refuses control-plane stores and foreign roles', () => {
  const env = {ECR_ENVIRONMENT:'development',ECR_DATABASE_HOST:'ep-synthetic.neon.tech',ECR_DATABASE_NAME:'synthetic_ecr',ECR_DATABASE_URL:'postgresql://economic_calendar_development_runtime:SYNTHETIC_ONLY@ep-synthetic.neon.tech/synthetic_ecr?sslmode=verify-full',ECR_NEON_PROJECT_ID:'SYNTHETIC_ONLY_PROJECT',ECR_NEON_BRANCH_ID:'SYNTHETIC_ONLY_BRANCH',ECR_PUBLIC_ORIGIN:'https://calendar.synthetic.test',ECR_IDENTITY_ISSUER:'https://synthetic.clerk.accounts.dev',RENDER_GIT_COMMIT:'a'.repeat(40),ECR_CONFIGURATION_VERSION:'SYNTHETIC_ONLY'}
  assert.equal(loadConfiguration(env).deploymentId,env.RENDER_GIT_COMMIT)
  const migration = {...env,ECR_MIGRATOR_DATABASE_URL:env.ECR_DATABASE_URL.replace('economic_calendar_development_runtime','economic_calendar_development_migrator'),ECR_EXECUTION_SHA:'b'.repeat(40)}
  assert.equal(loadConfiguration(migration,'migrator').deploymentId,'b'.repeat(40))
  assert.throws(()=>loadConfiguration({...migration,ECR_EXECUTION_SHA:undefined},'migrator'))
  assert.throws(()=>loadConfiguration({...env,ECR_DATABASE_NAME:'architecture_pmos',ECR_DATABASE_URL:env.ECR_DATABASE_URL.replace('synthetic_ecr','architecture_pmos')}))
  assert.throws(()=>loadConfiguration({...env,ECR_ENVIRONMENT:'production'}))
  assert.throws(()=>loadConfiguration({...env,PORT:'invalid'}))
  assert.throws(()=>loadConfiguration({...env,ECR_DATABASE_URL:env.ECR_DATABASE_URL.replace('economic_calendar_development_runtime','source_hub_development_runtime')}))
})
test('release identity survives actual/revision/schedule changes; distinct provider release keys never rebind', () => {
  const a = calendarObservation(sourceResponse().items[0]), b = calendarObservation(sourceResponse({actual: 0, eventAt: '2026-01-21T13:30:00.000Z', previous: '2.1%', revised: '2.0%'}).items[0])
  assert.equal(a.eventId, b.eventId); assert.notEqual(a.fingerprint, b.fingerprint)
  assert.notEqual(a.eventId, canonicalEventId('trading-economics', '1002'))
  assert.deepEqual(changeKinds(a.data, b.data), ['SCHEDULE_CHANGED', 'ACTUAL_CHANGED', 'PREVIOUS_REVISED'])
})
test('actual zero, null, before/after previous revision and two forecasts remain distinct; no publication-time invention', () => {
  const {data} = calendarObservation(sourceResponse({actual: 0, forecast: '2.5%', vendorForecast: '2.6%'}).items[0])
  assert.equal(data.values.actual, 0); assert.equal(data.values.previousAfterRevision, '2.3%'); assert.equal(data.values.previousBeforeRevision, '2.2%')
  assert.equal(data.values.consensusForecast, '2.5%'); assert.equal(data.values.vendorForecast, '2.6%'); assert.equal(data.publishedAt, null)
  assert.deepEqual(data.reference, {providerValue: '2026-01-01', label: 'JAN2026', date: '2026-01-01'})
  const unsafe=sourceResponse();unsafe.items[0].payload.sourceUrl='javascript:alert(1)';assert.throws(()=>calendarObservation(unsafe.items[0]))
  assert.equal(calendarObservation(sourceResponse({actual: null, eventAt: null, updated: null}).items[0]).data.values.actual, null)
})
test('cache TTL zero is not durable permission; retrieval or licence-version changes do not invent event revisions', () => {
  const first = sourceResponse(), second = sourceResponse({retrieved: '2026-11-06T01:00:00.000Z'})
  second.items[0].metadata.consumerStorage.licenceVersion = '2'
  assert.equal(calendarObservation(first.items[0]).fingerprint, calendarObservation(second.items[0]).fingerprint)
  delete first.items[0].metadata.consumerStorage
  assert.throws(() => calendarObservation(first.items[0]), e => e instanceof CalendarError && e.code === 'DURABLE_STORAGE_NOT_ADMITTED')
})
test('country/indicator filters and explicit local topics preserve values and reject identity substitution, bogus dates and provider inventions', () => {
  assert.deepEqual(calendarFilter({countries: ['Poland', 'United States'], importance: [1, 3]}).countries, ['Poland', 'United States'])
  assert.equal(preferences({watchedCountries:Array.from({length:200},(_,i)=>'SYNTHETIC_COUNTRY_'+i)}).watchedCountries.length,200)
  assert.equal(preferences({watchedTopics: [{kind: 'LOCAL_EVENT_TEXT_CONTAINS', text: 'oil'}]}).watchedTopics[0].kind, 'LOCAL_EVENT_TEXT_CONTAINS')
  for (const value of [{userId: 'other'}, {organisationId: 'other'}, {watchedTopics: [{kind: 'TE_OIL_CATEGORY', text: 'oil'}]}, {savedFilters: [{name: 'A', filter: {asKnownAt: '2026-01-01T00:00:00Z'}}]}]) assert.throws(() => preferences(value))
  for (const value of [{from: '2026-02-30T00:00:00Z'}, {from: '2026-03-01T00:00:00Z', to: '2026-01-01T00:00:00Z'}, {from: '2026-01-01'}, {countries: ['Poland', 'Poland']}, {limit: 501}]) assert.throws(() => calendarFilter(value))
})
