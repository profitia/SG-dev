/** Bounded offline Development export. Reuses the existing ordinary-role
 * reader; never hydrates, writes SQL, impersonates a user, or calls a provider. */
import {createHash} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {PrismaClient} from '@prisma/client'
import {createStoredMarketHistoryReader} from '../lib/market-data/stored-read'
import targets from '../deployment/private-runtime-targets.json'

const selected = ['cl_c1_cl', 'b_c1_cl'] as const
const expectedNames = {
  cl_c1_cl: 'Crude Oil, Future, Light Sweet (WTI) Physical, 1st Position, Close, USD',
  b_c1_cl: 'Crude Oil, Future, ICE Brent Crude, 1st Position, Close, USD',
}

async function main() {
  const output = process.argv[2]
  if (!output || !path.isAbsolute(output)) throw new Error('Absolute private local output directory required')
  const source = targets.environments.development.marketRead
  const connection = process.env.OIL_D0_MARKET_READ_DATABASE_URL
  if (!connection) throw new Error('Registered ordinary market read connection required')
  const url = new URL(connection)
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !source.hosts.includes(url.hostname)
    || url.username !== source.runtimeRole || url.pathname !== `/${source.databaseName}`
    || url.searchParams.get('sslmode') !== 'require') throw new Error('Development source identity mismatch')
  url.searchParams.set('connection_limit', '1')
  const prisma = new PrismaClient({datasources: {db: {url: url.toString()}}})
  try {
    const read = createStoredMarketHistoryReader(prisma, {
      projectId: source.projectId, branchId: source.branchId, databaseName: source.databaseName,
      role: source.runtimeRole, schemaDigest: source.schemaDigest,
    })
    await mkdir(output, {recursive: true, mode: 0o700})
    for (const id of selected) {
      const {history} = await read(id)
      if (history.providerSeries.providerSeriesId !== id || history.providerSeries.provider.providerCode !== 'MACROBOND'
        || history.frequency?.toLowerCase() !== 'daily' || history.currency !== 'USD') throw new Error('Exact D0 series identity mismatch')
      const artifact = {
        schemaVersion: 'oil-d0-source-v1', seriesId: id, requestedDescription: expectedNames[id],
        retrievedAt: new Date().toISOString(), sourceMode: 'EXISTING_DEVELOPMENT_STORED_SHARED_MARKET_HISTORY',
        dataClass: 'SHARED_KNOWLEDGE', dataOwner: 'SG2 Market Data',
        exportAuthority: 'SG2-OIL-MARKET-OUTLOOK-D0-20261101', productUserImpersonated: false,
        binding: {projectId: source.projectId, branchId: source.branchId, databaseName: source.databaseName,
          role: source.runtimeRole, schemaDigest: source.schemaDigest},
        providerCalls: 0, productWrites: 0, metadata: {},
        metadataAvailability: 'STORED_IDENTITY_ONLY_FULL_PROVIDER_METADATA_NOT_RETAINED',
        vintageStatus: 'LATEST_STORED_VINTAGE_NO_HISTORICAL_RELEASE_TIMESTAMPS', history,
      }
      const body = JSON.stringify(artifact, null, 2) + '\n'
      const digest = createHash('sha256').update(body).digest('hex')
      const file = path.join(output, `${id}-${digest}.json`)
      await writeFile(file, body, {flag: 'wx', mode: 0o600})
      console.log(JSON.stringify({seriesId: id, file, sha256: digest, points: history.historical.length,
        lastObservation: history.historical.at(-1)?.date, providerCalls: 0}))
    }
  } finally { await prisma.$disconnect() }
}

main().catch(() => { console.error('D0 stored source export failed; no provider or privileged fallback attempted.'); process.exitCode = 1 })
