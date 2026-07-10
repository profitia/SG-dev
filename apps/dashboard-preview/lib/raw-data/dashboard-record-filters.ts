import type { Prisma } from '@/src/generated/prisma/client'

export interface DashboardRecordListFilters {
  organizationId?: string
  pipelineId?: string
  componentName?: string
  componentCode?: string
  q?: string
  scenarioType?: string
  recordId?: string
  includeDeleted?: boolean
}

export interface SeriesFilters {
  organizationId?: string
  pipelineId?: string
  componentName?: string
  componentCode?: string
  historyMonths?: number
  showForecast?: boolean
}

export function buildDashboardRecordWhere(filters: DashboardRecordListFilters): Prisma.DrDashboardIndexRecordWhereInput {
  const where: Prisma.DrDashboardIndexRecordWhereInput = {
    organizationId: filters.organizationId,
    pipelineId: filters.pipelineId,
    id: filters.recordId,
    componentName: filters.componentName,
    componentCode: filters.componentCode,
    scenarioType: filters.scenarioType,
    deletedAt: filters.includeDeleted ? undefined : null,
  }

  if (filters.q) {
    where.OR = [
      { componentName: { contains: filters.q, mode: 'insensitive' } },
      { componentCode: { contains: filters.q, mode: 'insensitive' } },
    ]
  }

  return where
}

export function readBooleanQuery(value: string | null, fallback = false): boolean {
  if (!value) {
    return fallback
  }

  return value === '1' || value.toLowerCase() === 'true'
}

export function readNumberQuery(value: string | null, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
