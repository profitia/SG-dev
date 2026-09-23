#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const roles = Object.freeze({
  dashboard: 'SG2_STAGING_DASHBOARD_DEPLOY_HOOK',
  runtime: 'SG2_STAGING_RUNTIME_DEPLOY_HOOK',
  mainRuntime: 'SG2_STAGING_MAIN_RUNTIME_DEPLOY_HOOK',
  currentWorker: 'SG2_STAGING_CURRENT_WORKER_DEPLOY_HOOK',
  verificationWorker: 'SG2_STAGING_VERIFICATION_WORKER_DEPLOY_HOOK',
})

export function releaseTarget(registry, role, sha, repository, ref) {
  if (registry.projectKey !== 'SG2' || registry.environments?.staging?.status !== 'ACTIVE') {
    throw new Error('SG2 Staging registry is not active')
  }
  if (repository !== 'profitia/SG-dev' || ref !== 'refs/heads/main') {
    throw new Error('Release must be dispatched from profitia/SG-dev main')
  }
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Release requires a full lowercase Git SHA')
  if (!Object.hasOwn(roles, role)) throw new Error('Unknown Staging service role')
  const stage = registry.environments.staging
  if (stage.github?.environmentName !== 'sg2-staging' || stage.github?.environmentId !== 22494585971) {
    throw new Error('GitHub Staging environment identity drift')
  }
  if (stage.render?.workspaceId !== 'tea-d7lps8rbc2fs73cn80dg'
    || stage.render?.projectId !== 'prj-d98a52eq1p3s73835qh0'
    || stage.render?.environmentId !== 'evm-d98a52eq1p3s73835qi0') {
    throw new Error('Render Staging identity drift')
  }
  const service = stage.render.services?.[role]
  if (!service?.serviceId || service.autoDeploy !== false) throw new Error('Staging service is unregistered or auto-deploy is enabled')
  return { serviceId: service.serviceId, secretName: roles[role] }
}

export function exactCommitHook(hook, serviceId, sha) {
  if (!hook) throw new Error('Staging-scoped service deploy hook is missing')
  let url
  try { url = new URL(hook) } catch { throw new Error('Invalid Staging deploy hook URL') }
  if (url.protocol !== 'https:' || url.hostname !== 'api.render.com'
    || url.pathname !== `/deploy/${serviceId}` || !url.searchParams.get('key')
    || url.username || url.password || url.searchParams.has('ref') || url.searchParams.has('imgURL')) {
    throw new Error('Deploy hook does not match the registered Render service')
  }
  url.searchParams.set('ref', sha)
  return url
}

export async function triggerExactRelease({ registry, role, sha, repository, ref, hook, isMainAncestor, request = fetch }) {
  const target = releaseTarget(registry, role, sha, repository, ref)
  if (!isMainAncestor(sha)) throw new Error('Requested SHA is not an ancestor of current origin/main')
  const url = exactCommitHook(hook, target.serviceId, sha)
  const response = await request(url, { method: 'POST', redirect: 'error' })
  if (response.status !== 200) {
    throw new Error(`Render did not confirm an immediately started deploy (HTTP ${response.status}); inspect provider state before retrying`)
  }
  const payload = await response.json()
  const deployId = payload?.id ?? payload?.deploy?.id
  if (typeof deployId !== 'string' || !/^dep-[a-z0-9]+$/.test(deployId)) {
    throw new Error('Render started a deploy but returned no verifiable deploy ID; inspect provider state before retrying')
  }
  return { role, serviceId: target.serviceId, sha, deployId, status: 'TRIGGERED_VERIFY_REQUIRED' }
}

async function main() {
  const [role, sha] = process.argv.slice(2)
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'Canon/registries/sg2-environment-topology-v1.json'), 'utf8'))
  const target = releaseTarget(registry, role, sha, process.env.GITHUB_REPOSITORY, process.env.GITHUB_REF)
  const isMainAncestor = (candidate) => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', candidate, 'origin/main'], { cwd: root, stdio: 'ignore' })
      return true
    } catch { return false }
  }
  const result = await triggerExactRelease({
    registry, role, sha, repository: process.env.GITHUB_REPOSITORY, ref: process.env.GITHUB_REF,
    hook: process.env[target.secretName], isMainAncestor,
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `\nStaging deploy triggered for \`${result.serviceId}\` at \`${sha}\`: \`${result.deployId}\`. Render live SHA, health and UI verification remain required before release acceptance.\n`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`SG2 Staging release stopped: ${error.message}`)
    process.exitCode = 1
  })
}
