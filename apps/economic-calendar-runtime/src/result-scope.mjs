import {CalendarError} from '@profitia/economic-calendar-contracts'

/** Accepted publication identity, not a proximity/date-guess correlation. Each
 * period denotes the provider's reference Friday (WPSR) or Monday (prices). */
export const EIA_RESULT_PUBLICATIONS = Object.freeze({
  'petroleum/stoc/wstk': {publicationRef:'eia:wpsr',referenceWeekday:5},
  'petroleum/sum/sndw': {publicationRef:'eia:wpsr',referenceWeekday:5},
  'petroleum/pri/gnd': {publicationRef:'eia:gasdiesel',referenceWeekday:1},
  'petroleum/pri/wfr': {publicationRef:'eia:heatingoilpropane',referenceWeekday:1}
})
const unitAliases = Object.freeze({
  'Thousand Barrels': ['MBBL','Thousand Barrels'],
  'Thousand Barrels per Day': ['MBBL/D','Thousand Barrels per Day'],
  'Percent': ['%','Percent'],
  'Dollars per Gallon': ['$/GAL','Dollars per Gallon']
})
export function resultScope(dataset) {
  const scope=EIA_RESULT_PUBLICATIONS[dataset]
  if(!scope)throw new CalendarError('UNCONFIRMED_RESULT_PUBLICATION',502)
  return {...scope,method:scope.publicationRef==='eia:wpsr'?'EXACT_EIA_WPSR_REFERENCE_PERIOD/1':'EXACT_EIA_PUBLICATION_REFERENCE_PERIOD/2'}
}
export function assertResultMeasure(measure, mappings, payload, value) {
  const scope=resultScope(payload.datasetId)
  if(!measure||payload.frequency!==measure.data.frequency||measure.data.geography!=='USA'||payload.dimensions.duoarea!=='NUS'
    ||!unitAliases[measure.data.unit]?.includes(value.unit)
    ||new Date(payload.referencePeriod).getUTCDay()!==scope.referenceWeekday
    ||!mappings.some(e=>e.status==='accepted'&&e.data.provider==='eia'&&e.data.publicationRef===scope.publicationRef&&e.data.conceptId===measure.data.conceptId&&e.data.certainty==='CONFIRMED'&&e.data.relation==='EQUIVALENT_DEFINITION'))throw new CalendarError('UNCONFIRMED_RESULT_SEMANTICS',502)
  return scope
}
