import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const repoRoot = path.resolve(process.cwd(), '..', '..')

test('render deployment authority documents the canonical provider-managed forecast python runtime', async () => {
  const renderBlueprint = await readFile(path.join(repoRoot, 'render.yaml'), 'utf8')

  assert.match(renderBlueprint, /spendguru-stage is the canonical main SG Runtime deployment/)
  assert.match(renderBlueprint, /repo: profitia\/SG-dev/)
  assert.match(renderBlueprint, /branch: main/)
  assert.match(renderBlueprint, /rootDir: \./)
  assert.match(renderBlueprint, /buildCommand: bash \.\/scripts\/build-sg-runtime-private-service\.sh/)
  assert.match(renderBlueprint, /startCommand: cd apps\/sg-runtime && npm run start/)
  assert.match(renderBlueprint, /BENCHMARK-FINDER-CATEGORY-BUILDER is an intentional second deployment/)

  const pythonVersion = await readFile(path.join(repoRoot, '.python-version'), 'utf8')
  assert.equal(pythonVersion.trim(), '3.13.0')

  const buildScriptPath = path.join(repoRoot, 'scripts', 'build-sg-runtime-private-service.sh')
  assert.equal(existsSync(buildScriptPath), true)

  const buildScript = await readFile(buildScriptPath, 'utf8')
  assert.match(buildScript, /python3?/)
  assert.match(buildScript, /-m venv "\$VENV_DIR"/)
  assert.match(buildScript, /"\$PYTHON_RUNTIME_BIN" -m pip install -r "\$LAB_ROOT\/requirements\.txt"/)
  assert.match(buildScript, /cd "\$APP_DIR"\s+npm install --include=dev\s+npm run build/)

  assert.equal(existsSync(path.join(repoRoot, 'tooling', 'Benchmark-Forecasting', 'requirements.txt')), true)
})
