export type Sg2Environment = 'development' | 'staging' | 'production'
export type Sg2DatabaseIdentity = { projectId: string; branchId: string; endpointId: string; databaseName: string; role: string }
export const SG2_DATABASE_IDENTITIES: Readonly<Record<Sg2Environment, Readonly<Sg2DatabaseIdentity>>>
export function assertSg2Environment(value: unknown): 'development' | 'staging'
export function inspectSg2DatabaseIdentity(connectionString: string): Sg2DatabaseIdentity & { environment: Sg2Environment; hostname: string; schema: string | null; pooled: boolean }
export function assertSg2DatabaseIdentity(input: { appEnv: unknown; connectionString?: string; purpose?: 'market' | 'application' | 'dashboard'; declaredIdentity?: Sg2DatabaseIdentity }): ReturnType<typeof inspectSg2DatabaseIdentity>
export function assertSg2ServiceUrl(input: { appEnv: unknown; component: 'runtime' | 'dashboard'; value?: string; nodeEnv?: string }): string
export function assertSg2WorkerIdentity(env: Record<string, string | undefined>): 'CURRENT_ONLY' | 'VERIFICATION_ONLY'
export function assertSg2ProducerIdentity(env: Record<string, string | undefined>, seriesId: string, historical?: boolean): void
