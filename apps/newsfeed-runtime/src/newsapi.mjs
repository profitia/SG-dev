import { NEWS_DISCOVERY_CONTRACT_VERSION } from '../../../packages/newsfeed-contracts/index.mjs';
import { CATEGORIES, LANGUAGES, SOURCE_COUNTRIES, HEADLINE_COUNTRIES, getCapabilities } from './capabilities.mjs';
import { compileTerms } from './query.mjs';

export class DiscoveryError extends Error {
  /** @param {string} code @param {string[]} fields @param {number|null} httpStatus @param {string|null} providerCode @param {number|null} retryAfterSeconds */
  constructor(code, fields = [], httpStatus = null, providerCode = null, retryAfterSeconds = null) {
    super(code); this.name = 'DiscoveryError'; this.code = code;
    this.fields = fields; this.httpStatus = httpStatus; this.providerCode = providerCode; this.retryAfterSeconds = retryAfterSeconds;
  }
  toJSON() { return { code: this.code, fields: this.fields, httpStatus: this.httpStatus, providerCode: this.providerCode, retryAfterSeconds: this.retryAfterSeconds }; }
}
const fail = (code, fields = []) => { throw new DiscoveryError(code, fields); };
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function keys(value, allowed) {
  if (!object(value)) fail('INVALID_CRITERIA');
  if (Object.keys(value).some(k => !allowed.includes(k))) fail('UNKNOWN_CRITERIA');
}
function text(value, field, maximum = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\x00-\x1f]/.test(value)) fail('INVALID_CRITERIA', [field]);
  return value.trim();
}
function choice(value, options, field) {
  if (!options.includes(value)) fail('UNSUPPORTED_CRITERIA', [field]);
  return value;
}
function list(value, field, maximum = 100) {
  if (!Array.isArray(value) || !value.length || value.length > maximum) fail('INVALID_CRITERIA', [field]);
  const values = value.map(v => text(v, field, 253));
  if (new Set(values).size !== values.length) fail('INVALID_CRITERIA', [field]);
  return values;
}
function domainList(value, field) {
  const values = list(value, field);
  if (values.some(v => !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(v))) fail('INVALID_CRITERIA', [field]);
  return values.join(',');
}
function date(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value.slice(0,10)) fail('INVALID_CRITERIA', [field]);
  return value;
}
function integer(value, field, max) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) fail('INVALID_CRITERIA', [field]);
  return value;
}
const searchKeys = ['mode','text','terms','fields','category','editionCountry','publisherIds','domains','excludedDomains','language','publishedAfter','publishedBefore','order','page','pageSize','eventLocation'];

/** @param {import('../../../packages/newsfeed-contracts/index.js').DiscoveryQuery} query */
export function prepareSearch(query) {
  keys(query, searchKeys);
  choice(query.mode, ['articles','headlines'], 'mode');
  const params = new URLSearchParams();
  const unsupported = query.mode === 'articles' ? ['category','editionCountry','eventLocation'] : ['terms','fields','domains','excludedDomains','language','publishedAfter','publishedBefore','order','eventLocation'];
  const present = unsupported.filter(k => query[k] !== undefined);
  if (present.length) fail('UNSUPPORTED_CRITERIA', present);
  if (query.mode === 'headlines' && query.publisherIds !== undefined && (query.editionCountry !== undefined || query.category !== undefined)) fail('INCOMPATIBLE_CRITERIA', ['publisherIds','editionCountry','category']);
  let expression = query.text === undefined ? '' : text(query.text, 'text');
  if (query.mode === 'headlines' && /\b(?:AND|OR|NOT)\b|[()"]|(?:^|\s)[+-]\S/.test(expression)) fail('UNSUPPORTED_CRITERIA', ['advancedText']);
  if (query.terms !== undefined) {
    let compiled;
    try { compiled = compileTerms(query.terms); } catch { fail('INVALID_CRITERIA', ['terms']); }
    expression = expression ? '(' + expression + ') AND (' + compiled + ')' : compiled;
  }
  if (expression) params.set('q', text(expression, 'text'));
  if (query.fields !== undefined) {
    const fieldMap = { headline: 'title', summary: 'description', body: 'content' };
    params.set('searchIn', list(query.fields, 'fields', 3).map(f => fieldMap[choice(f, Object.keys(fieldMap), 'fields')]).join(','));
    if (!expression) fail('INVALID_CRITERIA', ['fields','text']);
  }
  if (query.publisherIds !== undefined) {
    const ids = list(query.publisherIds, 'publisherIds', 20);
    if (ids.some(id => !/^[a-z0-9-]+$/.test(id))) fail('INVALID_CRITERIA', ['publisherIds']);
    params.set('sources', ids.join(','));
  }
  if (query.domains !== undefined) params.set('domains', domainList(query.domains, 'domains'));
  if (query.excludedDomains !== undefined) params.set('excludeDomains', domainList(query.excludedDomains, 'excludedDomains'));
  if (query.domains?.some(d => query.excludedDomains?.includes(d))) fail('INCOMPATIBLE_CRITERIA', ['domains','excludedDomains']);
  if (query.language !== undefined) params.set('language', choice(query.language, LANGUAGES, 'language'));
  if (query.category !== undefined) params.set('category', choice(query.category, CATEGORIES, 'category'));
  if (query.editionCountry !== undefined) params.set('country', choice(query.editionCountry, HEADLINE_COUNTRIES, 'editionCountry'));
  if (query.publishedAfter !== undefined) params.set('from', date(query.publishedAfter, 'publishedAfter'));
  if (query.publishedBefore !== undefined) params.set('to', date(query.publishedBefore, 'publishedBefore'));
  if (query.publishedAfter && query.publishedBefore && Date.parse(query.publishedAfter) > Date.parse(query.publishedBefore)) fail('INCOMPATIBLE_CRITERIA', ['publishedAfter','publishedBefore']);
  if (query.order !== undefined) params.set('sortBy', {newest:'publishedAt',relevance:'relevancy',publisherPopularity:'popularity'}[choice(query.order,['newest','relevance','publisherPopularity'],'order')]);
  const page = integer(query.page ?? 1, 'page', Number.MAX_SAFE_INTEGER);
  const pageSize = integer(query.pageSize ?? (query.mode === 'articles' ? 100 : 20), 'pageSize', 100);
  params.set('page', String(page)); params.set('pageSize', String(pageSize));
  if (query.mode === 'articles' && !expression && !query.publisherIds && !query.domains) fail('MISSING_CRITERIA', ['text','publisherIds','domains']);
  if (query.mode === 'headlines' && !expression && !query.publisherIds && !query.editionCountry && !query.category) fail('MISSING_CRITERIA', ['text','publisherIds','editionCountry','category']);
  return { endpoint: query.mode === 'articles' ? 'everything' : 'top-headlines', params, page, pageSize };
}

/** @param {import('../../../packages/newsfeed-contracts/index.js').PublisherQuery} query */
export function preparePublishers(query = {}) {
  keys(query, ['category','language','publisherCountry']);
  const params = new URLSearchParams();
  if (query.category !== undefined) params.set('category', choice(query.category, CATEGORIES, 'category'));
  if (query.language !== undefined) params.set('language', choice(query.language, LANGUAGES, 'language'));
  if (query.publisherCountry !== undefined) params.set('country', choice(query.publisherCountry, SOURCE_COUNTRIES, 'publisherCountry'));
  return params;
}

function nullableString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > 16384) fail('INVALID_RESPONSE');
  return value;
}
function safeUrl(value, required = false) {
  if (value === null || value === undefined) { if (required) fail('INVALID_RESPONSE'); return null; }
  if (typeof value !== 'string' || value.length > 4096) fail('INVALID_RESPONSE');
  try { const url = new URL(value); if (['https:','http:'].includes(url.protocol) && !url.username && !url.password) return value; } catch {}
  fail('INVALID_RESPONSE');
}
function timestamp(value) {
  const result = nullableString(value);
  if (result !== null && !Number.isFinite(Date.parse(result))) fail('INVALID_RESPONSE');
  return result;
}
function article(raw, mode, observedAt) {
  if (!object(raw) || !object(raw.source)) fail('INVALID_RESPONSE');
  return { url: safeUrl(raw.url, true), headline: nullableString(raw.title), summary: nullableString(raw.description), bodyPreview: nullableString(raw.content), imageUrl: safeUrl(raw.urlToImage), byline: nullableString(raw.author), publishedAt: timestamp(raw.publishedAt), discoveredAt: observedAt, publisher: { id: nullableString(raw.source.id), name: nullableString(raw.source.name) }, language: null, category: null, eventLocation: null, provenance: { provider: 'newsapi', mode, fullTextAvailable: false } };
}
function publisher(raw) {
  if (!object(raw)) fail('INVALID_RESPONSE');
  const id = nullableString(raw.id), name = nullableString(raw.name);
  if (!id || !name) fail('INVALID_RESPONSE');
  return { id, name, description: nullableString(raw.description), url: safeUrl(raw.url, true), category: nullableString(raw.category), language: nullableString(raw.language), publisherCountry: nullableString(raw.country) };
}
const providerCodes = ['apiKeyDisabled','apiKeyExhausted','apiKeyInvalid','apiKeyMissing','parameterInvalid','parametersMissing','rateLimited','sourcesTooMany','sourceDoesNotExist','unexpectedError','maximumResultsReached','parameterRequired','parameterValueInvalid'];
function providerError(status, payload, retryAfter) {
  const code = providerCodes.includes(payload?.code) ? payload.code : null;
  const kind = code === 'apiKeyExhausted' ? 'QUOTA_EXHAUSTED' : code === 'maximumResultsReached' ? 'PLAN_LIMIT' : status === 429 || code === 'rateLimited' ? 'RATE_LIMITED' : status === 401 || ['apiKeyDisabled','apiKeyInvalid','apiKeyMissing'].includes(code) ? 'AUTHENTICATION_FAILED' : status === 403 || status === 426 ? 'PLAN_RESTRICTED' : status >= 500 ? 'PROVIDER_UNAVAILABLE' : status === 400 || ['parameterInvalid','parametersMissing','sourcesTooMany','sourceDoesNotExist','parameterRequired','parameterValueInvalid'].includes(code) ? 'PROVIDER_REJECTED_CRITERIA' : 'PROVIDER_ERROR';
  return new DiscoveryError(kind, [], status, code, retryAfter);
}

/**
 * Operator-only Development connector. No listener, customer auth bypass, storage or automatic retry.
 * @param {{apiKey:string,targetEnvironment:'development',fetchImpl?:typeof fetch,timeoutMs?:number,onEvent?:(event:import('../../../packages/newsfeed-contracts/index.js').DiscoveryEvent)=>void|Promise<void>}} options
 * @returns {import('../../../packages/newsfeed-contracts/index.js').NewsDiscoveryProvider}
 */
export function createNewsApiProvider({apiKey,targetEnvironment,fetchImpl = fetch,timeoutMs = 15000,onEvent} = /** @type {any} */ ({})) {
  if (typeof window !== 'undefined' || targetEnvironment !== 'development') fail('DEVELOPMENT_ONLY');
  if (typeof apiKey !== 'string' || apiKey.trim().length < 8 || apiKey.length > 512 || /[\r\n]/.test(apiKey)) fail('INVALID_CONFIGURATION');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000 || typeof fetchImpl !== 'function') fail('INVALID_CONFIGURATION');
  const key = apiKey.trim();
  /** @param {number|null} httpStatus @param {number|null} count */
  function emit(operation, outcome, start, httpStatus = null, count = null) {
    try { Promise.resolve(onEvent?.({provider:'newsapi',operation,outcome,durationMs:Math.max(0,Math.round(performance.now()-start)),httpStatus,count})).catch(() => {}); } catch {}
  }
  async function execute(endpoint, params, operation, normalize) {
    const start = performance.now(); let status = null;
    const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const response = await fetchImpl('https://newsapi.org/v2/' + endpoint + '?' + params.toString(), { method:'GET',headers:{'X-Api-Key':key,Accept:'application/json'},redirect:'error',signal:abort.signal });
      status = response.status;
      if (!response.body) throw new DiscoveryError('INVALID_RESPONSE', [], status);
      const reader = response.body.getReader(); const chunks = []; let length = 0;
      while (true) { const {done,value} = await reader.read(); if (done) break; length += value.byteLength; if (length > 2*1024*1024) { await reader.cancel(); throw new DiscoveryError('RESPONSE_TOO_LARGE', [], status); } chunks.push(value); }
      let payload;
      try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw response.ok ? new DiscoveryError('INVALID_RESPONSE', [], status) : providerError(status, null, null); }
      const retryHeader = response.headers.get('retry-after');
      const retryAfter = retryHeader && /^\d{1,5}$/.test(retryHeader) ? Number(retryHeader) : null;
      if (!response.ok || payload?.status === 'error') throw providerError(status, payload, retryAfter);
      if (!object(payload) || payload.status !== 'ok') throw new DiscoveryError('INVALID_RESPONSE', [], status);
      const result = normalize(payload, new Date().toISOString());
      emit(operation,result.status,start,status,result.items.length); return result;
    } catch (error) {
      const safe = error instanceof DiscoveryError ? error : new DiscoveryError(abort.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR', [], status);
      if (safe.httpStatus === null) safe.httpStatus = status;
      emit(operation,safe.code,start,status); throw safe;
    } finally { clearTimeout(timer); }
  }
  return Object.freeze({
    getCapabilities,
    async search(query) {
      const plan = prepareSearch(query);
      const mode = query.mode;
      return execute(plan.endpoint,plan.params,mode,(payload,observedAt) => {
        if (!Number.isSafeInteger(payload.totalResults) || payload.totalResults < 0 || !Array.isArray(payload.articles) || payload.articles.length > plan.pageSize || payload.articles.length > payload.totalResults) fail('INVALID_RESPONSE');
        const items = payload.articles.map(raw => article(raw,mode,observedAt));
        return {contractVersion:NEWS_DISCOVERY_CONTRACT_VERSION,provider:'newsapi',status:items.length?'ok':'empty',mode,totalAvailable:payload.totalResults,items,page:plan.page,pageSize:plan.pageSize,moreResultsReported:plan.page*plan.pageSize<payload.totalResults,observedAt};
      });
    },
    async listPublishers(query = {}) {
      return execute('top-headlines/sources',preparePublishers(query),'publishers',(payload,observedAt) => {
        if (!Array.isArray(payload.sources) || payload.sources.length > 10000) fail('INVALID_RESPONSE');
        const items = payload.sources.map(publisher);
        return {contractVersion:NEWS_DISCOVERY_CONTRACT_VERSION,provider:'newsapi',status:items.length?'ok':'empty',items,observedAt};
      });
    },
  });
}
