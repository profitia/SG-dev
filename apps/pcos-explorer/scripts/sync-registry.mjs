#!/usr/bin/env node
// PCOS Explorer — Domain Auto-Discovery Script
//
// Scans src/domains/*/definition.ts and automatically regenerates:
//   src/registry/index.ts  — domain import side-effects
//
// Usage:
//   node scripts/sync-registry.mjs              # dry run (print diff)
//   node scripts/sync-registry.mjs --write      # write changes
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS APPROACH — NOT FULL RUNTIME AUTO-DISCOVERY:
//
// True filesystem-based auto-discovery at runtime is NOT possible in Next.js
// App Router + Turbopack for these architectural reasons:
//
//   1. Turbopack builds a static module graph at compile time. Dynamic requires
//      with variable paths (require(`@/domains/${name}/definition`)) cannot be
//      statically analyzed and will fail to resolve.
//
//   2. fs.readdirSync at module-eval time works in Node.js server context but
//      the read happens AFTER the module graph is frozen — so new files are
//      not automatically bundled.
//
//   3. webpack.require.context (the Webpack pattern for this) is not supported
//      by Turbopack and is not available in App Router server components.
//
//   4. Using Next.js `dynamicImport()` for each domain would require knowing
//      domain names at page-render time, creating a chicken-and-egg problem.
//
// DECISION: Use codegen (this script) to auto-generate the static import list.
// Result: Adding a new domain requires ONLY:
//   1. Create src/domains/[name]/definition.ts
//   2. Create src/domains/[name]/query.ts
//   3. Create src/renderers/[name]-renderer.tsx
//   4. Create src/app/[name]/page.tsx
//   5. Run: node scripts/sync-registry.mjs --write
//   6. Add renderer registration in renderer-engine.ts (1 line)
//
// Steps 5-6 are the MINIMUM manual footprint — no sidebar/layout/router edits.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DOMAINS_DIR = join(ROOT, "src", "domains");
const REGISTRY_INDEX = join(ROOT, "src", "registry", "index.ts");

const WRITE = process.argv.includes("--write");
const VERBOSE = process.argv.includes("--verbose");

// ── Discover domains ──────────────────────────────────────────────────────────

function discoverDomains() {
  const entries = readdirSync(DOMAINS_DIR, { withFileTypes: true });
  const domains = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => {
      try {
        readFileSync(join(DOMAINS_DIR, name, "definition.ts"));
        return true;
      } catch {
        return false;
      }
    })
    .sort();
  return domains;
}

// ── Generate import block ─────────────────────────────────────────────────────

function generateImportBlock(domains) {
  return domains
    .map((name) => `import "@/domains/${name}/definition";`)
    .join("\n");
}

// ── Read + patch index.ts ─────────────────────────────────────────────────────

const SECTION_START = "// ── Domain + Artifact registrations ─────────────────────────────────────────";
const SECTION_END = "\n// ── Renderer registrations";

function patchRegistryIndex(domains) {
  const current = readFileSync(REGISTRY_INDEX, "utf-8");
  const startIdx = current.indexOf(SECTION_START);
  const endIdx = current.indexOf(SECTION_END);

  if (startIdx === -1 || endIdx === -1) {
    console.error(
      "[sync-registry] ERROR: Cannot find domain registration section in registry/index.ts"
    );
    console.error(
      "[sync-registry] Expected marker:", SECTION_START
    );
    process.exit(1);
  }

  const newBlock = [
    SECTION_START,
    generateImportBlock(domains),
  ].join("\n");

  const patched =
    current.slice(0, startIdx) +
    newBlock +
    current.slice(endIdx);

  return { current, patched, changed: current !== patched };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const domains = discoverDomains();

console.log(`[sync-registry] Discovered ${domains.length} domain(s):`);
for (const d of domains) console.log(`  • ${d}`);

const { current, patched, changed } = patchRegistryIndex(domains);

if (!changed) {
  console.log("[sync-registry] registry/index.ts is already up-to-date.");
  process.exit(0);
}

if (VERBOSE) {
  console.log("\n[sync-registry] Proposed changes:");
  // Show diff-style output
  const currentLines = current.split("\n");
  const patchedLines = patched.split("\n");
  const maxLen = Math.max(currentLines.length, patchedLines.length);
  for (let i = 0; i < maxLen; i++) {
    const c = currentLines[i];
    const p = patchedLines[i];
    if (c !== p) {
      if (c !== undefined) console.log(`  - ${c}`);
      if (p !== undefined) console.log(`  + ${p}`);
    }
  }
}

if (WRITE) {
  writeFileSync(REGISTRY_INDEX, patched, "utf-8");
  console.log(
    "[sync-registry] ✓ registry/index.ts updated with",
    domains.length,
    "domain imports."
  );
} else {
  console.log(
    "[sync-registry] registry/index.ts needs update. Run with --write to apply."
  );
}
