import type {
  BenchmarkProviderMapping,
  BusinessBenchmark,
  Category,
  CategoryCostComponent,
  Prisma,
} from '@prisma/client'

import { prisma } from '@/lib/db/prisma'
import type { CategoryRecord, CategoryStatus, CategorySummary } from '@/lib/category/contracts'
import { CategoryAppError } from '@/lib/category/errors'

/** Native private calls reuse their already authorised transaction. The legacy
 * default remains the existing client; no request selects this adapter. */
export type CategoryRepositoryOptions = { transaction?: Prisma.TransactionClient; newCategoryId?: string }
const database = (options: CategoryRepositoryOptions) => options.transaction ?? prisma

type CategoryWithRelations = Category & {
  costComponents: Array<CategoryCostComponent & {
    businessBenchmark: BusinessBenchmark & {
      providerMapping: BenchmarkProviderMapping[]
    }
  }>
}

function sumComponentWeights(components: Array<{ weightPercent: number }>) {
  return components.reduce((total, component) => total + component.weightPercent, 0)
}

function deriveCategoryStatus(componentCount: number, totalWeightPercent: number): CategoryStatus {
  return componentCount >= 2 && totalWeightPercent === 100 ? 'READY' : 'DRAFT'
}

function assertValidComponentWeights(components: Array<{ weightPercent: number }>) {
  const totalWeightPercent = sumComponentWeights(components)
  if (totalWeightPercent > 100) {
    throw new CategoryAppError('CATEGORY_WEIGHT_EXCEEDS_100', 'Total component allocation cannot exceed 100%.', 400)
  }

  return totalWeightPercent
}

function toCategoryRecord(category: CategoryWithRelations): CategoryRecord {
  const components = [...category.costComponents]
    .sort((left, right) => left.position - right.position)
    .map((component) => {
      const mapping = component.businessBenchmark.providerMapping[0]
      if (!mapping) {
        throw new CategoryAppError('BENCHMARK_NOT_FOUND', 'Benchmark could not be attached.', 404)
      }

      return {
        id: component.id,
        name: component.name,
        position: component.position,
        weightPercent: component.weightPercent,
        benchmark: {
          businessBenchmarkId: component.businessBenchmarkId,
          displayName: component.businessBenchmark.displayName,
          provider: {
            providerCode: 'MACROBOND' as const,
            displayName: mapping.providerDisplayName,
          },
          providerSeries: {
            provider: {
              providerCode: 'MACROBOND' as const,
              displayName: mapping.providerDisplayName,
            },
            providerSeriesId: mapping.providerSeriesId,
            providerSeriesKey: mapping.providerSeriesKey,
          },
          frequency: mapping.frequency,
          currency: mapping.currency,
          unit: mapping.unit,
          source: mapping.sourceLabel,
        },
      }
    })

  const allocatedPercent = sumComponentWeights(components)

  return {
    id: category.id,
    organizationId: category.organizationId,
    name: category.name,
    status: deriveCategoryStatus(components.length, allocatedPercent),
    componentCount: components.length,
    allocatedPercent,
    remainingPercent: Math.max(0, 100 - allocatedPercent),
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    components,
  }
}

async function getOwnedBenchmarks(organizationId: string, businessBenchmarkIds: string[], options: CategoryRepositoryOptions = {}) {
  const uniqueIds = [...new Set(businessBenchmarkIds)]
  if (uniqueIds.length === 0) {
    return []
  }

  const benchmarks = await database(options).businessBenchmark.findMany({
    where: {
      organizationId,
      id: { in: uniqueIds },
    },
  })

  if (benchmarks.length !== uniqueIds.length) {
    throw new CategoryAppError('BENCHMARK_NOT_FOUND', 'Benchmark could not be attached.', 404)
  }

  return benchmarks
}

async function findCategoryOwnedByOrganization(organizationId: string, categoryId: string, options: CategoryRepositoryOptions = {}) {
  return database(options).category.findFirst({
    where: {
      id: categoryId,
      organizationId,
    },
    include: {
      costComponents: {
        orderBy: { position: 'asc' },
        include: {
          businessBenchmark: {
            include: {
              providerMapping: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  })
}

export async function listCategoriesForOrganization(organizationId: string, options: CategoryRepositoryOptions = {}): Promise<CategorySummary[]> {
  const categories = await database(options).category.findMany({
    where: { organizationId },
    orderBy: { updatedAt: 'desc' },
    include: {
      costComponents: {
        select: {
          weightPercent: true,
        },
      },
    },
  })

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    status: deriveCategoryStatus(category.costComponents.length, sumComponentWeights(category.costComponents)),
    componentCount: category.costComponents.length,
    updatedAt: category.updatedAt.toISOString(),
  }))
}

export async function getCategoryForOrganization(organizationId: string, categoryId: string, options: CategoryRepositoryOptions = {}) {
  const category = await findCategoryOwnedByOrganization(organizationId, categoryId, options)
  if (!category) {
    throw new CategoryAppError('CATEGORY_NOT_FOUND', 'Category not found.', 404)
  }

  return toCategoryRecord(category)
}

export async function createCategory(params: {
  organizationId: string
  userId: string
  name: string
  components: Array<{
    name: string
    businessBenchmarkId: string
    weightPercent: number
  }>
}, options: CategoryRepositoryOptions = {}) {
  const { organizationId, userId, name, components } = params
  await getOwnedBenchmarks(organizationId, components.map((component) => component.businessBenchmarkId), options)
  const totalWeightPercent = assertValidComponentWeights(components)

  const category = await database(options).category.create({
    data: {
      ...(options.newCategoryId !== undefined ? { id: options.newCategoryId } : {}),
      organizationId,
      name,
      status: deriveCategoryStatus(components.length, totalWeightPercent),
      createdByUserId: userId,
      costComponents: {
        create: components.map((component, index) => ({
          name: component.name,
          businessBenchmarkId: component.businessBenchmarkId,
          weightPercent: component.weightPercent,
          position: index,
        })),
      },
    },
    include: {
      costComponents: {
        orderBy: { position: 'asc' },
        include: {
          businessBenchmark: {
            include: {
              providerMapping: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  })

  return toCategoryRecord(category)
}

export async function updateCategory(params: {
  organizationId: string
  categoryId: string
  name: string
  components: Array<{
    name: string
    businessBenchmarkId: string
    weightPercent: number
  }>
}, options: CategoryRepositoryOptions = {}) {
  const { organizationId, categoryId, name, components } = params
  const totalWeightPercent = assertValidComponentWeights(components)

  const update = async (tx: Prisma.TransactionClient) => {
    const category = await tx.category.findFirst({
      where: {
        id: categoryId,
        organizationId,
      },
    })

    if (!category) {
      throw new CategoryAppError('CATEGORY_NOT_FOUND', 'Category not found.', 404)
    }

    const uniqueIds = [...new Set(components.map((component) => component.businessBenchmarkId))]
    if (uniqueIds.length > 0) {
      const benchmarks = await tx.businessBenchmark.findMany({
        where: {
          organizationId,
          id: { in: uniqueIds },
        },
      })

      if (benchmarks.length !== uniqueIds.length) {
        throw new CategoryAppError('BENCHMARK_NOT_FOUND', 'Benchmark could not be attached.', 404)
      }
    }

    await tx.category.update({
      where: { id: categoryId },
      data: {
        name,
        status: deriveCategoryStatus(components.length, totalWeightPercent),
      },
    })

    await tx.categoryCostComponent.deleteMany({
      where: { categoryId },
    })

    if (components.length > 0) {
      await tx.categoryCostComponent.createMany({
        data: components.map((component, index) => ({
          categoryId,
          name: component.name,
          businessBenchmarkId: component.businessBenchmarkId,
          weightPercent: component.weightPercent,
          position: index,
        })),
      })
    }
  }
  if (options.transaction) await update(options.transaction)
  else await prisma.$transaction(update)

  const refreshed = await findCategoryOwnedByOrganization(organizationId, categoryId, options)
  if (!refreshed) {
    throw new CategoryAppError('CATEGORY_NOT_FOUND', 'Category not found.', 404)
  }

  return toCategoryRecord(refreshed)
}