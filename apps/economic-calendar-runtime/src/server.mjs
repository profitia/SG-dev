import http from 'node:http'
import {performance} from 'node:perf_hooks'
import {createSemanticRepository} from './semantics.mjs'
import {createNotificationSettingsRepository} from './notification-settings.mjs'
import {semanticFilter,semanticId} from '../../../packages/economic-calendar-contracts/semantic.mjs'
import {isOperationDenied, OperationDenied} from '@profitia/platform-contracts/operation-context'
import {CalendarError, ECR_CONTRACT, ECR_CALENDAR_QUERY_CONTRACT, calendarFilter, closedObject, eventId, publicationId, publicationFilter, fingerprint, organisationId} from '@profitia/economic-calendar-contracts'
const integer = value => {if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,14})$/.test(value)) throw new CalendarError('INVALID_INTEGER'); return Number(value)}
function parameters(query, allowed) {if ([...query.keys()].some(k => !allowed.includes(k))) throw new CalendarError('UNSUPPORTED_QUERY_PARAMETER')}
function single(query, key) {const values = query.getAll(key); if (values.length > 1) throw new CalendarError('DUPLICATE_QUERY_PARAMETER'); return values[0]}
function filter(query) {
  parameters(query, ['from', 'to', 'country', 'indicator', 'importance', 'eventText', 'eventId', 'asKnownAt', 'limit', 'after'])
  const value = {}
  for (const k of ['from', 'to', 'eventText', 'asKnownAt', 'after']) if (query.has(k)) value[k] = single(query, k)
  for (const [key, name] of [['country', 'countries'], ['indicator', 'indicators'], ['eventId', 'eventIds']]) if (query.has(key)) value[name] = query.getAll(key)
  if (query.has('importance')) value.importance = query.getAll('importance').map(integer)
  if (query.has('limit')) value.limit = integer(single(query, 'limit'))
  return calendarFilter(value)
}
async function body(request) {
  let size = 0; const chunks = []
  for await (const chunk of request) {size += chunk.length; if (size > 70000) throw new CalendarError('REQUEST_TOO_LARGE', 413); chunks.push(chunk)}
  const bytes = Buffer.concat(chunks)
  if (!bytes.length) return null
  if (request.headers['content-type'] !== 'application/json') throw new CalendarError('JSON_REQUIRED', 415)
  try {return JSON.parse(bytes.toString('utf8'))} catch {throw new CalendarError('INVALID_JSON')}
}
export function createServer({configuration, authorizer, repository, report = (_event) => {}}) {
  if (!authorizer?.execute || !repository?.ready) throw new TypeError('Explicit ECR runtime dependencies required')
  const semantics=createSemanticRepository(repository)
  const notifications=createNotificationSettingsRepository()
  const server = http.createServer(async (incoming, outgoing) => {
    const started = performance.now(); let operation = 'unmatched', status = 500,recordsReturned=null,databaseOperationMs=null
    const send = (code, value) => {status = code; if(Number.isSafeInteger(value.version))outgoing.setHeader('etag','"'+value.version+'"'); outgoing.writeHead(code, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}); outgoing.end(JSON.stringify(value))}
    try {
      if (!incoming.url?.startsWith('/') || incoming.url.startsWith('//')) throw new CalendarError('INVALID_PATH')
      const url = new URL(incoming.url, configuration.publicOrigin)
      for (const key of ['authorization', 'content-type', 'content-length','if-match']) if (incoming.rawHeaders.filter((v, i) => i % 2 === 0 && v.toLowerCase() === key).length > 1) throw new CalendarError('DUPLICATE_HEADER')
      if (['x-user-id', 'x-clerk-user-id', 'x-organisation-id'].some(k => incoming.headers[k] !== undefined)) throw new CalendarError('CLAIMED_IDENTITY_REFUSED', 403)
      const origin = incoming.headers.origin
      if (origin) {
        if (!configuration.allowedOrigins.includes(origin)) throw new CalendarError('ORIGIN_REFUSED', 403)
        outgoing.setHeader('access-control-allow-origin', origin); outgoing.setHeader('vary', 'Origin')
      }
      if (incoming.method === 'OPTIONS') {
        if (!origin) throw new CalendarError('ORIGIN_REQUIRED')
        outgoing.setHeader('access-control-allow-methods', 'GET, PUT, POST, DELETE'); outgoing.setHeader('access-control-allow-headers', 'Authorization, Content-Type, If-Match'); outgoing.writeHead(204); outgoing.end(); status = 204; return
      }
      if (url.pathname === '/health' && incoming.method === 'GET') {operation = 'health'; return send(200, {status: 'ok', contract: ECR_CONTRACT, sourceSha: configuration.deploymentId})}
      if (url.pathname === '/ready' && incoming.method === 'GET') {operation = 'ready'; const ready = await repository.ready() && await authorizer.ready(); return send(ready ? 200 : 503, {ready, sourceSha: configuration.deploymentId})}
      const match = /^\/v1\/organisations\/([^/]+)\/calendar\/(query|events|publications|preferences|favourites|timeline|context|knowledge|freshness|evidence|notifications)(?:\/([^/]+))?(?:\/(revisions))?$/.exec(url.pathname)
      if (!match) throw new CalendarError('NOT_FOUND', 404)
      const organisation = organisationId(decodeURIComponent(match[1])), collection = match[2], id = match[3] ? (collection==='publications'?publicationId:collection==='knowledge'?semanticId:eventId)(decodeURIComponent(match[3])) : null
      const history = match[4] === 'revisions', method = incoming.method ?? ''
      const value = await body(incoming)
      if (method === 'GET' && value !== null) throw new CalendarError('BODY_NOT_ALLOWED')
      const headers = new Headers()
      for (const name of ['authorization', 'cookie']) if (typeof incoming.headers[name] === 'string') headers.set(name, incoming.headers[name])
      const abort = new AbortController(); incoming.on('aborted', () => abort.abort())
      outgoing.on('close', () => {if (!outgoing.writableFinished) abort.abort()})
      const request = new Request(configuration.publicOrigin + url.pathname, {method, headers, signal: abort.signal})
      let expectedVersion
      if(incoming.headers['if-match']!==undefined){const match=/^"(0|[1-9][0-9]{0,14})"$/.exec(String(incoming.headers['if-match']));if(!match)throw new CalendarError('INVALID_IF_MATCH');expectedVersion=integer(match[1])}
      let action, kind = ['query','events','publications','timeline','context','knowledge','freshness','evidence'].includes(collection) ? 'events' : 'preferences', write = method !== 'GET'
      if(collection==='query'&&method==='GET'&&!id&&!history){
        parameters(url.searchParams,['include','eventAfter','publicationAfter','contextAfter','limit'])
        const include=(single(url.searchParams,'include')??'events,publications,context').split(',')
        if(!include.length||new Set(include).size!==include.length||include.some(k=>!['events','publications','context'].includes(k)))throw new CalendarError('INVALID_QUERY_PROJECTION')
        const page=calendarFilter({limit:url.searchParams.has('limit')?integer(single(url.searchParams,'limit')):100})
        const cursors={events:single(url.searchParams,'eventAfter'),publications:single(url.searchParams,'publicationAfter'),context:single(url.searchParams,'contextAfter')}
        for(const key of ['events','publications','context'])if(cursors[key]!==undefined){if(!include.includes(key))throw new CalendarError('UNUSED_QUERY_CURSOR');(key==='publications'?publicationId:eventId)(cursors[key])}
        operation='calendar_query'
        // All projections share exactly one current E1 operation and transaction.
        // Private preferences remain a separately authorised private operation.
        action=async(_,t)=>({projection:'CALENDAR_QUERY',queryContract:ECR_CALENDAR_QUERY_CONTRACT,
          events:include.includes('events')?await repository.listEvents(t,{limit:page.limit,...(cursors.events?{after:cursors.events}:{})}):null,
          publications:include.includes('publications')?await repository.listPublications(t,{limit:page.limit,...(cursors.publications?{after:cursors.publications}:{})}):null,
          context:include.includes('context')?await semantics.context(t,{limit:page.limit,...(cursors.context?{after:cursors.context}:{})}):null})
      }else if(['timeline','context'].includes(collection)&&method==='GET'&&!id&&!history){
        parameters(url.searchParams,['targetType','targetId','from','to','asKnownAt','after','limit'])
        const criteria=semanticFilter(Object.fromEntries([...url.searchParams.keys()].map(k=>[k,k==='limit'?integer(single(url.searchParams,k)):single(url.searchParams,k)])))
        operation='semantic_'+collection;action=(_,t)=>semantics[collection](t,criteria)
      }else if(collection==='knowledge'&&method==='GET'){
        operation=history?'semantic_history':'semantic_knowledge'
        if(history&&id){parameters(url.searchParams,['after','limit']);action=(_,t)=>semantics.history(t,id,{after:url.searchParams.has('after')?integer(single(url.searchParams,'after')):0,limit:url.searchParams.has('limit')?integer(single(url.searchParams,'limit')):100})}
        else if(!id&&!history){parameters(url.searchParams,['asKnownAt']);action=(_,t)=>semantics.knowledge(t,{asKnownAt:single(url.searchParams,'asKnownAt')})}
        else throw new CalendarError('NOT_FOUND',404)
      }else if(collection==='freshness'&&method==='GET'&&!id&&!history){parameters(url.searchParams,[]);operation='sync_freshness';action=(_,t)=>semantics.freshness(t)}
      else if(collection==='evidence'&&method==='GET'&&id&&history){parameters(url.searchParams,['after','limit']);operation='result_history';action=(_,t)=>semantics.resultHistory(t,id,{after:single(url.searchParams,'after')??'',limit:url.searchParams.has('limit')?integer(single(url.searchParams,'limit')):100})}
      else if(collection==='evidence'&&method==='GET'&&id&&!history){parameters(url.searchParams,['asKnownAt']);operation='event_evidence';action=(_,t)=>semantics.evidence(t,id,single(url.searchParams,'asKnownAt'))}
      else if (collection === 'events' && method === 'GET') {
        operation = history ? 'event_history' : id ? 'event_detail' : 'events'
        if (history) {if (!id) throw new CalendarError('NOT_FOUND', 404); parameters(url.searchParams, ['after', 'limit']); const page = {after: url.searchParams.has('after') ? integer(single(url.searchParams, 'after')) : 0, limit: url.searchParams.has('limit') ? integer(single(url.searchParams, 'limit')) : 100}; action = (_, t) => repository.revisions(t, id, page)}
        else if (id) {parameters(url.searchParams, ['asKnownAt']); action = (_, t) => repository.detail(t, id, single(url.searchParams, 'asKnownAt'))}
        else {const criteria = filter(url.searchParams); action = (_, t) => repository.listEvents(t, criteria)}
      } else if(collection==='publications'&&method==='GET'){
        operation=history?'publication_history':id?'publication_detail':'publications'
        if(history){if(!id)throw new CalendarError('NOT_FOUND',404);parameters(url.searchParams,['after','limit']);const page={after:url.searchParams.has('after')?integer(single(url.searchParams,'after')):0,limit:url.searchParams.has('limit')?integer(single(url.searchParams,'limit')):100};action=(_,t)=>repository.publicationRevisions(t,id,page)}
        else if(id){parameters(url.searchParams,['asKnownAt']);action=(_,t)=>repository.publicationDetail(t,id,single(url.searchParams,'asKnownAt'))}
        else{parameters(url.searchParams,['provider','after','limit','asKnownAt']);const criteria=Object.fromEntries([...url.searchParams.keys()].map(k=>[k,k==='limit'?integer(single(url.searchParams,k)):single(url.searchParams,k)]));const f=publicationFilter(criteria);action=(_,t)=>repository.listPublications(t,f)}
      } else if (collection === 'notifications' && !id && !history && method === 'GET') {parameters(url.searchParams, []); operation = 'notifications_read'; action = (c, t) => notifications.get(t, c)}
      else if (collection === 'notifications' && !id && !history && method === 'PUT') {
        parameters(url.searchParams, []); if (!closedObject(value, ['expectedVersion', 'settings']) || !Object.hasOwn(value, 'settings')) throw new CalendarError('INVALID_NOTIFICATION_UPDATE')
        operation = 'notifications_write'; action = (c, t) => notifications.put(t, c, value.expectedVersion, value.settings)
      } else if (collection === 'preferences' && !id && !history && method === 'GET') {parameters(url.searchParams, []); operation = 'preferences_read'; action = (c, t) => repository.getPreferences(t, c)}
      else if (collection === 'preferences' && !id && !history && method === 'PUT') {
        parameters(url.searchParams, []); if (!closedObject(value, ['expectedVersion', 'preferences']) || !Object.hasOwn(value, 'preferences')) throw new CalendarError('INVALID_PREFERENCE_UPDATE')
        operation = 'preferences_write'; action = (c, t) => repository.putPreferences(t, c, value.expectedVersion, value.preferences)
      } else if (collection === 'favourites' && !id && !history && method === 'GET') {
        parameters(url.searchParams, ['after', 'limit']); operation = 'favourites_read'; const page = {after: single(url.searchParams, 'after'), limit: url.searchParams.has('limit') ? integer(single(url.searchParams, 'limit')) : 100}; action = (c, t) => repository.favourites(t, c, page)
      } else if (collection === 'favourites' && id && !history && ['POST', 'DELETE'].includes(method)) {
        parameters(url.searchParams, []); if (value !== null && (!closedObject(value, []) || Object.keys(value).length)) throw new CalendarError('BODY_NOT_ALLOWED')
        operation = method === 'POST' ? 'favourite_add' : 'favourite_remove'; action = (c, t) => repository.setFavourite(t, c, id, method === 'POST',expectedVersion)
      } else throw new CalendarError('METHOD_NOT_ALLOWED', 405)
      const result = await authorizer.execute({request, organisation, kind, write, payload: {operation, inputDigest: fingerprint({path: url.pathname, query: [...url.searchParams], body: value,expectedVersion:expectedVersion??null})}}, async (c,t) => {const at=performance.now();try{await repository.assertInstalled(t);return await action(c,t)}finally{databaseOperationMs=Math.round((performance.now()-at)*100)/100}})
      recordsReturned=collection==='query'?(result.events?.items.length??0)+(result.publications?.items.length??0):Array.isArray(result.items)?result.items.length:result.event||result.publication?1:null
      send(200, {contract: ECR_CONTRACT, ...result})
    } catch (error) {
      if (error instanceof CalendarError) send(error.status, {error: {code: error.code}})
      else if (isOperationDenied(error) || error instanceof OperationDenied && String(error.reasonCode) === 'IDENTITY_REQUIRED') send(['IDENTITY_REQUIRED', 'UNVERIFIED_IDENTITY'].includes(error.reasonCode) ? 401 : ['POLICY_UNAVAILABLE', 'AUDIT_UNAVAILABLE'].includes(error.reasonCode) ? 503 : 403, {error: {code: error.reasonCode}})
      else send(503, {error: {code: 'CALENDAR_UNAVAILABLE'}})
    } finally {try {report({event: 'calendar_api', applicationId:configuration.applicationId,environment:configuration.environment,sourceSha:configuration.deploymentId,operation, status,recordsReturned,databaseOperationMs,acquisitionPath:'LOCAL_ECR_STORE',durationMs: Math.round((performance.now() - started) * 100) / 100})} catch {}}
  })
  server.requestTimeout = 20000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000; server.maxHeadersCount = 50
  return server
}
