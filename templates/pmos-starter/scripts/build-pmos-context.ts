#!/usr/bin/env tsx
/**
 * PMOS Context Builder
 * --------------------
 * Fetches active context from the PMOS API and generates:
 *   apps/pmos/.context/runtime-context.md
 *
 * Usage:
 *   npx tsx scripts/build-pmos-context.ts
 *   npx tsx scripts/build-pmos-context.ts --url http://localhost:3200
 *   npx tsx scripts/build-pmos-context.ts --out .context/my-context.md
 *
 * The generated file is injection-ready for:
 *   - GitHub Copilot (via .context/ directory)
 *   - Claude / ChatGPT (manual paste)
 *   - VS Code workspace context
 */

import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname, fileURLToPath } from 'path'

// ── Config ──────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// __dirname = scripts/ directory, root = one level up
const WORKSPACE_ROOT = resolve(__dirname, '..')
const DEFAULT_URL = process.env.PMOS_URL ?? 'http://localhost:3200'
const DEFAULT_OUT = resolve(WORKSPACE_ROOT, 'apps/pmos/.context/runtime-context.md')

function parseArgs() {
  const args = process.argv.slice(2)
  let url = DEFAULT_URL
  let out = DEFAULT_OUT

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) url = args[++i]
    if (args[i] === '--out' && args[i + 1]) out = resolve(args[++i])
  }

  return { url, out }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ContextResponse {
  generatedAt: string
  activeEtap: string | null
  activeNode: string | null
  activeDomains: string[]
  relatedPrinciples: string[]
  recentExecutions: { title: string; summary: string | null }[]
  activeWarnings: { title: string; severity: string; type: string }[]
  nextSuggestedStep: string | null
}

// ── Markdown Builder ─────────────────────────────────────────────────────────

function buildMarkdown(ctx: ContextResponse, projectName?: string): string {
  const SEVERITY_ICON: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '⚪',
  }

  const header = projectName ? `# PMOS Runtime Context — ${projectName}` : `# PMOS Runtime Context`

  const lines: string[] = [
    header,
    ``,
    `> Generated: ${ctx.generatedAt}`,
    `> Source: PMOS — /api/context/active`,
    ``,
    `---`,
    ``,
  ]

  // Active ETAP
  lines.push(`## Active ETAP`)
  lines.push(ctx.activeEtap ?? '_None in progress_')
  lines.push(``)

  // Active Node
  if (ctx.activeNode) {
    lines.push(`## Current Focus`)
    lines.push(ctx.activeNode)
    lines.push(``)
  }

  // Domains
  if (ctx.activeDomains.length > 0) {
    lines.push(`## Active Domains`)
    ctx.activeDomains.forEach((d) => lines.push(`- ${d}`))
    lines.push(``)
  }

  // Principles
  if (ctx.relatedPrinciples.length > 0) {
    lines.push(`## Canonical Principles (high priority)`)
    ctx.relatedPrinciples.forEach((p) => lines.push(`- ${p}`))
    lines.push(``)
  }

  // Recent executions
  if (ctx.recentExecutions.length > 0) {
    lines.push(`## Recent Executions`)
    ctx.recentExecutions.forEach((e) => {
      lines.push(`- **${e.title}**`)
      if (e.summary) {
        const brief = e.summary.length > 120 ? e.summary.slice(0, 120) + '…' : e.summary
        lines.push(`  ${brief}`)
      }
    })
    lines.push(``)
  }

  // Active warnings
  if (ctx.activeWarnings.length > 0) {
    lines.push(`## Active Warnings`)
    ctx.activeWarnings.forEach((w) => {
      const icon = SEVERITY_ICON[w.severity] ?? '⚠️'
      lines.push(`- ${icon} **${w.title}** _(${w.severity})_`)
    })
    lines.push(``)
  }

  // Next step
  if (ctx.nextSuggestedStep) {
    lines.push(`## Suggested Next Step`)
    lines.push(ctx.nextSuggestedStep)
    lines.push(``)
  }

  lines.push(`---`)
  lines.push(`_This file is auto-generated. Do not edit manually._`)
  lines.push(`_Run: \`npx tsx scripts/build-pmos-context.ts\`_`)

  return lines.join('\n')
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { url, out } = parseArgs()

  // Try to read project name from pmos.config.ts (optional)
  let projectName: string | undefined
  try {
    const configPath = resolve(WORKSPACE_ROOT, 'apps/pmos/pmos.config.ts')
    const { pmosConfig } = await import(configPath)
    projectName = pmosConfig?.projectName
  } catch {
    // Config not found or not yet set — continue without project name
  }

  const endpoint = `${url}/api/context/active`
  console.log(`\nFetching context from: ${endpoint}`)

  let ctx: ContextResponse
  try {
    const res = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} — ${res.statusText}`)
    }
    ctx = (await res.json()) as ContextResponse
  } catch (err) {
    console.error(`\nFailed to fetch context:`, err)
    console.error(`   Is PMOS running at ${url}?`)
    console.error(`   Run: cd apps/pmos && npm run dev`)
    process.exit(1)
  }

  const markdown = buildMarkdown(ctx, projectName)

  // Ensure output directory exists
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, markdown, 'utf-8')

  console.log(`Context written to: ${out}`)
  console.log(``)
  console.log(`   Active ETAP:  ${ctx.activeEtap ?? 'none'}`)
  console.log(`   Active Node:  ${ctx.activeNode ?? 'none'}`)
  console.log(`   Domains:      ${ctx.activeDomains.join(', ') || 'none'}`)
  console.log(`   Warnings:     ${ctx.activeWarnings.length}`)
  console.log(`   Principles:   ${ctx.relatedPrinciples.length}`)
  console.log(`   Executions:   ${ctx.recentExecutions.length}`)
  console.log(`   Next step:    ${ctx.nextSuggestedStep ?? 'none'}`)
  console.log(``)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
