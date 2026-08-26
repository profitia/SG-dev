import type { CategoryRecord } from '@/lib/category/contracts'
import { CategoryAppError } from '@/lib/category/errors'
import {
  createCategory,
  getCategoryForOrganization,
  listCategoriesForOrganization,
  updateCategory,
} from '@/lib/category/repository'

function normalizeName(name: string) {
  const normalized = name.trim()
  if (!normalized) {
    throw new CategoryAppError('VALIDATION_ERROR', 'Category name is required.', 400)
  }
  return normalized
}

function normalizeWeightPercent(weightPercent: number) {
  if (!Number.isInteger(weightPercent) || weightPercent < 0 || weightPercent > 100) {
    throw new CategoryAppError('INVALID_COMPONENT_WEIGHT', 'Component weight must be a whole number between 0 and 100.', 400)
  }

  return weightPercent
}

function normalizeComponents(components: Array<{ name: string; businessBenchmarkId: string; weightPercent: number }>) {
  return components.map((component) => {
    const name = component.name.trim()
    const businessBenchmarkId = component.businessBenchmarkId.trim()
    const weightPercent = normalizeWeightPercent(component.weightPercent)

    if (!name) {
      throw new CategoryAppError('VALIDATION_ERROR', 'Component could not be added.', 400)
    }

    if (!businessBenchmarkId) {
      throw new CategoryAppError('VALIDATION_ERROR', 'Benchmark could not be attached.', 400)
    }

    return {
      name,
      businessBenchmarkId,
      weightPercent,
    }
  })
}

export async function listCategories(organizationId: string) {
  return listCategoriesForOrganization(organizationId)
}

export async function getCategory(organizationId: string, categoryId: string) {
  return getCategoryForOrganization(organizationId, categoryId)
}

export async function createOrUpdateCategory(params: {
  organizationId: string
  userId: string
  categoryId?: string
  name: string
  components: Array<{
    name: string
    businessBenchmarkId: string
    weightPercent: number
  }>
}): Promise<CategoryRecord> {
  const name = normalizeName(params.name)
  const components = normalizeComponents(params.components)

  if (params.categoryId) {
    return updateCategory({
      organizationId: params.organizationId,
      categoryId: params.categoryId,
      name,
      components,
    })
  }

  return createCategory({
    organizationId: params.organizationId,
    userId: params.userId,
    name,
    components,
  })
}