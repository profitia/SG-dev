#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export function assessSg2ReleaseReadiness(record, environment, sha) {
  const blockers = []
  if (!['development', 'staging'].includes(environment)) blockers.push('ENVIRONMENT_RESERVED_OR_UNKNOWN')
  if (record?.projectKey !== 'SG2' || record?.sourceAuthority !== 'profitia/SG-dev') blockers.push('SOURCE_AUTHORITY_MISMATCH')
  if (!/^[a-f0-9]{40}$/.test(sha || '') || record?.approvedSourceSha !== sha) blockers.push('SOURCE_NOT_APPROVED')
  const required = ['liveBindings', 'applicationSchemas', 'legacyBridgeClosure', 'productCi', 'environmentConfiguration', 'multiServiceManifest', 'forecastProducerAuthority']
  for (const key of required) if (record?.gates?.[key]?.status !== 'PASS') blockers.push(`GATE_${key}_NOT_PASS`)
  if (!record?.evidenceExpiresAt || Date.parse(record.evidenceExpiresAt) <= Date.now()) blockers.push('EVIDENCE_STALE_OR_MISSING')
  blockers.push(...(record?.openBlockers || []))
  return { projectKey: 'SG2', environment, sourceSha: sha || null, verdict: blockers.length ? 'BLOCKED' : 'READY', blockers: [...new Set(blockers)] }
}
export function requireSg2ReleaseReady(record, environment, sha) {
  const result = assessSg2ReleaseReadiness(record, environment, sha)
  if (result.verdict !== 'READY') throw new Error(`SG2_RELEASE_NOT_READY: ${result.blockers.join(', ')}`)
  return result
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const record = JSON.parse(fs.readFileSync(path.join(root, 'Canon/registries/sg2-release-readiness-v1.json'), 'utf8'))
  const args = process.argv.slice(2)
  const result = assessSg2ReleaseReadiness(record, args[0], args[1])
  console.log(JSON.stringify(result, null, 2))
  if (!args.includes('--report') && result.verdict !== 'READY') process.exitCode = 1
}
