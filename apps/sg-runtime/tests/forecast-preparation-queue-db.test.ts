import assert from 'node:assert/strict'
import test from 'node:test'

import { PrismaClient } from '@/generated/market-data-client'
import { createForecastPreparationQueueService } from '@/lib/forecast/preparation-queue'

const databaseUrl = process.env.FORECAST_QUEUE_TEST_DATABASE_URL?.trim()

test('Postgres queue claim is priority ordered, fair between slices, and cross-worker single-owner', {
  skip: !databaseUrl,
}, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl! } } })
  const queue = createForecastPreparationQueueService({ prisma, leaseMs: 60_000 })
  const now = new Date()

  try {
    await prisma.forecastPreparationJob.deleteMany()
    const base = {
      status: 'QUEUED',
      seriesId: 'series-1',
      targetBasis: 'MONTHLY_AVERAGE' as const,
      targetSemantics: 'MONTHLY_AVERAGE',
      modelId: 'arima',
      sourceFrequency: 'DAILY',
      targetCadence: 'MONTHLY',
      historyFingerprint: 'history-1',
      availableAt: now,
    }
    await prisma.forecastPreparationJob.createMany({
      data: [
        { ...base, id: 'verification', jobKey: 'verification', jobKind: 'VERIFICATION', priority: 100, updatedAt: now },
        { ...base, id: 'current', jobKey: 'current', jobKind: 'CURRENT', priority: 10, updatedAt: now },
      ],
    })

    const first = await queue.claimNext('worker-priority')
    assert.equal(first?.jobKind, 'CURRENT')

    await prisma.forecastPreparationJob.deleteMany()
    await prisma.forecastPreparationJob.createMany({
      data: [
        {
          ...base,
          id: 'older-verification',
          jobKey: 'older-verification',
          jobKind: 'VERIFICATION',
          priority: 100,
          requestedAt: new Date(now.getTime() - 60_000),
          availableAt: new Date(now.getTime() - 60_000),
        },
        {
          ...base,
          id: 'newer-verification',
          jobKey: 'newer-verification',
          jobKind: 'VERIFICATION',
          priority: 100,
          requestedAt: new Date(now.getTime() - 30_000),
          availableAt: new Date(now.getTime() - 30_000),
        },
      ],
    })
    const olderVerification = await queue.claimNext('worker-fairness-first')
    assert.equal(olderVerification?.jobKey, 'older-verification')
    await queue.continueAfterSlice(olderVerification!, { progress: 'partial' })
    const newerVerification = await queue.claimNext('worker-fairness-second')
    assert.equal(newerVerification?.jobKey, 'newer-verification')

    await prisma.forecastPreparationJob.deleteMany()
    await prisma.forecastPreparationJob.create({
      data: { ...base, id: 'single', jobKey: 'single', jobKind: 'CURRENT', priority: 10 },
    })
    const claims = await Promise.all(Array.from({ length: 8 }, (_, index) => queue.claimNext(`worker-${index}`)))
    assert.equal(claims.filter(Boolean).length, 1)
    assert.equal(new Set(claims.filter(Boolean).map((claim) => claim!.jobKey)).size, 1)
  } finally {
    await prisma.forecastPreparationJob.deleteMany()
    await prisma.$disconnect()
  }
})
