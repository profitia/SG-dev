import type { PrismaClient } from '@/generated/market-data-client'
import { BenchmarkAppError } from '@/lib/benchmark/errors'
import { readStoredMarketHistory } from '@/lib/market-data/stored-read'
import { normalizeForecastSourceFrequency } from './cadence'
import { buildRollingDailyHistoryFingerprint, ROLLING_DAILY_INPUT_SOURCE } from './rolling-daily-maintenance'
import { readRollingDailyCurrentForecastSnapshot } from './rolling-daily-current-forecast-snapshot'
import { readStoredPeriodCurrent } from './stored-period-current'
import { periodCurrentUnavailable } from '@/lib/platform/period-forecast-current'
import { ForecastCurrentSelection, currentForecastUnavailable, validatePublicForecastCurrent,
  type ForecastCurrentSelectionValue, type StoredCurrentForecastResult } from '@/lib/platform/forecast-current'

export type StoredForecastBinding = Readonly<{
  projectId: string; branchId: string; databaseName: string; role: string
  schemaDigest: string; marketSchemaDigest: string
}>
const OWNER = 'profitia_forecast_read_owner'
const unavailable = () => new BenchmarkAppError('STORED_FORECAST_SOURCE_UNAVAILABLE', 'Stored forecast source unavailable.', 503)

/** Genuine generated ORM against a closed read view. History and artifact share
 * one bounded, repeatable, read-only source transaction. No provider, compute,
 * Python, file, job, private-store or mutating fallback is invoked. */
export function createStoredCurrentForecastReader(prisma: Pick<PrismaClient, '$transaction'>, input: StoredForecastBinding) {
  const binding = Object.freeze({ ...input })
  if (!['schemaDigest', 'marketSchemaDigest'].every(key => /^[a-f0-9]{64}$/.test(binding[key as keyof StoredForecastBinding]))
    || !['projectId', 'branchId', 'databaseName', 'role'].every(key => typeof binding[key as keyof StoredForecastBinding] === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(binding[key as keyof StoredForecastBinding]))
    || [OWNER, 'profitia_market_read_owner'].includes(binding.role)) throw new TypeError('Explicit stored forecast binding required')

  return async (value: ForecastCurrentSelectionValue): Promise<StoredCurrentForecastResult> => {
    const parsed = ForecastCurrentSelection.safeParse(value)
    if (!parsed.success) throw new BenchmarkAppError('VALIDATION_ERROR', 'Invalid stored forecast selection.', 400)
    const selection = parsed.data
    try {
      return await prisma.$transaction(async transaction => {
        await transaction.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
        await transaction.$executeRawUnsafe('SET LOCAL search_path=profitia_forecast_read,pg_catalog,pg_temp')
        await transaction.$executeRawUnsafe("SET LOCAL statement_timeout='4000ms'")
        await transaction.$executeRawUnsafe("SET LOCAL lock_timeout='2000ms'")
        const records = await transaction.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT
          current_user::text AS role,session_user::text AS login,pg_catalog.current_database() AS database_name,
          pg_catalog.current_setting('transaction_read_only') AS read_only,pg_catalog.current_setting('transaction_isolation') AS isolation,
          r.rolreplication,r.rolsuper,r.rolbypassrls,r.rolinherit,r.rolcreatedb,r.rolcreaterole,r.rolcanlogin,r.rolconnlimit,
          EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=r.oid) AS member_of_role,
          pg_catalog.has_database_privilege(current_user,pg_catalog.current_database(),'CREATE') AS database_create,
          pg_catalog.has_schema_privilege(current_user,'public','CREATE') AS public_create,
          pg_catalog.has_schema_privilege(current_user,'profitia_market_read','CREATE') AS market_create,
          pg_catalog.has_schema_privilege(current_user,'profitia_forecast_read','CREATE') AS forecast_create,
          (SELECT nspowner::pg_catalog.regrole::text FROM pg_catalog.pg_namespace WHERE nspname='profitia_forecast_read') AS schema_owner,
          (SELECT count(*)::int FROM pg_catalog.pg_roles o WHERE o.rolname IN('profitia_forecast_read_owner','profitia_market_read_owner')
            AND NOT(o.rolreplication OR o.rolcanlogin OR o.rolinherit OR o.rolsuper OR o.rolbypassrls OR o.rolcreatedb OR o.rolcreaterole)
            AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=o.oid)) AS controlled_owners,
          (SELECT count(*)::int FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE
            (n.nspname='profitia_forecast_read' AND c.relowner::pg_catalog.regrole::text='profitia_forecast_read_owner' AND
              ((c.relname='installation' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity)
              OR(c.relname IN('rolling_daily_current_forecast_snapshots','forecast_current_runs','forecast_current_points') AND c.relkind='v' AND 'security_barrier=true'=ANY(c.reloptions))))
            OR(n.nspname='profitia_market_read' AND c.relname IN('series','observations') AND c.relkind='v'
              AND c.relowner::pg_catalog.regrole::text='profitia_market_read_owner' AND 'security_barrier=true'=ANY(c.reloptions))) AS controlled_objects,
          (SELECT count(*)::int FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
            JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE n.nspname='profitia_forecast_read'
            AND p.proname IN('pick_fields','public_model_parameters','project_payload','project_period_metadata') AND NOT p.prosecdef AND p.provolatile='i'
            AND p.proowner::pg_catalog.regrole::text='profitia_forecast_read_owner' AND l.lanname='sql'
            AND pg_catalog.has_function_privilege(current_user,p.oid,'EXECUTE')) AS controlled_helpers,
          (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_catalog.pg_enum e
            JOIN pg_catalog.pg_type t ON t.oid=e.enumtypid JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
            WHERE n.nspname='profitia_forecast_read' AND t.typname='ForecastTargetBasis'
            AND t.typowner::pg_catalog.regrole::text='profitia_forecast_read_owner') AS target_basis_values,
          EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname NOT IN('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
            AND c.relkind IN('r','p','v','m','f') AND (pg_catalog.has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
              OR pg_catalog.has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
            AND NOT((n.nspname='profitia_forecast_read' AND c.relname IN('installation','rolling_daily_current_forecast_snapshots','forecast_current_runs','forecast_current_points'))
              OR(n.nspname='profitia_market_read' AND c.relname IN('series','observations')))) AS other_table_access,
          EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname IN('profitia_forecast_read','profitia_market_read') AND c.relkind IN('r','p','v','m','f')
            AND (pg_catalog.has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,SELECT WITH GRANT OPTION')
              OR pg_catalog.has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE,REFERENCES,SELECT WITH GRANT OPTION'))) AS source_write,
          EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef
            AND n.nspname NOT IN('pg_catalog','information_schema') AND pg_catalog.has_schema_privilege(current_user,n.oid,'USAGE')
            AND pg_catalog.has_function_privilege(current_user,p.oid,'EXECUTE')) AS definer_access
          FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`)
        const actual = records[0]
        if (records.length !== 1 || !actual || actual.role !== binding.role || actual.login !== binding.role
          || actual.database_name !== binding.databaseName || actual.read_only !== 'on' || actual.isolation !== 'repeatable read'
          || actual.rolcanlogin !== true || actual.rolconnlimit !== 1 || actual.schema_owner !== OWNER
          || actual.controlled_owners !== 2 || actual.controlled_objects !== 6 || actual.controlled_helpers !== 4
          || !Array.isArray(actual.target_basis_values) || actual.target_basis_values.join(',') !== 'MONTHLY_AVERAGE,END_OF_PERIOD,POINT_IN_TIME'
          || ['rolreplication', 'rolsuper', 'rolbypassrls', 'rolinherit', 'rolcreatedb', 'rolcreaterole', 'member_of_role',
            'database_create', 'public_create', 'market_create', 'forecast_create', 'other_table_access', 'source_write', 'definer_access'].some(key => actual[key] !== false)) throw unavailable()

        const receipts = await transaction.$queryRawUnsafe<Array<{
          schema_version: string; schema_digest: string; market_schema_digest: string; project_id: string; branch_id: string
          database_name: string; runtime_role: string; source_ref: string; expires_at: Date
        }>>('SELECT schema_version,schema_digest,market_schema_digest,project_id,branch_id,database_name,runtime_role::text,source_ref,expires_at FROM profitia_forecast_read.installation WHERE singleton')
        const receipt = receipts[0]
        if (receipts.length !== 1 || !receipt || receipt.schema_version !== '2.0.0' || receipt.schema_digest !== binding.schemaDigest
          || receipt.market_schema_digest !== binding.marketSchemaDigest || receipt.project_id !== binding.projectId
          || receipt.branch_id !== binding.branchId || receipt.database_name !== binding.databaseName || receipt.runtime_role !== binding.role
          || typeof receipt.source_ref !== 'string' || !receipt.source_ref.length || receipt.source_ref.length > 256
          || /gh[pousr]_|sk_(?:live|test)_|postgres(?:ql)?:\/\/|Bearer\s/i.test(receipt.source_ref)
          || !(receipt.expires_at instanceof Date) || receipt.expires_at.getTime() <= Date.now()) throw unavailable()

        let history
        try { history = (await readStoredMarketHistory(transaction, selection.seriesId)).history }
        catch (error) {
          if (error instanceof BenchmarkAppError && error.code === 'STORED_HISTORY_NOT_AVAILABLE') return selection.targetBasis === 'POINT_IN_TIME'
            ? currentForecastUnavailable(selection, 'MISS') : periodCurrentUnavailable(selection)
          throw error
        }
        if (selection.targetBasis !== 'POINT_IN_TIME') {
          const result = await readStoredPeriodCurrent(transaction, history, selection)
          await validatePublicForecastCurrent(result, selection)
          if (receipt.expires_at.getTime() <= Date.now()) throw unavailable()
          return result
        }
        if (normalizeForecastSourceFrequency(history.frequency) !== 'DAILY') return currentForecastUnavailable(selection, 'MISS')
        const fingerprint = buildRollingDailyHistoryFingerprint({ seriesId: selection.seriesId, displayName: history.displayName,
          description: history.displayName, frequency: 'DAILY', source: history.source, points: history.historical })
        const snapshot = await readRollingDailyCurrentForecastSnapshot({ seriesId: selection.seriesId, modelId: selection.modelId,
          sourceHistoryFingerprint: fingerprint }, { prisma: transaction })
        const result = snapshot.status === 'HIT' ? snapshot.payload : currentForecastUnavailable(selection, snapshot.status)
        if (snapshot.status === 'HIT' && (snapshot.payload.audit.sourceHistoryFingerprint !== fingerprint
          || snapshot.payload.audit.inputSource !== ROLLING_DAILY_INPUT_SOURCE)) throw unavailable()
        await validatePublicForecastCurrent(result, selection)
        if (receipt.expires_at.getTime() <= Date.now()) throw unavailable()
        return result
      }, { timeout: 5000, maxWait: 3000 })
    } catch (error) {
      if (error instanceof BenchmarkAppError) throw error
      throw unavailable()
    }
  }
}
