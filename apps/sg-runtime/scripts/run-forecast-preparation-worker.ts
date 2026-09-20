import { createForecastPreparationWorker } from '@/lib/forecast/preparation-queue'
import { getMarketDataPrisma } from '@/lib/market-data/client'

const IDLE_POLL_MS = 2_000
const ERROR_BACKOFF_MS = 10_000

let stopping = false

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    stopping = true
    console.info(`[forecast-preparation-worker] ${signal} received; no new job will be claimed.`)
  })
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const worker = createForecastPreparationWorker({
    workerId: process.env.RENDER_INSTANCE_ID?.trim() || undefined,
  })
  console.info(`[forecast-preparation-worker] started workerId=${worker.workerId}`)

  while (!stopping) {
    try {
      const processed = await worker.runOne()
      if (!processed && !stopping) await wait(IDLE_POLL_MS)
    } catch (error) {
      console.error('[forecast-preparation-worker] polling failure', error)
      if (!stopping) await wait(ERROR_BACKOFF_MS)
    }
  }

  await getMarketDataPrisma()?.$disconnect()
  console.info('[forecast-preparation-worker] stopped cleanly')
}

main().catch(async (error) => {
  console.error('[forecast-preparation-worker] fatal failure', error)
  await getMarketDataPrisma()?.$disconnect().catch(() => undefined)
  process.exitCode = 1
})
