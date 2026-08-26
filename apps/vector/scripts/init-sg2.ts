/**
 * SG2 Operational Bootstrap Script
 * Initializes the canonical SG2 execution topology in VECTOR.
 *
 * Run: npm run init:sg2
 *
 * IDEMPOTENT: safe to re-run — uses upsert where possible.
 * Clears only SG2 project data, preserves other projects.
 */

import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION DOMAINS
// ─────────────────────────────────────────────────────────────────────────────
const DOMAINS = [
  { name: "FOUNDATION",   description: "Core architecture, governance, runtime foundations" },
  { name: "PMOS",         description: "Project Memory Operating System — continuity, memory, lineage" },
  { name: "VECTOR",       description: "Execution Intelligence Runtime — orchestration, topology, cognition" },
  { name: "RUNTIME",      description: "SG2 application runtime — Next.js, Prisma, server actions" },
  { name: "AUTH",         description: "Authentication and authorization — Clerk, org system, permissions" },
  { name: "DATA",         description: "Data layer — Prisma schema, migrations, DB stability" },
  { name: "AI",           description: "AI runtime — OpenAI integration, cognition engine, interpretation" },
  { name: "UX",           description: "User experience — UI components, application flows, design system" },
  { name: "INFRA",        description: "Infrastructure — Render, Neon, env config, deployment" },
  { name: "OBSERVABILITY",description: "Monitoring, health, telemetry, runtime observability" },
  { name: "EXPORTS",      description: "Export system — reports, data exports, runtime payload exports" },
  { name: "INGESTION",    description: "Data ingestion — supplier data, spend data, API connectors" },
  { name: "COST-SCAN",    description: "Cost scanning engine — spend analysis, category mapping, benchmarks" },
  { name: "CRYSTAL-BALL", description: "Predictive intelligence — demand forecasting, price prediction" },
  { name: "X-RAY",        description: "Contract and document intelligence — clause analysis, risk detection" },
  { name: "NEWSFEED",     description: "News and signal intelligence — supplier news, market signals" },
  { name: "NEGOTIATION",  description: "Negotiation engine — session management, tactics, guidance" },
  { name: "DEAL-MAKER",   description: "Deal intelligence — scenario modeling, outcome optimization" },
]

// ─────────────────────────────────────────────────────────────────────────────
// ETAP HIERARCHY
// ─────────────────────────────────────────────────────────────────────────────
const ETAPS = [
  {
    order: 0,
    name: "ETAP 0 — Foundation + Governance",
    description: "Canonical SG2 runtime topology, PMOS ↔ VECTOR doctrine, operational foundations, deployment infrastructure",
    domains: ["FOUNDATION", "PMOS", "VECTOR", "INFRA"],
    subetaps: [
      "Runtime Topology Consolidation",
      "PMOS ↔ VECTOR Operational Doctrine",
      "VECTOR Initialization + Deployment",
      "Git + GitHub + Render Foundation",
    ],
  },
  {
    order: 1,
    name: "ETAP 1 — Runtime Foundation",
    description: "Core SG2 application runtime — Next.js, Prisma, Neon, Clerk scaffold, server action architecture",
    domains: ["RUNTIME", "DATA", "AUTH", "INFRA"],
    subetaps: [
      "Next.js 15 App Router scaffold",
      "Prisma 7 + Neon DB schema",
      "Clerk authentication integration",
      "Server action architecture",
      "Runtime hardening + CI",
    ],
  },
  {
    order: 2,
    name: "ETAP 2 — Data + Ingestion",
    description: "Data layer, supplier data ingestion, spend data models, category taxonomy, API connectors",
    domains: ["DATA", "INGESTION"],
    subetaps: [
      "Supplier data model",
      "Spend data model",
      "Category taxonomy system",
      "Ingestion pipeline v1",
      "CSV + API connector foundation",
    ],
  },
  {
    order: 3,
    name: "ETAP 3 — Auth + Organization System",
    description: "Multi-tenant org system, role-based access, team management, subscription tiers",
    domains: ["AUTH", "RUNTIME"],
    subetaps: [
      "Organization model",
      "Role-based access control",
      "Team management",
      "Subscription tier foundation",
      "Invitation system",
    ],
  },
  {
    order: 4,
    name: "ETAP 4 — Core Procurement Intelligence",
    description: "Cost scanning, X-Ray contract intelligence, negotiation engine core, baseline analytics",
    domains: ["COST-SCAN", "X-RAY", "NEGOTIATION"],
    subetaps: [
      "Cost scanning engine v1",
      "Spend category analyzer",
      "Contract X-Ray v1",
      "Negotiation session model",
      "Negotiation guidance engine",
    ],
  },
  {
    order: 5,
    name: "ETAP 5 — AI + Cognition",
    description: "AI runtime, OpenAI integration, Crystal Ball forecasting, Deal Maker optimization, Newsfeed intelligence",
    domains: ["AI", "CRYSTAL-BALL", "DEAL-MAKER", "NEWSFEED"],
    subetaps: [
      "OpenAI integration layer",
      "Crystal Ball forecasting engine",
      "Deal Maker scenario modeling",
      "Newsfeed signal intelligence",
      "AI audit and interpretation layer",
    ],
  },
  {
    order: 6,
    name: "ETAP 6 — UX + Application Experience",
    description: "Full application UX — dashboards, procurement workflows, negotiation UI, reporting experience",
    domains: ["UX", "RUNTIME"],
    subetaps: [
      "Dashboard and navigation",
      "Supplier management UI",
      "Negotiation workflow UI",
      "Spend analysis UI",
      "Report generation UI",
    ],
  },
  {
    order: 7,
    name: "ETAP 7 — Observability + Exports",
    description: "Runtime observability, monitoring, telemetry, export system, report exports, data exports",
    domains: ["OBSERVABILITY", "EXPORTS"],
    subetaps: [
      "Health monitoring layer",
      "Usage telemetry",
      "Export engine v1",
      "PDF report generation",
      "API export endpoints",
    ],
  },
  {
    order: 8,
    name: "ETAP 8 — Production Hardening",
    description: "Performance optimization, security audit, rate limiting, error handling, production readiness",
    domains: ["RUNTIME", "INFRA", "OBSERVABILITY"],
    subetaps: [
      "Security audit and hardening",
      "Performance optimization",
      "Rate limiting and abuse prevention",
      "Error handling and resilience",
      "Production readiness validation",
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL TASKS
// ─────────────────────────────────────────────────────────────────────────────
const ETAP0_TASKS = [
  { title: "SG2 runtime topology refactor (PMOS + VECTOR sibling structure)", status: "DONE", priority: "CRITICAL", type: "TASK" },
  { title: "SG2 Canonical Operational Doctrine established", status: "DONE", priority: "CRITICAL", type: "TASK" },
  { title: "SG2 Prompt Taxonomy established (BUILD/PLANNING split)", status: "DONE", priority: "HIGH", type: "TASK" },
  { title: "VECTOR git + GitHub initialization", status: "DONE", priority: "HIGH", type: "TASK" },
  { title: "VECTOR Neon DB — schema migrated and validated", status: "DONE", priority: "HIGH", type: "TASK" },
  { title: "VECTOR Render deployment foundation (render.yaml)", status: "DONE", priority: "HIGH", type: "TASK" },
  { title: "SG2 workspace initialized in VECTOR", status: "DONE", priority: "HIGH", type: "TASK" },
  { title: "Execution domains initialized (18 domains)", status: "DONE", priority: "HIGH", type: "TASK" },
  { title: "ETAP hierarchy initialized (ETAP 0-8)", status: "DONE", priority: "HIGH", type: "TASK" },
  { title: "Push VECTOR to GitHub — awaiting authentication", status: "ACTIVE", priority: "CRITICAL", type: "BLOCKER" },
  { title: "Configure VECTOR on Render (env vars + deploy hook)", status: "PLANNED", priority: "HIGH", type: "TASK" },
  { title: "Obtain Clerk production keys for VECTOR", status: "PLANNED", priority: "HIGH", type: "BLOCKER" },
  { title: "Configure OPENAI_API_KEY in Render env", status: "PLANNED", priority: "HIGH", type: "TASK" },
]

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 SG2 Operational Bootstrap starting...")

  // ── 1. Execution Domains ──
  console.log("\n📦 Initializing execution domains...")
  const domainMap: Record<string, string> = {}
  for (const d of DOMAINS) {
    const domain = await db.executionDomain.upsert({
      where: { name: d.name },
      update: { description: d.description },
      create: { name: d.name, description: d.description },
    })
    domainMap[d.name] = domain.id
    console.log(`  ✓ ${d.name}`)
  }

  // ── 2. SG2 Workspace ──
  console.log("\n🏢 Initializing SG2 workspace...")
  const workspace = await db.workspace.upsert({
    where: { slug: "spendguru-2-0" },
    update: { name: "SpendGuru 2.0", description: "AI-native negotiation-first B2B spend intelligence platform" },
    create: {
      name: "SpendGuru 2.0",
      slug: "spendguru-2-0",
      archetype: "SaaS",
      description: "AI-native negotiation-first B2B spend intelligence platform",
      conventions: {
        create: [
          { key: "runtime_model", value: "PMOS + VECTOR dual-runtime" },
          { key: "prompt_discipline", value: "BUILD → PMOS | PLANNING → VECTOR" },
          { key: "deployment_target", value: "Render (web service)" },
          { key: "database", value: "Neon PostgreSQL" },
          { key: "auth_provider", value: "Clerk" },
          { key: "ai_provider", value: "OpenAI" },
          { key: "positioning", value: "negotiation-first (not analytics-first)" },
          { key: "stack", value: "Next.js 15, Prisma 7, TypeScript, Tailwind v4, shadcn/ui" },
        ],
      },
    },
  })
  console.log(`  ✓ Workspace: ${workspace.name} (${workspace.slug})`)

  // ── 3. SG2 Project (upsert, link to workspace) ──
  console.log("\n📁 Initializing SG2 project...")
  const sg2 = await db.project.upsert({
    where: { slug: "sg2" },
    update: {
      name: "SpendGuru 2.0",
      description: "AI-native negotiation-first B2B spend intelligence platform",
      workspaceId: workspace.id,
    },
    create: {
      name: "SpendGuru 2.0",
      slug: "sg2",
      description: "AI-native negotiation-first B2B spend intelligence platform",
      status: "ACTIVE",
      workspaceId: workspace.id,
    },
  })
  console.log(`  ✓ Project: ${sg2.name} (${sg2.slug})`)

  // ── 4. Link domains to SG2 ──
  console.log("\n🔗 Linking all domains to SG2 project...")
  for (const domainName of Object.keys(domainMap)) {
    await db.projectExecutionDomain.upsert({
      where: { projectId_executionDomainId: { projectId: sg2.id, executionDomainId: domainMap[domainName] } },
      update: {},
      create: { projectId: sg2.id, executionDomainId: domainMap[domainName] },
    })
  }
  console.log(`  ✓ All ${DOMAINS.length} domains linked`)

  // ── 5. ETAPs + Subetaps + Tasks ──
  console.log("\n🗂  Initializing ETAP hierarchy (ETAP 0-8)...")

  // Clear existing ETAPs for SG2 to allow clean re-init
  const existingEtaps = await db.etap.findMany({ where: { projectId: sg2.id } })
  if (existingEtaps.length > 0) {
    console.log(`  ⚠  Clearing ${existingEtaps.length} existing ETAPs for clean re-init...`)
    await db.task.deleteMany({ where: { projectId: sg2.id } })
    await db.subetap.deleteMany({ where: { etapId: { in: existingEtaps.map((e) => e.id) } } })
    await db.etap.deleteMany({ where: { projectId: sg2.id } })
  }

  const etapMap: Record<number, string> = {}
  for (const e of ETAPS) {
    const etap = await db.etap.create({
      data: {
        name: e.name,
        order: e.order,
        projectId: sg2.id,
        subetaps: {
          create: e.subetaps.map((name, idx) => ({ name, order: idx + 1 })),
        },
      },
    })
    etapMap[e.order] = etap.id
    console.log(`  ✓ ${e.name} (${e.subetaps.length} subetaps)`)
  }

  // ── 6. Initial Tasks for ETAP 0 ──
  console.log("\n✅ Creating ETAP 0 initial task decomposition...")
  await db.task.createMany({
    data: ETAP0_TASKS.map((t) => ({
      ...t,
      projectId: sg2.id,
      etapId: etapMap[0],
    })),
  })
  console.log(`  ✓ ${ETAP0_TASKS.length} tasks created for ETAP 0`)

  // ── 7. Cognition Snapshot ──
  console.log("\n🧠 Initializing cognition snapshot...")
  await db.cognitionSnapshot.create({
    data: {
      output: {
        project: "SpendGuru 2.0",
        healthScore: 75,
        activeEtap: "ETAP 0 — Foundation + Governance",
        signals: {
          type: "initialization",
          message: "SG2 operational bootstrap complete. ETAP 0 in progress — ETAP 1 next.",
          domains: DOMAINS.length,
          etaps: ETAPS.length,
          driftRisk: "low",
          overloadRisk: "low",
          fragmentationRisk: "low",
        },
        recommendations: [
          "Push VECTOR to GitHub (profitia/vector) to complete git initialization",
          "Configure VECTOR on Render with env vars (DATABASE_URL, Clerk, OpenAI)",
          "Begin ETAP 1 — Runtime Foundation after VECTOR deployment confirmed",
          "Obtain Clerk production keys before ETAP 3",
        ],
      },
    },
  })
  console.log("  ✓ Cognition snapshot created (health: 75)")

  // ── 8. Summary ──
  console.log("\n" + "═".repeat(60))
  console.log("✅ SG2 Operational Bootstrap COMPLETE")
  console.log("═".repeat(60))
  console.log(`Workspace:   SpendGuru 2.0 (SaaS)`)
  console.log(`Project:     sg2`)
  console.log(`Domains:     ${DOMAINS.length}`)
  console.log(`ETAPs:       ${ETAPS.length} (ETAP 0–8)`)
  console.log(`Tasks (E0):  ${ETAP0_TASKS.length}`)
  console.log(`Cognition:   initialized (health: 75)`)
  console.log("")
  console.log("NEXT STEPS:")
  console.log("  1. git add . && git commit -m 'feat: SG2 operational bootstrap'")
  console.log("  2. git push -u origin main")
  console.log("  3. Connect Render to github.com/profitia/vector")
  console.log("  4. Set env vars on Render (DATABASE_URL, Clerk, OpenAI)")
  console.log("═".repeat(60))
}

main()
  .catch((e) => { console.error("❌ Bootstrap failed:", e); process.exit(1) })
  .finally(async () => { await db.$disconnect(); await pool.end() })
