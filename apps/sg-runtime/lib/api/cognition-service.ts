/**
 * lib/api/cognition-service.ts — sg-runtime
 * PCOS-8 — SG2 Operational API Runtime
 *
 * Cognition API service interface for sg-runtime route handlers.
 * This interface is the stable boundary between the Next.js runtime
 * and the PCOS cognition substrate.
 *
 * IMPLEMENTATION NOTE:
 * The concrete implementation (CognitionApiService from @sg/pcos-runtime)
 * is wired in lib/api/cognition-instance.ts once pcos-runtime is linked.
 * Route handlers import from this interface only — never from pcos-runtime directly.
 *
 * ARCHITECTURAL CONSTRAINTS:
 * - All methods are org-scoped (orgId: string)
 * - All methods return cognition-contract responses only
 * - No warehouse semantics in this interface
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared response types (self-contained in sg-runtime)
// ─────────────────────────────────────────────────────────────────────────────

export interface CognitionMeta {
  orgId:          string
  requestId:      string
  timestamp:      string
  retrievalRunId?: string
  lineage?: {
    lineageRef:    string
    sourceType:    string
    derivedFrom?:  string[]
    retrievalRunId?: string
  }
  confidence?: {
    score: number
    basis: string
  }
}

export interface SimpleMeta {
  orgId:     string
  requestId: string
  timestamp: string
}

export interface GraphNode {
  nodeRef:  string
  nodeType: string
  label?:   string
  metadata?: Record<string, unknown>
}

export interface GraphEdge {
  fromRef:          string
  toRef:            string
  relationshipType: string
  weight?:          number
}

export interface SemanticResultItem {
  entityRef:      string
  entityType:     string
  similarityScore: number
  metadata?:      Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// ICognitionApiService — stable boundary interface
// ─────────────────────────────────────────────────────────────────────────────

export interface ICognitionApiService {
  // Procurement
  getProcurementContext(orgId: string, requestId: string, commodityRef: string, sessionId?: string, depth?: string, retrievalRunId?: string): Promise<unknown>
  getProcurementIntelligence(orgId: string, requestId: string, commodityRef: string, entityType?: string): Promise<unknown>
  getProcurementCategories(orgId: string, requestId: string, limit?: number): Promise<unknown>
  hydrateProcurementContext(orgId: string, requestId: string, body: Record<string, unknown>): Promise<unknown>
  runProcurementRetrieval(orgId: string, requestId: string, body: Record<string, unknown>): Promise<unknown>

  // Retrieval
  runSemanticRetrieval(orgId: string, requestId: string, body: Record<string, unknown>): Promise<unknown>
  runGraphRetrieval(orgId: string, requestId: string, body: Record<string, unknown>): Promise<unknown>
  runRAGRetrieval(orgId: string, requestId: string, body: Record<string, unknown>): Promise<unknown>
  runContextualRetrieval(orgId: string, requestId: string, body: Record<string, unknown>): Promise<unknown>

  // Negotiation
  buildNegotiationContext(orgId: string, requestId: string, body: Record<string, unknown>): Promise<unknown>
  hydrateNegotiationContext(orgId: string, requestId: string, body: Record<string, unknown>): Promise<unknown>
  getNegotiationIntelligence(orgId: string, requestId: string, body: Record<string, unknown>): Promise<unknown>
  runNegotiationRetrieval(orgId: string, requestId: string, body: Record<string, unknown>): Promise<unknown>

  // Supplier
  getSupplierProfile(orgId: string, requestId: string, supplierRef: string): Promise<unknown>
  getSupplierRisk(orgId: string, requestId: string, supplierRef: string): Promise<unknown>
  getSupplierGraph(orgId: string, requestId: string, supplierRef: string, depth?: number): Promise<unknown>
  getSupplierIntelligence(orgId: string, requestId: string, supplierRef: string): Promise<unknown>

  // AI Hydration
  hydrateProcurement(orgId: string, requestId: string, body: Record<string, unknown>): Promise<unknown>
  hydrateAssistant(orgId: string, requestId: string, body: Record<string, unknown>): Promise<unknown>
  hydrateSupplier(orgId: string, requestId: string, body: Record<string, unknown>): Promise<unknown>
  hydrateIntelligence(orgId: string, requestId: string, body: Record<string, unknown>): Promise<unknown>

  // OpenAPI
  openApiSchema(): unknown
}

// ─────────────────────────────────────────────────────────────────────────────
// getCognitionService — singleton accessor
// Returns the configured CognitionApiService instance.
// Throws if not yet initialized (prevents silent failures).
// ─────────────────────────────────────────────────────────────────────────────

let _instance: ICognitionApiService | null = null

export function setCognitionService(instance: ICognitionApiService): void {
  _instance = instance
}

export function getCognitionService(): ICognitionApiService {
  if (!_instance) {
    throw new Error(
      '[sg-runtime] CognitionApiService not initialized. ' +
      'Call setCognitionService() before using API routes. ' +
      'See lib/api/cognition-instance.ts for wiring instructions.'
    )
  }
  return _instance
}
