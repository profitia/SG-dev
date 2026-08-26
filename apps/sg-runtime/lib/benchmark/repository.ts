import type {
  BenchmarkProviderMapping,
  BusinessBenchmark,
  OrganizationBenchmarkSelection,
  Prisma,
} from '@prisma/client'

import { prisma } from '@/lib/db/prisma'
import type { BenchmarkCandidate, SavedBenchmark } from '@/lib/benchmark/contracts'
import { resolveSavedBenchmarkDisplayName } from '@/lib/benchmark/presentation'

type MappingWithRelations = BenchmarkProviderMapping & {
  businessBenchmark: BusinessBenchmark & {
    selections: OrganizationBenchmarkSelection[]
  }
}

function toSavedBenchmark(mapping: MappingWithRelations): SavedBenchmark {
  const latestSelection = mapping.businessBenchmark.selections
    .filter((selection: OrganizationBenchmarkSelection) => selection.organizationId === mapping.organizationId)
    .sort((left: OrganizationBenchmarkSelection, right: OrganizationBenchmarkSelection) => right.createdAt.getTime() - left.createdAt.getTime())[0]

  return {
    selectionId: latestSelection?.id ?? '',
    businessBenchmarkId: mapping.businessBenchmark.id,
    organizationId: mapping.organizationId,
    displayName: resolveSavedBenchmarkDisplayName({
      displayName: mapping.businessBenchmark.displayName,
      description: mapping.businessBenchmark.description,
      title: mapping.title,
      sourceLabel: mapping.sourceLabel,
      metadata: mapping.metadataJson,
    }),
    provider: {
      providerCode: 'MACROBOND',
      displayName: mapping.providerDisplayName,
    },
    providerSeries: {
      provider: {
        providerCode: 'MACROBOND',
        displayName: mapping.providerDisplayName,
      },
      providerSeriesId: mapping.providerSeriesId,
      providerSeriesKey: mapping.providerSeriesKey,
    },
    frequency: mapping.frequency,
    currency: mapping.currency,
    unit: mapping.unit,
    source: mapping.sourceLabel,
    selectedAt: latestSelection?.createdAt.toISOString() ?? mapping.createdAt.toISOString(),
  }
}

export async function listSavedBenchmarksForOrganization(organizationId: string) {
  const selections = await prisma.organizationBenchmarkSelection.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: {
      businessBenchmark: {
        include: {
          providerMapping: {
            where: { isPrimary: true },
            take: 1,
          },
          selections: true,
        },
      },
    },
  })

  return selections
    .map((selection: OrganizationBenchmarkSelection & {
      businessBenchmark: BusinessBenchmark & {
        providerMapping: BenchmarkProviderMapping[]
        selections: OrganizationBenchmarkSelection[]
      }
    }) => {
      const mapping = selection.businessBenchmark.providerMapping[0]
      if (!mapping) {
        return null
      }

      return toSavedBenchmark({
        ...mapping,
        businessBenchmark: {
          ...selection.businessBenchmark,
          selections: selection.businessBenchmark.selections,
        },
      })
    })
    .filter((item: SavedBenchmark | null): item is SavedBenchmark => item !== null)
}

export async function saveBenchmarkSelection(params: {
  organizationId: string
  userId: string
  candidate: BenchmarkCandidate
  metadata: Record<string, unknown>
}) {
  const { organizationId, userId, candidate, metadata } = params

  return prisma.$transaction(async (tx) => {
    const existingMapping = await tx.benchmarkProviderMapping.findUnique({
      where: {
        organizationId_providerCode_providerSeriesId: {
          organizationId,
          providerCode: candidate.provider.providerCode,
          providerSeriesId: candidate.providerSeries.providerSeriesId,
        },
      },
      include: {
        businessBenchmark: {
          include: {
            selections: true,
          },
        },
      },
    })

    if (existingMapping) {
      await tx.organizationBenchmarkSelection.upsert({
        where: {
          organizationId_businessBenchmarkId: {
            organizationId,
            businessBenchmarkId: existingMapping.businessBenchmarkId,
          },
        },
        update: {
          createdByUserId: userId,
        },
        create: {
          organizationId,
          businessBenchmarkId: existingMapping.businessBenchmarkId,
          createdByUserId: userId,
        },
      })

      const refreshed = await tx.benchmarkProviderMapping.findUniqueOrThrow({
        where: { id: existingMapping.id },
        include: {
          businessBenchmark: {
            include: {
              selections: true,
            },
          },
        },
      })

      return toSavedBenchmark(refreshed)
    }

    const benchmark = await tx.businessBenchmark.create({
      data: {
        organizationId,
        displayName: candidate.displayName,
        description: candidate.description,
        concept: candidate.displayName,
        createdByUserId: userId,
      },
    })

    const mapping = await tx.benchmarkProviderMapping.create({
      data: {
        businessBenchmarkId: benchmark.id,
        organizationId,
        providerCode: candidate.provider.providerCode,
        providerDisplayName: candidate.provider.displayName,
        providerSeriesId: candidate.providerSeries.providerSeriesId,
        providerSeriesKey: candidate.providerSeries.providerSeriesKey,
        title: candidate.displayName,
        frequency: candidate.frequency,
        currency: candidate.currency,
        unit: candidate.unit,
        sourceLabel: candidate.source,
        region: candidate.region,
        metadataJson: metadata as Prisma.InputJsonValue,
        isPrimary: true,
      },
      include: {
        businessBenchmark: {
          include: {
            selections: true,
          },
        },
      },
    })

    await tx.organizationBenchmarkSelection.create({
      data: {
        organizationId,
        businessBenchmarkId: benchmark.id,
        createdByUserId: userId,
      },
    })

    const refreshed = await tx.benchmarkProviderMapping.findUniqueOrThrow({
      where: { id: mapping.id },
      include: {
        businessBenchmark: {
          include: {
            selections: true,
          },
        },
      },
    })

    return toSavedBenchmark(refreshed)
  })
}