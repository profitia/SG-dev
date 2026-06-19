#!/usr/bin/env tsx

import fs from 'node:fs'
import path from 'node:path'

import {
  CANONICAL_PMOS_AUTHORITIES,
  assertCanonicalPmosAuthorities,
} from '../src/lib/pmos/authority-registry'

const REPO_ROOT = path.resolve(__dirname, '../../..')
const APPS_ROOT = path.join(REPO_ROOT, 'apps')

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])
const IGNORED_DIR_NAMES = new Set([
  '.git',
  '.next',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.pnpm-store',
  '.yarn',
])
const IGNORED_DIR_PATHS = ['src/generated']

const ALLOWED_BROWSER_PERSISTENCE_FILES = new Set([
  path.resolve(APPS_ROOT, 'pmos/src/components/layout/ThemeProvider.tsx'),
  path.resolve(APPS_ROOT, 'pmos/src/app/layout.tsx'),
  path.resolve(APPS_ROOT, 'pmos/scripts/enforce-pmos-authority.ts'),
])

const ALLOWED_CONVERSATION_WRITE_FILES = new Set([
  path.resolve(APPS_ROOT, 'pmos/scripts/pmos-save.ts'),
  path.resolve(APPS_ROOT, 'pmos/scripts/seed-org1-conversation.ts'),
  path.resolve(APPS_ROOT, 'pmos/scripts/backfill-pmos-conversations.ts'),
  path.resolve(APPS_ROOT, 'pmos/scripts/backfill-flight-record-json.ts'),
])

const ALLOWED_LEGACY_CONVERSATION_HELPER_FILES = new Set([
  path.resolve(APPS_ROOT, 'pmos/src/lib/pmos/conversation-persistence.ts'),
])

const RUNTIME_AUTHORITY_FILE_PATTERNS = [
  'runtime-context.md',
  'runtime-context.integrity.json',
  'pending-artifact.json',
  'active-closeout.json',
]

const DISK_WRITE_PATTERN = /writeFileSync\s*\(|\.writeFile\s*\(|writeFile\s*\(|appendFileSync\s*\(|copyFileSync\s*\(/m
const BROWSER_PERSISTENCE_PATTERN = /\b(localStorage|sessionStorage|indexedDB)\b/m
const CONVERSATION_WRITE_PATTERN = /conversationArtifact\.(create|createMany(?:AndReturn)?|update|updateMany|upsert)\s*\(/m
const LEGACY_CONVERSATION_IMPORT_PATTERN = /from\s+['"][^'"]*conversation-persistence(?:\.ts)?['"]|require\(\s*['"][^'"]*conversation-persistence(?:\.ts)?['"]\s*\)/m

function relative(filePath: string): string {
  return path.relative(REPO_ROOT, filePath)
}

function shouldIgnoreDirectory(relativeDir: string): boolean {
  if (!relativeDir) return false

  const normalizedRelativeDir = relativeDir.split(path.sep).join('/')
  const pathSegments = normalizedRelativeDir.split('/')

  if (pathSegments.some((segment) => IGNORED_DIR_NAMES.has(segment))) {
    return true
  }

  return IGNORED_DIR_PATHS.some(
    (ignoredPath) => normalizedRelativeDir === ignoredPath || normalizedRelativeDir.includes(`/${ignoredPath}/`),
  )
}

function collectCodeFiles(rootDir: string): string[] {
  const files: string[] = []

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name)
      const relativePath = path.relative(rootDir, absolutePath)

      if (entry.isDirectory()) {
        if (shouldIgnoreDirectory(relativePath)) {
          continue
        }
        walk(absolutePath)
        continue
      }

      if (!CODE_EXTENSIONS.has(path.extname(entry.name))) {
        continue
      }

      files.push(absolutePath)
    }
  }

  walk(rootDir)
  return files
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8')
}

function requireCondition(condition: boolean, message: string, violations: string[]): void {
  if (!condition) {
    violations.push(message)
  }
}

function checkAuthorityRegistry(violations: string[]): void {
  assertCanonicalPmosAuthorities()

  for (const [domain, owner] of Object.entries(CANONICAL_PMOS_AUTHORITIES)) {
    requireCondition(owner === 'PMOS', `Authority registry mismatch for ${domain}: ${owner}`, violations)
  }
}

function checkBrowserPersistence(files: string[], violations: string[]): void {
  for (const filePath of files) {
    const content = readFile(filePath)
    if (!BROWSER_PERSISTENCE_PATTERN.test(content)) {
      continue
    }
    if (ALLOWED_BROWSER_PERSISTENCE_FILES.has(filePath)) {
      continue
    }
    violations.push(`Forbidden browser persistence API outside PMOS authority: ${relative(filePath)}`)
  }
}

function checkDirectConversationWrites(files: string[], violations: string[]): void {
  for (const filePath of files) {
    const content = readFile(filePath)
    if (!CONVERSATION_WRITE_PATTERN.test(content)) {
      continue
    }
    if (ALLOWED_CONVERSATION_WRITE_FILES.has(filePath)) {
      continue
    }
    violations.push(`Direct ConversationArtifact mutation outside canonical allowlist: ${relative(filePath)}`)
  }
}

function checkLegacyConversationPersistence(files: string[], violations: string[]): void {
  const helperFile = path.resolve(APPS_ROOT, 'pmos/src/lib/pmos/conversation-persistence.ts')
  const helperContent = readFile(helperFile)

  requireCondition(
    helperContent.includes('assertNonCanonicalPmosWriteAllowed'),
    `Legacy conversation persistence helper is not fail-closed: ${relative(helperFile)}`,
    violations,
  )

  for (const filePath of files) {
    if (ALLOWED_LEGACY_CONVERSATION_HELPER_FILES.has(filePath)) {
      continue
    }

    const content = readFile(filePath)
    if (!LEGACY_CONVERSATION_IMPORT_PATTERN.test(content)) {
      continue
    }

    violations.push(`Legacy PMOS conversation persistence surface is still referenced in code: ${relative(filePath)}`)
  }
}

function checkNonPmosRuntimeAuthorityWrites(files: string[], violations: string[]): void {
  for (const filePath of files) {
    if (filePath.includes(`${path.sep}apps${path.sep}pmos${path.sep}`)) {
      continue
    }

    const content = readFile(filePath)
    const referencesRuntimeAuthorityFile = RUNTIME_AUTHORITY_FILE_PATTERNS.some((pattern) => content.includes(pattern))
    if (!referencesRuntimeAuthorityFile) {
      continue
    }

    if (!DISK_WRITE_PATTERN.test(content)) {
      continue
    }

    violations.push(`Non-PMOS file references runtime-authority artifact in a write-capable surface: ${relative(filePath)}`)
  }
}

function checkNonPmosDiskWriters(files: string[], violations: string[]): void {
  for (const filePath of files) {
    if (filePath.includes(`${path.sep}apps${path.sep}pmos${path.sep}`)) {
      continue
    }

    if (!filePath.includes(`${path.sep}src${path.sep}`) && !filePath.includes(`${path.sep}app${path.sep}`)) {
      continue
    }

    const content = readFile(filePath)
    if (!DISK_WRITE_PATTERN.test(content)) {
      continue
    }

    const hasDiscoveryGuard = content.includes('assertDiscoveryOutputWriteAllowed')
    if (hasDiscoveryGuard) {
      continue
    }

    violations.push(`Non-PMOS source disk writer is not guarded by PMOS authority enforcement: ${relative(filePath)}`)
  }
}

function main(): void {
  const appFiles = collectCodeFiles(APPS_ROOT)
  const pmosFiles = appFiles.filter((filePath) => filePath.includes(`${path.sep}apps${path.sep}pmos${path.sep}`))
  const violations: string[] = []

  checkAuthorityRegistry(violations)
  checkBrowserPersistence(appFiles, violations)
  checkDirectConversationWrites(pmosFiles, violations)
  checkLegacyConversationPersistence(pmosFiles, violations)
  checkNonPmosRuntimeAuthorityWrites(appFiles, violations)
  checkNonPmosDiskWriters(appFiles, violations)

  if (violations.length > 0) {
    console.error('[pmos-authority-enforcement] FAIL')
    for (const violation of violations) {
      console.error(` - ${violation}`)
    }
    process.exit(1)
  }

  console.log('[pmos-authority-enforcement] PASS')
  console.log(` - authority registry domains locked to PMOS: ${Object.keys(CANONICAL_PMOS_AUTHORITIES).join(', ')}`)
  console.log(' - no forbidden browser persistence outside PMOS')
  console.log(' - no direct ConversationArtifact mutation outside canonical allowlist')
  console.log(' - legacy PMOS conversation persistence is fail-closed and unused in code')
  console.log(' - no non-PMOS runtime-authority writes detected')
  console.log(' - non-PMOS source disk writers are guarded')
}

main()