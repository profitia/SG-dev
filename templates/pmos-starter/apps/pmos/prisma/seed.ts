import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding PMOS...')

  // ─── Tags ────────────────────────────────────────────────────────────────

  const tagNames = [
    'runtime', 'architecture', 'infra', 'database', 'auth',
    'api', 'ui', 'ai', 'events', 'memory',
    'integrations', 'testing', 'security', 'performance', 'tooling',
  ]

  const tags = await Promise.all(
    tagNames.map((name) =>
      prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  )

  const tagMap = Object.fromEntries(tags.map((t) => [t.name, t.id]))

  // ─── Canonical Principles ─────────────────────────────────────────────────

  const principles = await Promise.all([
    prisma.canonicalPrinciple.create({
      data: {
        title: 'Runtime-first',
        description: 'Build for runtime correctness before optimizing for developer ergonomics. A system that works correctly at runtime is more valuable than a system that is pleasant to write.',
        reason: 'Premature abstraction and ergonomic-first design often produce systems that are brittle at runtime. Runtime-first forces correctness as the primary constraint.',
        priority: 'high',
      },
    }),
    prisma.canonicalPrinciple.create({
      data: {
        title: 'Event-driven boundaries',
        description: 'System boundaries are crossed via events, not direct function calls. Cross-domain communication is async and message-based.',
        reason: 'Direct coupling across domain boundaries creates implicit dependencies that make systems hard to change, test, and scale.',
        priority: 'high',
      },
    }),
    prisma.canonicalPrinciple.create({
      data: {
        title: 'Deterministic-first',
        description: 'Prefer deterministic, pure functions over stateful, side-effecting code. Isolate side effects at system boundaries.',
        reason: 'Deterministic code is easier to test, reason about, and debug. Side effects at boundaries are explicit and controlled.',
        priority: 'high',
      },
    }),
    prisma.canonicalPrinciple.create({
      data: {
        title: 'Validate at boundaries',
        description: 'All external inputs are validated with a schema (Zod or equivalent) at the entry point. No unvalidated data enters the domain layer.',
        reason: 'Unvalidated inputs are the root cause of a large class of runtime errors, security vulnerabilities, and data corruption bugs.',
        priority: 'high',
      },
    }),
    prisma.canonicalPrinciple.create({
      data: {
        title: 'Memory continuity',
        description: 'Every significant architectural decision, implementation session, and risk is recorded in PMOS. The AI must never be context-blind.',
        reason: 'Without structured memory, every AI session starts from scratch. Memory continuity ensures the AI builds on what was already decided.',
        priority: 'medium',
      },
    }),
  ])

  console.log(`Principles created: ${principles.length}`)

  // ─── Roadmap Nodes ────────────────────────────────────────────────────────

  const etap1 = await prisma.roadmapNode.create({
    data: {
      title: 'ETAP 1 — Foundation',
      description: 'Project scaffold, monorepo setup, database schema, base configuration, environment isolation.',
      status: 'done',
      priority: 'high',
      order: 100,
      sortKey: '001',
      tags: {
        create: [
          { tag: { connect: { id: tagMap['infra'] } } },
          { tag: { connect: { id: tagMap['database'] } } },
          { tag: { connect: { id: tagMap['architecture'] } } },
        ],
      },
    },
  })

  await prisma.roadmapNode.createMany({
    data: [
      {
        title: '1.1 — Project Scaffold',
        description: 'Initialize repository, configure TypeScript, set up build tooling.',
        status: 'done',
        priority: 'high',
        order: 1,
        sortKey: '001.001',
        parentId: etap1.id,
      },
      {
        title: '1.2 — Database Schema',
        description: 'Define core domain models in Prisma schema. Push to database.',
        status: 'done',
        priority: 'high',
        order: 2,
        sortKey: '001.002',
        parentId: etap1.id,
      },
      {
        title: '1.3 — Environment Configuration',
        description: 'Environment variables, secrets management, development/production split.',
        status: 'done',
        priority: 'high',
        order: 3,
        sortKey: '001.003',
        parentId: etap1.id,
      },
    ],
  })

  const etap2 = await prisma.roadmapNode.create({
    data: {
      title: 'ETAP 2 — Runtime Core',
      description: 'Core application runtime: API routes, data access layer, domain logic.',
      status: 'done',
      priority: 'high',
      order: 200,
      sortKey: '002',
      tags: {
        create: [
          { tag: { connect: { id: tagMap['runtime'] } } },
          { tag: { connect: { id: tagMap['api'] } } },
        ],
      },
    },
  })

  await prisma.roadmapNode.createMany({
    data: [
      {
        title: '2.1 — Domain Layer',
        description: 'Core domain models, business logic, validation.',
        status: 'done',
        priority: 'high',
        order: 1,
        sortKey: '002.001',
        parentId: etap2.id,
      },
      {
        title: '2.2 — API Layer',
        description: 'REST or RPC API routes, request validation, response formatting.',
        status: 'done',
        priority: 'high',
        order: 2,
        sortKey: '002.002',
        parentId: etap2.id,
      },
      {
        title: '2.3 — Data Access Layer',
        description: 'Repository pattern or query layer over Prisma.',
        status: 'done',
        priority: 'high',
        order: 3,
        sortKey: '002.003',
        parentId: etap2.id,
      },
    ],
  })

  const etap3 = await prisma.roadmapNode.create({
    data: {
      title: 'ETAP 3 — Integrations',
      description: 'External integrations: auth, third-party APIs, webhooks, queues.',
      status: 'in_progress',
      priority: 'high',
      order: 300,
      sortKey: '003',
      tags: {
        create: [
          { tag: { connect: { id: tagMap['integrations'] } } },
          { tag: { connect: { id: tagMap['auth'] } } },
        ],
      },
    },
  })

  await prisma.roadmapNode.createMany({
    data: [
      {
        title: '3.1 — Authentication',
        description: 'User identity, session management, role-based access.',
        status: 'done',
        priority: 'high',
        order: 1,
        sortKey: '003.001',
        parentId: etap3.id,
      },
      {
        title: '3.2 — External API Integration',
        description: 'Connect to third-party services. Implement adapters and error handling.',
        status: 'in_progress',
        priority: 'medium',
        order: 2,
        sortKey: '003.002',
        parentId: etap3.id,
      },
      {
        title: '3.3 — Background Queue',
        description: 'Async job processing for long-running tasks.',
        status: 'backlog',
        priority: 'medium',
        order: 3,
        sortKey: '003.003',
        parentId: etap3.id,
      },
    ],
  })

  const etap4 = await prisma.roadmapNode.create({
    data: {
      title: 'ETAP 4 — UI Layer',
      description: 'Frontend: pages, components, data fetching, state management.',
      status: 'backlog',
      priority: 'medium',
      order: 400,
      sortKey: '004',
      tags: {
        create: [
          { tag: { connect: { id: tagMap['ui'] } } },
        ],
      },
    },
  })

  await prisma.roadmapNode.createMany({
    data: [
      {
        title: '4.1 — Core UI Components',
        description: 'Design system foundation: typography, colors, layout primitives.',
        status: 'backlog',
        priority: 'high',
        order: 1,
        sortKey: '004.001',
        parentId: etap4.id,
      },
      {
        title: '4.2 — Main Application Views',
        description: 'Primary screens and user workflows.',
        status: 'backlog',
        priority: 'high',
        order: 2,
        sortKey: '004.002',
        parentId: etap4.id,
      },
      {
        title: '4.3 — Data Display & Visualizations',
        description: 'Charts, tables, real-time updates.',
        status: 'backlog',
        priority: 'medium',
        order: 3,
        sortKey: '004.003',
        parentId: etap4.id,
      },
    ],
  })

  const etap5 = await prisma.roadmapNode.create({
    data: {
      title: 'ETAP 5 — AI Layer',
      description: 'AI integration: prompts, conversation runtime, memory, recommendations.',
      status: 'backlog',
      priority: 'medium',
      order: 500,
      sortKey: '005',
      tags: {
        create: [
          { tag: { connect: { id: tagMap['ai'] } } },
          { tag: { connect: { id: tagMap['memory'] } } },
        ],
      },
    },
  })

  await prisma.roadmapNode.createMany({
    data: [
      {
        title: '5.1 — Prompt Architecture',
        description: 'Prompt templates, versioning, context injection.',
        status: 'backlog',
        priority: 'high',
        order: 1,
        sortKey: '005.001',
        parentId: etap5.id,
      },
      {
        title: '5.2 — Conversation Runtime',
        description: 'Session management, turn processing, response streaming.',
        status: 'backlog',
        priority: 'high',
        order: 2,
        sortKey: '005.002',
        parentId: etap5.id,
      },
      {
        title: '5.3 — Memory Layer',
        description: 'Short-term context, episodic memory, continuity signals.',
        status: 'backlog',
        priority: 'medium',
        order: 3,
        sortKey: '005.003',
        parentId: etap5.id,
      },
    ],
  })

  console.log(`ETAPs created: 5`)

  // ─── Architecture Warnings ────────────────────────────────────────────────

  await prisma.architectureWarning.createMany({
    data: [
      {
        title: 'Missing abstraction layer for external API calls',
        description: 'External API calls may be scattered across multiple modules without a unified adapter layer. This makes error handling inconsistent and testing difficult. Introduce a dedicated integration adapter layer.',
        severity: 'medium',
        type: 'runtime_boundary',
        affectedArea: 'src/lib/integrations/',
        resolved: false,
      },
      {
        title: 'Business logic risk in UI layer',
        description: 'As the UI layer grows, there is risk of business logic leaking into page components. Enforce strict separation: pages fetch data only, domain logic lives in server actions or API routes.',
        severity: 'medium',
        type: 'dashboard_gravity',
        affectedArea: 'src/app/',
        resolved: false,
      },
    ],
  })

  console.log(`Warnings created: 2`)

  // ─── Initial Execution Log ────────────────────────────────────────────────

  const log = await prisma.executionLog.create({
    data: {
      title: 'PMOS Bootstrap — Generic Starter Seed',
      summary: 'PMOS initialized with generic starter data. 5 ETAPs created covering Foundation → AI Layer. 5 canonical principles established. 2 architecture warnings seeded as reminders. Database schema pushed and Prisma client generated.',
      architecturalImpact: 'PMOS is now operational as the project memory runtime. The context builder can be run to generate the AI context injection file. All ETAPs, principles, and warnings should be customized to reflect the actual project state using the VSC-BOOTSTRAP-PROMPT.',
      changedFiles: [
        'apps/pmos/prisma/schema.prisma',
        'apps/pmos/prisma/seed.ts',
        'apps/pmos/pmos.config.ts',
      ],
      nextSteps: 'Run the VSC-BOOTSTRAP-PROMPT to replace generic data with project-specific roadmap, principles, and warnings. Then run context:build to generate the AI context file.',
      canonicalAlignment: 'high',
    },
  })

  console.log(`Execution log created: 1`)
  console.log(`\nPMOS seed complete.`)
  console.log(`Next: edit pmos.config.ts, then run the VSC-BOOTSTRAP-PROMPT to customize.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
