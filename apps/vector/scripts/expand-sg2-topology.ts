/**
 * SG2 Execution Topology Expansion Script
 * ETAP 08 — SG2 Execution Topology Expansion
 *
 * Seeds:
 * - ExecutionPhases (8 phases)
 * - ExecutionStreams (10 orchestration streams)
 * - CoreSystems (15 SG2 core systems)
 * - SystemDependencies (dependency graph)
 * - CriticalPathNodes (ordered critical path)
 * - Updates Etap descriptions + phaseId links
 * - Updates Subetap descriptions + streamId links
 *
 * Run: npm run expand:topology
 * IDEMPOTENT: safe to re-run (upsert logic throughout)
 */

import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION PHASES
// ─────────────────────────────────────────────────────────────────────────────
const PHASES = [
  { order: 0, name: "FOUNDATION",                 description: "Infrastructure bootstrap, governance, git, CI, runtime scaffold" },
  { order: 1, name: "RUNTIME CORE",               description: "Orchestration runtime, session management, core DB, server actions" },
  { order: 2, name: "DATA + AUTH",                description: "Organization system, tenant isolation, RBAC, ingestion pipeline" },
  { order: 3, name: "PROCUREMENT INTELLIGENCE",   description: "Should-cost engine, supplier intelligence, forecasting, negotiation core" },
  { order: 4, name: "AI + COGNITION",             description: "AI assistant runtime, conversational runtime, cognition engine" },
  { order: 5, name: "APPLICATION EXPERIENCE",     description: "UX layer, dashboard, procurement workflows, notification system" },
  { order: 6, name: "OBSERVABILITY + EXPORTS",    description: "Monitoring, telemetry, export engine, reports, API exports" },
  { order: 7, name: "PRODUCTION HARDENING",       description: "Security audit, performance optimization, resilience, rate limiting" },
]

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION STREAMS
// ─────────────────────────────────────────────────────────────────────────────
const STREAMS = [
  { name: "PMOS",          label: "PMOS Governance",      description: "Governance, memory, planning lineage, doctrine",        color: "purple",  order: 0 },
  { name: "VECTOR",        label: "Vector Runtime",        description: "Orchestration, topology, cognition, ETAP management",   color: "blue",    order: 1 },
  { name: "AUTH",          label: "Auth & Identity",       description: "Authentication, org system, RBAC, session management",  color: "amber",   order: 2 },
  { name: "DATA",          label: "Data Layer",            description: "Prisma schema, migrations, DB stability, data models",  color: "green",   order: 3 },
  { name: "INGESTION",     label: "Data Ingestion",        description: "Supplier data, spend data, CSV connectors, API feeds",  color: "cyan",    order: 4 },
  { name: "AI",            label: "AI & Cognition",        description: "OpenAI integration, forecasting, deal intelligence",   color: "violet",  order: 5 },
  { name: "UX",            label: "User Experience",       description: "UI components, application flows, design system",      color: "pink",    order: 6 },
  { name: "EXPORT",        label: "Export Engine",         description: "PDF reports, data exports, runtime payload exports",   color: "orange",  order: 7 },
  { name: "OBSERVABILITY", label: "Observability",         description: "Health monitoring, telemetry, usage tracking, alerts", color: "red",     order: 8 },
  { name: "DEPLOYMENT",    label: "Deployment",            description: "Render, Neon, env config, CI/CD, release pipeline",   color: "slate",   order: 9 },
]

// ─────────────────────────────────────────────────────────────────────────────
// CORE SYSTEMS
// (domain, stream, phase are referenced by name — resolved to IDs at runtime)
// ─────────────────────────────────────────────────────────────────────────────
const CORE_SYSTEMS = [
  {
    name:        "Organization System",
    description: "Multi-tenant organization model — company entities, org context, SaaS account root",
    domain:      "FOUNDATION",
    stream:      "AUTH",
    phase:       "DATA + AUTH",
    criticality: "CRITICAL",
    isBlocking:  true,
  },
  {
    name:        "Tenant System",
    description: "Tenant isolation — data scoping per organization, schema-per-tenant or row-level security",
    domain:      "DATA",
    stream:      "AUTH",
    phase:       "DATA + AUTH",
    criticality: "CRITICAL",
    isBlocking:  true,
  },
  {
    name:        "RBAC",
    description: "Role-based access control — roles, permissions, feature flags, access policies",
    domain:      "AUTH",
    stream:      "AUTH",
    phase:       "DATA + AUTH",
    criticality: "CRITICAL",
    isBlocking:  true,
  },
  {
    name:        "Session Management",
    description: "Authenticated user sessions — Clerk integration, JWT, org context, active session state",
    domain:      "AUTH",
    stream:      "AUTH",
    phase:       "RUNTIME CORE",
    criticality: "HIGH",
    isBlocking:  true,
  },
  {
    name:        "Orchestration Runtime",
    description: "Core SG2 orchestration engine — execution flow, action registry, workflow coordination",
    domain:      "RUNTIME",
    stream:      "VECTOR",
    phase:       "RUNTIME CORE",
    criticality: "CRITICAL",
    isBlocking:  true,
  },
  {
    name:        "Ingestion Pipeline",
    description: "Data ingestion layer — CSV import, API connectors, supplier feed normalization, spend data ETL",
    domain:      "INGESTION",
    stream:      "INGESTION",
    phase:       "DATA + AUTH",
    criticality: "CRITICAL",
    isBlocking:  true,
  },
  {
    name:        "Should-Cost Engine",
    description: "Core cost analysis engine — spend benchmarking, category analysis, price position, cost drivers",
    domain:      "COST-SCAN",
    stream:      "AI",
    phase:       "PROCUREMENT INTELLIGENCE",
    criticality: "CRITICAL",
    isBlocking:  true,
  },
  {
    name:        "Supplier Intelligence",
    description: "Supplier profiling and analysis — risk scoring, market position, alternative sourcing, X-Ray",
    domain:      "X-RAY",
    stream:      "DATA",
    phase:       "PROCUREMENT INTELLIGENCE",
    criticality: "HIGH",
    isBlocking:  false,
  },
  {
    name:        "Forecasting Engine",
    description: "Predictive intelligence — demand forecasting, price prediction, market trends, Crystal Ball",
    domain:      "CRYSTAL-BALL",
    stream:      "AI",
    phase:       "PROCUREMENT INTELLIGENCE",
    criticality: "HIGH",
    isBlocking:  false,
  },
  {
    name:        "Negotiation Intelligence",
    description: "Negotiation guidance engine — tactic generation, session management, outcome optimization, Deal Maker",
    domain:      "NEGOTIATION",
    stream:      "AI",
    phase:       "PROCUREMENT INTELLIGENCE",
    criticality: "HIGH",
    isBlocking:  false,
  },
  {
    name:        "AI Assistant Runtime",
    description: "OpenAI-powered AI assistant — procurement advice, context-aware guidance, action suggestions",
    domain:      "AI",
    stream:      "AI",
    phase:       "AI + COGNITION",
    criticality: "HIGH",
    isBlocking:  false,
  },
  {
    name:        "Conversational Runtime",
    description: "Conversational interface layer — chat UI, message threading, context persistence, history",
    domain:      "AI",
    stream:      "AI",
    phase:       "AI + COGNITION",
    criticality: "MEDIUM",
    isBlocking:  false,
  },
  {
    name:        "Cognition Runtime",
    description: "Meta-intelligence engine — execution health, signal detection, strategic recommendations",
    domain:      "OBSERVABILITY",
    stream:      "VECTOR",
    phase:       "AI + COGNITION",
    criticality: "MEDIUM",
    isBlocking:  false,
  },
  {
    name:        "Notification System",
    description: "User notifications — alerts, deal signals, negotiation reminders, supplier news, system events",
    domain:      "UX",
    stream:      "UX",
    phase:       "APPLICATION EXPERIENCE",
    criticality: "MEDIUM",
    isBlocking:  false,
  },
  {
    name:        "Export Engine",
    description: "Export layer — PDF report generation, data exports, API payloads, runtime export to PMOS",
    domain:      "EXPORTS",
    stream:      "EXPORT",
    phase:       "OBSERVABILITY + EXPORTS",
    criticality: "MEDIUM",
    isBlocking:  false,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM DEPENDENCIES
// source depends on target (target must exist before source can start)
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_DEPENDENCIES = [
  // Auth stack — foundational
  { source: "Tenant System",             target: "Organization System",  type: "runtime",       criticality: "CRITICAL", rationale: "Tenant isolation requires org context to exist first" },
  { source: "RBAC",                       target: "Organization System",  type: "runtime",       criticality: "CRITICAL", rationale: "Roles are scoped to organizations" },
  { source: "RBAC",                       target: "Tenant System",        type: "runtime",       criticality: "CRITICAL", rationale: "Permissions must be tenant-isolated" },
  { source: "Session Management",         target: "RBAC",                 type: "runtime",       criticality: "HIGH",     rationale: "Sessions carry role context from RBAC" },
  // Orchestration dependencies
  { source: "Orchestration Runtime",      target: "Session Management",   type: "runtime",       criticality: "HIGH",     rationale: "Orchestration requires authenticated execution context" },
  { source: "AI Assistant Runtime",       target: "Orchestration Runtime",type: "orchestration", criticality: "CRITICAL", rationale: "AI runtime runs inside the orchestration layer" },
  { source: "AI Assistant Runtime",       target: "Session Management",   type: "runtime",       criticality: "HIGH",     rationale: "AI needs user session for context personalization" },
  // Ingestion stack
  { source: "Should-Cost Engine",         target: "Ingestion Pipeline",   type: "runtime",       criticality: "CRITICAL", rationale: "Cost analysis requires normalized spend data from ingestion" },
  { source: "Supplier Intelligence",      target: "Ingestion Pipeline",   type: "runtime",       criticality: "HIGH",     rationale: "Supplier profiling requires ingested supplier data" },
  // Procurement intelligence stack
  { source: "Forecasting Engine",         target: "Should-Cost Engine",   type: "runtime",       criticality: "HIGH",     rationale: "Forecasting extends should-cost with predictive modeling" },
  { source: "Forecasting Engine",         target: "Ingestion Pipeline",   type: "runtime",       criticality: "HIGH",     rationale: "Forecasting needs historical spend data" },
  { source: "Negotiation Intelligence",   target: "Should-Cost Engine",   type: "orchestration", criticality: "HIGH",     rationale: "Negotiation guidance requires baseline cost position" },
  { source: "Negotiation Intelligence",   target: "Supplier Intelligence",type: "ai",            criticality: "HIGH",     rationale: "Negotiation needs supplier risk/alternative profile" },
  // AI stack
  { source: "Conversational Runtime",     target: "AI Assistant Runtime", type: "runtime",       criticality: "HIGH",     rationale: "Conversational UI wraps the AI assistant runtime" },
  { source: "Cognition Runtime",          target: "Conversational Runtime",type: "runtime",      criticality: "MEDIUM",   rationale: "Cognition engine monitors the conversational runtime" },
  // UX + Export
  { source: "Notification System",        target: "RBAC",                 type: "runtime",       criticality: "MEDIUM",   rationale: "Notification delivery requires role-based routing" },
  { source: "Export Engine",              target: "Should-Cost Engine",   type: "cognition",     criticality: "MEDIUM",   rationale: "Reports export cost analysis outputs" },
  { source: "Export Engine",              target: "Forecasting Engine",   type: "cognition",     criticality: "MEDIUM",   rationale: "Reports include forecast data" },
]

// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL PATH — ordered execution sequence that blocks global SG2 progress
// ─────────────────────────────────────────────────────────────────────────────
const CRITICAL_PATH = [
  { order: 1,  system: "Organization System",      isBlocker: true,  rationale: "Root entity — all SaaS tenancy depends on org model" },
  { order: 2,  system: "Orchestration Runtime",    isBlocker: true,  rationale: "All AI and procurement features execute inside the orchestration layer" },
  { order: 3,  system: "Tenant System",            isBlocker: true,  rationale: "Data isolation — nothing can be safely stored without tenant context" },
  { order: 4,  system: "RBAC",                     isBlocker: true,  rationale: "Authorization gate — all user-facing features blocked without roles" },
  { order: 5,  system: "Session Management",       isBlocker: true,  rationale: "Auth context required by all runtime services" },
  { order: 6,  system: "Ingestion Pipeline",       isBlocker: true,  rationale: "All intelligence depends on normalized spend + supplier data" },
  { order: 7,  system: "Should-Cost Engine",       isBlocker: true,  rationale: "Core product value — blocks all procurement intelligence" },
  { order: 8,  system: "Supplier Intelligence",    isBlocker: false, rationale: "Required for negotiation guidance quality" },
  { order: 9,  system: "AI Assistant Runtime",     isBlocker: false, rationale: "Central AI interface — required for conversational intelligence" },
  { order: 10, system: "Forecasting Engine",       isBlocker: false, rationale: "Strategic differentiation — predictive procurement" },
  { order: 11, system: "Negotiation Intelligence", isBlocker: false, rationale: "Primary product differentiator and revenue driver" },
  { order: 12, system: "Conversational Runtime",   isBlocker: false, rationale: "UX layer for AI assistant" },
  { order: 13, system: "Export Engine",            isBlocker: false, rationale: "Reporting and PMOS export capability" },
  { order: 14, system: "Cognition Runtime",        isBlocker: false, rationale: "Meta-intelligence and execution monitoring" },
  { order: 15, system: "Notification System",      isBlocker: false, rationale: "UX polish — deal signals, supplier alerts" },
]

// ─────────────────────────────────────────────────────────────────────────────
// ETAP → PHASE MAPPING
// ─────────────────────────────────────────────────────────────────────────────
const ETAP_PHASE_MAP: Record<string, string> = {
  "ETAP 0 — Foundation + Governance":            "FOUNDATION",
  "ETAP 1 — Runtime Foundation":                 "RUNTIME CORE",
  "ETAP 2 — Data + Ingestion":                   "DATA + AUTH",
  "ETAP 3 — Auth + Organization System":         "DATA + AUTH",
  "ETAP 4 — Core Procurement Intelligence":      "PROCUREMENT INTELLIGENCE",
  "ETAP 5 — AI + Cognition":                     "AI + COGNITION",
  "ETAP 6 — UX + Application Experience":        "APPLICATION EXPERIENCE",
  "ETAP 7 — Observability + Exports":            "OBSERVABILITY + EXPORTS",
  "ETAP 8 — Production Hardening":               "PRODUCTION HARDENING",
}

// Subetap → stream mapping (partial match on subetap name)
const SUBETAP_STREAM_MAP: Record<string, string> = {
  // ETAP 0
  "Runtime Topology Consolidation":              "VECTOR",
  "PMOS ↔ VECTOR Operational Doctrine":         "PMOS",
  "VECTOR Initialization + Deployment":          "DEPLOYMENT",
  "Git + GitHub + Render Foundation":            "DEPLOYMENT",
  // ETAP 1
  "Next.js 15 App Router scaffold":              "VECTOR",
  "Prisma 7 + Neon DB schema":                   "DATA",
  "Clerk authentication integration":            "AUTH",
  "Server action architecture":                  "VECTOR",
  "Runtime hardening + CI":                      "DEPLOYMENT",
  // ETAP 2
  "Supplier data model":                         "DATA",
  "Spend data model":                            "DATA",
  "Category taxonomy system":                    "DATA",
  "Ingestion pipeline v1":                       "INGESTION",
  "CSV + API connector foundation":              "INGESTION",
  // ETAP 3
  "Organization model":                          "AUTH",
  "Role-based access control":                   "AUTH",
  "Team management":                             "AUTH",
  "Subscription tier foundation":                "AUTH",
  "Invitation system":                           "AUTH",
  // ETAP 4
  "Cost scanning engine v1":                     "AI",
  "Spend category analyzer":                     "AI",
  "Contract X-Ray v1":                           "DATA",
  "Negotiation session model":                   "AI",
  "Negotiation guidance engine":                 "AI",
  // ETAP 5
  "OpenAI integration layer":                    "AI",
  "Crystal Ball forecasting engine":             "AI",
  "Deal Maker scenario modeling":                "AI",
  "Newsfeed signal intelligence":                "INGESTION",
  "AI audit and interpretation layer":           "AI",
  // ETAP 6
  "Dashboard and navigation":                    "UX",
  "Supplier management UI":                      "UX",
  "Negotiation workflow UI":                     "UX",
  "Spend analysis UI":                           "UX",
  "Report generation UI":                        "UX",
  // ETAP 7
  "Health monitoring layer":                     "OBSERVABILITY",
  "Usage telemetry":                             "OBSERVABILITY",
  "Export engine v1":                            "EXPORT",
  "PDF report generation":                       "EXPORT",
  "API export endpoints":                        "EXPORT",
  // ETAP 8
  "Security audit and hardening":                "DEPLOYMENT",
  "Performance optimization":                    "VECTOR",
  "Rate limiting and abuse prevention":          "DEPLOYMENT",
  "Error handling and resilience":               "VECTOR",
  "Production readiness validation":             "DEPLOYMENT",
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔭 SG2 Execution Topology Expansion starting...")

  // ── 1. Execution Phases ──────────────────────────────────────────────────
  console.log("\n📐 Creating execution phases...")
  const phaseMap: Record<string, string> = {}
  for (const p of PHASES) {
    const phase = await db.executionPhase.upsert({
      where: { order: p.order },
      update: { name: p.name, description: p.description },
      create: { order: p.order, name: p.name, description: p.description, status: "PLANNED" },
    })
    phaseMap[p.name] = phase.id
    console.log(`  ✓ PHASE ${p.order}: ${p.name}`)
  }

  // ── 2. Execution Streams ─────────────────────────────────────────────────
  console.log("\n🌊 Creating execution streams...")
  const streamMap: Record<string, string> = {}
  for (const s of STREAMS) {
    const stream = await db.executionStream.upsert({
      where: { name: s.name },
      update: { label: s.label, description: s.description, color: s.color, order: s.order },
      create: { name: s.name, label: s.label, description: s.description, color: s.color, order: s.order, isActive: true },
    })
    streamMap[s.name] = stream.id
    console.log(`  ✓ STREAM: ${s.name} (${s.label})`)
  }

  // ── 3. Core Systems ──────────────────────────────────────────────────────
  console.log("\n⚙️  Creating core systems...")
  const systemMap: Record<string, string> = {}
  for (const cs of CORE_SYSTEMS) {
    const domain = await db.executionDomain.findUnique({ where: { name: cs.domain } })
    const stream = streamMap[cs.stream]
    const phase  = phaseMap[cs.phase]

    const system = await db.coreSystem.upsert({
      where: { name: cs.name },
      update: {
        description: cs.description,
        domainId:    domain?.id ?? null,
        streamId:    stream ?? null,
        phaseId:     phase ?? null,
        criticality: cs.criticality as any,
        isBlocking:  cs.isBlocking,
      },
      create: {
        name:        cs.name,
        description: cs.description,
        domainId:    domain?.id ?? null,
        streamId:    stream ?? null,
        phaseId:     phase ?? null,
        status:      "PLANNED",
        criticality: cs.criticality as any,
        isBlocking:  cs.isBlocking,
      },
    })
    systemMap[cs.name] = system.id
    console.log(`  ✓ SYSTEM: ${cs.name} [${cs.domain} / ${cs.stream} / ${cs.phase}]`)
  }

  // ── 4. System Dependencies ───────────────────────────────────────────────
  console.log("\n🔗 Building dependency graph...")
  // Clear existing system dependencies before re-seeding
  await db.systemDependency.deleteMany()
  let depCount = 0
  for (const dep of SYSTEM_DEPENDENCIES) {
    const sourceId = systemMap[dep.source]
    const targetId = systemMap[dep.target]
    if (!sourceId || !targetId) {
      console.warn(`  ⚠ Skipped dependency: ${dep.source} → ${dep.target} (system not found)`)
      continue
    }
    await db.systemDependency.create({
      data: {
        sourceSystemId: sourceId,
        targetSystemId: targetId,
        dependencyType: dep.type as any,
        criticality:    dep.criticality as any,
        rationale:      dep.rationale,
      },
    })
    depCount++
    console.log(`  ✓ DEP: ${dep.source} → ${dep.target} [${dep.type} / ${dep.criticality}]`)
  }
  console.log(`  → ${depCount} dependencies created`)

  // ── 5. Critical Path ─────────────────────────────────────────────────────
  console.log("\n🔴 Building critical path...")
  await db.criticalPathNode.deleteMany()
  for (const node of CRITICAL_PATH) {
    const systemId = systemMap[node.system]
    await db.criticalPathNode.create({
      data: {
        order:     node.order,
        label:     node.system,
        rationale: node.rationale,
        isBlocker: node.isBlocker,
        systemId:  systemId ?? null,
      },
    })
    const blocker = node.isBlocker ? " 🔴" : ""
    console.log(`  ✓ PATH ${node.order}: ${node.system}${blocker}`)
  }

  // ── 6. Link ETAPs to Phases ──────────────────────────────────────────────
  console.log("\n🗂  Linking ETAPs to phases...")
  const allEtaps = await db.etap.findMany()
  for (const etap of allEtaps) {
    const phaseName = ETAP_PHASE_MAP[etap.name]
    if (!phaseName) continue
    const phaseId = phaseMap[phaseName]
    if (!phaseId) continue
    await db.etap.update({
      where: { id: etap.id },
      data: { phaseId },
    })
    console.log(`  ✓ ETAP "${etap.name}" → PHASE ${phaseName}`)
  }

  // ── 7. Link Subetaps to Streams ──────────────────────────────────────────
  console.log("\n🌊 Linking subetaps to streams...")
  const allSubetaps = await db.subetap.findMany()
  let subLinked = 0
  for (const sub of allSubetaps) {
    const streamName = SUBETAP_STREAM_MAP[sub.name]
    if (!streamName) continue
    const streamId = streamMap[streamName]
    if (!streamId) continue
    await db.subetap.update({
      where: { id: sub.id },
      data: { streamId },
    })
    subLinked++
  }
  console.log(`  ✓ ${subLinked} subetaps linked to streams`)

  // ── 8. Update CognitionSnapshot with topology health ────────────────────
  console.log("\n🧠 Updating cognition snapshot with topology health...")
  const totalSystems     = CORE_SYSTEMS.length
  const criticalSystems  = CORE_SYSTEMS.filter(s => s.criticality === "CRITICAL").length
  const blockingSystems  = CORE_SYSTEMS.filter(s => s.isBlocking).length
  const totalDeps        = SYSTEM_DEPENDENCIES.length
  const criticalDeps     = SYSTEM_DEPENDENCIES.filter(d => d.criticality === "CRITICAL").length

  // Pressure analysis
  const domainCount: Record<string, number> = {}
  for (const s of CORE_SYSTEMS) {
    domainCount[s.domain] = (domainCount[s.domain] ?? 0) + 1
  }
  const overloadedDomains = Object.entries(domainCount)
    .filter(([, count]) => count >= 3)
    .map(([name, count]) => ({ name, systemCount: count }))

  const streamCount: Record<string, number> = {}
  for (const s of CORE_SYSTEMS) {
    streamCount[s.stream] = (streamCount[s.stream] ?? 0) + 1
  }
  const topStream = Object.entries(streamCount).sort((a, b) => b[1] - a[1])[0]

  const topologyHealth = {
    healthScore:      72,
    version:          "1.1.0",
    etap:             "ETAP 08 — Execution Topology Expansion",
    timestamp:        new Date().toISOString(),
    topology: {
      phases:          PHASES.length,
      streams:         STREAMS.length,
      coreSystems:     totalSystems,
      criticalSystems,
      blockingSystems,
      dependencies:    totalDeps,
      criticalDeps,
      criticalPathLen: CRITICAL_PATH.length,
    },
    pressure: {
      overloadedDomains,
      topStream:        { name: topStream[0], systemCount: topStream[1] },
      criticalPathLen:  CRITICAL_PATH.length,
      blockerCount:     CRITICAL_PATH.filter(n => n.isBlocker).length,
      fragmentationRisk: "LOW",
      orchestrationPressure: criticalSystems > 4 ? "HIGH" : "MEDIUM",
    },
    signals: [
      { type: "topology", level: "warning",  message: `${blockingSystems} blocking systems in critical path — sequencing is tight` },
      { type: "overload", level: criticalDeps > 8 ? "warning" : "healthy", message: `${criticalDeps} CRITICAL dependencies in dependency graph` },
      { type: "domain",   level: overloadedDomains.length > 0 ? "warning" : "healthy", message: `${overloadedDomains.length} domains with 3+ systems — concentration risk` },
    ],
    recommendations: [
      { priority: "high",   title: "Unblock GitHub push — VECTOR cannot deploy without remote push" },
      { priority: "high",   title: "Establish Organization System as ETAP 3 top priority" },
      { priority: "high",   title: "Ingest baseline spend data early — unblocks 7 downstream systems" },
      { priority: "medium", title: "Configure Clerk org model before RBAC implementation begins" },
      { priority: "medium", title: "AI stream carries highest load (5 systems) — sequence carefully" },
    ],
  }

  await db.cognitionSnapshot.create({
    data: { output: topologyHealth },
  })
  console.log("  ✓ Cognition snapshot updated (health: 72, topology v1.1.0)")

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60))
  console.log("✅ SG2 Execution Topology Expansion COMPLETE")
  console.log("═".repeat(60))
  console.log(`  Phases:              ${PHASES.length}`)
  console.log(`  Streams:             ${STREAMS.length}`)
  console.log(`  Core Systems:        ${totalSystems}`)
  console.log(`  System Deps:         ${depCount}`)
  console.log(`  Critical Path Nodes: ${CRITICAL_PATH.length}`)
  console.log(`  ETAPs linked:        ${Object.keys(ETAP_PHASE_MAP).length}`)
  console.log(`  Subetaps linked:     ${subLinked}`)
  console.log("═".repeat(60))
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
