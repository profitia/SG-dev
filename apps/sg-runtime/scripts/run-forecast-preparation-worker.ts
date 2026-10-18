import {
  createForecastPreparationWorker,
  resolveForecastPreparationWorkerMode,
} from '@/lib/forecast/preparation-queue'
import { createSg2ConfiguredForecastWorker } from '@/lib/forecast/source-worker-runtime'
import {createSg2ConfiguredForecastDispatch} from '@/lib/forecast/dispatch-runtime'
import { getMarketDataPrisma } from '@/lib/market-data/client'

const IDLE_POLL_MS = 2_000
const ERROR_BACKOFF_MS = 10_000

let stopping = false
let nativeDisconnect:(()=>Promise<void>)|undefined
let dispatchDisconnect:(()=>Promise<void>)|undefined

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
  const mode = resolveForecastPreparationWorkerMode(process.env.FORECAST_PREPARATION_WORKER_MODE)
  const configured=createSg2ConfiguredForecastWorker()
  if(configured.provider==='native')nativeDisconnect=configured.disconnect
  const dispatch=createSg2ConfiguredForecastDispatch()
  if(dispatch.provider==='native')dispatchDisconnect=dispatch.disconnect
  const worker = configured.provider==='native'?configured.worker:createForecastPreparationWorker({
    workerId: process.env.RENDER_INSTANCE_ID?.trim() || undefined,
    mode,
  })
  console.info(`[forecast-preparation-worker] started workerId=${worker.workerId} mode=${worker.mode}`)

  while (!stopping) {
    let dispatched=false
    if(dispatch.provider==='native'){
      try{dispatched=await dispatch.poller.runOne()}
      catch{console.error('[forecast-preparation-worker] private dispatch unavailable; next iteration will recheck authority.')}
    }
    if(stopping)break
    try {
      const processed = await worker.runOne()
      if (!processed && !dispatched && !stopping) await wait(IDLE_POLL_MS)
    } catch (error) {
      console.error('[forecast-preparation-worker] polling failure', error)
      if (!stopping) await wait(ERROR_BACKOFF_MS)
    }
  }

  if(dispatchDisconnect)await dispatchDisconnect()
  if(nativeDisconnect)await nativeDisconnect()
  else await getMarketDataPrisma()?.$disconnect()
  console.info('[forecast-preparation-worker] stopped cleanly')
}

main().catch(async (error) => {
  console.error('[forecast-preparation-worker] fatal failure', error)
  if(dispatchDisconnect)await dispatchDisconnect()
  if(nativeDisconnect)await nativeDisconnect()
  else await getMarketDataPrisma()?.$disconnect().catch(() => undefined)
  process.exitCode = 1
})
