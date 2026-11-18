import {createFirstPartySourceHubClient} from '@profitia/platform-source-hub-contracts/client'
import {parseHubRequest} from '@profitia/platform-source-hub-contracts'
import {CalendarError, organisationId} from '@profitia/economic-calendar-contracts'

export const ECR_APPLICATION_ID = 'profitia-economic-calendar-runtime-development'
/** @typedef {{criteria?:any,command?:any,organisation:string,grantId:string,idempotencyKey:string}} CalendarSourceInput */
/** The ECR service path uses current E1 and Source Admission on every new intent.
 * It never imports the bounded Oil research executor or keeps a request budget.
 */
export function createCalendarSourceService(sourceConfiguration, {fetchImpl = globalThis.fetch} = {}) {
  const configuration = Object.freeze({...sourceConfiguration})
  if (configuration.environment !== 'development' || configuration.consumerApplicationId !== ECR_APPLICATION_ID
    || configuration.receiverApplicationId !== 'profitia-source-hub-development') throw new CalendarError('INGESTION_COMPONENT_BINDING_REQUIRED', 503)
  const source = createFirstPartySourceHubClient(configuration, {fetchImpl})
  /** @param {CalendarSourceInput} input */
  async function acquire(input){
    const {criteria,command:sourceCommand,organisation,grantId,idempotencyKey}=input
    const {command, execution} = calendarSourceIntent({criteria,command:sourceCommand,organisation, grantId, idempotencyKey})
    return source.acquire({command, execution, idempotencyKey})
  }
  return Object.freeze({acquire})
}
/** @param {CalendarSourceInput} input */
export function calendarSourceIntent(input) {
  const {criteria,command:sourceCommand,organisation,grantId,idempotencyKey}=input
  if (typeof grantId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(grantId)) throw new CalendarError('GENUINE_SERVICE_GRANT_REQUIRED', 403)
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(idempotencyKey)) throw new CalendarError('IDEMPOTENCY_KEY_REQUIRED')
  if(sourceCommand!==undefined&&criteria!==undefined)throw new CalendarError('AMBIGUOUS_SOURCE_COMMAND')
  const command = parseHubRequest(sourceCommand??{contractVersion: '1.0.0', family: 'economic-calendar', provider: 'trading-economics', operation: 'search', criteria})
  if(!(command.contractVersion==='1.0.0'&&command.provider==='trading-economics'&&command.family==='economic-calendar'&&command.operation==='search'
    ||['1.3.0','1.5.0'].includes(command.contractVersion)&&['eia','commodities-sh'].includes(command.provider)&&command.family==='publication-calendar'&&command.operation==='calendar'
    ||command.contractVersion==='1.4.0'&&command.provider==='eia'&&command.family==='series-observations'&&command.operation==='observations'))throw new CalendarError('UNSUPPORTED_CALENDAR_SOURCE')
  /** @type {import('@profitia/platform-current-e1-authority/first-party').SourceExecution} */
  const execution = {kind: 'SERVICE', organisationId: organisationId(organisation), grantId}
  return {command, execution}
}
export function sourceServiceConfiguration(env = process.env) {
  return {environment: 'development', componentId: env.ECR_SOURCE_COMPONENT_ID,
    consumerApplicationId: ECR_APPLICATION_ID, receiverApplicationId: 'profitia-source-hub-development',
    sourceOrigin: env.ECR_SOURCE_COMPONENT_ORIGIN, targetOrigin: 'https://source-hub-development.onrender.com',
    keyId: env.ECR_SOURCE_KEY_ID, privateKey: env.ECR_SOURCE_SIGNING_PRIVATE_KEY}
}
