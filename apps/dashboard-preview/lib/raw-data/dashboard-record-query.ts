import { getPrismaClient } from '@/lib/db/prisma'

import { buildDashboardRecordWhere, type DashboardRecordListFilters } from './dashboard-record-filters'
import type { DashboardRecordSource } from './dashboard-record-mapper'

export async function listDashboardRecords(filters: DashboardRecordListFilters): Promise<DashboardRecordSource[]> {
  const prisma = getPrismaClient()
  const records = await prisma.drDashboardIndexRecord.findMany({
    where: buildDashboardRecordWhere(filters),
    orderBy: [{ sourceDate: 'asc' }, { id: 'asc' }],
  })

  return records as unknown as DashboardRecordSource[]
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
