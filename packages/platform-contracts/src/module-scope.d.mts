import type { AccessQuery } from './access-store.mjs'
import type { Environment } from './operation-context.mjs'
export type ModuleId = 'benchmark' | 'category' | 'supplier_report'
export declare const MODULE_SCOPE_CONTRACT: Readonly<{ id: 'profitia.module-scope'; version: '1.0.0' }>
export declare const moduleSchemaUrl: string
export declare function moduleSchemaDigest(): Promise<string>
export declare function moduleScopeSourceDigest(): Promise<string>
export declare function createModuleScopeGuard(options: {
  applicationId: string; environment: Environment; moduleId: ModuleId; schemaDigest: string; now?: () => number
}): Readonly<{
  contract: typeof MODULE_SCOPE_CONTRACT
  /** Call only after the accepted private host established its current scope. */
  bind(query: AccessQuery, scope: { organisationId: string; userId: string }): Promise<Readonly<{
    moduleId: ModuleId; moduleBindingId: string; version: string; sourceRef: string; expiresAt: string; transactionId: string
  }>>
}>
