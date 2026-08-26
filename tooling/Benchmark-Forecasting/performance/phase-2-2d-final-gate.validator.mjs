import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const validatorPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'phase-2-2d-finalize-selection.mjs')
const result = spawnSync(process.execPath, [validatorPath, '--validate'], {
  cwd: path.resolve(path.dirname(validatorPath), '..', '..', '..'),
  encoding: 'utf8',
})

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.status !== 0) process.exitCode = result.status ?? 1