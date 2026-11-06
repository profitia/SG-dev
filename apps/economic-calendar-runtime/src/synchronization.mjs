import {createFirstPartySourceHubClient} from '@profitia/platform-source-hub-contracts/client'
import {parseHubRequest} from '@profitia/platform-source-hub-contracts'
import {CalendarError, organisationId, fingerprint} from '@profitia/economic-calendar-contracts'
import {persistAcquisition,createRepository} from './repository.mjs'
/** One explicit real acquisition. Ordinary read requests never import this
 * module or possess its component signing key / dedicated ingestion login.
 */
export function createSynchronizer({configuration, database, sourceConfiguration, fetchImpl = globalThis.fetch}) {
  configuration=Object.freeze({...configuration});sourceConfiguration=Object.freeze({...sourceConfiguration})
  if (configuration.runtimeRole !== 'economic_calendar_development_ingest' || sourceConfiguration.consumerApplicationId !== configuration.applicationId
    || sourceConfiguration.receiverApplicationId !== 'profitia-source-hub-development' || sourceConfiguration.environment !== 'development') throw new CalendarError('INGESTION_COMPONENT_BINDING_REQUIRED', 503)
  const storage = createRepository(configuration,database)
  const source = createFirstPartySourceHubClient(sourceConfiguration, {fetchImpl})
  return Object.freeze({async synchronize({criteria, organisation, grantId, idempotencyKey}) {
    if (typeof grantId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(grantId)) throw new CalendarError('GENUINE_SERVICE_GRANT_REQUIRED', 403)
    if (!await storage.ready()) throw new CalendarError('CALENDAR_STORAGE_UNAVAILABLE',503)
    const command = parseHubRequest({contractVersion: '1.0.0', family: 'economic-calendar', provider: 'trading-economics', operation: 'search', criteria})
    if(typeof idempotencyKey!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(idempotencyKey))throw new CalendarError('IDEMPOTENCY_KEY_REQUIRED')
    /** @type {import('@profitia/platform-current-e1-authority/first-party').SourceExecution} */
    const execution={kind:'SERVICE',organisationId:organisationId(organisation),grantId}
    const intentDigest=fingerprint({component:sourceConfiguration.componentId,application:configuration.applicationId,execution,idempotencyKey})
    const {rows:[existing]}=await database.query('SELECT request_digest,result FROM economic_calendar.sync_runs WHERE intent_digest=$1',[intentDigest])
    if(existing){if(existing.request_digest!==fingerprint(command))throw new CalendarError('ACQUISITION_INTENT_CONFLICT',409);return {...existing.result,replay:true}}
    const response = await source.acquire({command, execution, idempotencyKey})
    return persistAcquisition(database, command, response,{intentDigest})
  }})
}
