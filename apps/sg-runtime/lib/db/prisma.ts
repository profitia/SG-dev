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
  process.env.SG_RUNTIME_DATABASE_URL = normalizedDatabaseUrl
}

if (normalizedDirectUrl) {
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

if (process.env.NODE_ENV !== 'production') {
  globalThis.__sgRuntimePrisma__ = prisma
}