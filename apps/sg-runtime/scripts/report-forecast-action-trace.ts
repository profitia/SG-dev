import { readForecastActionTimeline } from '@/lib/forecast/forecast-action-trace'
import { getMarketDataPrisma } from '@/lib/market-data/client'

function argument(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1]?.trim() ?? '' : ''
}

async function main() {
  const correlationId = argument('--correlation-id')
  if (!correlationId) throw new Error('Usage: npm run forecast:trace:report -- --correlation-id <id>')
  const timeline = await readForecastActionTimeline(correlationId)
  if (!timeline) throw new Error(`No Forecast action trace exists for ${correlationId}.`)
  process.stdout.write(`${JSON.stringify(timeline, null, 2)}\n`)
}

main()
  .catch((error) => {
    console.error(`[forecast:trace:report] ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
  .finally(async () => getMarketDataPrisma()?.$disconnect())
