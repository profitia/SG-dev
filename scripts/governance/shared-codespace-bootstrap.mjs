#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { normalizeRepositorySlug } from './project-profile.mjs'

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const codexVersion = '0.167.0-alpha.3.2'

function run(command, args) {
  const result = spawnSync(command, args, { cwd: sourceRoot, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${command} failed; inspect the Codespace creation log.`)
  return result.stdout.trim()
}

function bootstrap(checkOnly) {
  if (process.env.CODESPACES !== 'true') throw new Error('This bootstrap is only for a new dedicated GitHub Codespace.')
  if (process.env.PMOS_PROJECT_NAME || process.env.PMOS_WORKSPACE_NAME) throw new Error('A product-bound environment must not be repurposed as the shared host.')
  if (normalizeRepositorySlug(run('git', ['remote', 'get-url', 'origin'])) !== 'profitia/sg-dev') throw new Error('Expected profitia/SG-dev origin.')
  if (!fs.realpathSync(sourceRoot).startsWith('/workspaces/')) throw new Error('Source must be in persistent /workspaces storage.')
  const stateRoot = '/workspaces/.sgdev-codex'
  const codexHome = path.join(os.homedir(), '.codex')
  let existing
  try { existing = fs.lstatSync(codexHome) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (existing && (!existing.isSymbolicLink() || fs.readlinkSync(codexHome) !== stateRoot)) {
    throw new Error('Existing Codex state must be preserved and reviewed before linking persistent storage.')
  }
  if (!checkOnly) {
    fs.mkdirSync(stateRoot, { recursive: true, mode: 0o700 })
    fs.chmodSync(stateRoot, 0o700)
    if (!fs.existsSync(codexHome)) fs.symlinkSync(stateRoot, codexHome, 'dir')
    const version = spawnSync('codex', ['--version'], { encoding: 'utf8' })
    if (version.status !== 0 || version.stdout.trim() !== `codex-cli ${codexVersion}`) run('npm', ['install', '--global', `@openai/codex@${codexVersion}`])
    fs.mkdirSync('/workspaces/sgdev-tasks', { recursive: true, mode: 0o700 })
  }
  return {
    checkOnly, sourceRoot, codexVersion, persistentCodexState: stateRoot,
    taskParent: '/workspaces/sgdev-tasks',
    profileActivated: false, productDependenciesInstalled: false,
    nextStep: 'Select a registered project for each task. Use development-workspace.mjs for isolated source, PHR and configuration. Run all normal gates before work. Keep existing product Codespaces unchanged.',
  }
}

try {
  if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('Only --check is supported.')
  console.log(JSON.stringify(bootstrap(process.argv.includes('--check')), null, 2))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
