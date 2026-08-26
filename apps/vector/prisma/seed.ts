import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 Seeding VECTOR database...")

  // Clear existing data
  await db.dependency.deleteMany()
  await db.inboxItem.deleteMany()
  await db.task.deleteMany()
  await db.subetap.deleteMany()
  await db.etap.deleteMany()
  await db.project.deleteMany()

  // ==========================================
  // PROJECTS
  // ==========================================

  const sg2 = await db.project.create({
    data: {
      name: "SpendGuru 2.0",
      slug: "sg2",
      description: "Next-gen negotiation intelligence platform",
      status: "ACTIVE",
    },
  })

  const cic = await db.project.create({
    data: {
      name: "Conversational Intelligence Core",
      slug: "cic",
      description: "AI runtime & engine ecosystem for all Profitia products",
      status: "ACTIVE",
    },
  })

  const pmos = await db.project.create({
    data: {
      name: "PMOS",
      slug: "pmos",
      description: "Project management operating system — Profitia internal",
      status: "ACTIVE",
    },
  })

  const profitiaWeb = await db.project.create({
    data: {
      name: "profitia.pl",
      slug: "profitia-pl",
      description: "Corporate website — brand, services, SEO",
      status: "ACTIVE",
    },
  })

  const sgWeb = await db.project.create({
    data: {
      name: "spendguru.ai",
      slug: "spendguru-ai",
      description: "Product landing, conversion, waitlist",
      status: "PAUSED",
    },
  })

  const leaxaro = await db.project.create({
    data: {
      name: "Leaxaro",
      slug: "leaxaro",
      description: "AI-native conversational intelligence platform",
      status: "ACTIVE",
    },
  })

  // ==========================================
  // SG2 — ETAPs
  // ==========================================

  const sg2_e1 = await db.etap.create({
    data: { name: "ETAP 01 — Core Architecture", order: 1, projectId: sg2.id },
  })
  const sg2_e2 = await db.etap.create({
    data: { name: "ETAP 02 — Negotiation Engine", order: 2, projectId: sg2.id },
  })
  const sg2_e3 = await db.etap.create({
    data: { name: "ETAP 03 — Data Layer & Integrations", order: 3, projectId: sg2.id },
  })

  // SG2 Tasks
  await db.task.createMany({
    data: [
      {
        title: "Define runtime schema architecture",
        type: "TASK",
        status: "DONE",
        priority: "HIGH",
        projectId: sg2.id,
        etapId: sg2_e1.id,
      },
      {
        title: "Setup Next.js 15 + Prisma 7 + Neon",
        type: "TASK",
        status: "DONE",
        priority: "HIGH",
        projectId: sg2.id,
        etapId: sg2_e1.id,
      },
      {
        title: "Neon DB connection stabilization",
        type: "BUG",
        status: "BLOCKED",
        priority: "CRITICAL",
        projectId: sg2.id,
        etapId: sg2_e1.id,
      },
      {
        title: "Design negotiation session model",
        type: "TASK",
        status: "ACTIVE",
        priority: "HIGH",
        projectId: sg2.id,
        etapId: sg2_e2.id,
      },
      {
        title: "Negotiation context engine — v1",
        type: "TASK",
        status: "PLANNED",
        priority: "HIGH",
        projectId: sg2.id,
        etapId: sg2_e2.id,
      },
      {
        title: "Clerk production keys — obtain & configure",
        type: "BLOCKER",
        status: "BLOCKED",
        priority: "HIGH",
        projectId: sg2.id,
      },
    ],
  })

  // ==========================================
  // CIC — ETAPs
  // ==========================================

  const cic_e1 = await db.etap.create({
    data: { name: "ETAP 01 — Foundation", order: 1, projectId: cic.id },
  })
  const cic_e10 = await db.etap.create({
    data: { name: "ETAP 10 — Runtime Intelligence", order: 10, projectId: cic.id },
  })
  const cic_e11 = await db.etap.create({
    data: { name: "ETAP 11 — Runtime Optimization", order: 11, projectId: cic.id },
  })
  const cic_e12 = await db.etap.create({
    data: { name: "ETAP 12 — Runtime Synthesis", order: 12, projectId: cic.id },
  })

  const cic_e12_sub1 = await db.subetap.create({
    data: { name: "Synthesis Engine Design", order: 1, etapId: cic_e12.id },
  })
  const cic_e12_sub2 = await db.subetap.create({
    data: { name: "Integration Layer", order: 2, etapId: cic_e12.id },
  })

  await db.task.createMany({
    data: [
      {
        title: "Project structure & monorepo setup",
        type: "TASK",
        status: "DONE",
        priority: "HIGH",
        projectId: cic.id,
        etapId: cic_e1.id,
      },
      {
        title: "Runtime intelligence — 18 engines (complete)",
        type: "TASK",
        status: "DONE",
        priority: "HIGH",
        projectId: cic.id,
        etapId: cic_e10.id,
      },
      {
        title: "Runtime optimization — 20 engines (complete)",
        type: "TASK",
        status: "DONE",
        priority: "HIGH",
        projectId: cic.id,
        etapId: cic_e11.id,
      },
      {
        title: "Synthesis engine interface definitions",
        type: "TASK",
        status: "ACTIVE",
        priority: "HIGH",
        projectId: cic.id,
        etapId: cic_e12.id,
        subetapId: cic_e12_sub1.id,
      },
      {
        title: "SynthesisOrchestrator class",
        type: "TASK",
        status: "PLANNED",
        priority: "HIGH",
        projectId: cic.id,
        etapId: cic_e12.id,
        subetapId: cic_e12_sub1.id,
      },
      {
        title: "CIC ↔ SG2 integration bridge",
        type: "TASK",
        status: "PLANNED",
        priority: "MEDIUM",
        projectId: cic.id,
        etapId: cic_e12.id,
        subetapId: cic_e12_sub2.id,
      },
      {
        title: "Neon DB connection drops under load",
        type: "BLOCKER",
        status: "BLOCKED",
        priority: "CRITICAL",
        projectId: cic.id,
      },
    ],
  })

  // ==========================================
  // PMOS — ETAPs
  // ==========================================

  const pmos_e1 = await db.etap.create({
    data: { name: "ETAP 01 — Scaffold & Foundation", order: 1, projectId: pmos.id },
  })

  await db.task.createMany({
    data: [
      {
        title: "Initialize PMOS starter kit",
        type: "TASK",
        status: "PLANNED",
        priority: "MEDIUM",
        projectId: pmos.id,
        etapId: pmos_e1.id,
      },
      {
        title: "Define PMOS core domain model",
        type: "DECISION",
        status: "PLANNED",
        priority: "HIGH",
        projectId: pmos.id,
      },
    ],
  })

  // ==========================================
  // profitia.pl
  // ==========================================

  const prof_e1 = await db.etap.create({
    data: { name: "ETAP 01 — Homepage Redesign", order: 1, projectId: profitiaWeb.id },
  })

  await db.task.createMany({
    data: [
      {
        title: "Hero section redesign — new copy & layout",
        type: "TASK",
        status: "PLANNED",
        priority: "MEDIUM",
        projectId: profitiaWeb.id,
        etapId: prof_e1.id,
      },
      {
        title: "Services section — SpendGuru positioning update",
        type: "TASK",
        status: "PLANNED",
        priority: "MEDIUM",
        projectId: profitiaWeb.id,
        etapId: prof_e1.id,
      },
    ],
  })

  // ==========================================
  // LEAXARO — ETAPs
  // ==========================================

  const lx_e1 = await db.etap.create({
    data: { name: "ETAP 01 — NCIC Foundation", order: 1, projectId: leaxaro.id },
  })
  const lx_e2 = await db.etap.create({
    data: { name: "ETAP 02 — Conversational Core", order: 2, projectId: leaxaro.id },
  })

  await db.task.createMany({
    data: [
      {
        title: "NCIC package scaffold — 17 directories",
        type: "TASK",
        status: "DONE",
        priority: "HIGH",
        projectId: leaxaro.id,
        etapId: lx_e1.id,
      },
      {
        title: "Conversational session model design",
        type: "TASK",
        status: "ACTIVE",
        priority: "HIGH",
        projectId: leaxaro.id,
        etapId: lx_e2.id,
      },
      {
        title: "Session persistence layer",
        type: "TASK",
        status: "PLANNED",
        priority: "HIGH",
        projectId: leaxaro.id,
        etapId: lx_e2.id,
      },
    ],
  })

  // ==========================================
  // INBOX — sample items
  // ==========================================

  await db.inboxItem.createMany({
    data: [
      {
        rawInput: "/task przepisać SG2 runtime schema na Prisma 7",
        interpretedTitle: "przepisać SG2 runtime schema na Prisma 7",
        type: "TASK",
        processed: false,
      },
      {
        rawInput: "/idea dodać AI summary do task description",
        interpretedTitle: "dodać AI summary do task description",
        type: "IDEA",
        processed: false,
      },
      {
        rawInput: "/blocker Neon DB connection timeout na produkcji",
        interpretedTitle: "Neon DB connection timeout na produkcji",
        type: "BLOCKER",
        processed: false,
      },
    ],
  })

  console.log("✅ Seed complete.")
  console.log(`   Projects: 6`)
  console.log(`   ETAPs: seeded for all projects`)
  console.log(`   Tasks: seeded across all projects`)
  console.log(`   Inbox: 3 sample items`)
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
