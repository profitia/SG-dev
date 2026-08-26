import { getPrismaClient } from '@/lib/db/prisma'
import {
  phase22cDiagnosticEvent,
  phase22cDiagnosticSpan,
  phase23C01DiagnosticEvent,
} from '@/lib/phase-2-2c/diagnostics'

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

type DashboardRecordQueryResult = {
  records: DashboardRecordSource[]
  metrics: DashboardRecordQueryMetrics
}

type DashboardRecordQueryClient = {
  $connect: () => Promise<unknown>
  drDashboardIndexRecord: {
    findMany: (args: {
      where: ReturnType<typeof buildDashboardRecordWhere>
      orderBy: Array<Record<string, 'asc'>>
    }) => Promise<unknown[]>
  }
}

type DashboardRecordQueryRuntimeDependencies = {
  getClient: () => DashboardRecordQueryClient
  now: () => number
  diagnosticEvent: typeof phase23C01DiagnosticEvent
}

const DASHBOARD_RECORD_CACHE_TTL_MS = 30_000

function cacheKeyFromFilters(filters: DashboardRecordListFilters) {
  return JSON.stringify({
    organizationId: filters.organizationId ?? null,
    pipelineId: filters.pipelineId ?? null,
  })
}

export function createDashboardRecordQueryRuntime(
  dependencies: Partial<DashboardRecordQueryRuntimeDependencies> = {},
) {
  const getClient = dependencies.getClient ?? (() => getPrismaClient() as unknown as DashboardRecordQueryClient)
  const now = dependencies.now ?? Date.now
  const diagnosticEvent = dependencies.diagnosticEvent ?? phase23C01DiagnosticEvent
  let dashboardRecordCacheEntry: DashboardRecordCacheEntry | null = null
  const inFlightMisses = new Map<string, Promise<DashboardRecordQueryResult>>()

  async function loadDashboardRecords(
    filters: DashboardRecordListFilters,
    cacheKey: string,
    cachedAt: number,
  ): Promise<DashboardRecordQueryResult> {
    const clientStartedAt = performance.now()
    const prisma = getClient()
    const getClientMs = performance.now() - clientStartedAt

    const connectStartedAt = performance.now()
    await phase22cDiagnosticSpan('application_db_connect', () => prisma.$connect())
    const dbConnectMs = performance.now() - connectStartedAt

    const queryStartedAt = performance.now()
    diagnosticEvent('underlying_read_started', { cacheKey })
    let records: unknown[]
    try {
      records = await phase22cDiagnosticSpan('application_db_dashboard_records_query', () => (
        prisma.drDashboardIndexRecord.findMany({
          where: buildDashboardRecordWhere(filters),
          orderBy: [{ sourceDate: 'asc' }, { id: 'asc' }],
        })
      ))
    } catch (error) {
      diagnosticEvent('underlying_read_failed', { cacheKey })
      throw error
    }
    const dbQueryMs = performance.now() - queryStartedAt
    diagnosticEvent('underlying_read_completed', { cacheKey, recordCount: records.length })
    phase22cDiagnosticEvent('application_db_query_result', {
      operation: 'dashboard_records',
      recordCount: records.length,
    })
    const normalizedRecords = records as unknown as DashboardRecordSource[]

    dashboardRecordCacheEntry = {
      key: cacheKey,
      cachedAt,
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

  async function listDashboardRecordsWithMetrics(
    filters: DashboardRecordListFilters,
  ): Promise<DashboardRecordQueryResult> {
    const cacheKey = cacheKeyFromFilters(filters)
    const requestStartedAt = now()

    if (
      dashboardRecordCacheEntry
      && dashboardRecordCacheEntry.key === cacheKey
      && requestStartedAt - dashboardRecordCacheEntry.cachedAt <= DASHBOARD_RECORD_CACHE_TTL_MS
    ) {
      phase22cDiagnosticEvent('application_db_cache_hit', {
        operation: 'dashboard_records',
        recordCount: dashboardRecordCacheEntry.records.length,
      })
      diagnosticEvent('cache_hit', { cacheKey })
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

    const existingOwner = inFlightMisses.get(cacheKey)
    if (existingOwner) {
      diagnosticEvent('joiner_acquired', { activeEntries: inFlightMisses.size, cacheKey })
      try {
        const result = await existingOwner
        diagnosticEvent('joiner_succeeded', { cacheKey })
        return result
      } catch (error) {
        diagnosticEvent('joiner_failed', { cacheKey })
        throw error
      }
    }

    const owner = loadDashboardRecords(filters, cacheKey, requestStartedAt)
    inFlightMisses.set(cacheKey, owner)
    diagnosticEvent('owner_acquired', { activeEntries: inFlightMisses.size, cacheKey })

    try {
      const result = await owner
      diagnosticEvent('owner_succeeded', { cacheKey })
      return result
    } catch (error) {
      diagnosticEvent('owner_failed', { cacheKey })
      throw error
    } finally {
      if (inFlightMisses.get(cacheKey) === owner) {
        inFlightMisses.delete(cacheKey)
        diagnosticEvent('entry_released', { activeEntries: inFlightMisses.size, cacheKey })
      }
    }
  }

  return {
    activeEntryCount: () => inFlightMisses.size,
    listDashboardRecordsWithMetrics,
  }
}

const dashboardRecordQueryRuntime = createDashboardRecordQueryRuntime()

export async function listDashboardRecordsWithMetrics(
  filters: DashboardRecordListFilters,
): Promise<DashboardRecordQueryResult> {
  return dashboardRecordQueryRuntime.listDashboardRecordsWithMetrics(filters)
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
