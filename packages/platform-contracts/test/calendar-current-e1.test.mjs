import test from 'node:test'
import assert from 'node:assert/strict'
import {createCurrentE1OperationHost} from '../current-e1-authority/index.mjs'
import {calendarE1Fixture, A, U} from './fixtures/calendar-current-e1-postgres.mjs'
function host(f, {foreignOwner = false} = {}) {
  const c = f.calendar, application = {appId: c.configuration.applicationId, environment: 'development', profileId: 'SPENDGURU_SAAS', deploymentId: 'SYNTHETIC_ONLY', configurationVersion: 'SYNTHETIC_ONLY', identityIssuer: f.issuer, organisationId: null, features: ['market', 'personal_workspace'], operations: ['knowledge.read', 'personal.list.read', 'personal.list.write']}
  return createCurrentE1OperationHost({application, binding: c.binding, independentQuery: c.runtime.query, transact: c.runtime.transact, fetch: f.transport,
    readResources: ({scope, request}) => ({resource: {id: request.resourceId, type: request.operation === 'knowledge.read' ? 'market_knowledge' : 'personal_list', dataClass: request.operation === 'knowledge.read' ? 'SHARED_KNOWLEDGE' : 'USER_IN_ORGANISATION_PRIVATE', environment: 'development', ownerOrganisationId: request.operation === 'knowledge.read' ? null : scope.organisationId, ...(request.operation === 'knowledge.read' ? {approvedSharedProjection: true} : {}), ownerUserId: request.operation === 'knowledge.read' ? null : foreignOwner ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' : scope.userId, version: '1', projectionVersion: 'SYNTHETIC_ONLY', contentRequirements: [{product: 'SPENDGURU', feature: request.operation === 'knowledge.read' ? 'market' : 'personal_workspace'}]}}), projectOutput: value => value})
}
const input = (f, h, operation = 'knowledge.read', resourceId = 'economic-calendar-events') => ({contractId: h.contract.id, contractVersion: h.contract.version, operation, resourceId, organisationId: A, request: f.calendar.request(), payload: null})
test('calendar uses current central E1 for shared reads and private operations, with no local directory', async () => {
  const f = await calendarE1Fixture()
  try {
    const h = host(f), before = f.transportState.calls
    const result = await h.execute(input(f, h), async (context, t) => {assert.equal(context.subjectUserId, U); return (await t.query("SELECT profitia_e1_receiver.calendar_scope('events',NULL,false) AS allowed")).rows[0].allowed})
    assert.equal(result.value, true); assert.equal(f.transportState.calls - before, 2)
    const p = await h.execute(input(f, h, 'personal.list.write', 'economic-calendar-preferences'), async (_, t) => (await t.query("SELECT profitia_e1_receiver.calendar_scope('preferences',$1::uuid,true) AS allowed", [U])).rows[0].allowed)
    assert.equal(p.value, true)
    const counts = await f.calendar.asOwner('profitia_access_owner', q => q.query('SELECT (SELECT count(*) FROM profitia_access.accounts)+(SELECT count(*) FROM profitia_access.external_identities)+(SELECT count(*) FROM profitia_access.memberships) AS count'))
    assert.equal(Number(counts.rows[0].count), 0)
  } finally {await f.close()}
})
test('calendar rejects cross-resource/operation proof, missing grants, foreign private owner and revoked parent feature', async () => {
  const f = await calendarE1Fixture()
  try {
    const h = host(f)
    for (const [operation, resource] of [['personal.list.write', 'economic-calendar-events'], ['knowledge.read', 'economic-calendar-preferences'], ['knowledge.read', 'newsfeed-observations']]) await assert.rejects(h.execute(input(f, h, operation, resource), () => {throw Error('must not execute')}))
    const foreign = host(f, {foreignOwner: true})
    await assert.rejects(foreign.execute(input(f, foreign, 'personal.list.read', 'economic-calendar-preferences'), () => true))
    await f.asOwner(0, q => q.query("UPDATE profitia_access.product_grants SET features=ARRAY['benchmark','personal_workspace'] WHERE application_id='spendguru' AND organisation_id=$1", [A]))
    await assert.rejects(h.execute(input(f, h), () => true))
    const preference = await h.execute(input(f, h, 'personal.list.read', 'economic-calendar-preferences'), () => true)
    assert.equal(preference.value, true)
  } finally {await f.close()}
})
test('current E1 calendar outcome denial rolls back writes and authority outage never falls back', async () => {
  const f = await calendarE1Fixture()
  try {
    await f.calendar.admin.query('CREATE TABLE public.synthetic_calendar_effect(value text)'); await f.calendar.admin.query('GRANT INSERT,SELECT ON public.synthetic_calendar_effect TO economic_calendar_development_runtime')
    const h = host(f)
    f.transportState.afterInitial = () => f.asOwner(0, q => q.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE user_id=$1 AND organisation_id=$2", [U, A]))
    await assert.rejects(h.execute(input(f, h, 'personal.list.write', 'economic-calendar-preferences'), async (_, t) => {await t.query("INSERT INTO public.synthetic_calendar_effect VALUES('SYNTHETIC_ONLY')"); return true}))
    assert.equal(Number((await f.calendar.admin.query('SELECT count(*) FROM public.synthetic_calendar_effect')).rows[0].count), 0)
    f.transportState.afterInitial = null; f.transportState.offline = true
    await assert.rejects(h.execute(input(f, h), () => true))
    assert.equal((await f.calendar.runtime.query("SELECT profitia_e1_receiver.calendar_scope('events',NULL,false) AS allowed")).rows[0].allowed, false)
  } finally {await f.close()}
})
