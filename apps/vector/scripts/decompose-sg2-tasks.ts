/**
 * SG2 Task Decomposition Engine
 * ETAP 09 — SG2 Task Decomposition + Execution Readiness
 *
 * Seeds:
 * - ImplementationWaves (8 waves)
 * - ImplementationTasks (30 tasks, 7 critical-path systems decomposed)
 * - ImplTaskDependencies (task-level dependency graph)
 * - Computes readiness states
 * - Updates CognitionSnapshot with execution pressure analysis
 *
 * Run: npm run decompose:tasks
 * IDEMPOTENT: safe to re-run (deleteMany + recreate)
 */

import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION WAVES
// ─────────────────────────────────────────────────────────────────────────────
const WAVES = [
  { order: 1, name: "FOUNDATION",                description: "Runtime bootstrap, git, env, deployment infrastructure — COMPLETE",    status: "COMPLETE" },
  { order: 2, name: "AUTH + TENANT",             description: "Organization system, tenant isolation, RBAC, session management",       status: "ACTIVE"   },
  { order: 3, name: "DATA + INGESTION",          description: "Spend data models, supplier data, CSV ingestion, category taxonomy",   status: "PLANNED"  },
  { order: 4, name: "PROCUREMENT INTELLIGENCE",  description: "Should-cost engine, supplier intelligence, forecasting, negotiation",  status: "PLANNED"  },
  { order: 5, name: "AI + COGNITION",            description: "AI assistant runtime, conversational layer, cognition engine",         status: "PLANNED"  },
  { order: 6, name: "UX + APPLICATION",          description: "Dashboard, procurement workflows, negotiation UI, notification",       status: "PLANNED"  },
  { order: 7, name: "OBSERVABILITY + EXPORTS",   description: "Health monitoring, telemetry, export engine, PDF reports",             status: "PLANNED"  },
  { order: 8, name: "PRODUCTION HARDENING",      description: "Security audit, performance, rate limiting, resilience",               status: "PLANNED"  },
]

// ─────────────────────────────────────────────────────────────────────────────
// TASK REGISTRY
// localId → task definition
// readiness: READY = can start now, BLOCKED = external blocker, NOT_READY = deps unmet
// ─────────────────────────────────────────────────────────────────────────────
type TaskDef = {
  localId:            string
  title:              string
  description:        string
  buildPrompt:        string
  implementationType: string
  readiness:          string
  complexity:         string
  effort:             number
  priority:           string
  system:             string
  stream:             string
  etap:               string
  wave:               string
  deps:               string[]    // localIds this task depends on
}

const TASKS: TaskDef[] = [

  // ── ORGANIZATION SYSTEM ────────────────────────────────────────────────────
  {
    localId:            "ORG-1",
    title:              "Design Organization data model",
    description:        "Define the canonical Organization entity — root SaaS account, workspace linkage, subscription tier, org archetype. This is the foundation of all multi-tenant data isolation in SG2.",
    buildPrompt:        "SYSTEM: Organization System\nSTREAM: AUTH → DATA + AUTH phase\nWAVE: Wave 2 — AUTH + TENANT\nCOMPLEXITY: CRITICAL | EFFORT: 8sp\n\nDELIVERABLES:\n- Prisma Organization model (id, name, slug, type, subscriptionTier, clerkOrgId, createdAt)\n- Workspace-to-Organization FK (workspaceId → orgId)\n- OrganizationType enum: ENTERPRISE | SME | STARTUP\n- SubscriptionTier enum: FREE | STARTER | PROFESSIONAL | ENTERPRISE\n- Multi-tenant convention: all downstream models MUST include orgId\n\nCONSTRAINTS:\n- Must be Clerk-compatible (orgId maps to Clerk org.id)\n- Row-level scoping only (no schema-per-tenant)\n- Must NOT expose cross-org data in any server action\n\nNEXT BUILD TASK: ORG-2 (Implement Organization Prisma schema)\nUNLOCKS: TENANT-1 (Tenant isolation design)",
    implementationType: "ARCHITECTURE",
    readiness:          "READY",
    complexity:         "CRITICAL",
    effort:             8,
    priority:           "CRITICAL",
    system:             "Organization System",
    stream:             "AUTH",
    etap:               "ETAP 3 — Auth + Organization System",
    wave:               "AUTH + TENANT",
    deps:               [],
  },
  {
    localId:            "ORG-2",
    title:              "Implement Organization Prisma schema",
    description:        "Create and migrate the Organization model in Prisma. Add FK references to existing Workspace model. Write idempotent migration.",
    buildPrompt:        "SYSTEM: Organization System\nSTREAM: DATA → DATA + AUTH phase\nDEPENDS ON: ORG-1 (design approved)\n\nDELIVERABLES:\n- prisma/schema.prisma: Organization model with all fields\n- Migration file\n- Update Workspace model to include orgId FK\n- Prisma generate + validate\n\nCONSTRAINTS:\n- Use cuid() for ids\n- All String fields nullable unless explicitly required\n- Add @index on clerkOrgId for auth lookups",
    implementationType: "DATABASE",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             3,
    priority:           "HIGH",
    system:             "Organization System",
    stream:             "DATA",
    etap:               "ETAP 3 — Auth + Organization System",
    wave:               "AUTH + TENANT",
    deps:               ["ORG-1"],
  },
  {
    localId:            "ORG-3",
    title:              "Organization CRUD server actions",
    description:        "Server actions for creating, reading, updating, and archiving organizations. Include Clerk org sync.",
    buildPrompt:        "SYSTEM: Organization System\nSTREAM: AUTH\nDEPENDS ON: ORG-2\n\nDELIVERABLES:\n- src/app/actions/organizations.ts\n- createOrganization(clerkOrgId, name, type)\n- getOrganizationByClerkId(clerkOrgId)\n- updateOrganization(id, data)\n- getOrganizationContext() — returns active org for current session",
    implementationType: "BACKEND",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             5,
    priority:           "HIGH",
    system:             "Organization System",
    stream:             "AUTH",
    etap:               "ETAP 3 — Auth + Organization System",
    wave:               "AUTH + TENANT",
    deps:               ["ORG-2"],
  },
  {
    localId:            "ORG-4",
    title:              "Organization context middleware",
    description:        "Next.js middleware that injects org context into every request. Blocks unauthenticated requests and ensures org scoping.",
    buildPrompt:        "SYSTEM: Organization System\nSTREAM: AUTH\nDEPENDS ON: ORG-3\n\nDELIVERABLES:\n- middleware.ts update: inject orgId from Clerk session\n- src/lib/auth/org-context.ts: getOrgId() server utility\n- Throw 401 if no valid org context\n- Export type OrgContext",
    implementationType: "BACKEND",
    readiness:          "NOT_READY",
    complexity:         "MEDIUM",
    effort:             3,
    priority:           "HIGH",
    system:             "Organization System",
    stream:             "AUTH",
    etap:               "ETAP 3 — Auth + Organization System",
    wave:               "AUTH + TENANT",
    deps:               ["ORG-3"],
  },

  // ── TENANT SYSTEM ──────────────────────────────────────────────────────────
  {
    localId:            "TENANT-1",
    title:              "Design tenant isolation strategy",
    description:        "Decide and document the tenant isolation approach for SG2. Evaluate row-level scoping vs schema-per-tenant. Define data access patterns.",
    buildPrompt:        "SYSTEM: Tenant System\nSTREAM: AUTH\nDEPENDS ON: ORG-1\n\nDELIVERABLES:\n- Architecture Decision Record: tenant isolation\n- Decision: row-level scoping (recommended for SaaS MVP)\n- Convention: every DB model MUST have orgId: String field\n- Prisma middleware pattern for automatic orgId injection\n- Data access layer (DAL) design\n\nCONSTRAINTS:\n- No cross-tenant data leakage allowed under any circumstances\n- orgId filter MUST be applied in every findMany/findFirst query",
    implementationType: "ARCHITECTURE",
    readiness:          "NOT_READY",
    complexity:         "CRITICAL",
    effort:             8,
    priority:           "CRITICAL",
    system:             "Tenant System",
    stream:             "AUTH",
    etap:               "ETAP 3 — Auth + Organization System",
    wave:               "AUTH + TENANT",
    deps:               ["ORG-1"],
  },
  {
    localId:            "TENANT-2",
    title:              "Tenant scoping Prisma middleware",
    description:        "Prisma client extension that automatically applies orgId filter to all read queries. Prevents cross-tenant data access.",
    buildPrompt:        "SYSTEM: Tenant System\nSTREAM: DATA\nDEPENDS ON: TENANT-1\n\nDELIVERABLES:\n- src/lib/db/tenant-prisma.ts: createTenantClient(orgId) factory\n- Prisma.$extends with beforeQuery hook\n- Auto-inject where.orgId for all findMany, findFirst, findUnique\n- Throw TenantViolationError if orgId mismatch detected\n- Unit test: cross-tenant query is rejected",
    implementationType: "DATABASE",
    readiness:          "NOT_READY",
    complexity:         "CRITICAL",
    effort:             5,
    priority:           "CRITICAL",
    system:             "Tenant System",
    stream:             "DATA",
    etap:               "ETAP 3 — Auth + Organization System",
    wave:               "AUTH + TENANT",
    deps:               ["TENANT-1"],
  },
  {
    localId:            "TENANT-3",
    title:              "Tenant context propagation layer",
    description:        "Server-side utility that propagates org context through the request lifecycle. Used by all server actions.",
    buildPrompt:        "SYSTEM: Tenant System\nSTREAM: AUTH\nDEPENDS ON: TENANT-2\n\nDELIVERABLES:\n- src/lib/auth/tenant-context.ts\n- getTenantDb(): returns tenant-scoped Prisma client\n- requireTenantContext(): throws if no org in session\n- withTenant(fn) wrapper for server actions",
    implementationType: "BACKEND",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             5,
    priority:           "HIGH",
    system:             "Tenant System",
    stream:             "AUTH",
    etap:               "ETAP 3 — Auth + Organization System",
    wave:               "AUTH + TENANT",
    deps:               ["TENANT-2"],
  },
  {
    localId:            "TENANT-4",
    title:              "Tenant-aware server action wrapper",
    description:        "Higher-order function that wraps server actions with tenant context injection and error handling.",
    buildPrompt:        "SYSTEM: Tenant System\nSTREAM: BACKEND\nDEPENDS ON: TENANT-3\n\nDELIVERABLES:\n- tenantAction(fn) wrapper: injects orgId + tenantDb\n- ActionResult<T> type with error + data\n- Error codes: TENANT_VIOLATION, AUTH_REQUIRED, NOT_FOUND",
    implementationType: "BACKEND",
    readiness:          "NOT_READY",
    complexity:         "MEDIUM",
    effort:             3,
    priority:           "HIGH",
    system:             "Tenant System",
    stream:             "VECTOR",
    etap:               "ETAP 3 — Auth + Organization System",
    wave:               "AUTH + TENANT",
    deps:               ["TENANT-3"],
  },

  // ── RBAC ──────────────────────────────────────────────────────────────────
  {
    localId:            "RBAC-1",
    title:              "Design role taxonomy + permission matrix",
    description:        "Define the canonical role hierarchy for SG2. Roles: OWNER, ADMIN, BUYER, ANALYST, VIEWER. Map permissions to features.",
    buildPrompt:        "SYSTEM: RBAC\nSTREAM: AUTH → DATA + AUTH phase\nWAVE: Wave 2 — AUTH + TENANT\nCOMPLEXITY: CRITICAL | EFFORT: 8sp\n\nDELIVERABLES:\n- Role enum: OWNER | ADMIN | BUYER | ANALYST | VIEWER\n- Permission matrix (role → allowed actions)\n- Feature flag scoping (which features require which role)\n- Clerk org role mapping convention\n- Resource-level permissions model (org, workspace, project, negotiation)\n\nCONSTRAINTS:\n- OWNER > ADMIN > BUYER/ANALYST > VIEWER hierarchy\n- All procurement actions require BUYER or higher\n- Export actions require ANALYST or higher\n\nNEXT BUILD TASK: RBAC-2 (Role + Permission Prisma schema)\nUNLOCKS: SESSION-1 (Session management), TENANT-1 (Tenant design needs role model)",
    implementationType: "ARCHITECTURE",
    readiness:          "READY",
    complexity:         "CRITICAL",
    effort:             8,
    priority:           "CRITICAL",
    system:             "RBAC",
    stream:             "AUTH",
    etap:               "ETAP 3 — Auth + Organization System",
    wave:               "AUTH + TENANT",
    deps:               [],
  },
  {
    localId:            "RBAC-2",
    title:              "Role + Permission Prisma schema",
    description:        "Implement OrgMember model with role assignment, permission checks, and role history.",
    buildPrompt:        "SYSTEM: RBAC\nSTREAM: DATA\nDEPENDS ON: RBAC-1\n\nDELIVERABLES:\n- OrgMember model: { id, orgId, userId, clerkUserId, role, createdAt }\n- OrgRole enum from design\n- Permission lookup: canUserPerform(userId, orgId, action)\n- Migration + generate",
    implementationType: "DATABASE",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             3,
    priority:           "HIGH",
    system:             "RBAC",
    stream:             "DATA",
    etap:               "ETAP 3 — Auth + Organization System",
    wave:               "AUTH + TENANT",
    deps:               ["RBAC-1"],
  },
  {
    localId:            "RBAC-3",
    title:              "Permission check server action",
    description:        "Reusable server utility for permission checking. Used by all protected server actions.",
    buildPrompt:        "SYSTEM: RBAC\nSTREAM: AUTH\nDEPENDS ON: RBAC-2\n\nDELIVERABLES:\n- src/lib/auth/permissions.ts\n- checkPermission(userId, orgId, action): Promise<boolean>\n- requirePermission(userId, orgId, action): throws if denied\n- getEffectivePermissions(userId, orgId): returns Permission[]\n- Cache: permissions cached per request (not globally)",
    implementationType: "BACKEND",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             5,
    priority:           "HIGH",
    system:             "RBAC",
    stream:             "AUTH",
    etap:               "ETAP 3 — Auth + Organization System",
    wave:               "AUTH + TENANT",
    deps:               ["RBAC-2"],
  },
  {
    localId:            "RBAC-4",
    title:              "Clerk organization role mapping",
    description:        "Map Clerk organization membership + roles to SG2 OrgMember records. Sync on webhook events.",
    buildPrompt:        "SYSTEM: RBAC\nSTREAM: AUTH\nDEPENDS ON: RBAC-3\n⚠ EXTERNAL BLOCKER: Clerk production keys required\n\nDELIVERABLES:\n- Clerk org membership webhook handler\n- Sync Clerk member roles → OrgMember records\n- Handle: organizationMembership.created, updated, deleted\n- Role mapping: clerk admin → ADMIN, clerk member → BUYER",
    implementationType: "AUTH",
    readiness:          "BLOCKED",
    complexity:         "HIGH",
    effort:             5,
    priority:           "HIGH",
    system:             "RBAC",
    stream:             "AUTH",
    etap:               "ETAP 3 — Auth + Organization System",
    wave:               "AUTH + TENANT",
    deps:               ["RBAC-3"],
  },
  {
    localId:            "RBAC-5",
    title:              "Feature flag system v1",
    description:        "Role-based feature flag system. Controls access to premium features by subscription tier and role.",
    buildPrompt:        "SYSTEM: RBAC\nSTREAM: BACKEND\nDEPENDS ON: RBAC-4\n\nDELIVERABLES:\n- FeatureFlag enum: SHOULD_COST | FORECASTING | NEGOTIATION | EXPORT | NEWSFEED\n- isFeatureEnabled(userId, orgId, flag): boolean\n- React component: <FeatureGate flag={...}>",
    implementationType: "BACKEND",
    readiness:          "NOT_READY",
    complexity:         "MEDIUM",
    effort:             3,
    priority:           "MEDIUM",
    system:             "RBAC",
    stream:             "VECTOR",
    etap:               "ETAP 3 — Auth + Organization System",
    wave:               "AUTH + TENANT",
    deps:               ["RBAC-4"],
  },

  // ── SESSION MANAGEMENT ────────────────────────────────────────────────────
  {
    localId:            "SESSION-1",
    title:              "Clerk webhook handler + user sync",
    description:        "Handle Clerk webhooks to sync user and session data into SG2 DB. Creates User records on first login.",
    buildPrompt:        "SYSTEM: Session Management\nSTREAM: AUTH\n⚠ EXTERNAL BLOCKER: Clerk production keys required (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY)\n\nDELIVERABLES:\n- src/app/api/webhooks/clerk/route.ts\n- Handle: user.created, session.created, organizationMembership.created\n- Create/update User record on user.created\n- Validate Svix webhook signature\n- Return 200 on success, 400 on validation failure",
    implementationType: "AUTH",
    readiness:          "BLOCKED",
    complexity:         "HIGH",
    effort:             5,
    priority:           "CRITICAL",
    system:             "Session Management",
    stream:             "AUTH",
    etap:               "ETAP 3 — Auth + Organization System",
    wave:               "AUTH + TENANT",
    deps:               [],
  },
  {
    localId:            "SESSION-2",
    title:              "Session context server action",
    description:        "Server utility returning the current user's session context: userId, orgId, role, permissions.",
    buildPrompt:        "SYSTEM: Session Management\nSTREAM: AUTH\nDEPENDS ON: SESSION-1\n\nDELIVERABLES:\n- src/lib/auth/session.ts\n- getSessionContext(): Promise<SessionContext>\n- SessionContext: { userId, clerkUserId, orgId, role, email }\n- Throws AuthenticationError if no session\n- Used by ALL protected server actions",
    implementationType: "BACKEND",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             3,
    priority:           "CRITICAL",
    system:             "Session Management",
    stream:             "AUTH",
    etap:               "ETAP 3 — Auth + Organization System",
    wave:               "AUTH + TENANT",
    deps:               ["SESSION-1"],
  },
  {
    localId:            "SESSION-3",
    title:              "Auth-protected route middleware",
    description:        "Next.js middleware that blocks unauthenticated access. Redirects to sign-in, injects auth headers.",
    buildPrompt:        "SYSTEM: Session Management\nSTREAM: AUTH\nDEPENDS ON: SESSION-2\n\nDELIVERABLES:\n- middleware.ts: Clerk middleware configuration\n- Protected routes: all /app/* paths\n- Public routes: /, /sign-in, /sign-up, /api/webhooks/*\n- Redirect: unauthorized → /sign-in?redirect_url=...",
    implementationType: "AUTH",
    readiness:          "NOT_READY",
    complexity:         "MEDIUM",
    effort:             3,
    priority:           "HIGH",
    system:             "Session Management",
    stream:             "AUTH",
    etap:               "ETAP 1 — Runtime Foundation",
    wave:               "AUTH + TENANT",
    deps:               ["SESSION-2"],
  },

  // ── ORCHESTRATION RUNTIME ─────────────────────────────────────────────────
  {
    localId:            "ORCH-1",
    title:              "Design action registry + execution model",
    description:        "Design the core orchestration architecture for SG2. Action registry, execution context, workflow primitives.",
    buildPrompt:        "SYSTEM: Orchestration Runtime\nSTREAM: VECTOR → RUNTIME CORE phase\nWAVE: Wave 2 — AUTH + TENANT\nCOMPLEXITY: CRITICAL | EFFORT: 8sp\n\nDELIVERABLES:\n- Action registry design: ActionType enum + ActionHandler interface\n- ExecutionContext type: { sessionContext, tenantDb, actionId, timestamp }\n- Workflow coordination model: sequential, parallel, conditional\n- Error handling model: ActionError hierarchy\n- Idempotency strategy for all mutating actions\n\nCONSTRAINTS:\n- All actions MUST be tenant-scoped\n- Action handlers MUST be pure functions (no side effects in registry)\n- Retry strategy: max 3 attempts, exponential backoff\n\nNEXT BUILD TASK: ORCH-2 (Server action composition layer)",
    implementationType: "ARCHITECTURE",
    readiness:          "READY",
    complexity:         "CRITICAL",
    effort:             8,
    priority:           "CRITICAL",
    system:             "Orchestration Runtime",
    stream:             "VECTOR",
    etap:               "ETAP 1 — Runtime Foundation",
    wave:               "AUTH + TENANT",
    deps:               [],
  },
  {
    localId:            "ORCH-2",
    title:              "Server action composition layer",
    description:        "Implements the action composition layer — chains server actions with context injection, error handling, and logging.",
    buildPrompt:        "SYSTEM: Orchestration Runtime\nSTREAM: VECTOR\nDEPENDS ON: ORCH-1\n\nDELIVERABLES:\n- src/lib/orchestration/action-registry.ts: registerAction, executeAction\n- composeActions(actions[]): chained executor\n- ActionResult<T> monad with error + data + metadata\n- Execution log: records action execution in ExecutionEvent",
    implementationType: "RUNTIME",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             8,
    priority:           "HIGH",
    system:             "Orchestration Runtime",
    stream:             "VECTOR",
    etap:               "ETAP 1 — Runtime Foundation",
    wave:               "AUTH + TENANT",
    deps:               ["ORCH-1"],
  },
  {
    localId:            "ORCH-3",
    title:              "Execution context provider",
    description:        "Request-scoped execution context that carries session, tenant DB, trace ID, and action metadata.",
    buildPrompt:        "SYSTEM: Orchestration Runtime\nSTREAM: VECTOR\nDEPENDS ON: ORCH-2\n\nDELIVERABLES:\n- src/lib/orchestration/execution-context.ts\n- createExecutionContext(req): ExecutionContext\n- withExecutionContext(fn): server action wrapper\n- Context: { sessionContext, tenantDb, traceId, timestamp, actionChain }",
    implementationType: "RUNTIME",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             5,
    priority:           "HIGH",
    system:             "Orchestration Runtime",
    stream:             "VECTOR",
    etap:               "ETAP 1 — Runtime Foundation",
    wave:               "AUTH + TENANT",
    deps:               ["ORCH-2"],
  },
  {
    localId:            "ORCH-4",
    title:              "Workflow coordination primitives",
    description:        "Sequential and parallel workflow execution primitives. Used by procurement intelligence engines.",
    buildPrompt:        "SYSTEM: Orchestration Runtime\nSTREAM: VECTOR\nDEPENDS ON: ORCH-3\n\nDELIVERABLES:\n- runSequential(steps[]): executes steps in order, passes output\n- runParallel(steps[]): executes steps concurrently, merges results\n- runConditional(condition, ifTrue, ifFalse): branching workflow\n- WorkflowTrace: full execution record with timing",
    implementationType: "RUNTIME",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             8,
    priority:           "HIGH",
    system:             "Orchestration Runtime",
    stream:             "VECTOR",
    etap:               "ETAP 1 — Runtime Foundation",
    wave:               "AUTH + TENANT",
    deps:               ["ORCH-3"],
  },

  // ── INGESTION PIPELINE ────────────────────────────────────────────────────
  {
    localId:            "ING-1",
    title:              "Design ingestion data model",
    description:        "Design the canonical data model for supplier data, spend records, category taxonomy, and ingestion jobs.",
    buildPrompt:        "SYSTEM: Ingestion Pipeline\nSTREAM: INGESTION → DATA + AUTH phase\nWAVE: Wave 3 — DATA + INGESTION\nCOMPLEXITY: CRITICAL | EFFORT: 8sp\n\nDELIVERABLES:\n- Supplier model: { id, orgId, name, vatId, country, status, riskScore }\n- SpendRecord model: { id, orgId, supplierId, categoryId, amount, currency, period }\n- IngestionJob model: { id, orgId, type, status, fileName, rowCount, errors }\n- Category model: { id, orgId, name, parentId, unspscCode }\n- Relationship diagram\n\nCONSTRAINTS:\n- All models MUST include orgId (tenant scoping)\n- SpendRecord amounts stored in cents (integer) to avoid float precision\n- Category taxonomy: supports UNSPSC + custom categories\n\nNEXT BUILD TASK: ING-2 (Supplier schema), ING-3 (Spend schema) — parallel\nUNLOCKS: COST-1 (Should-cost design) when ING-5 complete",
    implementationType: "ARCHITECTURE",
    readiness:          "READY",
    complexity:         "CRITICAL",
    effort:             8,
    priority:           "CRITICAL",
    system:             "Ingestion Pipeline",
    stream:             "INGESTION",
    etap:               "ETAP 2 — Data + Ingestion",
    wave:               "DATA + INGESTION",
    deps:               [],
  },
  {
    localId:            "ING-2",
    title:              "Supplier data schema + migration",
    description:        "Implement Supplier and related models in Prisma. Add indexes for common queries.",
    buildPrompt:        "SYSTEM: Ingestion Pipeline\nSTREAM: DATA\nDEPENDS ON: ING-1\n\nDELIVERABLES:\n- Supplier, SupplierContact, SupplierDocument Prisma models\n- Indexes: orgId, status, country\n- SupplierStatus enum: ACTIVE | INACTIVE | BLACKLISTED | UNDER_REVIEW\n- Migration + generate",
    implementationType: "DATABASE",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             3,
    priority:           "HIGH",
    system:             "Ingestion Pipeline",
    stream:             "DATA",
    etap:               "ETAP 2 — Data + Ingestion",
    wave:               "DATA + INGESTION",
    deps:               ["ING-1"],
  },
  {
    localId:            "ING-3",
    title:              "Spend data schema + category taxonomy",
    description:        "Implement SpendRecord, Category, and CategoryMapping models. Support UNSPSC codes.",
    buildPrompt:        "SYSTEM: Ingestion Pipeline\nSTREAM: DATA\nDEPENDS ON: ING-1 (parallel with ING-2)\n\nDELIVERABLES:\n- SpendRecord, Category, CategoryMapping Prisma models\n- Category: tree structure (parentId self-relation)\n- SpendRecord: amount in cents, currency ISO code, fiscal period\n- Indexes: orgId, supplierId, categoryId, period",
    implementationType: "DATABASE",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             5,
    priority:           "HIGH",
    system:             "Ingestion Pipeline",
    stream:             "DATA",
    etap:               "ETAP 2 — Data + Ingestion",
    wave:               "DATA + INGESTION",
    deps:               ["ING-1"],
  },
  {
    localId:            "ING-4",
    title:              "CSV parser + data normalization engine",
    description:        "Parse uploaded spend/supplier CSV files, normalize data, validate against schema, queue for ingestion.",
    buildPrompt:        "SYSTEM: Ingestion Pipeline\nSTREAM: INGESTION\nDEPENDS ON: ING-2, ING-3\n\nDELIVERABLES:\n- src/lib/ingestion/csv-parser.ts: parseSpendCSV(), parseSupplierCSV()\n- Normalization: trim whitespace, normalize currency codes, parse dates\n- Validation: required fields, type coercion, duplicate detection\n- Error collection: returns { valid: Row[], errors: ParseError[] }\n- Max file size: 50MB, max rows: 100,000",
    implementationType: "INGESTION",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             8,
    priority:           "HIGH",
    system:             "Ingestion Pipeline",
    stream:             "INGESTION",
    etap:               "ETAP 2 — Data + Ingestion",
    wave:               "DATA + INGESTION",
    deps:               ["ING-2", "ING-3"],
  },
  {
    localId:            "ING-5",
    title:              "Ingestion job queue + status tracking",
    description:        "Background job system for processing large ingestion files. Tracks progress, handles errors, reports completion.",
    buildPrompt:        "SYSTEM: Ingestion Pipeline\nSTREAM: INGESTION\nDEPENDS ON: ING-4\n\nDELIVERABLES:\n- IngestionJob lifecycle: PENDING → PROCESSING → COMPLETE | FAILED\n- Server action: createIngestionJob(file, type, orgId)\n- Progress tracking: rowsProcessed / totalRows\n- Error reporting: validation errors stored as JSON\n- Retry: failed jobs retried up to 3 times",
    implementationType: "BACKEND",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             8,
    priority:           "HIGH",
    system:             "Ingestion Pipeline",
    stream:             "INGESTION",
    etap:               "ETAP 2 — Data + Ingestion",
    wave:               "DATA + INGESTION",
    deps:               ["ING-4"],
  },

  // ── SHOULD-COST ENGINE ────────────────────────────────────────────────────
  {
    localId:            "COST-1",
    title:              "Design should-cost calculation model",
    description:        "Design the core SpendGuru should-cost model. Defines how spend position, benchmarks, and cost drivers are computed.",
    buildPrompt:        "SYSTEM: Should-Cost Engine\nSTREAM: AI → PROCUREMENT INTELLIGENCE phase\nWAVE: Wave 4 — PROCUREMENT INTELLIGENCE\nCOMPLEXITY: CRITICAL | EFFORT: 13sp\n\nDELIVERABLES:\n- ShouldCostModel design: inputs, formula, outputs\n- Inputs: historical spend, supplier pricing, category benchmarks, market indices\n- Outputs: should-cost estimate, confidence score, cost gap (actual vs should-cost), opportunity value\n- Benchmark data model: category benchmarks with percentiles (P25, P50, P75, P90)\n- CostDriver enum: VOLUME | SPECIFICATION | SUPPLIER_MARKET_POWER | PROCESS | TIMING\n- Cost position enum: OVERPAYING | FAIR | UNDERPAYING\n\nCONSTRAINTS:\n- Must work without external market data (baseline mode)\n- Confidence score 0-100 based on data quality\n- All calculations must be auditable (store input snapshot)\n\nNEXT BUILD TASK: COST-2 (Category mapping schema)\nUNLOCKS: COST-3 (Calculation algorithm), Negotiation Intelligence",
    implementationType: "ARCHITECTURE",
    readiness:          "NOT_READY",
    complexity:         "CRITICAL",
    effort:             13,
    priority:           "CRITICAL",
    system:             "Should-Cost Engine",
    stream:             "AI",
    etap:               "ETAP 4 — Core Procurement Intelligence",
    wave:               "PROCUREMENT INTELLIGENCE",
    deps:               ["ING-5"],
  },
  {
    localId:            "COST-2",
    title:              "Category benchmark schema + seed data",
    description:        "Prisma schema for benchmark data. Seed with baseline category benchmarks for Polish/EU markets.",
    buildPrompt:        "SYSTEM: Should-Cost Engine\nSTREAM: DATA\nDEPENDS ON: COST-1\n\nDELIVERABLES:\n- CategoryBenchmark model: { categoryId, marketId, p25, p50, p75, p90, currency, period }\n- MarketIndex model for market reference data\n- Seed: 20+ category benchmarks (IT equipment, logistics, MRO, services)\n- Migration + generate",
    implementationType: "DATABASE",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             5,
    priority:           "HIGH",
    system:             "Should-Cost Engine",
    stream:             "DATA",
    etap:               "ETAP 4 — Core Procurement Intelligence",
    wave:               "PROCUREMENT INTELLIGENCE",
    deps:               ["COST-1"],
  },
  {
    localId:            "COST-3",
    title:              "Cost calculation algorithm v1",
    description:        "Core should-cost calculation engine. Takes spend records + benchmarks, outputs cost position and opportunity value.",
    buildPrompt:        "SYSTEM: Should-Cost Engine\nSTREAM: AI\nDEPENDS ON: COST-2\n\nDELIVERABLES:\n- src/lib/intelligence/should-cost.ts\n- calculateShouldCost(orgId, categoryId, period): ShouldCostResult\n- ShouldCostResult: { shouldCost, actualSpend, gap, opportunityValue, confidence, position, drivers }\n- Benchmark lookup: find closest benchmark by category + market\n- Percentile position: place actual spend in P25-P90 range\n- Opportunity value: (actualSpend - shouldCost) * adjustment",
    implementationType: "BACKEND",
    readiness:          "NOT_READY",
    complexity:         "CRITICAL",
    effort:             13,
    priority:           "CRITICAL",
    system:             "Should-Cost Engine",
    stream:             "AI",
    etap:               "ETAP 4 — Core Procurement Intelligence",
    wave:               "PROCUREMENT INTELLIGENCE",
    deps:               ["COST-2"],
  },
  {
    localId:            "COST-4",
    title:              "Cost position scoring (percentile analysis)",
    description:        "Generates cost position score and identifies key cost drivers for each category.",
    buildPrompt:        "SYSTEM: Should-Cost Engine\nSTREAM: AI\nDEPENDS ON: COST-3\n\nDELIVERABLES:\n- scoreCostPosition(result: ShouldCostResult): CostScore\n- CostScore: { score 0-100, position, primaryDrivers: CostDriver[], recommendation }\n- Scoring rules: >P75 = OVERPAYING (score < 40), P25-P75 = FAIR, <P25 = UNDERPAYING\n- Driver detection: volume analysis, spec complexity, supplier concentration",
    implementationType: "AI",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             8,
    priority:           "HIGH",
    system:             "Should-Cost Engine",
    stream:             "AI",
    etap:               "ETAP 4 — Core Procurement Intelligence",
    wave:               "PROCUREMENT INTELLIGENCE",
    deps:               ["COST-3"],
  },
  {
    localId:            "COST-5",
    title:              "Should-cost API server actions",
    description:        "Server actions exposing should-cost results to the UI. Caches results per org/category/period.",
    buildPrompt:        "SYSTEM: Should-Cost Engine\nSTREAM: BACKEND\nDEPENDS ON: COST-4\n\nDELIVERABLES:\n- src/app/actions/should-cost.ts\n- getShouldCostAnalysis(orgId, categoryId, period): ShouldCostResult\n- getCostOpportunities(orgId): CostOpportunity[] (top 10 opportunities)\n- getCategoryPosition(orgId): CategoryPosition[] (all categories)\n- Cache: 24h TTL, invalidate on new ingestion",
    implementationType: "BACKEND",
    readiness:          "NOT_READY",
    complexity:         "HIGH",
    effort:             5,
    priority:           "HIGH",
    system:             "Should-Cost Engine",
    stream:             "AI",
    etap:               "ETAP 4 — Core Procurement Intelligence",
    wave:               "PROCUREMENT INTELLIGENCE",
    deps:               ["COST-4"],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// TASK DEPENDENCIES
// [blockingLocalId, blockedLocalId] — blocking must complete before blocked can start
// ─────────────────────────────────────────────────────────────────────────────
// Dependencies are already encoded in the TASKS array via deps[] field.
// We resolve them to DB IDs in the main() function.

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔬 SG2 Task Decomposition Engine starting...")

  // ── 1. Implementation Waves ───────────────────────────────────────────────
  console.log("\n🌊 Creating implementation waves...")
  const waveMap: Record<string, string> = {}
  for (const w of WAVES) {
    const wave = await db.implementationWave.upsert({
      where: { order: w.order },
      update: { name: w.name, description: w.description, status: w.status as any },
      create: { order: w.order, name: w.name, description: w.description, status: w.status as any },
    })
    waveMap[w.name] = wave.id
    console.log(`  ✓ WAVE ${w.order}: ${w.name} [${w.status}]`)
  }

  // ── 2. Resolve FK maps ────────────────────────────────────────────────────
  const [allSystems, allStreams, allEtaps] = await Promise.all([
    db.coreSystem.findMany({ select: { id: true, name: true } }),
    db.executionStream.findMany({ select: { id: true, name: true } }),
    db.etap.findMany({ select: { id: true, name: true } }),
  ])
  const systemMap  = Object.fromEntries(allSystems.map(s => [s.name, s.id]))
  const streamMap  = Object.fromEntries(allStreams.map(s => [s.name, s.id]))
  const etapMap    = Object.fromEntries(allEtaps.map(e => [e.name, e.id]))

  // ── 3. Implementation Tasks ───────────────────────────────────────────────
  console.log("\n⚙️  Decomposing implementation tasks...")
  // Clear existing tasks + deps
  await db.implTaskDependency.deleteMany()
  await db.implementationTask.deleteMany()

  const taskIdMap: Record<string, string> = {}

  for (const t of TASKS) {
    const task = await db.implementationTask.create({
      data: {
        localId:            t.localId,
        title:              t.title,
        description:        t.description,
        buildPrompt:        t.buildPrompt,
        implementationType: t.implementationType as any,
        readiness:          t.readiness as any,
        complexity:         t.complexity as any,
        effort:             t.effort,
        priority:           t.priority as any,
        status:             "PLANNED",
        systemId:           systemMap[t.system] ?? null,
        streamId:           streamMap[t.stream] ?? null,
        etapId:             etapMap[t.etap] ?? null,
        waveId:             waveMap[t.wave] ?? null,
      },
    })
    taskIdMap[t.localId] = task.id
    const badge = t.readiness === "READY" ? " ✅ READY" : t.readiness === "BLOCKED" ? " 🔴 BLOCKED" : ""
    console.log(`  ✓ ${t.localId}: ${t.title}${badge}`)
  }

  // ── 4. Task Dependency Graph ──────────────────────────────────────────────
  console.log("\n🔗 Building task dependency graph...")
  let depCount = 0
  for (const t of TASKS) {
    for (const depLocalId of t.deps) {
      const blockingId = taskIdMap[depLocalId]
      const blockedId  = taskIdMap[t.localId]
      if (!blockingId || !blockedId) {
        console.warn(`  ⚠ Skipped dep: ${depLocalId} → ${t.localId}`)
        continue
      }
      await db.implTaskDependency.create({
        data: { blockingTaskId: blockingId, blockedTaskId: blockedId },
      })
      depCount++
    }
  }
  console.log(`  ✓ ${depCount} task dependencies created`)

  // ── 5. Pressure + Cognition Analysis ─────────────────────────────────────
  console.log("\n🧠 Computing execution pressure...")
  const readyCt    = TASKS.filter(t => t.readiness === "READY").length
  const blockedCt  = TASKS.filter(t => t.readiness === "BLOCKED").length
  const notReadyCt = TASKS.filter(t => t.readiness === "NOT_READY").length
  const totalEffort= TASKS.reduce((s, t) => s + t.effort, 0)
  const readyEffort= TASKS.filter(t => t.readiness === "READY").reduce((s, t) => s + t.effort, 0)
  const criticalCt = TASKS.filter(t => t.complexity === "CRITICAL").length

  // Stream load
  const streamLoad: Record<string, number> = {}
  for (const t of TASKS) {
    streamLoad[t.stream] = (streamLoad[t.stream] ?? 0) + 1
  }
  const topStream = Object.entries(streamLoad).sort((a, b) => b[1] - a[1])[0]

  // External blockers
  const externalBlockers = [
    { id: "EXT-001", title: "Clerk production keys", blocks: ["RBAC-4", "SESSION-1"], severity: "CRITICAL" },
    { id: "EXT-002", title: "GitHub push (git push -u origin main)", blocks: ["ORCH-1 deployment path"], severity: "HIGH" },
    { id: "EXT-003", title: "Render deployment (connect profitia/vector)", blocks: ["production access"], severity: "HIGH" },
  ]

  const readyTasks = TASKS.filter(t => t.readiness === "READY").map(t => ({
    localId: t.localId, title: t.title, system: t.system, complexity: t.complexity, effort: t.effort,
  }))

  const cognitionOutput = {
    healthScore:      68,
    version:          "1.2.0",
    etap:             "ETAP 09 — Task Decomposition Engine",
    timestamp:        new Date().toISOString(),
    execution: {
      totalTasks:      TASKS.length,
      readyTasks:      readyCt,
      blockedTasks:    blockedCt,
      notReadyTasks:   notReadyCt,
      criticalTasks:   criticalCt,
      totalEffort,
      readyEffort,
      waveCount:       WAVES.length,
      activeWave:      "Wave 2 — AUTH + TENANT",
    },
    pressure: {
      topStream:        { name: topStream[0], taskCount: topStream[1] },
      criticalTasks:    criticalCt,
      externalBlockers: externalBlockers.length,
      blockedByClerk:   2,
      executionReadiness: `${readyCt}/${TASKS.length} tasks READY`,
      bottleneck:       "Clerk keys block 2 critical auth tasks; ING-5 blocks entire procurement intelligence wave",
    },
    signals: [
      { type: "execution", level: "warning",  message: `Only ${readyCt}/${TASKS.length} tasks are READY — execution queue is thin` },
      { type: "blocker",   level: "critical", message: "Clerk production keys block RBAC-4 + SESSION-1 — auth stack cannot complete" },
      { type: "overload",  level: "warning",  message: `AUTH stream carries ${streamLoad["AUTH"] ?? 0} tasks — highest load in Wave 2` },
      { type: "topology",  level: "warning",  message: "ING-5 (Ingestion Pipeline) blocks entire Wave 4 — single point of failure" },
    ],
    recommendations: [
      { priority: "high",   title: "Execute ORG-1 and RBAC-1 immediately — 0 dependencies, design tasks" },
      { priority: "high",   title: "Obtain Clerk keys to unblock RBAC-4 + SESSION-1 (2 blocked tasks)" },
      { priority: "high",   title: "Execute ING-1 (Ingestion design) — unblocks entire Wave 3 + 4" },
      { priority: "high",   title: "Execute ORCH-1 (Orchestration design) — unblocks runtime stack" },
      { priority: "medium", title: "Push VECTOR to GitHub before Wave 2 implementation begins" },
    ],
    readyQueue: readyTasks,
    externalBlockers,
  }

  await db.cognitionSnapshot.create({
    data: { output: cognitionOutput },
  })
  console.log("  ✓ Cognition snapshot v1.2.0 (health: 68, execution pressure)")

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60))
  console.log("✅ SG2 Task Decomposition Engine COMPLETE")
  console.log("═".repeat(60))
  console.log(`  Implementation Waves:  ${WAVES.length}`)
  console.log(`  Implementation Tasks:  ${TASKS.length}`)
  console.log(`  Task Dependencies:     ${depCount}`)
  console.log(`  ✅ READY:              ${readyCt}  (${readyEffort} sp)`)
  console.log(`  🔴 BLOCKED:            ${blockedCt}  (external blockers)`)
  console.log(`  ⏳ NOT_READY:          ${notReadyCt}`)
  console.log(`  CRITICAL tasks:        ${criticalCt}`)
  console.log(`  Total effort:          ${totalEffort} story points`)
  console.log(`  Top stream:            ${topStream[0]} (${topStream[1]} tasks)`)
  console.log("═".repeat(60))
  console.log("\n🎯 READY FOR BUILD NOW:")
  for (const t of readyTasks) {
    console.log(`  → ${t.localId}: ${t.title} [${t.complexity} / ${t.effort}sp]`)
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
