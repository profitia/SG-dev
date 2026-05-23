#!/usr/bin/env bash
# PMOS Starter — Install Script
# Version: 0.1.0
# Usage: bash scripts/install-pmos.sh [project-root]
#
# Copies PMOS into a target project and initializes it.
# Run from the pmos-starter directory.
#
# Requirements: Node 20+, npm 10+

set -euo pipefail

STARTER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${1:-$PWD}"
FAILED=0
ENV_LOCAL_TMP=""
CONFIG_TMP=""

# ── Trap: print diagnostics on unexpected failure ────────────────────────────
cleanup_on_error() {
  echo ""
  echo "ERROR: Install failed at the step above."
  echo ""
  echo "Partial install state may exist at: $TARGET_DIR/apps/pmos"
  echo ""
  echo "To retry cleanly:"
  echo "  rm -rf \"$TARGET_DIR/apps/pmos\""
  echo "  bash \"$STARTER_DIR/scripts/install-pmos.sh\" \"$TARGET_DIR\""
  echo ""
  echo "If apps/pmos already existed before this install, do not delete it"
  echo "without backing up your .env.local and pmos.config.ts first."
  exit 1
}
trap cleanup_on_error ERR

# ── Pre-flight: Node version ─────────────────────────────────────────────────
echo ""
echo "PMOS Starter Install v0.1.0"
echo "==========================="
echo "Starter:  $STARTER_DIR"
echo "Target:   $TARGET_DIR"
echo ""
echo "[pre-flight] Checking prerequisites..."

NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
if [ "$NODE_VERSION" -lt 20 ]; then
  echo ""
  echo "ERROR: Node.js 20+ is required. Found: $(node --version 2>/dev/null || echo 'not found')"
  echo "Install Node 20: https://nodejs.org or use nvm: nvm install 20"
  exit 1
fi
echo "  Node: $(node --version) ✓"

NPM_VERSION=$(npm --version 2>/dev/null | cut -d. -f1 || echo "0")
if [ "$NPM_VERSION" -lt 10 ]; then
  echo ""
  echo "ERROR: npm 10+ is required. Found: $(npm --version 2>/dev/null || echo 'not found')"
  echo "Upgrade: npm install -g npm@latest"
  exit 1
fi
echo "  npm:  $(npm --version) ✓"

if [ ! -d "$STARTER_DIR/apps/pmos" ]; then
  echo ""
  echo "ERROR: PMOS source not found at $STARTER_DIR/apps/pmos"
  echo "Run this script from the pmos-starter root directory."
  exit 1
fi
echo "  Source: $STARTER_DIR/apps/pmos ✓"

if [ ! -d "$TARGET_DIR" ]; then
  echo ""
  echo "ERROR: Target directory does not exist: $TARGET_DIR"
  echo "Create it first or pass the correct path as argument."
  exit 1
fi
echo "  Target: $TARGET_DIR ✓"

if [ -d "$TARGET_DIR/apps/pmos" ]; then
  echo ""
  echo "WARNING: apps/pmos already exists in target directory."
  echo "  Existing .env.local and pmos.config.ts will be preserved."
  echo "  Other files will be overwritten."
  echo ""
fi

echo ""

# ── Step 1: Copy PMOS app ────────────────────────────────────────────────────
echo "[1/7] Copying apps/pmos..."
mkdir -p "$TARGET_DIR/apps/pmos"
# Preserve .env.local if it exists
if [ -f "$TARGET_DIR/apps/pmos/.env.local" ]; then
  ENV_LOCAL_TMP=$(mktemp)
  cp "$TARGET_DIR/apps/pmos/.env.local" "$ENV_LOCAL_TMP"
fi
# Preserve pmos.config.ts if it has been customized (projectName != 'My Project')
if [ -f "$TARGET_DIR/apps/pmos/pmos.config.ts" ]; then
  if ! grep -q "projectName: 'My Project'" "$TARGET_DIR/apps/pmos/pmos.config.ts" 2>/dev/null; then
    CONFIG_TMP=$(mktemp)
    cp "$TARGET_DIR/apps/pmos/pmos.config.ts" "$CONFIG_TMP"
    echo "      Backed up customized pmos.config.ts"
  fi
fi
# Copy contents (not directory itself) so re-installs stay idempotent
cp -r "$STARTER_DIR/apps/pmos/." "$TARGET_DIR/apps/pmos/"
# Restore preserved files
if [ -n "$ENV_LOCAL_TMP" ] && [ -f "$ENV_LOCAL_TMP" ]; then
  cp "$ENV_LOCAL_TMP" "$TARGET_DIR/apps/pmos/.env.local"
  rm -f "$ENV_LOCAL_TMP"
fi
if [ -n "$CONFIG_TMP" ] && [ -f "$CONFIG_TMP" ]; then
  cp "$CONFIG_TMP" "$TARGET_DIR/apps/pmos/pmos.config.ts"
  rm -f "$CONFIG_TMP"
  echo "      Restored customized pmos.config.ts"
fi
echo "      Done."

# ── Step 2: Copy scripts ─────────────────────────────────────────────────────
echo "[2/7] Copying scripts..."
mkdir -p "$TARGET_DIR/scripts"
cp "$STARTER_DIR/scripts/build-pmos-context.ts" "$TARGET_DIR/scripts/build-pmos-context.ts"
echo "      Done."

# ── Step 3: Copy docs ────────────────────────────────────────────────────────
echo "[3/7] Copying PMOS documentation..."
mkdir -p "$TARGET_DIR/docs"
cp "$STARTER_DIR/PMOS-ARCHITECTURE.md"             "$TARGET_DIR/docs/PMOS-ARCHITECTURE.md"
cp "$STARTER_DIR/VSC-BOOTSTRAP-PROMPT.md"          "$TARGET_DIR/docs/VSC-BOOTSTRAP-PROMPT.md"
cp "$STARTER_DIR/APPLICATION-BOOTSTRAP-PROMPT.md"  "$TARGET_DIR/docs/APPLICATION-BOOTSTRAP-PROMPT.md"
cp "$STARTER_DIR/PMOS-PHILOSOPHY.md"               "$TARGET_DIR/docs/PMOS-PHILOSOPHY.md"
echo "      Done."

# ── Step 4: Set up .env.local ────────────────────────────────────────────────
echo "[4/7] Setting up .env.local..."
if [ ! -f "$TARGET_DIR/apps/pmos/.env.local" ]; then
  cp "$TARGET_DIR/apps/pmos/.env.example" "$TARGET_DIR/apps/pmos/.env.local"
  echo "      Created apps/pmos/.env.local"
  echo "      ACTION REQUIRED: fill in DATABASE_URL and DIRECT_URL"
  echo "      (Neon free tier: https://neon.tech)"
else
  echo "      apps/pmos/.env.local already exists — preserved."
fi

# ── Step 5: Install dependencies ─────────────────────────────────────────────
echo "[5/7] Installing npm dependencies..."
(cd "$TARGET_DIR/apps/pmos" && npm install --silent)
# Verify Prisma CLI is available
if ! (cd "$TARGET_DIR/apps/pmos" && npx prisma --version >/dev/null 2>&1); then
  echo "      WARNING: prisma CLI not responsive after npm install."
  echo "      Try: cd apps/pmos && npx prisma --version"
  FAILED=1
else
  echo "      Dependencies: ok"
  echo "      Prisma CLI: ok"
fi
echo "      Done."

# ── Step 6: Create .pmos/ directory structure ─────────────────────────────────
echo "[6/7] Creating .pmos/ governance structure..."
mkdir -p "$TARGET_DIR/apps/pmos/.pmos/conversations"
mkdir -p "$TARGET_DIR/apps/pmos/.pmos/governance/decisions"
mkdir -p "$TARGET_DIR/apps/pmos/.pmos/governance/findings"
mkdir -p "$TARGET_DIR/apps/pmos/.pmos/governance/principles"
mkdir -p "$TARGET_DIR/apps/pmos/.pmos/governance/warnings"
mkdir -p "$TARGET_DIR/apps/pmos/.context"
# Ensure empty dirs are tracked by git
touch "$TARGET_DIR/apps/pmos/.pmos/conversations/.gitkeep"
touch "$TARGET_DIR/apps/pmos/.pmos/governance/decisions/.gitkeep"
touch "$TARGET_DIR/apps/pmos/.pmos/governance/findings/.gitkeep"
touch "$TARGET_DIR/apps/pmos/.pmos/governance/principles/.gitkeep"
touch "$TARGET_DIR/apps/pmos/.pmos/governance/warnings/.gitkeep"
touch "$TARGET_DIR/apps/pmos/.context/.gitkeep"
echo "      Done."

# ── Step 7: Port conflict check ───────────────────────────────────────────────
# Soft check only — does not block install
if command -v lsof >/dev/null 2>&1; then
  if lsof -ti:3200 >/dev/null 2>&1; then
    echo ""
    echo "  [WARN] Port 3200 is currently in use by another process."
    echo "  If this conflicts, edit apps/pmos/package.json:"
    echo "    \"dev\": \"next dev --port 3201\""
    echo "  And update NEXT_PUBLIC_APP_URL in .env.local accordingly."
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [ "$FAILED" -eq 1 ]; then
  echo "Install completed with warnings. Review the messages above."
else
  echo "Install completed successfully."
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " NEXT STEPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo " 1. Configure environment:"
echo "    Edit apps/pmos/.env.local"
echo "    → DATABASE_URL (pooled) and DIRECT_URL (direct) from Neon dashboard"
echo "    → https://neon.tech (free tier)"
echo ""
echo " 2. Configure project identity:"
echo "    Edit apps/pmos/pmos.config.ts"
echo "    → Set projectName, projectType, domains, architectureStyle"
echo ""
echo " 3. Initialize database:"
echo "    cd apps/pmos"
echo "    npm run db:generate"
echo "    npm run db:push"
echo "    npm run db:seed"
echo ""
echo " 4. Start PMOS:"
echo "    cd apps/pmos && npm run dev"
echo "    → http://localhost:3200"
echo ""
echo " 5. Bootstrap your project with AI:"
echo ""
echo "    RECOMMENDED — Full bootstrap (all project types):"
echo "    Open docs/APPLICATION-BOOTSTRAP-PROMPT.md"
echo "    Edit the PROJECT INPUT BLOCK (top section, ~20 lines)"
echo "    Copy full file → paste into Claude or Copilot Agent"
echo ""
echo "    ALTERNATIVE — Reactive analysis (existing projects only):"
echo "    Open docs/VSC-BOOTSTRAP-PROMPT.md"
echo "    Copy full file → paste into GitHub Copilot Agent"
echo ""
echo " 6. Build AI context after bootstrap:"
echo "    npx tsx scripts/build-pmos-context.ts"
echo ""
echo " 7. Validate install:"
echo "    bash scripts/validate-pmos-install.sh \"$TARGET_DIR\""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
