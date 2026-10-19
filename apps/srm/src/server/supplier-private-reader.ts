import { OperationDenied } from '@profitia/platform-contracts/operation-context'
import { bindOrganizationTransaction, withOrganization } from './db'
import { readPreparedFinancialDocuments, projectArchivedFinancialDocuments, type FinancialArchive } from './financial-documents'
import type { SupplierRequestInspection, SupplierPrivateInspectionSelection } from './supplier-request-inspection'

export const SUPPLIER_PRIVATE_READER_VERSION = 'srm-supplier-private-reader-v1'
type Selection = Omit<SupplierPrivateInspectionSelection, 'phaseId'>
const refuse = (): never => { throw new OperationDenied('RESOURCE_SCOPE_MISMATCH') }

/** Domain SELECTs under the shared current inspection fence. Prepared documents
 * are never restored here. Existing financial provenance checks remain in use. */
export function createSrmSupplierPrivateReader({ inspection }: { inspection: Readonly<SupplierRequestInspection> }) {
  if (typeof window !== 'undefined' || typeof inspection?.read !== 'function') throw TypeError('Explicit native Supplier inspection required')
  const read = <T>(selection: Selection, phaseId: SupplierPrivateInspectionSelection['phaseId'],
    action: (client: import('pg').PoolClient, selection: Selection) => Promise<T>) => {
    const selected = structuredClone(selection)
    return inspection.read({ ...selected, phaseId }, (context, client) =>
      withOrganization(selected.organisationId, c => action(c, selected), bindOrganizationTransaction(selected.organisationId, client, context)))
  }
  return Object.freeze({
    lookup: (selection: Selection) => read(selection, 'REGISTER_LOOKUP', async (client, selection) => {
      const rows = (await client.query<{ supplierId: string; requestId: string }>(
        'SELECT supplier_id AS "supplierId",id AS "requestId" FROM srm.lookup_requests WHERE organization_id=$1::uuid AND id=$2::uuid AND identifier=$3 AND entity_type=\'COMPANY\'',
        [selection.organisationId, selection.requestId, selection.command.nip])).rows
      if (rows.length !== 1) return refuse()
      return rows[0]
    }),
    snapshot: (selection: Selection, section: 'general' | 'financial') => {
      if (!['general','financial'].includes(section)) return refuse()
      return read(selection, section === 'general' ? 'STORE_GENERAL' : 'STORE_FINANCIAL', async (client, selection) => {
        const rows = (await client.query<{ snapshotId: string; supplierId: string; section: string }>(
          'SELECT snapshot.id AS "snapshotId",snapshot.supplier_id AS "supplierId",snapshot.section FROM srm.source_snapshots snapshot JOIN srm.provider_attempts a ON a.organization_id=snapshot.organization_id AND a.id=snapshot.attempt_id WHERE snapshot.organization_id=$1::uuid AND a.request_id=$2::uuid AND snapshot.section=$3',
          [selection.organisationId, selection.requestId, section])).rows
        if (rows.length > 1) return refuse()
        return rows[0] ?? null
      })
    },
    preparedDocuments: (selection: Selection) => read(selection, 'REGISTER_LOOKUP', (client, selection) =>
      readPreparedFinancialDocuments(client, selection.organisationId, selection.command.nip)),
    financialArchive: (selection: Selection) => read(selection, 'REGISTER_LOOKUP', async (client, selection) => {
      const rows = (await client.query<FinancialArchive>(
        "SELECT organization_id,nip,model,payload_json::text AS payload_text,payload_jsonb_sha256,record_count FROM srm.mgbi_source_archives WHERE organization_id=$1::uuid AND nip=$2 AND model='pl-krs-rdf-record'",
        [selection.organisationId, selection.command.nip])).rows
      if (!rows.length) return null
      if (rows.length !== 1) return refuse()
      projectArchivedFinancialDocuments(rows[0], selection.organisationId, selection.command.nip)
      return rows[0]
    }),
  })
}
