import { spawn } from 'node:child_process'
import { access, lstat, readdir, symlink } from 'node:fs/promises'
import path from 'node:path'

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function findSiblingWorkspaceWithSgRuntime(workspaceRoot) {
  const currentWorkspaceName = path.basename(path.resolve(process.cwd(), '..', '..'))
  const entries = await readdir(workspaceRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === currentWorkspaceName) {
      continue
    }

    const candidateNodeModules = path.join(workspaceRoot, entry.name, 'apps', 'sg-runtime', 'node_modules')
    const candidateLoader = path.join(candidateNodeModules, 'tsx', 'dist', 'loader.mjs')
    if (await exists(candidateLoader)) {
      return { workspaceName: entry.name, candidateNodeModules, candidateLoader }
    }
  }

  return null
}

async function findSiblingWorkspaceWithForecastingPython(workspaceRoot) {
  const currentWorkspaceName = path.basename(path.resolve(process.cwd(), '..', '..'))
  const entries = await readdir(workspaceRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === currentWorkspaceName) {
      continue
    }

    const candidatePython = path.join(
      workspaceRoot,
      entry.name,
      'tooling',
      'Benchmark-Forecasting',
      '.venv',
      'bin',
      'python',
    )
    if (await exists(candidatePython)) {
      return candidatePython
    }
  }

  return null
}

async function ensurePrismaEngine(workspaceRoot, candidateWorkspaceName) {
  const localEngine = path.join(process.cwd(), 'generated', 'market-data-client', 'libquery_engine-darwin-arm64.dylib.node')
  if (await exists(localEngine)) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = localEngine
    return
  }

  const candidateEngine = path.join(
    workspaceRoot,
    candidateWorkspaceName,
    'apps',
    'sg-runtime',
    'generated',
    'market-data-client',
    'libquery_engine-darwin-arm64.dylib.node',
  )
  if (await exists(candidateEngine)) {
    await symlink(candidateEngine, localEngine)
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = candidateEngine
  }
}

async function ensureForecastingPython(workspaceRoot, candidateWorkspaceName) {
  const localPython = path.join(process.cwd(), '..', '..', 'tooling', 'Benchmark-Forecasting', '.venv', 'bin', 'python')
  if (process.env.FORECASTING_PYTHON_BIN && process.env.FORECASTING_PYTHON_BIN.trim()) {
    return
  }
  if (await exists(localPython)) {
    process.env.FORECASTING_PYTHON_BIN = localPython
    return
  }

  const preferredCandidatePython = path.join(
    workspaceRoot,
    candidateWorkspaceName,
    'tooling',
    'Benchmark-Forecasting',
    '.venv',
    'bin',
    'python',
  )
  if (await exists(preferredCandidatePython)) {
    process.env.FORECASTING_PYTHON_BIN = preferredCandidatePython
    return
  }

  const fallbackPython = await findSiblingWorkspaceWithForecastingPython(workspaceRoot)
  if (fallbackPython) {
    process.env.FORECASTING_PYTHON_BIN = fallbackPython
    return
  }

  process.env.FORECASTING_PYTHON_BIN = preferredCandidatePython
}

async function resolveWorkspaceTsxLoader() {
  const workspaceRoot = path.resolve(process.cwd(), '..', '..', '..')
  const localLoader = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'loader.mjs')
  const sibling = await findSiblingWorkspaceWithSgRuntime(workspaceRoot)
  if (await exists(localLoader)) {
    if (sibling) {
      await ensurePrismaEngine(workspaceRoot, sibling.workspaceName)
      await ensureForecastingPython(workspaceRoot, sibling.workspaceName)
    }
    return localLoader
  }

  const localNodeModules = path.join(process.cwd(), 'node_modules')
  if (sibling) {
    if (!await exists(localNodeModules)) {
      await symlink(sibling.candidateNodeModules, localNodeModules, 'dir')
    } else {
      const stats = await lstat(localNodeModules)
      if (!stats.isDirectory() && !stats.isSymbolicLink()) {
        throw new Error(`Existing node_modules at ${localNodeModules} is not usable for the Stage 8 evidence runner.`)
      }
    }
    await ensurePrismaEngine(workspaceRoot, sibling.workspaceName)
    await ensureForecastingPython(workspaceRoot, sibling.workspaceName)
    return sibling.candidateLoader
  }

  throw new Error('Unable to resolve a tsx loader for sg-runtime in the current workspace.')
}

const scriptPath = process.argv[2]
if (!scriptPath) {
  throw new Error('Usage: node scripts/run-with-tsx-loader.mjs <script> [...args]')
}

const scriptArgs = process.argv.slice(3)
const loaderPath = await resolveWorkspaceTsxLoader()

const child = spawn(process.execPath, ['--import', loaderPath, path.resolve(process.cwd(), scriptPath), ...scriptArgs], {
  stdio: 'inherit',
  env: process.env,
})

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject)
  child.once('exit', (code, signal) => {
    if (signal) {
      reject(new Error(`Stage 8 evidence runner exited via signal ${signal}.`))
      return
    }
    resolve(code ?? 0)
  })
})

process.exitCode = Number(exitCode)