import {CalendarError, fingerprint} from '@profitia/economic-calendar-contracts'
import {createCalendarSourceService, calendarSourceIntent} from './source-service.mjs'
import {persistAcquisition,createRepository} from './repository.mjs'
/** One explicit real acquisition. Ordinary read requests never import this
 * module or possess its component signing key / dedicated ingestion login.
 */
export function createSynchronizer({configuration, database, sourceConfiguration, fetchImpl = globalThis.fetch}) {
  configuration=Object.freeze({...configuration});sourceConfiguration=Object.freeze({...sourceConfiguration})
  if (configuration.runtimeRole !== 'economic_calendar_development_ingest' || sourceConfiguration.consumerApplicationId !== configuration.applicationId
    || sourceConfiguration.receiverApplicationId !== 'profitia-source-hub-development' || sourceConfiguration.environment !== 'development') throw new CalendarError('INGESTION_COMPONENT_BINDING_REQUIRED', 503)
  const storage = createRepository(configuration,database)
  const source = createCalendarSourceService(sourceConfiguration, {fetchImpl})
  return Object.freeze({async synchronize({criteria=undefined,command:sourceCommand=undefined,organisation, grantId, idempotencyKey}) {
    const {command, execution} = calendarSourceIntent({criteria,command:sourceCommand,organisation, grantId, idempotencyKey})
    if (!await storage.ready()) throw new CalendarError('CALENDAR_STORAGE_UNAVAILABLE',503)
    const intentDigest=fingerprint({component:sourceConfiguration.componentId,application:configuration.applicationId,execution,idempotencyKey})
    const {rows:[existing]}=await database.query('SELECT request_digest,result FROM economic_calendar.sync_runs WHERE intent_digest=$1',[intentDigest])
    if(existing){if(existing.request_digest!==fingerprint(command))throw new CalendarError('ACQUISITION_INTENT_CONFLICT',409);return {...existing.result,replay:true}}
    const response = await source.acquire({command,organisation, grantId, idempotencyKey})
    return persistAcquisition(database, command, response,{intentDigest})
  }})
}
