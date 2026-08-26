// VECTOR Workspace Archetypes — 5 opinionated execution templates
// These are code-defined, not DB-stored. Each archetype generates:
// projects, ETAPs, execution domains, topology, and AI conventions.

import type { DependencyType, Criticality } from "@/lib/topology/types"

export type WorkspaceArchetype =
  | "SaaS"
  | "Startup"
  | "Agency"
  | "InternalProduct"
  | "AIPlatform"

export interface ArchetypeProject {
  name: string
  description: string
  etaps: string[]
}

export interface ArchetypeTopologyEdge {
  from: string           // source project name (depends on →)
  to: string             // target project name (is a dependency)
  type: DependencyType
  criticality: Criticality
}

export interface ArchetypeTemplate {
  archetype: WorkspaceArchetype
  label: string
  tagline: string
  description: string
  projects: ArchetypeProject[]
  executionDomains: { name: string; projectNames: string[] }[]
  topology: ArchetypeTopologyEdge[]
  conventions: Record<string, string>
}

// ──────────────────────────────────────────────────────────────────────────────

export const ARCHETYPES: Record<WorkspaceArchetype, ArchetypeTemplate> = {

  SaaS: {
    archetype: "SaaS",
    label: "SaaS Product",
    tagline: "Runtime · Frontend · Infrastructure · GTM",
    description:
      "Multi-layer SaaS execution: a runtime core, user-facing frontend, cloud infrastructure, and a go-to-market layer.",
    projects: [
      {
        name: "Runtime Core",
        description: "Core product API, business logic, data model",
        etaps: ["API Design", "Core Services", "Auth", "Data Layer"],
      },
      {
        name: "Frontend",
        description: "User-facing interface, dashboard, component library",
        etaps: ["Component Library", "Dashboard", "Landing Page"],
      },
      {
        name: "Infrastructure",
        description: "CI/CD, deployment pipeline, monitoring, observability",
        etaps: ["CI/CD Pipeline", "Deployment", "Monitoring"],
      },
      {
        name: "GTM",
        description: "Go-to-market: positioning, launch plan, user onboarding",
        etaps: ["Positioning", "Launch Plan", "User Onboarding"],
      },
    ],
    executionDomains: [
      { name: "Runtime", projectNames: ["Runtime Core", "Infrastructure"] },
      { name: "Frontend", projectNames: ["Frontend"] },
      { name: "GTM", projectNames: ["GTM"] },
    ],
    topology: [
      { from: "Frontend", to: "Runtime Core", type: "ui", criticality: "HIGH" },
      { from: "Runtime Core", to: "Infrastructure", type: "infra", criticality: "HIGH" },
      { from: "GTM", to: "Frontend", type: "orchestration", criticality: "MEDIUM" },
    ],
    conventions: {
      "ai.runtime_term": "product runtime",
      "ai.launch_term": "go-to-market launch",
      "ai.infra_term": "cloud infrastructure",
      "governance.etap_naming": "phase-based",
      "governance.priority_scale": "standard",
      "governance.naming": "kebab-case",
    },
  },

  Startup: {
    archetype: "Startup",
    label: "Startup",
    tagline: "MVP · Growth · Infrastructure",
    description:
      "Lean startup structure: build the core product loop, drive growth, keep infrastructure minimal.",
    projects: [
      {
        name: "MVP Core",
        description: "Core product loop, user auth, data model, V1 launch",
        etaps: ["Core Loop", "User Auth", "Data Model", "V1 Launch"],
      },
      {
        name: "Growth",
        description: "Acquisition, activation, retention engines",
        etaps: ["Acquisition", "Activation", "Retention"],
      },
      {
        name: "Infrastructure",
        description: "Deploy, monitoring, basic reliability",
        etaps: ["Deploy", "Monitoring"],
      },
    ],
    executionDomains: [
      { name: "Product", projectNames: ["MVP Core"] },
      { name: "Growth", projectNames: ["Growth"] },
      { name: "Infra", projectNames: ["Infrastructure"] },
    ],
    topology: [
      { from: "Growth", to: "MVP Core", type: "runtime", criticality: "HIGH" },
      { from: "MVP Core", to: "Infrastructure", type: "infra", criticality: "MEDIUM" },
    ],
    conventions: {
      "ai.runtime_term": "product core",
      "ai.launch_term": "launch",
      "ai.mvp_term": "MVP",
      "governance.etap_naming": "sprint-based",
      "governance.priority_scale": "high-critical-only",
      "governance.naming": "plain",
    },
  },

  Agency: {
    archetype: "Agency",
    label: "Agency",
    tagline: "Delivery · Internal Tooling · Business Development",
    description:
      "Agency delivery model: client execution pipeline, internal operations, and business development.",
    projects: [
      {
        name: "Client Delivery",
        description: "Discovery, design, build, QA, and client launch pipeline",
        etaps: ["Discovery", "Design", "Build", "QA", "Launch"],
      },
      {
        name: "Internal Tooling",
        description: "Workflows, templates, process automation",
        etaps: ["Workflows", "Templates", "Process Automation"],
      },
      {
        name: "Business Development",
        description: "Pipeline management, proposals, client onboarding",
        etaps: ["Pipeline", "Proposals", "Client Onboarding"],
      },
    ],
    executionDomains: [
      { name: "Delivery", projectNames: ["Client Delivery"] },
      { name: "Operations", projectNames: ["Internal Tooling", "Business Development"] },
    ],
    topology: [
      {
        from: "Client Delivery",
        to: "Internal Tooling",
        type: "orchestration",
        criticality: "MEDIUM",
      },
      {
        from: "Business Development",
        to: "Client Delivery",
        type: "orchestration",
        criticality: "LOW",
      },
    ],
    conventions: {
      "ai.runtime_term": "delivery pipeline",
      "ai.launch_term": "client launch",
      "governance.etap_naming": "stage-based",
      "governance.priority_scale": "deadline-driven",
      "governance.naming": "client-prefixed",
    },
  },

  InternalProduct: {
    archetype: "InternalProduct",
    label: "Internal Product",
    tagline: "Platform · Data Layer · UX · Operations",
    description:
      "Internal platform execution: core platform, data layer, user experience, and operational overhead.",
    projects: [
      {
        name: "Core Platform",
        description: "Foundation, core features, third-party integrations",
        etaps: ["Foundation", "Features", "Integrations"],
      },
      {
        name: "Data Layer",
        description: "Schema design, ETL pipelines, reporting and analytics",
        etaps: ["Schema", "ETL", "Reporting"],
      },
      {
        name: "User Experience",
        description: "Design system, dashboard UI, UX patterns",
        etaps: ["Design System", "Dashboard", "UX Patterns"],
      },
      {
        name: "Operations",
        description: "Admin tooling, system monitoring, support tooling",
        etaps: ["Admin", "Monitoring", "Support Tools"],
      },
    ],
    executionDomains: [
      { name: "Platform", projectNames: ["Core Platform", "Data Layer"] },
      { name: "UX", projectNames: ["User Experience"] },
      { name: "Ops", projectNames: ["Operations"] },
    ],
    topology: [
      { from: "User Experience", to: "Core Platform", type: "ui", criticality: "HIGH" },
      { from: "Core Platform", to: "Data Layer", type: "runtime", criticality: "HIGH" },
      { from: "Operations", to: "Core Platform", type: "infra", criticality: "MEDIUM" },
    ],
    conventions: {
      "ai.runtime_term": "platform runtime",
      "ai.launch_term": "rollout",
      "governance.etap_naming": "milestone-based",
      "governance.priority_scale": "standard",
      "governance.naming": "domain-prefixed",
    },
  },

  AIPlatform: {
    archetype: "AIPlatform",
    label: "AI Platform",
    tagline: "Cognition · Runtime · Data · Orchestration · Product",
    description:
      "AI-native platform: cognition core, orchestration layer, data pipeline, and product interface.",
    projects: [
      {
        name: "Cognition Core",
        description: "Model architecture, reasoning engine, memory system",
        etaps: ["Model Architecture", "Reasoning Engine", "Memory System"],
      },
      {
        name: "Runtime",
        description: "API layer, orchestration, streaming, latency optimization",
        etaps: ["API Layer", "Orchestration", "Streaming"],
      },
      {
        name: "Data Pipeline",
        description: "Data ingestion, processing, vector storage",
        etaps: ["Ingestion", "Processing", "Vector Storage"],
      },
      {
        name: "Orchestration Layer",
        description: "Agent framework, tool use, model evaluation",
        etaps: ["Agent Framework", "Tool Use", "Evaluation"],
      },
      {
        name: "Product Interface",
        description: "UX design, user-facing features, external integrations",
        etaps: ["Interface Design", "UX", "Integration"],
      },
    ],
    executionDomains: [
      { name: "AI", projectNames: ["Cognition Core", "Orchestration Layer"] },
      { name: "Runtime", projectNames: ["Runtime", "Data Pipeline"] },
      { name: "Product", projectNames: ["Product Interface"] },
    ],
    topology: [
      { from: "Product Interface", to: "Runtime", type: "ui", criticality: "HIGH" },
      { from: "Runtime", to: "Cognition Core", type: "cognition", criticality: "CRITICAL" },
      { from: "Runtime", to: "Data Pipeline", type: "runtime", criticality: "HIGH" },
      {
        from: "Orchestration Layer",
        to: "Cognition Core",
        type: "orchestration",
        criticality: "HIGH",
      },
    ],
    conventions: {
      "ai.runtime_term": "AI orchestration runtime",
      "ai.launch_term": "model release",
      "ai.infra_term": "compute infrastructure",
      "governance.etap_naming": "capability-based",
      "governance.priority_scale": "stability-first",
      "governance.naming": "domain-based",
    },
  },
}

export const ARCHETYPE_LIST = Object.values(ARCHETYPES)
