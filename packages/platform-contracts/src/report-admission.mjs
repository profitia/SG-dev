import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomBytes } from 'node:crypto'
import { OperationDenied } from './operation-context.mjs'

export const REPORT_ADMISSION_CONTRACT = Object.freeze({ id: 'profitia.form-report-admission', version: '1.0.0', schemaVersion: '1.0.0' })
export const reportAdmissionSchemaUrl = new URL('../migrations/access/025-form-report-admission.sql', import.meta.url).href
// Next/Node can load the accepted package through both ESM and CommonJS.
// Share only request-local bookkeeping and non-enumerable weak brands, never
// a cached user, account status or ALLOW decision. Every HTTP proof is loaded
// through the ordinary SQL receiver; unrelated async requests have no scope.
const internalsKey=Symbol.for('profitia.form-report-admission.request-internals/1.0.0')
if(!Object.hasOwn(globalThis,internalsKey))Object.defineProperty(globalThis,internalsKey,
  {value:Object.freeze({scope:new AsyncLocalStorage(),proofs:new WeakMap(),observations:new WeakSet()})})
const {scope,proofs,observations}=globalThis[internalsKey]
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const digest = /^[a-f0-9]{64}$/
const deny = () => { throw new OperationDenied('ACCESS_BASIS_INVALID') }
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }
const hash = value => createHash('sha256').update(value).digest('hex')
const tokenParts = value => {
  if (typeof value !== 'string' || !/^fr1\.[a-f0-9-]{36}\.[a-f0-9]{64}$/i.test(value)) return deny()
  const [, id, secret] = value.split('.')
  if (!uuid.test(id)) return deny()
  return { id, secret }
}

/** Process-owned evidence, obtained only from the ordinary-role SQL store.
 * The browser carries an opaque, short-lived capability, never an Actor/ALLOW.
 * It authorizes one admitted NIP report, not a future unrelated request. */
export function currentReportAdmission() { return scope.getStore()?.proof ?? null }
export function reportAdmissionEvidence(value) { return proofs.get(value)?.public ?? null }
export function admittedReportObservation(value) { return observations.has(value) ? value : null }
export function withoutReportAdmission(action) { return scope.run(undefined, action) }

export function createReportAdmissionStore({ binding, schemaDigest, now = Date.now }) {
  const b = freeze(structuredClone(binding))
  if (!b || b.environment!=='development' || !digest.test(schemaDigest ?? '') || !['applicationId', 'environment', 'projectId', 'branchId', 'databaseName', 'role'].every(k => typeof b[k] === 'string' && b[k]) || typeof now !== 'function') throw TypeError('Explicit accepted Development report-admission binding required')
  const queryOne = async (query, sql, values = []) => {
    const result = await query(sql, values)
    if (!Array.isArray(result?.rows) || result.rows.length !== 1) return deny()
    return result.rows[0]
  }
  const descriptor = async query => {
    const d = (await queryOne(query, 'SELECT profitia_report_admission.runtime_descriptor() AS descriptor')).descriptor
    if (!d || d.schemaVersion !== REPORT_ADMISSION_CONTRACT.schemaVersion || d.schemaDigest !== schemaDigest || ['applicationId', 'environment', 'projectId', 'branchId', 'databaseName', 'role'].some(k => d[k] !== b[k])) return deny()
    return d
  }
  const own = proof => {
    const p = proofs.get(proof)
    if (!p || p.public.schemaDigest !== schemaDigest || p.public.environment !== b.environment
      || ['projectId','branchId','databaseName'].some(k=>p.binding[k]!==b[k]) || !(Date.parse(p.public.expiresAt) > now())) return deny()
    return p
  }
  return Object.freeze({
    contract: REPORT_ADMISSION_CONTRACT,
    async issue(query, { requestId, nip }) {
      if (!uuid.test(requestId ?? '') || !/^\d{10}$/.test(nip ?? '')) return deny()
      await descriptor(query)
      const secret = randomBytes(32).toString('hex')
      const r = (await queryOne(query, 'SELECT profitia_report_admission.issue($1::uuid,$2,$3) AS admission', [requestId, nip, hash(secret)])).admission
      if (!r || !uuid.test(r.id ?? '') || r.requestId !== requestId || r.nip !== nip || !(Date.parse(r.readyUntil) > now()) || !(Date.parse(r.expiresAt) >= Date.parse(r.readyUntil))) return deny()
      return Object.freeze({ token: `fr1.${r.id}.${secret}`, nip, readyUntil: r.readyUntil, expiresAt: r.expiresAt })
    },
    async load(query, token) {
      const { id, secret } = tokenParts(token)
      await descriptor(query)
      const r = (await queryOne(query, 'SELECT profitia_report_admission.read($1::uuid,$2) AS admission', [id, hash(secret)])).admission
      if (!r || r.id !== id || r.schemaDigest !== schemaDigest || r.applicationId !== b.applicationId || r.environment !== b.environment || !uuid.test(r.requestId ?? '') || !uuid.test(r.organisationId ?? '') || !uuid.test(r.userId ?? '') || !/^\d{10}$/.test(r.nip ?? '') || !digest.test(r.payloadDigest ?? '') || !(Date.parse(r.expiresAt) > now()) || !['PREPARED', 'RUNNING', 'COMPLETE'].includes(r.status)) return deny()
      const proof = Object.freeze({ id, requestId: r.requestId, nip: r.nip })
      proofs.set(proof, { public: freeze(structuredClone(r)), secretHash: hash(secret),binding:b,started:false })
      return proof
    },
    async run(proof, request, action) {
      if(!own(proof).started)return deny()
      if (!(request instanceof Request) || typeof action !== 'function' || scope.getStore()) return deny()
      request.signal.throwIfAborted()
      return scope.run({ proof, request }, action)
    },
    async start(query,proof) {
      const p=own(proof)
      if(scope.getStore())return deny()
      await descriptor(query)
      if((await queryOne(query,'SELECT profitia_report_admission.start($1::uuid,$2) AS allowed',[p.public.id,p.secretHash])).allowed!==true)return deny()
      p.started=true
    },
    async bindHuman(query, proof, request) {
      const p = own(proof)
      if (scope.getStore()?.proof !== proof || !['supplier.report.read', 'supplier.report.project'].includes(request.operation) || request.organisationId !== p.public.organisationId) return deny()
      await descriptor(query)
      const r = (await queryOne(query, 'SELECT profitia_report_admission.bind_human($1::uuid,$2,$3,$4,$5) AS admission', [p.public.id, p.secretHash, request.operation, request.resourceId, request.payloadDigest])).admission
      if (!r || r.admissionId !== p.public.id || r.state?.access?.actorId !== p.public.userId || r.state?.access?.organisationId !== p.public.organisationId || r.state?.applicationId !== b.applicationId) return deny()
      return freeze(r)
    },
    async bindJob(query, proof, requestId) {
      const p = own(proof)
      if (scope.getStore()?.proof !== proof || p.public.requestId !== requestId) return deny()
      await descriptor(query)
      if ((await queryOne(query, 'SELECT profitia_report_admission.bind_job($1::uuid,$2,$3::uuid) AS allowed', [p.public.id, p.secretHash, requestId])).allowed !== true) return deny()
    },
    async appendJobIntent(query,proof,event) {
      const p=own(proof)
      if(scope.getStore()?.proof!==proof || event.phase!=='INTENT' || event.decision!=='ALLOW'
        || event.resourceId!==p.public.requestId || event.organisationId!==p.public.organisationId
        || event.payloadDigest!==p.public.payloadDigest)return deny()
      await descriptor(query)
      const encoded=JSON.stringify(event);if(Buffer.byteLength(encoded)>16384)return deny()
      if((await queryOne(query,'SELECT true AS recorded FROM profitia_report_admission.append_job_intent($1::uuid,$2,$3::jsonb)',
        [p.public.id,p.secretHash,encoded])).recorded!==true)return deny()
    },
    jobObservation(state) {
      const proof = currentReportAdmission(), p = own(proof)
      const d = state?.delegation, a = d?.reportAdmission
      if (!a || a.id !== p.public.id || a.schemaDigest !== schemaDigest || a.requestId !== p.public.requestId || d.jobId !== p.public.requestId || d.subjectUserId !== p.public.userId || d.organisationId !== p.public.organisationId || d.payloadDigest !== p.public.payloadDigest || !(Date.parse(a.expiresAt) > now()) || Date.parse(a.expiresAt) > Date.parse(p.public.expiresAt)) return deny()
      const observation = freeze(structuredClone(a)); observations.add(observation); return observation
    },
    actor(proof) {
      const p = own(proof)
      return freeze({ kind: 'HUMAN', actorId: p.public.userId, userId: p.public.userId, proofRef: `admitted-report:${p.public.id}`, issuer: p.public.identity.issuer, audience: p.public.applicationId, environment: p.public.environment, expiresAt: p.public.expiresAt })
    },
  })
}

export async function reportAdmissionSchemaDigest() {
  const fs = await import('node:fs')
  return createHash('sha256').update(fs.readFileSync(new URL(reportAdmissionSchemaUrl))).digest('hex')
}
export async function reportAdmissionSourceDigest() {
  const fs = await import('node:fs')
  return createHash('sha256').update(fs.readFileSync(new URL('./report-admission.mjs', import.meta.url))).update(fs.readFileSync(new URL('./report-admission.d.mts', import.meta.url))).update(fs.readFileSync(new URL(reportAdmissionSchemaUrl))).digest('hex')
}
