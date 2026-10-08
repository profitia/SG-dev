import { assertRuntimeDatabaseIdentity } from '@/lib/environment-identity'

import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __sgRuntimePrisma__: PrismaClient | undefined
}

const SG_RUNTIME_SCHEMA = 'sg_runtime_benchmarks'

function ensureSchema(urlValue?: string): string | undefined {
  if (!urlValue) {
    return undefined
  }

  try {
    const parsedUrl = new URL(urlValue)

    if (!parsedUrl.searchParams.has('schema')) {
      parsedUrl.searchParams.set('schema', SG_RUNTIME_SCHEMA)
    }

    return parsedUrl.toString()
  } catch {
    return urlValue
  }
}

const normalizedDatabaseUrl = ensureSchema(process.env.SG_RUNTIME_DATABASE_URL)
const normalizedDirectUrl = ensureSchema(
  process.env.SG_RUNTIME_DIRECT_URL ?? process.env.SG_RUNTIME_DATABASE_URL,
)

if (normalizedDatabaseUrl) {
  assertRuntimeDatabaseIdentity(normalizedDatabaseUrl, 'application')
  process.env.SG_RUNTIME_DATABASE_URL = normalizedDatabaseUrl
}

if (normalizedDirectUrl) {
  assertRuntimeDatabaseIdentity(normalizedDirectUrl, 'application')
  process.env.SG_RUNTIME_DIRECT_URL = normalizedDirectUrl
}

export const prisma =
  globalThis.__sgRuntimePrisma__ ??
  new PrismaClient(
    normalizedDatabaseUrl
      ? {
          datasources: {
            db: {
              url: normalizedDatabaseUrl,
            },
          },
        }
      : undefined,
  )

prisma.$use(async (params, next) => {
  assertRuntimeDatabaseIdentity(normalizedDatabaseUrl, 'application')
  return next(params)
})

if (process.env.NODE_ENV !== 'production') {
  globalThis.__sgRuntimePrisma__ = prisma
}