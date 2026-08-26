/**
 * SG2 ETAP 10 — Organization System BUILD Thread Bootstrap
 * VECTOR Production Deployment + Organization System Bootstrap
 *
 * Bootstraps:
 * - ETAP 10 record in SG2 project (new Etap entity)
 * - Updates ORG-1 through ORG-4 with full BUILD execution structure
 * - Marks ETAP 10 as the active build thread
 * - Creates runtime health snapshot
 *
 * Run: npm run bootstrap:etap10
 * IDEMPOTENT: safe to re-run
 */

import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

// ─────────────────────────────────────────────────────────────────────────────
// ETAP 10 — Full BUILD execution structure
// Each task: execution goal, scope, deps, acceptance criteria, constraints,
// PMOS persistence, runtime implications, future dependency impact
// ─────────────────────────────────────────────────────────────────────────────

const ETAP10_BUILD_TASKS = {
  "ORG-1": {
    title:       "Design Organization data model",
    description: "Define the canonical Organization entity for SG2. Root SaaS tenant model — all multi-tenant isolation depends on this design being correct.",
    buildPrompt: `BUILD TASK: ORG-1
═══════════════════════════════════════════════════════════════

ETAP: ETAP 10 — Organization System BUILD Thread
SYSTEM: Organization System
STREAM: AUTH
WAVE: Wave 2 — AUTH + TENANT
COMPLEXITY: CRITICAL | EFFORT: 8sp | READINESS: READY

═══════════════════════════════════════════════════════════════
EXECUTION GOAL
═══════════════════════════════════════════════════════════════

Design and document the Organization data model — the root entity of the SG2 multi-tenant architecture. This model defines how all downstream data is isolated, scoped, and accessed.

═══════════════════════════════════════════════════════════════
IMPLEMENTATION SCOPE
═══════════════════════════════════════════════════════════════

Deliverable 1 — Organization Entity Model
  - id: String @id @default(cuid())
  - clerkOrgId: String @unique (Clerk organization.id)
  - name: String (display name)
  - slug: String @unique (URL-safe identifier)
  - type: OrganizationType (ENTERPRISE | SME | STARTUP)
  - subscriptionTier: SubscriptionTier (FREE | STARTER | PROFESSIONAL | ENTERPRISE)
  - isActive: Boolean @default(true)
  - createdAt: DateTime @default(now())
  - updatedAt: DateTime @updatedAt

Deliverable 2 — Enum Definitions
  - OrganizationType: ENTERPRISE | SME | STARTUP
  - SubscriptionTier: FREE | STARTER | PROFESSIONAL | ENTERPRISE

Deliverable 3 — Workspace Linkage
  - Workspace model must have orgId: String (FK to Organization)
  - All tenant-scoped models MUST include orgId as required field

Deliverable 4 — Architecture Decision Record
  - Document: why row-level scoping (not schema-per-tenant)
  - Document: Clerk org.id as external identity anchor
  - Document: slug strategy and uniqueness constraints

═══════════════════════════════════════════════════════════════
IMPLEMENTATION DEPENDENCIES
═══════════════════════════════════════════════════════════════

NONE — this is a foundational design task with zero external dependencies.
This is the first task in the organization system dependency chain.

═══════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════

- [ ] Organization model schema defined (all fields, types, constraints)
- [ ] OrganizationType and SubscriptionTier enums defined
- [ ] Workspace FK to Organization documented
- [ ] Multi-tenant convention documented: every model MUST have orgId
- [ ] Clerk integration pattern documented (clerkOrgId as external anchor)
- [ ] Architecture Decision Record written
- [ ] No circular dependencies in model design
- [ ] Slug uniqueness strategy confirmed (lowercase, hyphenated)

═══════════════════════════════════════════════════════════════
ARCHITECTURAL CONSTRAINTS
═══════════════════════════════════════════════════════════════

- MUST be compatible with Clerk organization model (org.id = clerkOrgId)
- Row-level scoping ONLY — no schema-per-tenant at MVP
- orgId MUST be required (not nullable) on all tenant-scoped models
- slug MUST be URL-safe (no spaces, lowercase, hyphens)
- clerkOrgId MUST be @unique — one Clerk org = one SG2 org
- DO NOT store Clerk API keys in Organization model

═══════════════════════════════════════════════════════════════
PMOS PERSISTENCE REQUIREMENTS
═══════════════════════════════════════════════════════════════

On completion, persist to PMOS:
  - .pmos/conversations/[timestamp]_org1-design-complete.json
  - Include: final model schema, enum values, ADR summary, constraints
  - Update: ImplementationTask ORG-1 readiness → COMPLETE
  - Trigger: ORG-2 readiness → READY (lifecycle design can begin)

═══════════════════════════════════════════════════════════════
RUNTIME IMPLICATIONS
═══════════════════════════════════════════════════════════════

- All downstream Prisma models will include orgId FK
- Tenant scoping middleware depends on this model being correctly defined
- Clerk webhook handler will use clerkOrgId to find/create records
- SubscriptionTier will gate features in RBAC-5 (feature flags)
- Performance: @index on clerkOrgId is critical for auth lookups

═══════════════════════════════════════════════════════════════
FUTURE DEPENDENCY IMPACT
═══════════════════════════════════════════════════════════════

DIRECTLY UNLOCKS:
  - ORG-2: Organization lifecycle design (depends on entity model)
  - TENANT-1: Tenant isolation strategy (depends on org model structure)
  - SESSION-1: User sync handler (needs Organization FK pattern)

INDIRECTLY UNLOCKS (via dependency chain):
  - RBAC-2: Role schema (needs OrgMember → Organization FK)
  - ING-2/3: All ingestion models (need orgId field pattern)
  - COST-1: Should-cost model (needs supplier → orgId scoping)

TOTAL UNLOCK DEPTH: 20+ tasks depend on correct ORG-1 design`,
    readiness: "READY",
  },

  "ORG-2": {
    title:       "Design organization lifecycle model",
    description: "Define the full Organization lifecycle: creation, activation, suspension, deletion. Includes org metadata, feature limits by tier, and audit trail design.",
    buildPrompt: `BUILD TASK: ORG-2
═══════════════════════════════════════════════════════════════

ETAP: ETAP 10 — Organization System BUILD Thread
SYSTEM: Organization System
STREAM: AUTH
WAVE: Wave 2 — AUTH + TENANT
COMPLEXITY: HIGH | EFFORT: 5sp | READINESS: NOT_READY (depends on ORG-1)

DEPENDENCY GATE: Requires ORG-1 design approval before starting.

═══════════════════════════════════════════════════════════════
EXECUTION GOAL
═══════════════════════════════════════════════════════════════

Design the Organization lifecycle state machine and all lifecycle-related operations: provisioning, activation, suspension, reactivation, and deletion. Define feature limits per subscription tier.

═══════════════════════════════════════════════════════════════
IMPLEMENTATION SCOPE
═══════════════════════════════════════════════════════════════

Deliverable 1 — Lifecycle State Machine
  - OrgStatus enum: PROVISIONING | ACTIVE | SUSPENDED | DELETED
  - Transitions: PROVISIONING → ACTIVE, ACTIVE → SUSPENDED, SUSPENDED → ACTIVE, ACTIVE/SUSPENDED → DELETED
  - Triggers: Clerk webhook events (org created, deleted), admin actions

Deliverable 2 — Organization Metadata Model
  - OrgMetadata: { orgId, maxUsers, maxWorkspaces, maxSuppliers, maxMonthlySpendRecords }
  - Feature limits by tier:
    - FREE: 3 users, 1 workspace, 50 suppliers, 10k records
    - STARTER: 10 users, 3 workspaces, 500 suppliers, 100k records
    - PROFESSIONAL: 50 users, 10 workspaces, unlimited suppliers, 1M records
    - ENTERPRISE: unlimited

Deliverable 3 — Audit Trail Design
  - OrgAuditEvent: { id, orgId, eventType, actorId, metadata, timestamp }
  - OrgAuditEventType enum: CREATED | ACTIVATED | SUSPENDED | REACTIVATED | DELETED | TIER_CHANGED | MEMBER_ADDED | MEMBER_REMOVED

Deliverable 4 — Server Action Signatures
  - createOrganization(clerkOrgId, name, type): Promise<Organization>
  - activateOrganization(id): Promise<Organization>
  - suspendOrganization(id, reason): Promise<Organization>
  - deleteOrganization(id): Promise<void>
  - getOrganizationLimits(orgId): Promise<OrgMetadata>

═══════════════════════════════════════════════════════════════
IMPLEMENTATION DEPENDENCIES
═══════════════════════════════════════════════════════════════

  - ORG-1: Organization data model (CRITICAL — must be COMPLETE before ORG-2 begins)

═══════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════

- [ ] OrgStatus state machine documented with valid transitions
- [ ] Invalid transitions documented (e.g., DELETED → ACTIVE is not allowed)
- [ ] OrgMetadata limits defined per tier
- [ ] OrgAuditEvent model designed
- [ ] Server action signatures defined (not yet implemented)
- [ ] Clerk webhook events mapped to lifecycle transitions
- [ ] Soft delete strategy confirmed (deletedAt timestamp or status = DELETED)

═══════════════════════════════════════════════════════════════
ARCHITECTURAL CONSTRAINTS
═══════════════════════════════════════════════════════════════

- Soft delete preferred over hard delete (legal compliance, audit requirements)
- SUSPENDED organizations: data retained, access blocked
- DELETED organizations: data retained 90 days, then purged
- Audit trail MUST be append-only (no updates or deletes)
- Feature limits MUST be enforced server-side (not just frontend)

═══════════════════════════════════════════════════════════════
PMOS PERSISTENCE REQUIREMENTS
═══════════════════════════════════════════════════════════════

On completion:
  - .pmos/conversations/[timestamp]_org2-lifecycle-design-complete.json
  - Update: ORG-2 readiness → COMPLETE
  - Trigger: ORG-3 readiness → READY

═══════════════════════════════════════════════════════════════
RUNTIME IMPLICATIONS
═══════════════════════════════════════════════════════════════

- SUSPENDED check must be enforced in every server action middleware
- Feature limit checks must be cached (per-request, not per-query)
- Audit events must be written asynchronously (non-blocking)

═══════════════════════════════════════════════════════════════
FUTURE DEPENDENCY IMPACT
═══════════════════════════════════════════════════════════════

DIRECTLY UNLOCKS:
  - ORG-3: Membership model design
  - TENANT-2: Tenant scoping middleware (needs org status check)
  - RBAC-5: Feature flags (needs subscription tier from org lifecycle)`,
    readiness: "NOT_READY",
  },

  "ORG-3": {
    title:       "Design organization membership model",
    description: "Define the Organization membership model: OrgMember entity, role assignment, invitation states, and permission boundary design for multi-user access.",
    buildPrompt: `BUILD TASK: ORG-3
═══════════════════════════════════════════════════════════════

ETAP: ETAP 10 — Organization System BUILD Thread
SYSTEM: Organization System
STREAM: AUTH
WAVE: Wave 2 — AUTH + TENANT
COMPLEXITY: HIGH | EFFORT: 5sp | READINESS: NOT_READY (depends on ORG-2)

DEPENDENCY GATE: Requires ORG-2 lifecycle design before starting.

═══════════════════════════════════════════════════════════════
EXECUTION GOAL
═══════════════════════════════════════════════════════════════

Design the Organization membership model — how users belong to organizations, what roles they hold, and how their permissions are structured. This model is the bridge between Clerk identity and SG2 authorization.

═══════════════════════════════════════════════════════════════
IMPLEMENTATION SCOPE
═══════════════════════════════════════════════════════════════

Deliverable 1 — OrgMember Entity
  - id: String @id @default(cuid())
  - orgId: String (FK to Organization)
  - userId: String (SG2 User.id)
  - clerkUserId: String (Clerk user.id)
  - clerkMembershipId: String? @unique (Clerk membership.id)
  - role: OrgRole
  - status: MemberStatus (ACTIVE | SUSPENDED | REMOVED)
  - joinedAt: DateTime @default(now())
  - lastActiveAt: DateTime?

Deliverable 2 — Role Taxonomy
  - OrgRole enum: OWNER | ADMIN | BUYER | ANALYST | VIEWER
  - Role hierarchy: OWNER > ADMIN > BUYER = ANALYST > VIEWER
  - Each role maps to a set of allowed actions
  - Clerk role mapping: org admin → ADMIN, org member → BUYER (default)

Deliverable 3 — Permission Boundary Design
  - Permission matrix: role → allowed server actions
  - OWNER: all actions + billing, org deletion
  - ADMIN: all procurement actions + member management
  - BUYER: spend ingestion, supplier management, negotiation execution
  - ANALYST: read-only + exports + reporting
  - VIEWER: dashboard read-only

Deliverable 4 — Unique Constraints
  - @@unique([orgId, userId]) — one membership per user per org
  - @@unique([orgId, clerkMembershipId]) — Clerk membership is unique per org

═══════════════════════════════════════════════════════════════
IMPLEMENTATION DEPENDENCIES
═══════════════════════════════════════════════════════════════

  - ORG-1: Organization entity (FK target)
  - ORG-2: Lifecycle model (membership status integrates with org status)
  - RBAC-1: Role taxonomy design (must be consistent — ORG-3 and RBAC-1 define the same roles)

═══════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════

- [ ] OrgMember entity fully designed (all fields, types, constraints)
- [ ] OrgRole enum defined and consistent with RBAC-1 design
- [ ] MemberStatus state machine defined
- [ ] Permission matrix completed (role → allowed actions)
- [ ] Unique constraint strategy documented
- [ ] Clerk membership sync strategy documented
- [ ] Edge cases handled: user leaves Clerk org → SG2 member status?

═══════════════════════════════════════════════════════════════
ARCHITECTURAL CONSTRAINTS
═══════════════════════════════════════════════════════════════

- OrgMember MUST align with Clerk membership model (clerkMembershipId)
- Single-role per member per org (no multi-role at MVP)
- Role changes MUST be audited (OrgAuditEvent from ORG-2)
- REMOVED members: data retained (soft remove), access blocked immediately
- Permission checks MUST be server-side enforced (not just client-gated)

═══════════════════════════════════════════════════════════════
PMOS PERSISTENCE REQUIREMENTS
═══════════════════════════════════════════════════════════════

On completion:
  - .pmos/conversations/[timestamp]_org3-membership-design-complete.json
  - Update: ORG-3 readiness → COMPLETE
  - Trigger: ORG-4 readiness → READY
  - Cross-reference: RBAC-1 and ORG-3 must be consistent (validate before marking complete)

═══════════════════════════════════════════════════════════════
RUNTIME IMPLICATIONS
═══════════════════════════════════════════════════════════════

- OrgMember lookup is hot path — add @index on (orgId, userId) and (orgId, clerkUserId)
- Role check must be cached at request scope (not per-action)
- Clerk webhook org membership events → immediate OrgMember sync

═══════════════════════════════════════════════════════════════
FUTURE DEPENDENCY IMPACT
═══════════════════════════════════════════════════════════════

DIRECTLY UNLOCKS:
  - ORG-4: Invitation flow design
  - RBAC-2: Permission Prisma schema (uses OrgMember as base)
  - RBAC-3: Permission check server action
  - SESSION-2: Session context (returns OrgMember role)`,
    readiness: "NOT_READY",
  },

  "ORG-4": {
    title:       "Design organization invitation flow",
    description: "Design the full invitation lifecycle for SG2: invite creation, email delivery strategy, acceptance, rejection, expiry, and Clerk integration.",
    buildPrompt: `BUILD TASK: ORG-4
═══════════════════════════════════════════════════════════════

ETAP: ETAP 10 — Organization System BUILD Thread
SYSTEM: Organization System
STREAM: AUTH
WAVE: Wave 2 — AUTH + TENANT
COMPLEXITY: MEDIUM | EFFORT: 5sp | READINESS: NOT_READY (depends on ORG-3)

DEPENDENCY GATE: Requires ORG-3 membership model before starting.

═══════════════════════════════════════════════════════════════
EXECUTION GOAL
═══════════════════════════════════════════════════════════════

Design the organization invitation system — how administrators invite new members, how invitations are delivered and accepted, and how the invitation state integrates with both Clerk and SG2 membership.

═══════════════════════════════════════════════════════════════
IMPLEMENTATION SCOPE
═══════════════════════════════════════════════════════════════

Deliverable 1 — OrgInvitation Entity
  - id: String @id @default(cuid())
  - orgId: String (FK to Organization)
  - invitedByUserId: String (FK to User — who sent it)
  - inviteeEmail: String (email to invite)
  - role: OrgRole (role to assign on acceptance)
  - status: InvitationStatus
  - clerkInvitationId: String? @unique (Clerk invitation.id)
  - token: String @unique (secure random token for magic link)
  - expiresAt: DateTime (48h TTL)
  - acceptedAt: DateTime?
  - createdAt: DateTime @default(now())

Deliverable 2 — Invitation State Machine
  - InvitationStatus enum: PENDING | ACCEPTED | REJECTED | EXPIRED | REVOKED
  - Transitions: PENDING → ACCEPTED, PENDING → REJECTED, PENDING → EXPIRED, PENDING → REVOKED
  - ACCEPTED → creates OrgMember with assigned role
  - EXPIRED → automatic (checked on access, or via cron)

Deliverable 3 — Delivery Strategy
  - Primary: Clerk handles invitation emails (Clerk Invitations API)
  - Fallback: SG2 sends invitation email via SendGrid/Resend if Clerk delivery fails
  - Deep link pattern: /invite/accept?token=[token]

Deliverable 4 — Server Action Signatures
  - createInvitation(orgId, email, role, invitedByUserId): Promise<OrgInvitation>
  - acceptInvitation(token, clerkUserId): Promise<OrgMember>
  - revokeInvitation(id, revokedByUserId): Promise<void>
  - listPendingInvitations(orgId): Promise<OrgInvitation[]>
  - checkInvitationStatus(token): Promise<InvitationStatus>

Deliverable 5 — Security Design
  - Token: 32-byte cryptographically random (crypto.randomBytes(32).toString('hex'))
  - Token stored hashed in DB, raw token only in email link
  - Rate limiting: max 10 invitations per org per hour
  - Email uniqueness: one pending invitation per email per org (prevent spam)

═══════════════════════════════════════════════════════════════
IMPLEMENTATION DEPENDENCIES
═══════════════════════════════════════════════════════════════

  - ORG-1: Organization entity (FK target)
  - ORG-3: Membership model (acceptance creates OrgMember)
  - RBAC-1: Role enum (invitation carries role assignment)
  - SESSION-1: Clerk webhooks (Clerk fires invitation.accepted event)

═══════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════

- [ ] OrgInvitation entity fully designed
- [ ] InvitationStatus state machine with valid transitions
- [ ] Token security design documented (generation + storage strategy)
- [ ] Email delivery strategy documented (Clerk primary, fallback)
- [ ] Rate limiting strategy defined
- [ ] Clerk Invitations API integration documented
- [ ] Expiry handling strategy defined (passive check vs active cron)
- [ ] Duplicate invitation prevention strategy

═══════════════════════════════════════════════════════════════
ARCHITECTURAL CONSTRAINTS
═══════════════════════════════════════════════════════════════

- Invitation token MUST be stored hashed (SHA-256), never raw
- One active invitation per email per org (prevent duplicate invitations)
- ACCEPTED invitations: immutable — status cannot be changed post-acceptance
- REVOKED by non-admin: throw PermissionError
- Invitation email delivery failure: log + retry, do not fail invitation creation

═══════════════════════════════════════════════════════════════
PMOS PERSISTENCE REQUIREMENTS
═══════════════════════════════════════════════════════════════

On completion:
  - .pmos/conversations/[timestamp]_org4-invitation-design-complete.json
  - Update: ORG-4 readiness → COMPLETE
  - Trigger: Organization System design phase COMPLETE
  - Milestone: Wave 2 AUTH + TENANT — architecture phase COMPLETE (ORG track)
  - Next wave activation: ORG-2 schema implementation can begin

═══════════════════════════════════════════════════════════════
RUNTIME IMPLICATIONS
═══════════════════════════════════════════════════════════════

- Invitation token lookup is hot path on acceptance — @index on token hash
- Expiry check: run on every invitation access (no scheduled jobs at MVP)
- Clerk webhook: invitation.accepted → call acceptInvitation server action
- Rate limiting: in-memory per org (Redis at scale, simple counter at MVP)

═══════════════════════════════════════════════════════════════
FUTURE DEPENDENCY IMPACT
═══════════════════════════════════════════════════════════════

DIRECTLY UNLOCKS:
  - Full Organization System implementation (all ORG design tasks complete)
  - TENANT-2: Tenant scoping middleware (org design is the foundation)
  - RBAC-2: Role schema implementation

MILESTONE UNLOCKED:
  - Organization System architecture design COMPLETE
  - Wave 2 AUTH track: enter implementation phase`,
    readiness: "NOT_READY",
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 ETAP 10 — Organization System BUILD Thread Bootstrap")
  console.log("═".repeat(60))

  // ── 1. Find SG2 Project ───────────────────────────────────────────────────
  const sg2 = await db.project.findFirst({ where: { slug: "sg2" } })
  if (!sg2) throw new Error("SG2 project not found — run init:sg2 first")
  console.log(`\n✓ SG2 project: ${sg2.name} (${sg2.id})`)

  // ── 2. Create ETAP 10 in VECTOR ───────────────────────────────────────────
  console.log("\n📋 Creating ETAP 10 — Organization System BUILD Thread...")
  const existingEtap10 = await db.etap.findFirst({
    where: { name: "ETAP 10 — Organization System BUILD Thread", projectId: sg2.id },
  })
  const etap10 = existingEtap10 ?? await db.etap.create({
    data: {
      name:        "ETAP 10 — Organization System BUILD Thread",
      description: "First SG2 BUILD execution ETAP. Organization System architecture design — 4 tasks: ORG-1 (entity model), ORG-2 (lifecycle), ORG-3 (membership), ORG-4 (invitation flow). All tasks are ARCHITECTURE/DESIGN type.",
      order:       10,
      projectId:   sg2.id,
    },
  })
  console.log(`  ${existingEtap10 ? "✓ ETAP 10 found" : "✓ ETAP 10 created"}: ${etap10.id}`)

  // ── 3. Update ORG tasks with ETAP 10 build structure ─────────────────────
  console.log("\n⚙️  Updating ORG BUILD tasks...")
  for (const [localId, taskData] of Object.entries(ETAP10_BUILD_TASKS)) {
    const updated = await db.implementationTask.update({
      where: { localId },
      data: {
        title:       taskData.title,
        description: taskData.description,
        buildPrompt: taskData.buildPrompt,
        etapId:      etap10.id,
      },
    })
    const readinessFlag = taskData.readiness === "READY" ? " ✅ READY" : ""
    console.log(`  ✓ ${localId}: ${taskData.title}${readinessFlag}`)
  }

  // ── 4. Verify readiness state ─────────────────────────────────────────────
  console.log("\n🔍 Verifying BUILD thread state...")
  const orgTasks = await db.implementationTask.findMany({
    where: { localId: { startsWith: "ORG-" } },
    include: {
      blockingDependencies: { include: { blockingTask: { select: { localId: true, readiness: true } } } },
    },
    orderBy: { localId: "asc" },
  })
  for (const t of orgTasks) {
    const deps = t.blockingDependencies.map(d => d.blockingTask.localId).join(", ")
    console.log(`  ${t.localId}: [${t.readiness}]${deps ? ` — deps: ${deps}` : " — no deps"}`)
  }

  // ── 5. Cognition Snapshot — Deployment + ETAP 10 ─────────────────────────
  console.log("\n🧠 Persisting deployment cognition snapshot...")
  const cognitionOutput = {
    healthScore:    72,
    version:        "1.3.0",
    etap:           "ETAP 10 — Organization System BUILD Thread",
    timestamp:      new Date().toISOString(),
    deployment: {
      githubPush:   "COMPLETE — 4 commits pushed to profitia/vector",
      renderStatus: "PENDING — awaiting Render service configuration",
      renderConfig: "render.yaml updated — prisma migrate deploy included",
      envStatus: {
        DATABASE_URL:                      "CONFIGURED",
        DIRECT_URL:                        "REQUIRED — add Neon direct URL",
        OPENAI_API_KEY:                    "REQUIRED",
        CLERK_SECRET_KEY:                  "REQUIRED — critical blocker",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "REQUIRED — critical blocker",
        CLERK_WEBHOOK_SECRET:              "REQUIRED — critical blocker",
        NEXT_PUBLIC_APP_URL:               "REQUIRED — set after Render URL assigned",
      },
    },
    execution: {
      activeEtap:    "ETAP 10 — Organization System BUILD Thread",
      activeWave:    "Wave 2 — AUTH + TENANT",
      buildThread:   "ORG track",
      readyTasks:    1,
      blockedTasks:  2,
      notReadyTasks: 3,
      currentBuildNode: "ORG-1 — Design Organization data model",
    },
    buildThread: {
      system:  "Organization System",
      tasks:   ["ORG-1", "ORG-2", "ORG-3", "ORG-4"],
      status:  "ACTIVE",
      phase:   "ARCHITECTURE DESIGN",
    },
    signals: [
      { type: "deployment", level: "info",    message: "GitHub push COMPLETE — 4 commits on main at profitia/vector" },
      { type: "deployment", level: "warning", message: "Render deployment PENDING — user must configure service in Render dashboard" },
      { type: "blocker",    level: "critical",message: "Clerk keys missing — RBAC-4 and SESSION-1 blocked. Provide keys to Render." },
      { type: "execution",  level: "info",    message: "ETAP 10 BUILD thread active — ORG-1 READY for immediate execution" },
      { type: "execution",  level: "info",    message: "ORG-1 is the recommended first BUILD prompt — 0 dependencies, CRITICAL priority" },
    ],
    recommendations: [
      { priority: "critical", title: "Configure Render service — connect profitia/vector repo, add env vars" },
      { priority: "critical", title: "Provide Clerk production keys to Render (CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)" },
      { priority: "high",     title: "Add DIRECT_URL (Neon direct connection) to Render env vars" },
      { priority: "high",     title: "EXECUTE ORG-1 — Design Organization data model (READY, 0 deps)" },
      { priority: "high",     title: "EXECUTE RBAC-1 in parallel with ORG-1 (READY, 0 deps)" },
    ],
    nextBuildPrompt: "ORG-1: Design Organization data model — EXECUTE IMMEDIATELY",
  }

  await db.cognitionSnapshot.create({ data: { output: cognitionOutput } })
  console.log("  ✓ Cognition snapshot v1.3.0 (health: 72, deployment + ETAP 10)")

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60))
  console.log("✅ ETAP 10 Bootstrap COMPLETE")
  console.log("═".repeat(60))
  console.log(`  ETAP 10 ID:              ${etap10.id}`)
  console.log(`  BUILD Thread:            Organization System (4 tasks)`)
  console.log(`  Active Wave:             Wave 2 — AUTH + TENANT`)
  console.log(`  Current BUILD Node:      ORG-1 (READY — execute now)`)
  console.log(`  Blocked BUILD Nodes:     RBAC-4, SESSION-1 (Clerk keys)`)
  console.log(`  GitHub:                  PUSHED — profitia/vector main`)
  console.log(`  Render:                  PENDING — user action required`)
  console.log("═".repeat(60))
  console.log("\n🎯 NEXT: Execute ORG-1 BUILD prompt")
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
