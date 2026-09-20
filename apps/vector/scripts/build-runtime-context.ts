#!/usr/bin/env tsx

import { spawnSync } from 'child_process'
import path from 'path'

const PMOS_DIR = path.resolve(__dirname, '../../pmos')

function main(): void {
  console.warn('[vector:projection] runtime:build-context is deprecated as an authority surface.')
  console.warn('[vector:projection] Delegating to PMOS canonical runtime authority: cd apps/pmos && npm run pmos:context')

  const result = spawnSync('npm', ['run', 'pmos:context'], {
    cwd: PMOS_DIR,
    stdio: 'inherit',
    env: process.env,
  })

  if (result.error) {
    throw result.error
  }

  if (typeof result.status === 'number') {
    process.exit(result.status)
  }

  process.exit(1)
}

main()