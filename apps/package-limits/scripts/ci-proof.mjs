import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { limitsDigest, identityDigest } from "./install.mjs";
const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../..",
  ),
  sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  base = process.env.VALIDATION_BASE_SHA;
if (
  process.env.CI !== "true" ||
  sha !== process.env.CANDIDATE_HEAD_SHA ||
  !/^[a-f0-9]{40}$/.test(base ?? "")
)
  throw Error("EXACT_CI_SOURCE_REQUIRED");
for (const key of [
  "CLERK_SECRET_KEY",
  "LIMITS_DATABASE_URL",
  "IDENTITY_DATABASE_URL",
  "NPM_TOKEN",
  "NODE_AUTH_TOKEN",
])
  if (process.env[key]) throw Error("LIVE_CREDENTIAL_IN_SOURCE_CI");
const files = execFileSync(
  "git",
  ["diff", "--name-only", "--no-renames", base, sha],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
const allowed = (n) =>
  n.startsWith("apps/package-limits/") ||
  n === ".github/workflows/package-limits-ci.yml" ||
  n ===
    "Canon/evidence/2026-10-30-package-limits-dashboard-development-release.md";
if (
  !files.length ||
  files.some((n) => !allowed(n) || n.includes("..") || n.includes("\\"))
)
  throw Error("SOURCE_SCOPE_EXPANSION");
execFileSync(
  process.execPath,
  [
    "scripts/governance/governance-preflight.mjs",
    "--ci",
    "--mode",
    "development",
    "--project",
    "ARCHITECTURE",
    "--target-environment",
    "development",
    "--task-id",
    "CI-PACKAGE-LIMITS-SOURCE",
    "--title",
    "Package Limits source CI",
    "--scope",
    "implementation",
    "--workspace",
    "GitHub Actions",
    "--execution-environment",
    "ci",
    "--host-conversation-unavailable",
    ...files.flatMap((n) => ["--target", n]),
  ],
  { cwd: root, stdio: "inherit" },
);
fs.writeFileSync(
  new URL("../dist/source-proof.json", import.meta.url),
  JSON.stringify(
    {
      schemaVersion: "1.0",
      project: "ARCHITECTURE",
      environment: "development",
      candidateSha: sha,
      baseSha: base,
      files,
      limitsDigest,
      identityDigest,
      validationScope: "SOURCE_AND_ISOLATED_SYNTHETIC_POSTGRES_ONLY",
      cloudCredentialsUsed: false,
      liveRuntimeVerified: false,
      meteringConnected: false,
    },
    null,
    2,
  ),
);
console.log(
  "Exact source and governance proof recorded. No live verification claimed.",
);
