import type {PoolClient} from 'pg'
import {isCompanyReportRestricted} from '@profitia/srm-xray'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import {prepareCompanyReport,PREPARED_REPORT_VERSION,type PreparedCompanyReport} from './ready-report'
import type {FinancialSourceDocument} from './financial-documents'
import type {CalculatedFinancialIndicator} from './financial-indicators'
import type {ReportReadRow} from './report-data'

/** Runs only inside the original admitted corporate Source publication. The
 * SQL port independently requires that exact publication and its outcome.
 * Raw source documents are consumed here and never persisted in this view. */
export async function writeReadyCompanyReport(client:PoolClient,nip:string,effectId:string,
 indicators:CalculatedFinancialIndicator[],documents:readonly FinancialSourceDocument[],schemaDigest:string):Promise<PreparedCompanyReport|undefined>{
 const row=(await client.query<ReportReadRow&{general_json:PreparedCompanyReport['general'];general_sha256:string;
  general_source_snapshot_id:string;financial_source_snapshot_id:string}>(
  `SELECT c.nip,c.financial_json,c.financial_sha256,c.financial_checked_at,
   coalesce((SELECT jsonb_agg(jsonb_build_object('metricCode',metric_code,'periodStart',period_start::text,'periodEnd',period_end::text,
    'statementScope',statement_scope,'amount',amount::text,'sourceAmount',source_amount::text,'currencyCode',currency_code,'unitCode',unit_code,
    'sourcePath',source_path,'validationStatus',validation_status,'normalizationRule',normalization_rule,'sourceSnapshotId',source_snapshot_id::text))
    FROM srm.catalog_financial_facts WHERE nip=c.nip),'[]'::jsonb) AS facts,c.general_json,c.general_sha256,c.general_source_snapshot_id,c.financial_source_snapshot_id,NULL::jsonb AS kys
   FROM srm.catalog_companies c WHERE c.nip=$1`,[nip])).rows[0]
 if(!row?.general_json?.data||isCompanyReportRestricted(row.general_json.data)||!row.financial_sha256
  ||!row.general_source_snapshot_id||!row.financial_source_snapshot_id
  ||!['SUCCESS','PARTIAL','EMPTY'].includes(row.financial_json?.status??''))return undefined
 // Use the one canonical calculation already written by this publication.
 const body=prepareCompanyReport({general:row.general_json,row:{...row,indicators},documents,sources:{
  generalHash:row.general_sha256,financialHash:row.financial_sha256,
  generalEffectId:row.general_source_snapshot_id,financialEffectId:row.financial_source_snapshot_id}})
 const result=await client.query('SELECT srm.publish_ready_report($1,$2::uuid,$3,$4,$5) AS published',
  [nip,effectId,JSON.stringify(body),schemaDigest,PREPARED_REPORT_VERSION])
 if(result.rows[0]?.published!==true)throw new OperationDenied('POLICY_UNAVAILABLE')
 return body
}
