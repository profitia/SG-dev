#!/usr/bin/env tsx
/**
 * check-enum-purity.ts — GOV-1-2 Compile-Time Enum Purity Checker
 *
 * Scans runtime TypeScript files in apps/pmos/scripts/ and apps/vector/scripts/
 * for raw governance string literals that should be replaced with canonical
 * enum references from @sg/governance.
 *
 * Exit 0: PASS — no violations found
 * Exit 1: FAIL — governance purity violations detected
 *
 * Run: tsx scripts/check-enum-purity.ts
 * Via npm: npm run governance:purity-check
 *
 * CANONICAL SOURCE: packages/governance/src (@sg/governance)
 */

import fs from "fs"
import path from "path"

// ── Directories to scan ───────────────────────────────────────────────────────
const SG_DEV_ROOT = path.resolve(__dirname, "../../..")
const SCAN_DIRS = [
  path.join(SG_DEV_ROOT, "apps/pmos/scripts"),
  path.join(SG_DEV_ROOT, "apps/vector/scripts"),
]

// ── Files that are allowlisted (governance package itself, this checker) ──────
const ALLOWLISTED_FILES = new Set([
  path.join(SG_DEV_ROOT, "packages/governance/src/enums/index.ts"),
  path.join(SG_DEV_ROOT, "packages/governance/src/registries/index.ts"),
  path.join(SG_DEV_ROOT, "packages/governance/src/types/index.ts"),
  path.join(SG_DEV_ROOT, "packages/governance/src/validators/index.ts"),
  path.join(SG_DEV_ROOT, "packages/governance/src/integrity/index.ts"),
  path.join(SG_DEV_ROOT, "packages/governance/src/index.ts"),
  path.join(SG_DEV_ROOT, "apps/pmos/scripts/check-enum-purity.ts"),
])

// ── Known-acceptable ADAPTER files (documented in enum-purity-audit.md) ──────
// These files contain intentional adapter/migration patterns — documented exceptions.
const ADAPTER_FILES = new Set([
  "ingest-sg2-roadmap-to-pmos.ts", // CanonicalStatus adapter type
  "build-runtime-context.ts",       // JSON input parsing boundary
  // Validation/integrity scripts use IntegrityStatus ("PASS"/"FAIL"/"WARNING")
  // which is a PMOS-internal concept distinct from GovernanceState ("VALID"/"FAIL"/"WARNING").
  // These are not GovernanceState violations — they are test suite lifecycle states.
  "integrity-check.ts",
  "runtime-integrity-audit.ts",
  "concurrent-runtime-test.ts",
  "drift-simulation.ts",
  "projection-consistency-test.ts",
  "run-all-validation.ts",
  "topology-attack-suite.ts",
  "runtime-rebuild-test.ts",
])

// ── Pattern sets ──────────────────────────────────────────────────────────────

// Governance enum values that must NOT appear as raw inline string literals
// in non-governance TypeScript files
const GOVERNANCE_STRING_PATTERNS: Array<{
  pattern: RegExp
  description: string
  enum: string
}> = [
  // ReadinessState values
  { pattern: /:\s*["']NOT_READY["']/g,    description: "ReadinessState.NOT_READY",    enum: "ReadinessState" },
  { pattern: /:\s*["']IN_PROGRESS["']/g,  description: "ReadinessState.IN_PROGRESS",  enum: "ReadinessState" },
  { pattern: /:\s*["']VALIDATION["']/g,   description: "ReadinessState.VALIDATION",    enum: "ReadinessState" },

  // NOTE: GovernanceState values ("FAIL"/"WARNING"/"VALID") are intentionally NOT checked here
  // because they overlap with IntegrityStatus ("PASS"/"FAIL"/"WARNING") used in validation scripts.
  // GovernanceState purity is enforced at compile-time by TypeScript via typed function params.

  // ConversationType values
  { pattern: /conversationType:\s*["']implementation["']/g,    description: "ConversationType.IMPLEMENTATION",   enum: "ConversationType" },
  { pattern: /conversationType:\s*["']architecture["']/g,      description: "ConversationType.ARCHITECTURE",     enum: "ConversationType" },
  { pattern: /conversationType:\s*["']debugging["']/g,         description: "ConversationType.DEBUGGING",        enum: "ConversationType" },
  { pattern: /conversationType:\s*["']philosophy["']/g,        description: "ConversationType.PHILOSOPHY",       enum: "ConversationType" },
  { pattern: /conversationType:\s*["']runtime_analysis["']/g,  description: "ConversationType.RUNTIME_ANALYSIS", enum: "ConversationType" },
  { pattern: /conversationType:\s*["']orchestration["']/g,     description: "ConversationType.ORCHESTRATION",    enum: "ConversationType" },
  { pattern: /conversationType:\s*["']ux["']/g,                description: "ConversationType.UX",               enum: "ConversationType" },
  { pattern: /conversationType:\s*["']continuity["']/g,        description: "ConversationType.CONTINUITY",       enum: "ConversationType" },
  { pattern: /conversationType:\s*["']governance["']/g,        description: "ConversationType.GOVERNANCE",       enum: "ConversationType" },
  { pattern: /conversationType:\s*["']infrastructure["']/g,    description: "ConversationType.INFRASTRUCTURE",   enum: "ConversationType" },

  // ImportanceLevel values
  { pattern: /importanceLevel:\s*["']low["']/g,        description: "ImportanceLevel.LOW",        enum: "ImportanceLevel" },
  { pattern: /importanceLevel:\s*["']medium["']/g,     description: "ImportanceLevel.MEDIUM",     enum: "ImportanceLevel" },
  { pattern: /importanceLevel:\s*["']high["']/g,       description: "ImportanceLevel.HIGH",       enum: "ImportanceLevel" },
  { pattern: /importanceLevel:\s*["']foundational["']/g, description: "ImportanceLevel.FOUNDATIONAL", enum: "ImportanceLevel" },

  // Pipeline name strings (must use PIPELINE_NAME_MVP / PIPELINE_NAME_SAAS)
  { pattern: /["']MVP-SEPTEMBER-2026["']/g, description: "PIPELINE_NAME_MVP", enum: "registries" },
  { pattern: /["']FULL-SAAS-ROADMAP["']/g,  description: "PIPELINE_NAME_SAAS", enum: "registries" },
]

// Duplicate local type patterns — must NOT appear in non-governance files
const DUPLICATE_TYPE_PATTERNS: Array<{
  pattern: RegExp
  description: string
}> = [
  {
    pattern: /type\s+\w+\s*=\s*["']ARCHITECTURE["']\s*\|/g,
    description: "Local ImplementationType duplicate (use ExecutionType from @sg/governance)",
  },
  {
    pattern: /type\s+\w+\s*=\s*["']NOT_READY["']\s*\|/g,
    description: "Local ReadinessState duplicate (use ReadinessState from @sg/governance)",
  },
  {
    pattern: /type\s+AuditSeverity\s*=\s*["']ERROR["']/g,
    description: "Local AuditSeverity duplicate (import from @sg/governance types)",
  },
  {
    pattern: /interface\s+AuditFinding\s*\{/g,
    description: "Local AuditFinding duplicate (import from @sg/governance types)",
  },
  {
    pattern: /conversationType\s*:\s*\n?\s*\|\s*['"]implementation['"]/g,
    description: "Local conversationType string union (use ConversationType from @sg/governance)",
  },
  {
    pattern: /importanceLevel:\s*['"]low['"]\s*\|/g,
    description: "Local importanceLevel string union (use ImportanceLevel from @sg/governance)",
  },
]

// ── Scanner ───────────────────────────────────────────────────────────────────

interface Violation {
  file: string
  line: number
  match: string
  description: string
  severity: "ERROR" | "WARN"
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = []
  const fileName = path.basename(filePath)

  if (ALLOWLISTED_FILES.has(filePath)) return violations
  if (ADAPTER_FILES.has(fileName)) return violations

  const content = fs.readFileSync(filePath, "utf-8")
  const lines = content.split("\n")

  // Check for raw governance string patterns
  for (const { pattern, description } of GOVERNANCE_STRING_PATTERNS) {
    pattern.lastIndex = 0 // reset regex state
    const fullMatch = content.match(pattern)
    if (fullMatch) {
      // Find line numbers
      for (let i = 0; i < lines.length; i++) {
        const linePattern = new RegExp(pattern.source)
        if (linePattern.test(lines[i])) {
          // Skip if line is a comment
          const trimmed = lines[i].trim()
          if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue
          violations.push({
            file: path.relative(SG_DEV_ROOT, filePath),
            line: i + 1,
            match: lines[i].trim().substring(0, 80),
            description,
            severity: "ERROR",
          })
        }
      }
    }
  }

  // Check for duplicate type declarations
  for (const { pattern, description } of DUPLICATE_TYPE_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(content)) {
      violations.push({
        file: path.relative(SG_DEV_ROOT, filePath),
        line: 0,
        match: "(pattern match)",
        description,
        severity: "ERROR",
      })
    }
  }

  return violations
}

function collectTypeScriptFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(path.join(dir, entry.name)))
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      files.push(path.join(dir, entry.name))
    }
  }
  return files
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log("╔══════════════════════════════════════════════════════════╗")
  console.log("║  GOV-1-2 ENUM PURITY CHECK — SpendGuru 2.0              ║")
  console.log("╚══════════════════════════════════════════════════════════╝")
  console.log(`  Timestamp: ${new Date().toISOString()}\n`)

  const allViolations: Violation[] = []
  let filesScanned = 0

  for (const scanDir of SCAN_DIRS) {
    const files = collectTypeScriptFiles(scanDir)
    for (const file of files) {
      const violations = scanFile(file)
      allViolations.push(...violations)
      filesScanned++
    }
  }

  console.log(`  Files scanned: ${filesScanned}`)

  if (allViolations.length === 0) {
    console.log("\n  ✅  ENUM PURITY: PASS — No governance string violations found")
    console.log("  All governance values use canonical enum references.")
    console.log("\n  Governance state: VALID\n")
    process.exit(0)
  } else {
    console.log(`\n  ❌  ENUM PURITY: FAIL — ${allViolations.length} violation(s) found\n`)
    for (const v of allViolations) {
      const loc = v.line > 0 ? `:${v.line}` : ""
      console.log(`  [ERROR] ${v.file}${loc}`)
      console.log(`          → ${v.description}`)
      if (v.line > 0) {
        console.log(`          match: ${v.match}`)
      }
      console.log()
    }
    console.log("  Fix: Replace raw strings with canonical enum imports from @sg/governance")
    console.log("  Ref: apps/pmos/.context/enum-purity-audit.md\n")
    console.log("  Governance state: FAIL\n")
    process.exit(1)
  }
}

main()
