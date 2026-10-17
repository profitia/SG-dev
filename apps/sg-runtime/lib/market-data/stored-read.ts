import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { BenchmarkAppError } from '@/lib/benchmark/errors';
import type { BenchmarkHistoricalSeriesResult } from '@/lib/benchmark/contracts';
import { MarketPreviewSelection, MAX_STORED_MARKET_POINTS } from '@/lib/platform/market-preview';
export type StoredMarketBinding = Readonly<{
    projectId: string;
    branchId: string;
    databaseName: string;
    role: string;
    schemaDigest: string;
}>;
const denied = (): never => { throw new BenchmarkAppError('STORED_SOURCE_UNAVAILABLE', 'Stored market source unavailable.', 503); };
const OWNER = 'profitia_market_read_owner';
const seriesSchema = z.object({ providerCode: z.literal('MACROBOND'), providerSeriesId: z.string().min(1).max(256),
    providerSeriesKey: z.string().max(256).nullable(), displayName: z.string().max(4096),
    frequency: z.string().max(4096).nullable(), currency: z.string().max(4096).nullable(),
    unit: z.string().max(4096).nullable(), sourceLabel: z.string().max(4096).nullable() }).strict();
/** Same native Prisma driver, separate ordinary source pool. No provider,
 * hydration repository, private data or mutating fallback is reachable here. */
export function createStoredMarketHistoryReader(prisma: Pick<PrismaClient, '$transaction'>, input: StoredMarketBinding) {
    const binding = Object.freeze({ ...input });
    if (!/^[a-f0-9]{64}$/.test(binding.schemaDigest) || !['projectId', 'branchId', 'databaseName', 'role'].every(key => {
        const value = binding[key as keyof StoredMarketBinding];
        return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
    }) || binding.role === OWNER)
        throw new TypeError('Explicit stored market binding required');
    return async (seriesName: string): Promise<{
        history: BenchmarkHistoricalSeriesResult;
    }> => {
        const selection = MarketPreviewSelection.safeParse({ seriesName, range: 'ALL' });
        if (!selection.success)
            throw new BenchmarkAppError('VALIDATION_ERROR', 'Invalid stored series selection.', 400);
        return prisma.$transaction(async (transaction) => {
            await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
            await transaction.$executeRawUnsafe('SET LOCAL search_path=pg_catalog,pg_temp');
            await transaction.$executeRawUnsafe("SET LOCAL statement_timeout='4000ms'");
            await transaction.$executeRawUnsafe("SET LOCAL lock_timeout='2000ms'");
            const rows = await transaction.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT
        current_user::text AS role,session_user::text AS login,current_database() AS database_name,
        r.rolreplication,r.rolsuper,r.rolbypassrls,r.rolinherit,r.rolcreatedb,r.rolcreaterole,r.rolcanlogin,r.rolconnlimit,
        EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=r.oid) AS member_of_role,
        has_database_privilege(current_user,current_database(),'CREATE') AS database_create,
        has_schema_privilege(current_user,'public','CREATE') AS public_create,
        has_schema_privilege(current_user,'profitia_market_read','CREATE') AS source_create,
        (SELECT count(*)::int FROM pg_catalog.pg_roles o WHERE o.rolname='profitia_market_read_owner'
          AND NOT(o.rolcanlogin OR o.rolinherit OR o.rolsuper OR o.rolbypassrls OR o.rolcreatedb OR o.rolcreaterole OR o.rolreplication)
          AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=o.oid)) AS controlled_owner,
        (SELECT nspowner::pg_catalog.regrole::text FROM pg_catalog.pg_namespace WHERE nspname='profitia_market_read') AS schema_owner,
        (SELECT count(*)::int FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='profitia_market_read' AND c.relowner::pg_catalog.regrole::text='profitia_market_read_owner'
          AND ((c.relname='installation' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity)
          OR (c.relname IN('series','observations') AND c.relkind='v' AND 'security_barrier=true'=ANY(c.reloptions)))) AS controlled_objects,
        EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname NOT IN('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
          AND c.relkind IN('r','p','v','m','f') AND (has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            OR has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
          AND NOT(n.nspname='profitia_market_read' AND c.relname IN('installation','series','observations'))) AS other_table_access,
        EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='profitia_market_read' AND c.relkind IN('r','p','v','m','f') AND (has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,SELECT WITH GRANT OPTION')
            OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE,REFERENCES,SELECT WITH GRANT OPTION'))) AS source_write,
        EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
          WHERE p.prosecdef AND n.nspname NOT IN('pg_catalog','information_schema')
          AND has_schema_privilege(current_user,n.oid,'USAGE') AND has_function_privilege(current_user,p.oid,'EXECUTE')) AS definer_access
        FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`);
            const actual = rows[0];
            if (rows.length !== 1 || !actual || actual.role !== binding.role || actual.login !== binding.role || actual.database_name !== binding.databaseName
                || actual.rolcanlogin !== true || actual.rolconnlimit !== 1 || actual.schema_owner !== OWNER || actual.controlled_objects !== 3 || actual.controlled_owner !== 1
                || ['rolreplication', 'rolsuper', 'rolbypassrls', 'rolinherit', 'rolcreatedb', 'rolcreaterole', 'member_of_role', 'database_create', 'public_create', 'source_create', 'other_table_access', 'source_write', 'definer_access'].some(key => actual[key] !== false))
                denied();
            const receipts = await transaction.$queryRawUnsafe<Array<{
                schema_version: string;
                schema_digest: string;
                project_id: string;
                branch_id: string;
                database_name: string;
                runtime_role: string;
                source_ref: string;
                expires_at: Date;
            }>>('SELECT schema_version,schema_digest,project_id,branch_id,database_name,runtime_role::text,source_ref,expires_at FROM profitia_market_read.installation WHERE singleton');
            const receipt = receipts[0];
            if (receipts.length !== 1 || !receipt || receipt.schema_version !== '1.0.0' || receipt.schema_digest !== binding.schemaDigest
                || receipt.project_id !== binding.projectId || receipt.branch_id !== binding.branchId || receipt.database_name !== binding.databaseName
                || receipt.runtime_role !== binding.role || typeof receipt.source_ref !== 'string' || !receipt.source_ref.length || receipt.source_ref.length > 256
                || /gh[pousr]_|sk_(?:live|test)_|postgres(?:ql)?:\/\/|Bearer\s/i.test(receipt.source_ref)
                || !(receipt.expires_at instanceof Date) || receipt.expires_at.getTime() <= Date.now())
                denied();
            const result = await readStoredMarketHistory(transaction, selection.data.seriesName);
            if (receipt.expires_at.getTime() <= Date.now())
                denied();
            return result;
        }, { timeout: 5000, maxWait: 3000 });
    };
}

/** Shared data query/format only. The caller must first verify its ordinary
 * source login, closed object ACLs and installation receipt in this transaction.
 * No actor, authority, provider, hydration, cache or source write is created. */
export async function readStoredMarketHistory(transaction: Pick<Prisma.TransactionClient, '$queryRawUnsafe'>, seriesName: string): Promise<{ history: BenchmarkHistoricalSeriesResult }> {
    const selection = MarketPreviewSelection.safeParse({ seriesName, range: 'ALL' });
    if (!selection.success)
        throw new BenchmarkAppError('VALIDATION_ERROR', 'Invalid stored series selection.', 400);
    const series = await transaction.$queryRawUnsafe<unknown[]>('SELECT "providerCode","providerSeriesId","providerSeriesKey","displayName","frequency","currency","unit","sourceLabel" FROM profitia_market_read.series WHERE "providerSeriesId"=$1 LIMIT 2', selection.data.seriesName);
    if (series.length === 0)
        throw new BenchmarkAppError('STORED_HISTORY_NOT_AVAILABLE', 'Stored market history is not available.', 404);
    const parsed = seriesSchema.safeParse(series[0]);
    if (!parsed.success)
        return denied();
    if (series.length !== 1 || parsed.data.providerSeriesId !== selection.data.seriesName)
        denied();
    const observations = await transaction.$queryRawUnsafe<Array<{
        observedAt: Date;
        value: string | null;
    }>>('SELECT "observedAt","value"::text FROM profitia_market_read.observations WHERE "providerSeriesId"=$1 ORDER BY "observedAt" ASC LIMIT $2', selection.data.seriesName, MAX_STORED_MARKET_POINTS + 1);
    if (observations.length > MAX_STORED_MARKET_POINTS)
        throw new BenchmarkAppError('STORED_HISTORY_TOO_LARGE', 'Stored history exceeds the supported preview size.', 413);
    if (observations.length === 0)
        throw new BenchmarkAppError('STORED_HISTORY_NOT_AVAILABLE', 'Stored market history is not available.', 404);
    let previous = -Infinity;
    const historical = observations.map(point => {
        if (!(point.observedAt instanceof Date) || !Number.isFinite(point.observedAt.getTime()) || point.observedAt.getTime() <= previous
            || !(point.value === null || typeof point.value === 'string' && point.value.trim() !== '' && Number.isFinite(Number(point.value))))
            denied();
        previous = point.observedAt.getTime();
        return { date: point.observedAt.toISOString(), value: point.value === null ? null : Number(point.value) };
    });
    const source = parsed.data;
    return { history: { providerSeries: { provider: { providerCode: 'MACROBOND', displayName: 'Macrobond' }, providerSeriesId: source.providerSeriesId, providerSeriesKey: source.providerSeriesKey },
            displayName: source.displayName, frequency: source.frequency, currency: source.currency, unit: source.unit, source: source.sourceLabel, historical } };
}
