import { createHash } from 'node:crypto'
import { OperationDenied, operationPayloadDigest, type Json } from '@profitia/platform-contracts/operation-context'
import { bindOrganizationTransaction } from './db'
import { createLookup } from './xray-repository'
import { persistSection } from './xray-lookup'
import { saveMgbiArchive } from './mgbi-archive'
import { saveFinancialDocuments } from './financial-documents'
import type { MgbiGeneralResult } from './mgbi-general'
import type { MgbiFinancialResult } from './mgbi-financial'
import { readSupplierRequest } from './supplier-request-operation'
import type { createSrmSupplierRequestContinuation, SupplierPrivatePhaseInput } from './supplier-request-continuation'

export const SUPPLIER_PRIVATE_STORE_VERSION = 'srm-supplier-private-store-v1'
export const MAX_PRIVATE_SUPPLIER_RESULT_BYTES = 32 * 1024 * 1024
type Continuation = ReturnType<typeof createSrmSupplierRequestContinuation>
type Selection = Omit<SupplierPrivatePhaseInput, 'phaseId' | 'data'>
type General = Pick<MgbiGeneralResult, 'section' | 'errorCode' | 'rawResponse'>
type Financial = Pick<MgbiFinancialResult, 'section' | 'errorCode' | 'facts' | 'sourceData' | 'rawResponse'>
const refuse = (): never => { throw new OperationDenied('RESOURCE_SCOPE_MISMATCH') }
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

/** Server-owned, immutable capture. Large complete archives remain private;
 * the small phase manifest binds their exact bytes without duplicating them in
 * the common audit/ledger. No provider response is returned by this writer. */
function capture<T>(input: T, keys: string[]): { value: T; digest: string } {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype
    || Object.keys(input).some(k => !keys.includes(k))) return refuse()
  let text: string
  try { text = JSON.stringify(input) } catch { return refuse() }
  if (!text || Buffer.byteLength(text) > MAX_PRIVATE_SUPPLIER_RESULT_BYTES) return refuse()
  const value: T = freeze(JSON.parse(text))
  return { value, digest: createHash('sha256').update(text).digest('hex') }
}

/** Existing domain writers, one existing native transaction, no new pool,
 * queue, provider client, catalogue writer or demo-user identity. Acquisition
 * happens outside this adapter; the common host rechecks rights at each write. */
export function createSrmSupplierPrivateStore(options: { continuation: Continuation; boundaryDigest: string }) {
  if (typeof window !== 'undefined' || !/^[a-f0-9]{64}$/.test(options.boundaryDigest)
    || typeof options.continuation?.run !== 'function') throw new TypeError('Explicit private business continuation required')
  const { boundaryDigest } = options
  const runContinuation = options.continuation.run.bind(options.continuation)
  async function run(selection: Selection, phaseId: 'REGISTER_LOOKUP' | 'STORE_GENERAL' | 'STORE_FINANCIAL',
    body: General | Financial | null) {
    if (!selection || Object.getPrototypeOf(selection) !== Object.prototype
      || Object.keys(selection).sort().join(',') !== 'command,idempotencyKey,organisationId,request,requestId') return refuse()
    const command = readSupplierRequest(selection.command)
    const base = { requestId: selection.requestId, organisationId: selection.organisationId,
      idempotencyKey: selection.idempotencyKey, request: selection.request, command }
    const captured = body === null ? { value: null, digest: operationPayloadDigest(null) }
      : capture(body, phaseId === 'STORE_GENERAL' ? ['section','errorCode','rawResponse'] : ['section','errorCode','facts','sourceData','rawResponse'])
    const data: Json = { version: SUPPLIER_PRIVATE_STORE_VERSION, nip: command.nip, bodyDigest: captured.digest }
    return runContinuation({ ...base, phaseId, data }, async (context, client, manifest) => {
      if (JSON.stringify(manifest) !== JSON.stringify(data) || context.requestContinuation?.phaseId !== phaseId) return refuse()
      const descriptor = (await client.query('SELECT srm.supplier_business_descriptor() AS descriptor')).rows[0]?.descriptor
      if (descriptor?.businessSchemaVersion !== '1.0.0' || descriptor.businessBoundaryDigest !== boundaryDigest
        || descriptor.applicationId !== 'srm' || !/^[a-f0-9]{40}$/.test(descriptor.businessSourceRef ?? '')) return refuse()
      await client.query("SELECT set_config('srm.organization_id',$1,true)", [context.organisationId])
      const pool = bindOrganizationTransaction(context.organisationId!, client)
      if (phaseId === 'REGISTER_LOOKUP') {
        await createLookup(context.organisationId!, { type: 'NIP', value: command.nip }, 'COMPANY', pool, base.requestId)
        return
      }
      const rows = (await client.query<{ supplier_id: string }>(
        "SELECT l.supplier_id FROM srm.lookup_requests l JOIN srm.suppliers s ON s.organization_id=l.organization_id AND s.id=l.supplier_id WHERE l.organization_id=$1::uuid AND l.id=$2::uuid AND l.identifier_type='NIP' AND l.identifier=$3 AND l.entity_type='COMPANY' AND s.nip=$3",
        [context.organisationId, base.requestId, command.nip],
      )).rows
      if (rows.length !== 1 || !captured.value) return refuse()
      const body = captured.value, section = body.section
      if (!section || section.source?.provider !== 'MGBI' || section.source.model !== (phaseId === 'STORE_GENERAL' ? 'pl-krs-wp-record' : 'pl-krs-rdf-record')
        || !Array.isArray(section.warnings) || !['SUCCESS','PARTIAL','EMPTY','ERROR','NOT_REQUESTED'].includes(section.status)
        || !(body.errorCode === null || typeof body.errorCode === 'string')) return refuse()
      if (body.rawResponse) {
        if (!section.retrievedAt) return refuse()
        await saveMgbiArchive(context.organisationId!, command.nip, section.source.model as 'pl-krs-wp-record' | 'pl-krs-rdf-record',
          body.rawResponse.pages, body.rawResponse.recordCount, section.retrievedAt, base.requestId, pool)
        if (phaseId === 'STORE_FINANCIAL') await saveFinancialDocuments(context.organisationId!, command.nip, body.rawResponse.pages, pool)
      }
      const lookup = { supplierId: rows[0].supplier_id, requestId: base.requestId }
      if (phaseId === 'STORE_GENERAL') {
        const general = body as General
        if (general.section.data?.nip && general.section.data.nip !== command.nip) return refuse()
        await persistSection(context.organisationId!, lookup, 'general', general.section, general.errorCode, [], undefined, undefined, 'PROVIDER', pool)
      } else {
        const financial = body as Financial
        if (!Array.isArray(financial.facts)) return refuse()
        await persistSection(context.organisationId!, lookup, 'financial', financial.section, financial.errorCode,
          financial.facts, undefined, financial.sourceData, 'PROVIDER', pool)
      }
    })
  }
  return Object.freeze({
    register: (selection: Selection) => run(selection, 'REGISTER_LOOKUP', null),
    general: (selection: Selection, result: General) => run(selection, 'STORE_GENERAL', result),
    financial: (selection: Selection, result: Financial) => run(selection, 'STORE_FINANCIAL', result),
  })
}
