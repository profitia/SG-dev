import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const repoRoot = path.resolve(process.cwd(), '..', '..')

test('render blueprint provisions the canonical forecast python runtime from the repository root', async () => {
  const renderBlueprint = await readFile(path.join(repoRoot, 'render.yaml'), 'utf8')

  for (const serviceName of ['spendguru-production', 'spendguru-staging']) {
    assert.match(
      renderBlueprint,
      new RegExp(
        `name: ${serviceName}[\\s\\S]*?runtime: node[\\s\\S]*?rootDir: \\.[\\s\\S]*?buildCommand: bash \\./scripts/build-sg-runtime-private-service\\.sh[\\s\\S]*?startCommand: cd apps/sg-runtime && npm run start`,
      ),
    )
  }

  const pythonVersion = await readFile(path.join(repoRoot, '.python-version'), 'utf8')
  assert.equal(pythonVersion.trim(), '3.13.0')

  const buildScriptPath = path.join(repoRoot, 'scripts', 'build-sg-runtime-private-service.sh')
  assert.equal(existsSync(buildScriptPath), true)

  const buildScript = await readFile(buildScriptPath, 'utf8')
  assert.match(buildScript, /python3?/)
  assert.match(buildScript, /-m venv "\$VENV_DIR"/)
  assert.match(buildScript, /"\$PYTHON_RUNTIME_BIN" -m pip install -r "\$LAB_ROOT\/requirements\.txt"/)
  assert.match(buildScript, /cd "\$APP_DIR"\s+npm install\s+npm run build/)

  assert.equal(existsSync(path.join(repoRoot, 'tooling', 'Benchmark-Forecasting', 'requirements.txt')), true)
})