/**
 * env.ts — Environment variable validation for sg-runtime
 *
 * Uses Zod to parse and validate environment variables at startup.
 *
 * SCAFFOLD RULES:
 * - Server-only variables (DATABASE_URL, CLERK_SECRET_KEY, etc.) are treated as
 *   optional at this scaffold stage. They will become required once the respective
 *   integrations (Neon, Clerk, OpenAI) are configured.
 * - NEXT_PUBLIC_* variables are safe for client-side use. They must never contain secrets.
 * - Never import this file from client components. Use `publicEnv` exports only in
 *   client-safe contexts.
 *
 * IMPORTANT: This file must never be imported by PMOS or VECTOR tooling.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Server environment schema
// Private variables — server-side only. Never expose to client components.
// ---------------------------------------------------------------------------

const serverEnvSchema = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database — optional until Neon is configured per environment
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  SG_RUNTIME_DATABASE_URL: z.string().optional(),
  SG_RUNTIME_DIRECT_URL: z.string().optional(),
  MARKET_DATA_DATABASE_URL: z.string().optional(),
  MARKET_DATA_DIRECT_URL: z.string().optional(),
  FORECASTING_LAB_ROOT: z.string().optional(),
  FORECASTING_PYTHON_BIN: z.string().optional(),

  // Clerk — optional until Clerk apps are created per environment
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),

  // Macrobond — required only for benchmark discovery provider calls
  MACROBOND_CLIENT_ID: z.string().optional(),
  MACROBOND_CLIENT_SECRET: z.string().optional(),
  MACROBOND_BASE_URL: z.string().url().optional(),
  MACROBOND_TOKEN_URL: z.string().url().optional(),

  // Dashboard Preview — canonical analytics application base URL
  DASHBOARD_PREVIEW_BASE_URL: z.string().url().optional(),

  // Transitional deployment flag for the standalone public benchmark component.
  // Exact string 'true' is required to enable it; malformed values fail closed.
  SG_RUNTIME_TEMPORARY_PUBLIC_BENCHMARK_COMPONENT: z.preprocess(
    (value) => (value === 'true' || value === 'false' ? value : undefined),
    z.enum(['true', 'false']).optional(),
  ),

  // Explicit deployment profile flag for the PORR password-protected demo shell.
  // Exact string 'true' is required to enable it; malformed values fail closed.
  SG_RUNTIME_PORR_DEMO: z.preprocess(
    (value) => (value === 'true' || value === 'false' ? value : undefined),
    z.enum(['true', 'false']).optional(),
  ),

  // Shared-password demo access. Never expose these client-side.
  PORR_DEMO_PASSWORD: z.string().optional(),
  PORR_DEMO_SESSION_SECRET: z.string().optional(),

  // Internal service credential for Dashboard Preview -> SG Runtime production forecast reads
  SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN: z.string().optional(),

  // Development-only org context fallback for local vertical-slice validation.
  SG_RUNTIME_DEV_ORG_ID: z.string().optional(),
  SG_RUNTIME_DEV_USER_ID: z.string().optional(),
  SG_RUNTIME_DEV_ORG_ROLE: z.string().optional(),

  // OpenAI — optional until API key is configured per environment
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Public environment schema
// Safe for client components. Must never include secrets.
// ---------------------------------------------------------------------------

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Parse and export
// ---------------------------------------------------------------------------

const _serverEnv = serverEnvSchema.safeParse(process.env)
const _publicEnv = publicEnvSchema.safeParse(process.env)

if (!_serverEnv.success) {
  console.error('[sg-runtime] Invalid server environment variables:')
  console.error(_serverEnv.error.flatten().fieldErrors)
  // Do not throw at scaffold stage — external integrations may not be configured yet.
  // Convert to throw once Neon/Clerk/OpenAI are required.
}

if (!_publicEnv.success) {
  console.error('[sg-runtime] Invalid public environment variables:')
  console.error(_publicEnv.error.flatten().fieldErrors)
}

function resolveDevelopmentRuntime() {
  return process.env.NODE_ENV !== 'production' && serverEnv.APP_ENV === 'development'
}

/**
 * Server-only environment variables.
 * Import this only in server components, API routes and server actions.
 * Never import in client components.
 */
export const serverEnv = _serverEnv.success ? _serverEnv.data : serverEnvSchema.parse({})

/**
 * Development-only auth fallback must never activate in a production runtime,
 * even when APP_ENV is missing or invalid and falls back during parsing.
 */
export const isDevelopmentRuntime = resolveDevelopmentRuntime()

/**
 * Transitional standalone Benchmark Finder deployment profile.
 * This must remain an explicit opt-in and defaults closed for all other SG runtimes.
 */
export const isTemporaryPublicBenchmarkComponentProfile = (
  serverEnv.SG_RUNTIME_TEMPORARY_PUBLIC_BENCHMARK_COMPONENT === 'true'
)

/**
 * PORR demo shell must remain an explicit opt-in profile and defaults closed
 * for every existing SG Runtime deployment.
 */
export const isPorrDemoProfile = serverEnv.SG_RUNTIME_PORR_DEMO === 'true'

/**
 * Public environment variables — safe for client-side use.
 * These are prefixed with NEXT_PUBLIC_ and contain no secrets.
 */
export const publicEnv = _publicEnv.success ? _publicEnv.data : publicEnvSchema.parse({})
