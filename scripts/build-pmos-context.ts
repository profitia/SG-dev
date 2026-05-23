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
 *   npx tsx scripts/build-pmos-context.ts --offline   # force offline mode
 *
 * Offline mode:
 *   When PMOS server is unreachable, generates a minimal fallback context
 *   from the last saved snapshot (if available) instead of crashing.
 *   This ensures context:build is always safe to run, regardless of dev
 *   server state.
 *
 * The generated file is injection-ready for:
 *   - GitHub Copilot (via .context/ directory)
 *   - Claude / ChatGPT (manual paste)
 *   - VS Code workspace context
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

// Inline governance reader — avoids import path issues in the scripts/ context
// (same logic as src/lib/pmos/governance-reader.ts but self-contained)
interface GovItem { title: string; [key: string]: unknown }
function readGovJsonFiles(dir: string): GovItem[] {
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => {
        try {
          const obj = JSON.parse(readFileSync(join(dir, f), 'utf-8'))
          return typeof obj?.title === 'string' ? [obj as GovItem] : []
        } catch { return [] }
      })
  } catch { return [] }
}

// ── Paths ────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// __dirname = scripts/, root = SG-dev/
const WORKSPACE_ROOT = resolve(__dirname, '..')
const PMOS_ROOT = resolve(WORKSPACE_ROOT, 'apps/pmos')
const DEFAULT_URL = process.env.PMOS_URL ?? 'http://localhost:3200'
const DEFAULT_OUT = resolve(PMOS_ROOT, '.context/runtime-context.md')
const SNAPSHOTS_DIR = resolve(PMOS_ROOT, '.pmos/conversations/snapshots')
const GOVERNANCE_ROOT = resolve(PMOS_ROOT, '.pmos/governance')

// ── CLI Args ─────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  let url = DEFAULT_URL
  let out = DEFAULT_OUT
  let offline = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) url = args[++i]
    if (args[i] === '--out' && args[i + 1]) out = resolve(args[++i])
    if (args[i] === '--offline') offline = true
  }

  return { url, out, offline }
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

interface ContextSnapshot {
  id: string
  timestamp: string
  pmosUrl: string
  mode: 'live' | 'offline'
  activeEtap: string | null
  activeNode: string | null
  warningCount: number
  principleCount: number
  executionCount: number
  contextPath: string
}

// ── Snapshot helpers ─────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true })
  } catch (err) {
    console.warn(`[PMOS] Warning: could not create directory ${dir}:`, (err as Error).message)
  }
}

function writeSnapshot(snapshot: ContextSnapshot): void {
  try {
    ensureDir(SNAPSHOTS_DIR)
    const snapshotPath = join(SNAPSHOTS_DIR, `${snapshot.id}.json`)
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8')
    console.log(`   Snapshot:     ${snapshotPath.replace(WORKSPACE_ROOT + '/', '')}`)
  } catch (err) {
    console.warn(`[PMOS] Warning: could not write snapshot:`, (err as Error).message)
    // Non-fatal — context generation continues
  }
}

function readLastSnapshot(): ContextSnapshot | null {
  try {
    if (!existsSync(SNAPSHOTS_DIR)) return null
    const files = readdirSync(SNAPSHOTS_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
    if (files.length === 0) return null
    const raw = readFileSync(join(SNAPSHOTS_DIR, files[0]), 'utf-8')
    return JSON.parse(raw) as ContextSnapshot
  } catch {
    return null
  }
}

// ── Markdown Builders ────────────────────────────────────────────────────────

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

  lines.push(`## Active ETAP`)
  lines.push(ctx.activeEtap ?? '_None in progress_')
  lines.push(``)

  if (ctx.activeNode) {
    lines.push(`## Current Focus`)
    lines.push(ctx.activeNode)
    lines.push(``)
  }

  if (ctx.activeDomains.length > 0) {
    lines.push(`## Active Domains`)
    ctx.activeDomains.forEach((d) => lines.push(`- ${d}`))
    lines.push(``)
  }

  if (ctx.relatedPrinciples.length > 0) {
    lines.push(`## Canonical Principles (high priority)`)
    ctx.relatedPrinciples.forEach((p) => lines.push(`- ${p}`))
    lines.push(``)
  }

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

  if (ctx.activeWarnings.length > 0) {
    lines.push(`## Active Warnings`)
    ctx.activeWarnings.forEach((w) => {
      const icon = SEVERITY_ICON[w.severity] ?? '⚠️'
      lines.push(`- ${icon} **${w.title}** _(${w.severity})_`)
    })
    lines.push(``)
  }

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

function buildOfflineMarkdown(
  projectName: string | undefined,
  url: string,
  lastSnapshot: ContextSnapshot | null,
  governanceRoot: string,
): string {
  const now = new Date().toISOString()
  const header = projectName
    ? `# PMOS Runtime Context — ${projectName}`
    : `# PMOS Runtime Context`

  const lines: string[] = [
    header,
    ``,
    `> Generated: ${now}`,
    `> Source: OFFLINE FALLBACK (PMOS server not reachable at ${url})`,
    ``,
    `---`,
    ``,
    `## Status`,
    ``,
    `⚠️ **PMOS runtime server is not currently running.**`,
    ``,
    `This context was generated in offline mode from local snapshot data.`,
    `For full live runtime context, start PMOS:`,
    ``,
    `\`\`\``,
    `cd apps/pmos && npm run dev`,
    `\`\`\``,
    ``,
  ]

  if (lastSnapshot) {
    lines.push(`## Last Known State`)
    lines.push(``)
    lines.push(`> Snapshot from: ${lastSnapshot.timestamp}`)
    lines.push(``)
    lines.push(`- **Active ETAP:** ${lastSnapshot.activeEtap ?? '_none_'}`)
    lines.push(`- **Active Node:** ${lastSnapshot.activeNode ?? '_none_'}`)
    lines.push(`- **Warnings:** ${lastSnapshot.warningCount}`)
    lines.push(`- **Principles:** ${lastSnapshot.principleCount}`)
    lines.push(`- **Executions:** ${lastSnapshot.executionCount}`)
    lines.push(``)
  } else {
    lines.push(`## Last Known State`)
    lines.push(``)
    lines.push(`_No previous snapshot found. Start PMOS and run \`npm run context:build\` to generate._`)
    lines.push(``)
  }

  // Read governance filesystem artifacts (defensive)
  const govPrinciples = readGovJsonFiles(join(governanceRoot, 'principles'))
  const govWarnings = readGovJsonFiles(join(governanceRoot, 'warnings'))
  const govDecisions = readGovJsonFiles(join(governanceRoot, 'decisions'))

  if (govPrinciples.length > 0) {
    lines.push(`## Governance Principles (filesystem)`)
    govPrinciples.forEach((p) => lines.push(`- ${p.title}`))
    lines.push(``)
  }

  if (govWarnings.length > 0) {
    lines.push(`## Governance Warnings (filesystem)`)
    govWarnings.forEach((w) => lines.push(`- ⚠️ ${w.title}`))
    lines.push(``)
  }

  if (govDecisions.length > 0) {
    lines.push(`## Architecture Decisions (filesystem)`)
    govDecisions.forEach((d) => lines.push(`- ${d.title}`))
    lines.push(``)
  }

  lines.push(`---`)
  lines.push(`_This file is auto-generated. Do not edit manually._`)
  lines.push(`_Run: \`npx tsx scripts/build-pmos-context.ts\`_`)

  return lines.join('\n')
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateMarkdown(content: string, out: string): boolean {
  if (!content || content.trim().length === 0) {
    console.warn(`[PMOS] Warning: generated context is empty — skipping write to ${out}`)
    return false
  }
  if (!content.includes('# PMOS Runtime Context')) {
    console.warn(`[PMOS] Warning: generated context missing expected header`)
    return false
  }
  return true
}

// ── Context Writer ────────────────────────────────────────────────────────────

function writeContext(markdown: string, out: string): void {
  try {
    ensureDir(dirname(out))
    writeFileSync(out, markdown, 'utf-8')
  } catch (err) {
    console.error(`[PMOS] Error: could not write context to ${out}:`, (err as Error).message)
    process.exit(1)
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { url, out, offline } = parseArgs()

  // Read project name from pmos.config.ts (defensive)
  let projectName: string | undefined
  try {
    const configPath = resolve(PMOS_ROOT, 'pmos.config.ts')
    if (existsSync(configPath)) {
      const { pmosConfig } = await import(configPath)
      projectName = pmosConfig?.projectName
    }
  } catch {
    // Config not readable — continue without project name
  }

  // ── Offline mode ────────────────────────────────────────────────────────────
  if (offline) {
    console.log(`\n[PMOS] Running in offline mode (--offline flag set)`)
    const lastSnapshot = readLastSnapshot()
    const markdown = buildOfflineMarkdown(projectName, url, lastSnapshot, GOVERNANCE_ROOT)
    if (validateMarkdown(markdown, out)) {
      writeContext(markdown, out)
      console.log(`Context written to: ${out} (offline)`)
    }
    return
  }

  // ── Live mode ───────────────────────────────────────────────────────────────
  const endpoint = `${url}/api/context/active`
  console.log(`\n[PMOS] Fetching context from: ${endpoint}`)

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
    // Server not reachable — graceful fallback, no crash
    console.warn(`\n[PMOS] Server not reachable at ${url} — generating offline fallback context`)
    console.warn(`[PMOS] Reason: ${(err as Error).message}`)
    console.warn(`[PMOS] To get live context: cd apps/pmos && npm run dev`)

    const lastSnapshot = readLastSnapshot()
    const markdown = buildOfflineMarkdown(projectName, url, lastSnapshot, GOVERNANCE_ROOT)
    if (validateMarkdown(markdown, out)) {
      writeContext(markdown, out)
      console.log(`\nContext written to: ${out} (offline fallback)`)
      if (lastSnapshot) {
        console.log(`   Last snapshot: ${lastSnapshot.timestamp}`)
      }
    }
    // Exit 0 — offline fallback is not a failure
    return
  }

  // Build and validate markdown
  const markdown = buildMarkdown(ctx, projectName)
  if (!validateMarkdown(markdown, out)) {
    console.error(`[PMOS] Error: context validation failed — not writing file`)
    process.exit(1)
  }

  // Write context file
  writeContext(markdown, out)

  // Write snapshot (non-fatal if it fails)
  const snapshot: ContextSnapshot = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    pmosUrl: url,
    mode: 'live',
    activeEtap: ctx.activeEtap,
    activeNode: ctx.activeNode,
    warningCount: ctx.activeWarnings.length,
    principleCount: ctx.relatedPrinciples.length,
    executionCount: ctx.recentExecutions.length,
    contextPath: out.replace(WORKSPACE_ROOT + '/', ''),
  }
  writeSnapshot(snapshot)

  console.log(`\n[PMOS] Context written to: ${out}`)
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
  console.error(`[PMOS] Unexpected error:`, err)
  process.exit(1)
})
