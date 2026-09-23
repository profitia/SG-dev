/**
 * Controlled, additive SG2 market-data / prepared-artifact promotion.
 *
 * Dry-run is mandatory. --apply requires the digest produced by an immediately
 * preceding dry-run; every source and destination row is rechecked before write.
 * Operational jobs, telemetry, sessions and PMOS are deliberately excluded.
 */
import { PrismaClient } from '../generated/market-data-client'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import topology from '../../../Canon/registries/sg2-environment-topology-v1.json'
import {
  assertPromotionEndpoint,
  assertNeonBranchEndpoint,
  assertPromotionRoute,
  assertSameSemanticRecord,
  exactKey,
  semanticDigest,
  type PromotionEnvironment,
} from '../lib/market-data/promotion'

type StoredRow = Record<string, unknown>
type LooseDelegate = {
  findMany(args: Record<string, unknown>): Promise<StoredRow[]>
  createMany(args: Record<string, unknown>): Promise<unknown>
}
type SimpleModel = {
  model: string
  key: readonly string[]
  eligible?: (row: StoredRow) => boolean
}

const SIMPLE_ARTIFACTS: readonly SimpleModel[] = [
  {
    model: 'rollingDailyCurrentForecastSnapshot',
    key: ['seriesId', 'inputSource', 'targetBasis', 'methodId', 'methodVersion', 'modelId', 'trainingWindowPolicyId', 'effectiveTrainingPolicyId', 'sourceHistoryFingerprint'],
    eligible: (row) => row.status === 'AVAILABLE',
  },
  {
    model: 'rollingDailyVerificationRecord',
    key: ['seriesId', 'inputSource', 'targetBasis', 'methodId', 'methodVersion', 'modelId', 'forecastOriginAt', 'horizonLabel'],
    eligible: (row) => row.maturityStatus === 'MATURED',
  },
  {
    model: 'rollingDailyCalibrationGroup',
    key: ['seriesId', 'inputSource', 'targetBasis', 'methodId', 'methodVersion', 'modelId', 'horizonLabel'],
    eligible: (row) => row.status === 'AVAILABLE',
  },
] as const

const RUN_IDENTITY = [
  'seriesId', 'inputSource', 'historyFingerprint', 'targetBasis', 'methodId',
  'modelId', 'methodVersion', 'frequency', 'trainingWindowPolicyId',
  'effectiveTrainingPolicyId',
] as const

function arg(name: string) {
  const prefix = `--${name}=`
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length)
}

function requiredArg(name: string) {
  const value = arg(name)?.trim()
  if (!value) throw new Error(`Missing --${name}=...`)
  return value
}

function environment(name: string): PromotionEnvironment {
  const value = requiredArg(name)
  if (value !== 'development' && value !== 'staging' && value !== 'production') {
    throw new Error(`Unknown SG2 environment: ${value}`)
  }
  return value
}

function delegate(client: PrismaClient, model: string): LooseDelegate {
  const resolved = (client as unknown as Record<string, LooseDelegate>)[model]
  if (!resolved) throw new Error(`Unsupported promotion model: ${model}`)
  return resolved
}

function indexed(rows: StoredRow[], columns: readonly string[], label: string) {
  const result = new Map<string, StoredRow>()
  for (const row of rows) {
    const key = exactKey(row, columns)
    if (result.has(key)) throw new Error(`${label} has duplicate exact identity ${key}.`)
    result.set(key, row)
  }
  return result
}

function sortedRows(rows: StoredRow[], columns: readonly string[]) {
  return [...rows].sort((left, right) => exactKey(left, columns).localeCompare(exactKey(right, columns)))
}

function sortedRunRows(rows: StoredRow[], children: readonly { field: string; key: readonly string[] }[]) {
  return sortedRows(rows, RUN_IDENTITY).map((row) => ({
    ...row,
    ...Object.fromEntries(children.map(({ field, key }) => [field, sortedRows(row[field] as StoredRow[], key)])),
  }))
}

function compareRuns(source: StoredRow, destination: StoredRow, children: readonly { field: string; key: readonly string[] }[], label: string) {
  const childFields = children.map((child) => child.field)
  const stripChildren = (row: StoredRow) => Object.fromEntries(Object.entries(row).filter(([field]) => !childFields.includes(field)))
  assertSameSemanticRecord(stripChildren(source), stripChildren(destination), label)
  for (const { field, key } of children) {
    const sourceChildren = sortedRows(source[field] as StoredRow[], key)
    const destinationChildren = sortedRows(destination[field] as StoredRow[], key)
    assertSameSemanticRecord(sourceChildren, destinationChildren, `${label}/${field}`)
  }
}

function withoutRelations(row: StoredRow, relations: readonly string[]) {
  return Object.fromEntries(Object.entries(row).filter(([field]) => !relations.includes(field)))
}

async function migrations(client: PrismaClient) {
  const rows = await client.$queryRaw<Array<{ migration_name: string; checksum: string }>>`
    SELECT migration_name, checksum FROM _prisma_migrations
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ORDER BY migration_name
  `
  return semanticDigest(rows)
}

export async function assertReadOnlySource(client: PrismaClient) {
  const rows = await client.$queryRaw<Array<{ can_write: boolean }>>`
    SELECT COALESCE(BOOL_OR(
      has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'INSERT') OR
      has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'UPDATE') OR
      has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'DELETE') OR
      has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'TRUNCATE')
    ), false) AS can_write
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'market_series', 'market_observations', 'market_hydration_state',
        'forecast_current_runs', 'forecast_current_points',
        'forecast_verification_runs', 'forecast_verification_metrics',
        'forecast_verification_points', 'rolling_daily_current_forecast_snapshots',
        'rolling_daily_verification_records', 'rolling_daily_calibration_groups'
      )
  `
  if (rows.length !== 1 || rows[0]?.can_write !== false) {
    throw new Error('Source database credential must be read-only for promoted tables.')
  }
}

async function registeredBranchHost(projectId: string, branchId: string, apiKey: string, label: string) {
  const response = await fetch(`https://console.neon.tech/api/v2/projects/${encodeURIComponent(projectId)}/branches/${encodeURIComponent(branchId)}/endpoints`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`${label} Neon branch-endpoint verification failed (HTTP ${response.status}).`)
  const inventory = await response.json() as { endpoints?: unknown }
  return assertNeonBranchEndpoint(branchId, inventory.endpoints, label)
}

export async function scanSeries(source: PrismaClient, destination: PrismaClient, series: StoredRow) {
  const providerSeriesId = String(series.providerSeriesId)
  const sourceSeriesId = String(series.id)
  const destinationSeries = await destination.marketSeries.findUnique({
    where: { providerCode_providerSeriesId: { providerCode: String(series.providerCode), providerSeriesId } },
  })
  if (destinationSeries) {
    assertSameSemanticRecord(series, destinationSeries, `market_series/${providerSeriesId}`, ['id', 'createdAt', 'updatedAt'])
  }
  const destinationSeriesId = destinationSeries?.id ?? sourceSeriesId
  const sourceHydration = await source.marketHydrationState.findUnique({ where: { seriesId: sourceSeriesId } })
  const destinationHydration = destinationSeries
    ? await destination.marketHydrationState.findUnique({ where: { seriesId: destinationSeriesId } })
    : null
  const missingHydration = sourceHydration && !destinationHydration
    ? { ...sourceHydration, seriesId: destinationSeriesId }
    : null
  const sourceObservations = await source.marketObservation.findMany({ where: { seriesId: sourceSeriesId }, orderBy: { observedAt: 'asc' } })
  const destinationObservations = destinationSeries
    ? await destination.marketObservation.findMany({ where: { seriesId: destinationSeriesId }, orderBy: { observedAt: 'asc' } })
    : []
  const sourceByDate = indexed(sourceObservations as StoredRow[], ['observedAt'], `source observations/${providerSeriesId}`)
  const destinationByDate = indexed(destinationObservations as StoredRow[], ['observedAt'], `destination observations/${providerSeriesId}`)
  for (const [key, stored] of destinationByDate) {
    const incoming = sourceByDate.get(key)
    if (!incoming) throw new Error(`Destination has an observation absent from source for ${providerSeriesId}: ${key}.`)
    if (String(incoming.value) !== String(stored.value)) {
      throw new Error(`Observation value conflict for ${providerSeriesId}: ${key}.`)
    }
  }
  const missingObservations = [...sourceByDate].filter(([key]) => !destinationByDate.has(key)).map(([, row]) => ({
    observedAt: row.observedAt,
    value: row.value,
    seriesId: destinationSeriesId,
  }))

  const sourceCurrent = await source.forecastCurrentRun.findMany({ where: { seriesId: providerSeriesId, status: 'AVAILABLE' }, include: { points: true } })
  const destinationCurrent = await destination.forecastCurrentRun.findMany({ where: { seriesId: providerSeriesId }, include: { points: true } })
  indexed(sourceCurrent as StoredRow[], RUN_IDENTITY, `source current/${providerSeriesId}`)
  const currentByKey = indexed(destinationCurrent as StoredRow[], RUN_IDENTITY, `destination current/${providerSeriesId}`)
  const missingCurrent: StoredRow[] = []
  for (const row of sourceCurrent as StoredRow[]) {
    const existing = currentByKey.get(exactKey(row, RUN_IDENTITY))
    if (existing) compareRuns(row, existing, [{ field: 'points', key: ['horizonLabel'] }], `current/${providerSeriesId}`)
    else missingCurrent.push(row)
  }

  const sourceVerification = await source.forecastVerificationRun.findMany({ where: { seriesId: providerSeriesId, status: 'AVAILABLE' }, include: { metrics: true, points: true } })
  const destinationVerification = await destination.forecastVerificationRun.findMany({ where: { seriesId: providerSeriesId }, include: { metrics: true, points: true } })
  indexed(sourceVerification as StoredRow[], RUN_IDENTITY, `source verification/${providerSeriesId}`)
  const verificationByKey = indexed(destinationVerification as StoredRow[], RUN_IDENTITY, `destination verification/${providerSeriesId}`)
  const missingVerification: StoredRow[] = []
  for (const row of sourceVerification as StoredRow[]) {
    const existing = verificationByKey.get(exactKey(row, RUN_IDENTITY))
    if (existing) compareRuns(row, existing, [
      { field: 'metrics', key: ['horizonLabel'] },
      { field: 'points', key: ['horizonLabel', 'forecastOriginAt', 'targetDate'] },
    ], `verification/${providerSeriesId}`)
    else missingVerification.push(row)
  }

  const simpleMissing: Record<string, StoredRow[]> = {}
  const simpleSource: Record<string, StoredRow[]> = {}
  const simpleDestination: Record<string, StoredRow[]> = {}
  for (const model of SIMPLE_ARTIFACTS) {
    const incoming = (await delegate(source, model.model).findMany({ where: { seriesId: providerSeriesId } }))
      .filter((row) => model.eligible?.(row) ?? true)
    const existing = await delegate(destination, model.model).findMany({ where: { seriesId: providerSeriesId } })
    const destinationByKey = indexed(existing, model.key, `destination ${model.model}/${providerSeriesId}`)
    simpleMissing[model.model] = []
    indexed(incoming, model.key, `source ${model.model}/${providerSeriesId}`)
    simpleSource[model.model] = sortedRows(incoming, model.key)
    simpleDestination[model.model] = sortedRows(existing, model.key)
    for (const row of incoming) {
      const match = destinationByKey.get(exactKey(row, model.key))
      if (match) assertSameSemanticRecord(row, match, `${model.model}/${providerSeriesId}`, ['id', 'createdAt', 'updatedAt'])
      else simpleMissing[model.model]!.push(row)
    }
  }

  const summary = {
    providerCode: series.providerCode,
    providerSeriesId,
    newSeries: !destinationSeries,
    missingHydrationState: Boolean(missingHydration),
    missingObservations: missingObservations.length,
    missingCurrentRuns: missingCurrent.length,
    missingVerificationRuns: missingVerification.length,
    missingDailySnapshots: simpleMissing.rollingDailyCurrentForecastSnapshot?.length ?? 0,
    missingDailyVerificationRecords: simpleMissing.rollingDailyVerificationRecord?.length ?? 0,
    missingDailyCalibrationGroups: simpleMissing.rollingDailyCalibrationGroup?.length ?? 0,
    sourceDigest: semanticDigest({
      series, sourceHydration, sourceObservations,
      sourceCurrent: sortedRunRows(sourceCurrent as StoredRow[], [{ field: 'points', key: ['horizonLabel'] }]),
      sourceVerification: sortedRunRows(sourceVerification as StoredRow[], [
        { field: 'metrics', key: ['horizonLabel'] },
        { field: 'points', key: ['horizonLabel', 'forecastOriginAt', 'targetDate'] },
      ]),
      simpleSource,
    }, ['createdAt', 'updatedAt']),
    destinationDigest: semanticDigest({
      destinationSeries, destinationHydration, destinationObservations,
      destinationCurrent: sortedRunRows(destinationCurrent as StoredRow[], [{ field: 'points', key: ['horizonLabel'] }]),
      destinationVerification: sortedRunRows(destinationVerification as StoredRow[], [
        { field: 'metrics', key: ['horizonLabel'] },
        { field: 'points', key: ['horizonLabel', 'forecastOriginAt', 'targetDate'] },
      ]),
      simpleDestination,
    }, ['createdAt', 'updatedAt']),
  }
  return { summary, missingHydration, missingObservations, missingCurrent, missingVerification, simpleMissing, destinationSeriesId }
}

async function insertBatches(delegateToUse: LooseDelegate, rows: StoredRow[], size = 500) {
  for (let index = 0; index < rows.length; index += size) {
    await delegateToUse.createMany({ data: rows.slice(index, index + size) })
  }
}

export async function applySeries(destination: PrismaClient, series: StoredRow, planned: Awaited<ReturnType<typeof scanSeries>>) {
  if (planned.summary.newSeries) {
    await destination.marketSeries.create({ data: series as never })
  }
  if (planned.missingHydration) {
    await destination.marketHydrationState.create({ data: planned.missingHydration })
  }
  await insertBatches(delegate(destination, 'marketObservation'), planned.missingObservations)
  if (planned.missingCurrent.length > 0) {
    await destination.$transaction(async (transaction) => {
      await insertBatches(delegate(transaction as PrismaClient, 'forecastCurrentRun'), planned.missingCurrent.map((row) => withoutRelations(row, ['points'])))
      await insertBatches(delegate(transaction as PrismaClient, 'forecastCurrentPoint'), planned.missingCurrent.flatMap((row) => row.points as StoredRow[]))
    }, { timeout: 120000 })
  }
  if (planned.missingVerification.length > 0) {
    await destination.$transaction(async (transaction) => {
      await insertBatches(delegate(transaction as PrismaClient, 'forecastVerificationRun'), planned.missingVerification.map((row) => withoutRelations(row, ['metrics', 'points'])))
      await insertBatches(delegate(transaction as PrismaClient, 'forecastVerificationMetric'), planned.missingVerification.flatMap((row) => row.metrics as StoredRow[]))
      await insertBatches(delegate(transaction as PrismaClient, 'forecastVerificationPoint'), planned.missingVerification.flatMap((row) => row.points as StoredRow[]))
    }, { timeout: 120000 })
  }
  for (const model of SIMPLE_ARTIFACTS) {
    await insertBatches(delegate(destination, model.model), planned.simpleMissing[model.model] ?? [])
  }
}

async function main() {
  const from = environment('from')
  const to = environment('to')
  const reconciliation = process.argv.includes('--reconcile')
  assertPromotionRoute({ from, to, reconciliation })
  const fromBranchId = topology.environments[from].neon.branchId
  const toBranchId = topology.environments[to].neon.branchId
  if (requiredArg('from-branch-id') !== fromBranchId || requiredArg('to-branch-id') !== toBranchId) {
    throw new Error('Neon branch IDs do not match the canonical SG2 environment registry.')
  }
  const sourceUrl = process.env.PROMOTION_SOURCE_DATABASE_URL
  const destinationUrl = process.env.PROMOTION_DEST_DATABASE_URL
  const neonApiKey = process.env.NEON_API_KEY
  if (!sourceUrl || !destinationUrl || !neonApiKey) throw new Error('PROMOTION_SOURCE_DATABASE_URL, PROMOTION_DEST_DATABASE_URL and NEON_API_KEY are required.')
  const projectId = topology.environments[from].neon.projectId
  if (projectId !== topology.environments[to].neon.projectId) throw new Error('Cross-project data promotion is not supported.')
  const [registeredSourceHost, registeredDestinationHost] = await Promise.all([
    registeredBranchHost(projectId, fromBranchId, neonApiKey, 'Source'),
    registeredBranchHost(projectId, toBranchId, neonApiKey, 'Destination'),
  ])
  const sourceHost = assertPromotionEndpoint(sourceUrl, registeredSourceHost, 'Source')
  const destinationHost = assertPromotionEndpoint(destinationUrl, registeredDestinationHost, 'Destination')
  if (sourceHost === destinationHost) throw new Error('Source and destination must have distinct Neon endpoints.')
  const apply = process.argv.includes('--apply')
  const approvedDigest = apply ? requiredArg('approved-plan-digest') : null
  const ids = arg('series-ids')?.split(',').map((id) => id.trim()).filter(Boolean)
  if (process.argv.includes('--all') === Boolean(ids?.length)) throw new Error('Choose exactly one of --all or --series-ids=...')

  const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } })
  const destination = new PrismaClient({ datasources: { db: { url: destinationUrl } } })
  try {
    await assertReadOnlySource(source)
    const sourceMigrationDigest = await migrations(source)
    const destinationMigrationDigest = await migrations(destination)
    if (sourceMigrationDigest !== destinationMigrationDigest) throw new Error('Source and destination Prisma migration histories differ.')
    const series = await source.marketSeries.findMany({
      ...(ids ? { where: { providerSeriesId: { in: [...new Set(ids)] } } } : {}),
      orderBy: [{ providerCode: 'asc' }, { providerSeriesId: 'asc' }],
    })
    if (ids && series.length !== new Set(ids).size) throw new Error('At least one requested series is missing from the source branch.')
    const summaries = []
    for (const item of series) summaries.push((await scanSeries(source, destination, item as StoredRow)).summary)
    const plan = { contract: 'SG2_MARKET_FORECAST_PROMOTION_V1', from, to, reconciliation, fromBranchId, toBranchId, sourceHost, destinationHost, migrationDigest: sourceMigrationDigest, summaries }
    const planDigest = semanticDigest(plan)
    if (apply && approvedDigest !== planDigest) throw new Error('Approved dry-run digest does not match current source/destination state.')
    if (apply) {
      for (const [index, item] of series.entries()) {
        const planned = await scanSeries(source, destination, item as StoredRow)
        if (semanticDigest(planned.summary) !== semanticDigest(summaries[index])) throw new Error(`Data changed after plan approval for ${item.providerSeriesId}.`)
        await applySeries(destination, item as StoredRow, planned)
      }
    }
    console.log(JSON.stringify({ ...plan, planDigest, mode: apply ? 'APPLIED' : 'DRY_RUN' }, null, 2))
  } finally {
    await Promise.all([source.$disconnect(), destination.$disconnect()])
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`SG2 data promotion failed closed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
