import type { PoolClient } from 'pg'
import { readSharedFinancialSummary } from '@profitia/srm-xray/shared-financial-summary'
import { isRestrictedRegistrationStatus, type GeneralCompanyData } from '@profitia/srm-xray'
import type { OperationContext } from '@profitia/platform-contracts/operation-context'
import { OperationDenied } from '@profitia/platform-contracts/operation-context'
import { FINANCIAL_INDICATOR_FORMULA_VERSION } from './financial-indicators'
import { projectReportData, REPORT_SHARED_FINANCIAL_SELECT, validateReportSelection, type ReportReadRow, type ReportSelection } from './report-data'

export const NO_STORED_FINANCIAL_SOURCE = 'no-stored-financial-evidence-v1'
// The shared projection reads only the three corporate catalog tables. The
// unused organisation column types the existing $2 parameter without selecting
// any private data. No archive, KYS, document or scanner-frame query is run.
export const SHARED_FINANCIAL_READ_SQL = `${REPORT_SHARED_FINANCIAL_SELECT},
  c.general_json#>>'{data,registrationStatus}' AS registration_status, NULL::jsonb AS kys
FROM (VALUES ($1::text,$2::uuid)) requested(nip,organisation_id)
LEFT JOIN srm.catalog_companies c ON c.nip=requested.nip AND $3='COMPANY'`

export async function readSharedFinancialReport(client: Pick<PoolClient, 'query'>, organisationId: string,
  selection: ReportSelection, expectedVersion: string, now = new Date(), env: Readonly<Record<string, string | undefined>> = {}) {
  const result = await client.query<ReportReadRow & { registration_status?: GeneralCompanyData['registrationStatus'] }>(
    SHARED_FINANCIAL_READ_SQL, [selection.nip, organisationId, selection.entityType, FINANCIAL_INDICATOR_FORMULA_VERSION])
  const row = result.rows[0]
  if (!row || row.nip !== selection.nip || (row.financial_sha256 ?? NO_STORED_FINANCIAL_SOURCE) !== expectedVersion) {
    throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  }
  if (row.financial_json && !/^[a-f0-9]{64}$/.test(row.financial_sha256 ?? '')) throw new OperationDenied('POLICY_UNAVAILABLE')
  // Current shared catalog status only. This port does not inspect another
  // organisation's private archive or claim that such an inspection happened.
  const source: ReportReadRow = isRestrictedRegistrationStatus(row.registration_status)
    ? { nip: selection.nip, financial_json: null, financial_sha256: null, financial_checked_at: null, facts: [], indicators: [], kys: null }
    : { ...row, scanner_documents: [], kys: null }
  const report = projectReportData(selection, source, now, env)
  // Scanner requires separately authorized source documents. No synthesized
  // scanner, private reference frame, export or preference scope leaves here.
  delete report.financial.scanner
  return report
}

/** Output fence over the existing allowlisted business projector, not a second
 * implementation of financial facts, formulas or quality decisions. */
export async function projectSharedFinancialResponse(value: unknown, context: OperationContext): Promise<Response> {
  const reject = (): never => { throw new OperationDenied('RESOURCE_SCOPE_MISMATCH') }
  if (!(value instanceof Response) || value.status !== 200
    || value.headers.get('Cache-Control') !== 'private, no-store' || value.headers.get('Vary') !== 'Cookie, Authorization'
    || value.headers.get('Content-Type') !== 'application/json'
    || [...value.headers.keys()].some(key => !['cache-control', 'vary', 'content-type'].includes(key))) reject()
  const response = value as Response
  let body: Record<string, unknown>
  try { body = await response.clone().json() } catch { return reject() }
  try { readSharedFinancialSummary(body, validateReportSelection(context.payload)) }
  catch { return reject() }
  return response
}
