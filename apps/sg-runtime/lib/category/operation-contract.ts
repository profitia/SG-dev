import { z } from 'zod'
import { OperationDenied, type OperationContext } from '@profitia/platform-contracts/operation-context'

export const CATEGORY_HEADERS = Object.freeze({ 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' })
export const CATEGORY_PROJECTION = 'sg2-category-response-v1'
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const component = z.object({ name: z.string().trim().min(1).max(120), businessBenchmarkId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,128}$/),
  weightPercent: z.coerce.number().int().min(0).max(100) }).strict()
export const categoryBodySchema = z.object({ name: z.string().trim().min(1).max(120), components: z.array(component).max(12) }).strict()
  .refine(body => body.components.reduce((sum, item) => sum + item.weightPercent, 0) <= 100)
const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list'), categoryId: z.null(), body: z.null() }).strict(),
  z.object({ action: z.literal('detail'), categoryId: id, body: z.null() }).strict(),
  z.object({ action: z.literal('create'), categoryId: z.string().uuid(), body: categoryBodySchema }).strict(),
  z.object({ action: z.literal('update'), categoryId: id, body: categoryBodySchema }).strict(),
])
export type CategoryOperationInput = z.infer<typeof input>
export function readCategoryOperation(value: unknown): CategoryOperationInput {
  const result = input.safeParse(value)
  if (!result.success) throw new OperationDenied('CONTEXT_INVALID')
  return result.data
}
export function categoryOperation(input: CategoryOperationInput) {
  return input.action === 'list' || input.action === 'detail' ? 'category.read' : 'category.write'
}
export function categoryResourceId(input: CategoryOperationInput, organisationId: string) {
  return input.action === 'list' ? `categories:${organisationId}` : `category:${input.categoryId}`
}
const provider = z.object({ providerCode: z.literal('MACROBOND'), displayName: z.string() }).strict()
const providerSeries = z.object({ provider, providerSeriesId: z.string(), providerSeriesKey: z.string().nullable() }).strict()
const benchmark = z.object({ businessBenchmarkId: id, displayName: z.string(), provider, providerSeries,
  frequency: z.string().nullable(), currency: z.string().nullable(), unit: z.string().nullable(), source: z.string().nullable() }).strict()
const status = z.enum(['DRAFT','READY'])
const summary = z.object({ id, name: z.string(), status, componentCount: z.number().int().min(0), updatedAt: z.string().datetime() }).strict()
const record = z.object({ id, organizationId: z.string().uuid(), name: z.string(), status,
  componentCount: z.number().int().min(0), allocatedPercent: z.number().int().min(0).max(100),
  remainingPercent: z.number().int().min(0).max(100), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  components: z.array(z.object({ id, name: z.string(), position: z.number().int().min(0),
    weightPercent: z.number().int().min(0).max(100), benchmark }).strict()).max(12) }).strict()
export const CATEGORY_BUSINESS_ERRORS = Object.freeze({
  VALIDATION_ERROR: { status: 400, message: 'Category could not be saved.' },
  INVALID_COMPONENT_WEIGHT: { status: 400, message: 'Component weight must be a whole number between 0 and 100.' },
  CATEGORY_WEIGHT_EXCEEDS_100: { status: 400, message: 'Total component allocation cannot exceed 100%.' },
  BENCHMARK_NOT_FOUND: { status: 404, message: 'Benchmark could not be attached.' },
  CATEGORY_NOT_FOUND: { status: 404, message: 'Category not found.' },
})
const refuse = (): never => { throw new OperationDenied('RESOURCE_SCOPE_MISMATCH') }

/** Closed host-owned DTO, never a caller response/owner claim. Data ownership
 * is enforced by the native transaction and restrictive private SQL policies. */
export async function projectCategoryResponse(value: unknown, context: Readonly<OperationContext>): Promise<Response> {
  if (!(value instanceof Response) || ![200,201].includes(value.status)
    || value.headers.get('content-type') !== 'application/json'
    || value.headers.get('cache-control') !== 'private, no-store' || value.headers.get('vary') !== 'Cookie, Authorization'
    || [...value.headers.keys()].some(key => !['content-type','cache-control','vary'].includes(key))) return refuse()
  const selected = readCategoryOperation(context.payload)
  if (!context.organisationId || context.operation !== categoryOperation(selected)
    || context.resourceId !== categoryResourceId(selected, context.organisationId)) return refuse()
  let body: unknown
  try { const text = await value.clone().text(); if (Buffer.byteLength(text, 'utf8') > 4 * 1024 * 1024) return refuse(); body = JSON.parse(text) }
  catch { return refuse() }
  if (value.status !== (selected.action === 'create' ? 201 : 200)) return refuse()
  if (selected.action === 'list') {
    if (!z.object({ items: z.array(summary).max(10000) }).strict().safeParse(body).success) return refuse()
  } else {
    const parsed = record.safeParse(body)
    if (!parsed.success || parsed.data.organizationId !== context.organisationId || parsed.data.id !== selected.categoryId
      || parsed.data.componentCount !== parsed.data.components.length
      || parsed.data.components.reduce((sum, item) => sum + item.weightPercent, 0) !== parsed.data.allocatedPercent
      || parsed.data.remainingPercent !== 100 - parsed.data.allocatedPercent
      || parsed.data.status !== (parsed.data.componentCount >= 2 && parsed.data.allocatedPercent === 100 ? 'READY' : 'DRAFT')) return refuse()
  }
  return value
}
