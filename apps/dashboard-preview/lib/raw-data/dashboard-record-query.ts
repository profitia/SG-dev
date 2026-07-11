import { getPrismaClient } from '@/lib/db/prisma'

import { buildDashboardRecordWhere, type DashboardRecordListFilters } from './dashboard-record-filters'
import type { DashboardRecordSource } from './dashboard-record-mapper'

export interface DashboardRecordQueryMetrics {
  getClientMs: number
  dbConnectMs: number
  dbQueryMs: number
  dbTotalMs: number
  fetchedCount: number
}

type DashboardRecordCacheEntry = {
  key: string
  cachedAt: number
  records: DashboardRecordSource[]
}

const DASHBOARD_RECORD_CACHE_TTL_MS = 30_000
let dashboardRecordCacheEntry: DashboardRecordCacheEntry | null = null

function cacheKeyFromFilters(filters: DashboardRecordListFilters) {
  return JSON.stringify({
    organizationId: filters.organizationId ?? null,
    pipelineId: filters.pipelineId ?? null,
  })
}

export async function listDashboardRecordsWithMetrics(filters: DashboardRecordListFilters): Promise<{
  records: DashboardRecordSource[]
  metrics: DashboardRecordQueryMetrics
}> {
  const cacheKey = cacheKeyFromFilters(filters)
  const now = Date.now()

  if (
    dashboardRecordCacheEntry
    && dashboardRecordCacheEntry.key === cacheKey
    && now - dashboardRecordCacheEntry.cachedAt <= DASHBOARD_RECORD_CACHE_TTL_MS
  ) {
    return {
      records: dashboardRecordCacheEntry.records,
      metrics: {
        getClientMs: 0,
        dbConnectMs: 0,
        dbQueryMs: 0,
        dbTotalMs: 0,
        fetchedCount: dashboardRecordCacheEntry.records.length,
      },
    }
  }

  const clientStartedAt = performance.now()
  const prisma = getPrismaClient()
  const getClientMs = performance.now() - clientStartedAt

  const connectStartedAt = performance.now()
  await prisma.$connect()
  const dbConnectMs = performance.now() - connectStartedAt

  const queryStartedAt = performance.now()
  const records = await prisma.drDashboardIndexRecord.findMany({
    where: buildDashboardRecordWhere(filters),
    orderBy: [{ sourceDate: 'asc' }, { id: 'asc' }],
  })
  const dbQueryMs = performance.now() - queryStartedAt
  const normalizedRecords = records as unknown as DashboardRecordSource[]

  dashboardRecordCacheEntry = {
    key: cacheKey,
    cachedAt: now,
    records: normalizedRecords,
  }

  return {
    records: normalizedRecords,
    metrics: {
      getClientMs,
      dbConnectMs,
      dbQueryMs,
      dbTotalMs: dbConnectMs + dbQueryMs,
      fetchedCount: records.length,
    },
  }
}

export async function listDashboardRecords(filters: DashboardRecordListFilters): Promise<DashboardRecordSource[]> {
  const { records } = await listDashboardRecordsWithMetrics(filters)
  return records
}

export async function getDashboardRecordById(recordId: string): Promise<DashboardRecordSource | null> {
  const prisma = getPrismaClient()
  const record = await prisma.drDashboardIndexRecord.findFirst({
    where: {
      id: recordId,
      deletedAt: null,
    },
  })

  return (record as unknown as DashboardRecordSource | null) ?? null
}
