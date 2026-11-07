import {createCurrentE1OperationHost} from '@profitia/platform-current-e1-authority'
import {accessSchemaDigest} from '@profitia/platform-contracts/access-store'
import {CalendarError, ECR_EVENT_RESOURCE, ECR_PREFERENCE_RESOURCE, organisationId} from '@profitia/economic-calendar-contracts'
export async function createAuthorizer(configuration, database, {fetch: send = globalThis.fetch} = {}) {
  const binding = {applicationId: configuration.applicationId, environment: configuration.environment, projectId: configuration.projectId, branchId: configuration.branchId, databaseName: configuration.databaseName, role: configuration.runtimeRole, schemaDigest: await accessSchemaDigest()}
  /** @type {import('@profitia/platform-contracts/operation-context').Application} */
  const application = {appId: configuration.applicationId, environment: configuration.environment, identityIssuer: configuration.identityIssuer, organisationId: null,
    profileId: 'SPENDGURU_SAAS', deploymentId: configuration.deploymentId, configurationVersion: configuration.configurationVersion,
    features: ['market', 'personal_workspace'], operations: ['knowledge.read', 'personal.list.read', 'personal.list.write']}
  const host = createCurrentE1OperationHost({application, binding, independentQuery: database.query, transact: database.transact, fetch: send,
    async readResources({scope, request}) {
      const shared = request.resourceId === ECR_EVENT_RESOURCE
      return {resource: {id: request.resourceId, type: shared ? 'market_knowledge' : 'personal_list', dataClass: shared ? 'SHARED_KNOWLEDGE' : 'USER_IN_ORGANISATION_PRIVATE',
        environment: scope.environment, ownerOrganisationId: shared ? null : scope.organisationId, ownerUserId: shared ? null : scope.userId, ...(shared ? {approvedSharedProjection: true} : {}),
        version: '1', projectionVersion: 'economic-calendar-v1', contentRequirements: [{product: 'SPENDGURU', feature: shared ? 'market' : 'personal_workspace'}]}}
    }, projectOutput: value => structuredClone(value)})
  return Object.freeze({binding, ready: () => host.ready(), async execute({request, organisation, kind, write = false, payload = null}, action) {
    if (!(request instanceof Request) || request.headers.has('cookie') || !/^Bearer [\x21-\x7e]{1,16384}$/.test(request.headers.get('authorization') ?? '')) throw new CalendarError('UNVERIFIED_IDENTITY',401)
    if (!['events', 'preferences'].includes(kind) || kind === 'events' && write) throw new CalendarError('UNSUPPORTED_OPERATION')
    const shared = kind === 'events'
    const result = await host.execute({contractId: host.contract.id, contractVersion: host.contract.version, operation: shared ? 'knowledge.read' : write ? 'personal.list.write' : 'personal.list.read',
      organisationId: organisationId(organisation), resourceId: shared ? ECR_EVENT_RESOURCE : ECR_PREFERENCE_RESOURCE, request, payload}, async (context, transaction) => {
      await transaction.query('SAVEPOINT calendar_business')
      try {const value = await action(context, transaction); await transaction.query('RELEASE SAVEPOINT calendar_business'); return {ok: true, value}}
      catch (error) {if (!(error instanceof CalendarError)) throw error; await transaction.query('ROLLBACK TO SAVEPOINT calendar_business'); await transaction.query('RELEASE SAVEPOINT calendar_business'); return {ok: false, error: {code: error.code, status: error.status}}}
    })
    if (result.value.error) throw new CalendarError(result.value.error.code, result.value.error.status)
    return result.value.value
  }})
}
