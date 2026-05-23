#!/usr/bin/env bash
# PMOS — Post-Install Validator
# Version: 0.1.0
# Usage: bash scripts/validate-pmos-install.sh [project-root]
#
# Validates that PMOS is correctly installed and configured.
# Run after install-pmos.sh and database setup.
# Does NOT require PMOS to be running for most checks.
# API checks require PMOS to be running on localhost:{PMOS_PORT}.

set -euo pipefail

TARGET_DIR="${1:-$PWD}"
PMOS_DIR="$TARGET_DIR/apps/pmos"
PMOS_PORT="${PMOS_PORT:-3200}"

PASS=0
FAIL=0
WARN=0

pass()  { echo "  [PASS] $1"; PASS=$((PASS+1)); }
fail()  { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }
warn()  { echo "  [WARN] $1"; WARN=$((WARN+1)); }
header(){ echo ""; echo "── $1 ──────────────────────────────────────────────────"; }

echo ""
echo "PMOS Install Validator v0.1.0"
echo "=============================="
echo "Target: $TARGET_DIR"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
header "REQUIRED FILES"

check_file() {
  local path="$1"
  local label="$2"
  if [ -f "$path" ]; then
    pass "$label"
  else
    fail "$label — not found: $path"
  fi
}

check_file "$PMOS_DIR/package.json"                                  "apps/pmos/package.json"
check_file "$PMOS_DIR/pmos.config.ts"                                "apps/pmos/pmos.config.ts"
check_file "$PMOS_DIR/tsconfig.json"                                 "apps/pmos/tsconfig.json"
check_file "$PMOS_DIR/.gitignore"                                    "apps/pmos/.gitignore"
check_file "$PMOS_DIR/.env.example"                                  "apps/pmos/.env.example"
check_file "$PMOS_DIR/next.config.mjs"                               "apps/pmos/next.config.mjs"
check_file "$PMOS_DIR/tailwind.config.ts"                            "apps/pmos/tailwind.config.ts"
check_file "$PMOS_DIR/prisma/schema.prisma"                          "apps/pmos/prisma/schema.prisma"
check_file "$PMOS_DIR/prisma/seed.ts"                                "apps/pmos/prisma/seed.ts"
check_file "$PMOS_DIR/src/app/layout.tsx"                            "apps/pmos/src/app/layout.tsx"
check_file "$PMOS_DIR/src/app/page.tsx"                              "apps/pmos/src/app/page.tsx"
check_file "$TARGET_DIR/scripts/build-pmos-context.ts"               "scripts/build-pmos-context.ts"
check_file "$TARGET_DIR/docs/APPLICATION-BOOTSTRAP-PROMPT.md"        "docs/APPLICATION-BOOTSTRAP-PROMPT.md"
check_file "$TARGET_DIR/docs/VSC-BOOTSTRAP-PROMPT.md"                "docs/VSC-BOOTSTRAP-PROMPT.md"
check_file "$TARGET_DIR/docs/PMOS-ARCHITECTURE.md"                   "docs/PMOS-ARCHITECTURE.md"

# ─────────────────────────────────────────────────────────────────────────────
header "REQUIRED DIRECTORIES"

check_dir() {
  local path="$1"
  local label="$2"
  if [ -d "$path" ]; then
    pass "$label"
  else
    fail "$label — not found: $path"
  fi
}

check_dir "$PMOS_DIR/.pmos"                                "apps/pmos/.pmos/"
check_dir "$PMOS_DIR/.pmos/conversations"                  "apps/pmos/.pmos/conversations/"
check_dir "$PMOS_DIR/.pmos/governance"                     "apps/pmos/.pmos/governance/"
check_dir "$PMOS_DIR/.pmos/governance/decisions"           "apps/pmos/.pmos/governance/decisions/"
check_dir "$PMOS_DIR/.pmos/governance/principles"          "apps/pmos/.pmos/governance/principles/"
check_dir "$PMOS_DIR/.pmos/governance/warnings"            "apps/pmos/.pmos/governance/warnings/"
check_dir "$PMOS_DIR/.context"                             "apps/pmos/.context/"
check_dir "$PMOS_DIR/src/app/api"                          "apps/pmos/src/app/api/"
check_dir "$PMOS_DIR/node_modules"                         "apps/pmos/node_modules/ (dependencies installed)"

# ─────────────────────────────────────────────────────────────────────────────
header "ENVIRONMENT"

if [ -f "$PMOS_DIR/.env.local" ]; then
  pass ".env.local exists"

  if grep -q 'DATABASE_URL="postgresql://user:password' "$PMOS_DIR/.env.local" 2>/dev/null; then
    fail ".env.local — DATABASE_URL still has placeholder value. Edit with your Neon credentials."
  elif grep -q 'DATABASE_URL=' "$PMOS_DIR/.env.local" 2>/dev/null; then
    pass ".env.local — DATABASE_URL is set (non-placeholder)"
  else
    fail ".env.local — DATABASE_URL is missing"
  fi

  if grep -q 'DIRECT_URL="postgresql://user:password' "$PMOS_DIR/.env.local" 2>/dev/null; then
    fail ".env.local — DIRECT_URL still has placeholder value. Edit with your Neon credentials."
  elif grep -q 'DIRECT_URL=' "$PMOS_DIR/.env.local" 2>/dev/null; then
    pass ".env.local — DIRECT_URL is set (non-placeholder)"
  else
    warn ".env.local — DIRECT_URL is missing (required for prisma migrate)"
  fi

  if grep -q 'NEXT_PUBLIC_APP_URL=' "$PMOS_DIR/.env.local" 2>/dev/null; then
    pass ".env.local — NEXT_PUBLIC_APP_URL is set"
  else
    warn ".env.local — NEXT_PUBLIC_APP_URL is missing (defaulting to http://localhost:3200)"
  fi
else
  fail ".env.local does not exist — run: cp apps/pmos/.env.example apps/pmos/.env.local"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "PMOS CONFIG"

if [ -f "$PMOS_DIR/pmos.config.ts" ]; then
  if grep -q "projectName: 'My Project'" "$PMOS_DIR/pmos.config.ts" 2>/dev/null; then
    warn "pmos.config.ts — projectName is still 'My Project' (default). Edit before bootstrap."
  else
    pass "pmos.config.ts — projectName is customized"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
header "CONTAMINATION SCAN"

CONTAM_FOUND=0

scan_contamination() {
  local pattern="$1"
  local label="$2"
  if grep -r "$pattern" "$PMOS_DIR/src/" "$PMOS_DIR/prisma/" "$PMOS_DIR/pmos.config.ts" \
       --include="*.ts" --include="*.tsx" --include="*.js" -l 2>/dev/null | grep -q .; then
    fail "Contamination: $label found in PMOS source files"
    CONTAM_FOUND=1
  fi
}

scan_contamination "sentry" "Sentry references"
scan_contamination "posthog" "PostHog references"
scan_contamination "leaxaro\|nutricoach" "Leaxaro/NutriCoach project references"
scan_contamination "profitia\|spendguru" "Profitia/SpendGuru project references"
scan_contamination "webd\.pl\|tomuscin" "WEBD.pl hosting references"

if [ "$CONTAM_FOUND" -eq 0 ]; then
  pass "No contamination found in PMOS source files"
fi

# Check .env.example for contamination
if grep -qi "sentry\|posthog" "$PMOS_DIR/.env.example" 2>/dev/null; then
  fail ".env.example — Sentry/PostHog references found (contamination)"
else
  pass ".env.example — no Sentry/PostHog references"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "LAYOUT INTEGRATION"

if [ -f "$PMOS_DIR/src/app/layout.tsx" ]; then
  if grep -q "ThemeProvider" "$PMOS_DIR/src/app/layout.tsx" 2>/dev/null; then
    pass "layout.tsx — ThemeProvider integrated"
  else
    fail "layout.tsx — ThemeProvider missing"
  fi

  if grep -q "RuntimeFocusBar" "$PMOS_DIR/src/app/layout.tsx" 2>/dev/null; then
    pass "layout.tsx — RuntimeFocusBar integrated"
  else
    fail "layout.tsx — RuntimeFocusBar missing"
  fi

  if grep -q "force-dynamic" "$PMOS_DIR/src/app/layout.tsx" 2>/dev/null; then
    pass "layout.tsx — export const dynamic = 'force-dynamic'"
  else
    fail "layout.tsx — missing 'force-dynamic' export"
  fi

  if grep -q "suppressHydrationWarning" "$PMOS_DIR/src/app/layout.tsx" 2>/dev/null; then
    pass "layout.tsx — suppressHydrationWarning on <html>"
  else
    warn "layout.tsx — suppressHydrationWarning not found (theme flicker risk)"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
header "PRISMA"

# Check the custom Prisma output path (schema.prisma: output = "../src/generated/prisma")
# node_modules/.prisma contains engine binaries; src/generated/prisma contains the JS/TS client.
if [ -f "$PMOS_DIR/src/generated/prisma/index.js" ]; then
  pass "Prisma client generated (src/generated/prisma/index.js exists)"
else
  if (cd "$PMOS_DIR" && npx prisma generate 2>/dev/null); then
    pass "Prisma client generated successfully"
  else
    warn "Prisma client not generated — DATABASE_URL may not be set yet."
    warn "After configuring .env.local, run: cd apps/pmos && npm run db:generate"
  fi
fi

if [ -f "$PMOS_DIR/prisma/schema.prisma" ]; then
  MODEL_COUNT=$(grep -c "^model " "$PMOS_DIR/prisma/schema.prisma" 2>/dev/null || echo "0")
  if [ "$MODEL_COUNT" -ge 7 ]; then
    pass "schema.prisma — $MODEL_COUNT models found"
  else
    fail "schema.prisma — only $MODEL_COUNT models found (expected ≥7)"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
header "TYPECHECK"

if (cd "$PMOS_DIR" && npx tsc --noEmit --skipLibCheck 2>/dev/null); then
  pass "TypeScript typecheck: 0 errors"
else
  fail "TypeScript typecheck: errors found — run: cd apps/pmos && npm run typecheck"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "BUILD"

echo "  (Running next build — this may take 30-60 seconds...)"
if (cd "$PMOS_DIR" && npm run build >/dev/null 2>&1); then
  pass "next build: success"
else
  fail "next build: failed — run: cd apps/pmos && npm run build"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "API ROUTES"

PMOS_RUNNING=0
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PMOS_PORT/api/context/active" 2>/dev/null | grep -q "200\|404"; then
  PMOS_RUNNING=1
fi

if [ "$PMOS_RUNNING" -eq 1 ]; then
  check_route() {
    local route="$1"
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PMOS_PORT$route" 2>/dev/null || echo "000")
    if [ "$code" = "200" ]; then
      pass "GET $route → 200"
    else
      fail "GET $route → $code (expected 200)"
    fi
  }

  check_route "/api/context/active"
  check_route "/api/roadmap"
  check_route "/api/principles"
  check_route "/api/warnings"
  check_route "/api/decisions"
  check_route "/api/logs"
  check_route "/api/prompts"
  check_route "/api/timeline"
  check_route "/api/search?q=test"
  check_route "/api/conversations"
else
  warn "PMOS is not running — API route checks skipped."
  warn "Start PMOS with: cd apps/pmos && npm run dev"
  warn "Then re-run this validator to check API routes."
fi

# ─────────────────────────────────────────────────────────────────────────────
header "CONTEXT FILE"

if [ -f "$PMOS_DIR/.context/runtime-context.md" ]; then
  CONTEXT_SIZE=$(wc -c < "$PMOS_DIR/.context/runtime-context.md" 2>/dev/null || echo "0")
  if [ "$CONTEXT_SIZE" -gt 100 ]; then
    pass ".context/runtime-context.md exists ($CONTEXT_SIZE bytes)"
    if grep -q "My Project" "$PMOS_DIR/.context/runtime-context.md" 2>/dev/null; then
      warn "runtime-context.md contains 'My Project' — update pmos.config.ts and rebuild"
    fi
  else
    warn ".context/runtime-context.md exists but is nearly empty — run: npm run context:build"
  fi
else
  warn ".context/runtime-context.md not found — run: npm run context:build after starting PMOS"
fi

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " VALIDATION SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  PASS:  $PASS"
echo "  WARN:  $WARN"
echo "  FAIL:  $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  RESULT: FAIL"
  echo ""
  echo "  Fix all [FAIL] items above before using PMOS."
  echo "  [WARN] items are non-blocking but should be addressed."
  echo ""
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo "  RESULT: PASS (with warnings)"
  echo ""
  echo "  PMOS install is valid. Review [WARN] items above."
  echo ""
  exit 0
else
  echo "  RESULT: PASS"
  echo ""
  echo "  PMOS install is complete and valid."
  echo ""
  exit 0
fi
