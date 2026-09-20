#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const MANIFEST_PATH = 'Canon/registries/governance-manifest-v2.json'
const ACTIVE_STATUSES = new Set(['ACTIVE', 'ACTIVE_ADAPTER'])
const ALL_STATUSES = new Set([...ACTIVE_STATUSES, 'SUPERSEDED'])

export function validateGovernanceManifest(repositoryRoot, manifestRelativePath = MANIFEST_PATH) {
  const errors = []
  const manifestPath = path.join(repositoryRoot, manifestRelativePath)
  if (!fs.existsSync(manifestPath)) return { valid: false, errors: [`Missing manifest: ${manifestRelativePath}`], manifest: null }

  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    return { valid: false, errors: [`Invalid manifest JSON: ${error.message}`], manifest: null }
  }

  if (manifest.schemaVersion !== '2.0') errors.push('schemaVersion must equal 2.0.')
  if (!manifest.validation?.failClosed) errors.push('Manifest must declare failClosed validation.')
  if (!Array.isArray(manifest.documents) || manifest.documents.length === 0) errors.push('documents must be a non-empty array.')

  const documents = Array.isArray(manifest.documents) ? manifest.documents : []
  const byId = new Map()
  const paths = new Set()
  for (const document of documents) {
    if (!document?.id || typeof document.id !== 'string') {
      errors.push('Every document requires a string id.')
      continue
    }
    if (byId.has(document.id)) errors.push(`Duplicate document id: ${document.id}`)
    byId.set(document.id, document)
    if (!ALL_STATUSES.has(document.status)) errors.push(`Invalid status for ${document.id}: ${document.status}`)
    if (!document.version || !document.owner || !document.path) errors.push(`Document ${document.id} is missing version, owner, or path.`)
    if (paths.has(document.path)) errors.push(`Duplicate document path: ${document.path}`)
    paths.add(document.path)
    if (document.path && !fs.existsSync(path.join(repositoryRoot, document.path))) errors.push(`Missing document: ${document.path}`)
    if (ACTIVE_STATUSES.has(document.status) && (!Number.isInteger(document.loadOrder) || document.loadOrder < 0)) {
      errors.push(`Active document ${document.id} requires a non-negative integer loadOrder.`)
    }
    if (document.status === 'SUPERSEDED' && !document.supersededBy) errors.push(`Superseded document ${document.id} requires supersededBy.`)
  }

  const activeOrders = new Set()
  for (const document of documents) {
    for (const dependencyId of document.dependsOn ?? []) {
      const dependency = byId.get(dependencyId)
      if (!dependency) errors.push(`Document ${document.id} has unknown dependency ${dependencyId}.`)
      if (ACTIVE_STATUSES.has(document.status) && dependency?.status === 'SUPERSEDED') {
        errors.push(`Active document ${document.id} depends on superseded document ${dependencyId}.`)
      }
    }
    if (document.supersededBy && !byId.has(document.supersededBy)) errors.push(`Document ${document.id} has unknown successor ${document.supersededBy}.`)
    if (ACTIVE_STATUSES.has(document.status)) {
      if (activeOrders.has(document.loadOrder)) errors.push(`Duplicate active loadOrder: ${document.loadOrder}`)
      activeOrders.add(document.loadOrder)
    }
  }

  for (const requiredPath of [manifest.entrypoint, manifest.preflight]) {
    if (!requiredPath || !fs.existsSync(path.join(repositoryRoot, requiredPath))) errors.push(`Missing required governance surface: ${requiredPath ?? '<unset>'}`)
  }

  const activeDocuments = documents
    .filter((document) => ACTIVE_STATUSES.has(document.status))
    .sort((left, right) => left.loadOrder - right.loadOrder)

  return { valid: errors.length === 0, errors, manifest, activeDocuments }
}

const isDirectExecution = process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href
if (isDirectExecution) {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  const result = validateGovernanceManifest(repositoryRoot)
  console.log(JSON.stringify({
    manifest: MANIFEST_PATH,
    valid: result.valid,
    activeLoadOrder: result.activeDocuments?.map((document) => document.path) ?? [],
    errors: result.errors,
  }, null, 2))
  if (!result.valid) process.exitCode = 1
}
