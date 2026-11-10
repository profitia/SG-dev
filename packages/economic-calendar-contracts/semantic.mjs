import {CalendarError, closedObject, instant} from './index.mjs'

export const SEMANTIC_CONTRACT = 'profitia.economic-calendar-semantics/1.0.0'
export const SEMANTIC_KINDS = Object.freeze(['concept','mapping','measure','rule','relevance'])
export const RELEVANCE_LEVELS = Object.freeze(['DIRECT','STRONG','CONTEXTUAL'])
export const CURATION_STATES = Object.freeze(['candidate','accepted','rejected','retired'])
export function semanticId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(value)) throw new CalendarError('INVALID_SEMANTIC_ID')
  return value
}
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 4096
export function semanticChange(input) {
  if (!closedObject(input,['kind','id','expectedVersion','status','effectiveAt','data','evidence','curatorRef'])
    || !SEMANTIC_KINDS.includes(input.kind) || !CURATION_STATES.includes(input.status)
    || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0
    || !text(input.curatorRef) || !Array.isArray(input.evidence) || !input.evidence.length || input.evidence.length > 30
    || !input.evidence.every(e => closedObject(e,['ref','reason']) && text(e.ref) && text(e.reason))) throw new CalendarError('INVALID_SEMANTIC_CHANGE')
  semanticId(input.id); instant(input.effectiveAt)
  const d = input.data
  const fields = {concept:['namePl','nameEn','description','aliases','taxonomy','geography'],
    mapping:['provider','publicationRef','conceptId','certainty','relation','reason'],
    measure:['conceptId','namePl','nameEn','description','unit','frequency','geography','sourceSelector','valueMeaning'],
    rule:['description','method','version','causalityClaim'],
    relevance:['conceptId','targetType','targetId','level','reason','ruleId','ruleVersion','targetEvidenceRef']}
  if (!closedObject(d,fields[input.kind]) || fields[input.kind].some(k=>!Object.hasOwn(d,k))
    || Object.hasOwn(d,'userId') || Object.hasOwn(d,'organisationId')) throw new CalendarError('INVALID_SEMANTIC_DATA')
  if (input.kind === 'concept' && (!text(d.namePl)||!text(d.nameEn)||!text(d.description)||!Array.isArray(d.aliases)||!d.aliases.every(text)||!Array.isArray(d.taxonomy)||!d.taxonomy.every(text)||!text(d.geography))) throw new CalendarError('INVALID_CONCEPT')
  if (input.kind === 'mapping' && (!['eia','commodities-sh','trading-economics'].includes(d.provider)||!text(d.publicationRef)||!['CONFIRMED','SUGGESTED','UNRESOLVED'].includes(d.certainty)||!['EQUIVALENT_DEFINITION','PART_OF','UNRESOLVED'].includes(d.relation)||!text(d.reason)
    || input.status==='accepted' && (d.certainty!=='CONFIRMED'||d.relation==='UNRESOLVED'))) throw new CalendarError('INVALID_SOURCE_MAPPING')
  if (input.kind === 'measure' && (!text(d.namePl)||!text(d.nameEn)||!text(d.description)||!text(d.unit)||!text(d.frequency)||!text(d.geography)||!closedObject(d.sourceSelector,['provider','path','series','field'])||Object.keys(d.sourceSelector).length!==4||!Object.values(d.sourceSelector).every(text)||d.valueMeaning!=='CURRENT_SNAPSHOT_NOT_PUBLICATION_VINTAGE')) throw new CalendarError('INVALID_MEASURE')
  if (input.kind === 'rule' && (!text(d.description)||d.method!=='CURATED_EVIDENCE_RULE'||!text(d.version)||d.causalityClaim!==false)) throw new CalendarError('INVALID_RULE')
  if (input.kind === 'relevance' && (!['BENCHMARK_SERIES','MARKET','COMMODITY','CATEGORY'].includes(d.targetType)||!RELEVANCE_LEVELS.includes(d.level)||!text(d.reason)||!text(d.targetEvidenceRef)||!Number.isSafeInteger(d.ruleVersion)||d.ruleVersion<1)) throw new CalendarError('INVALID_RELEVANCE')
  for (const key of ['conceptId','targetId','ruleId']) if (d[key]!==undefined) semanticId(d[key])
  if (Buffer.byteLength(JSON.stringify(input))>24000) throw new CalendarError('SEMANTIC_CHANGE_TOO_LARGE')
  return structuredClone(input)
}
export function semanticFilter(input={}) {
  if (!closedObject(input,['targetType','targetId','from','to','asKnownAt','after','limit'])) throw new CalendarError('INVALID_SEMANTIC_FILTER')
  const f={...input,limit:input.limit??100}
  if (!Number.isSafeInteger(f.limit)||f.limit<1||f.limit>500) throw new CalendarError('INVALID_PAGE_SIZE')
  for(const k of ['from','to','asKnownAt']) if(f[k]!==undefined)f[k]=instant(f[k])
  if(f.from&&f.to&&f.from>f.to)throw new CalendarError('INVALID_TIME_RANGE')
  if((f.targetType===undefined)!==(f.targetId===undefined))throw new CalendarError('TARGET_PAIR_REQUIRED')
  if(f.targetType!==undefined&&!['BENCHMARK_SERIES','MARKET','COMMODITY','CATEGORY'].includes(f.targetType))throw new CalendarError('INVALID_TARGET_TYPE')
  if(f.targetId!==undefined)semanticId(f.targetId)
  if(f.after!==undefined)semanticId(f.after)
  return f
}
