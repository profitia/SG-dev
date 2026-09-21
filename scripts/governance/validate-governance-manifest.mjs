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
    if (ACTIVE_STATUSES.has(document.status) && (!Array.isArray(document.appliesTo) || document.appliesTo.length === 0)) {
      errors.push(`Active document ${document.id} requires a non-empty appliesTo array.`)
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

  if (!manifest.projectRegistry || !fs.existsSync(path.join(repositoryRoot, manifest.projectRegistry))) {
    errors.push(`Missing project registry: ${manifest.projectRegistry ?? '<unset>'}`)
  } else {
    try {
      const projectRegistry = JSON.parse(fs.readFileSync(path.join(repositoryRoot, manifest.projectRegistry), 'utf8'))
      const projectKeys = new Set()
      const neonProjectIds = new Set()
      if (projectRegistry.schemaVersion !== '1.0' || projectRegistry.defaultPolicy !== 'FAIL_CLOSED') {
        errors.push('Project registry must use schemaVersion 1.0 and defaultPolicy FAIL_CLOSED.')
      }
      for (const project of projectRegistry.projects ?? []) {
        if (!project.projectKey || projectKeys.has(project.projectKey)) errors.push(`Invalid or duplicate projectKey: ${project.projectKey ?? '<missing>'}`)
        projectKeys.add(project.projectKey)
        if (!project.displayName || !project.repository?.slug || !project.repository?.defaultBranch) errors.push(`Project ${project.projectKey ?? '<unknown>'} has incomplete repository identity.`)
        if (project.repository?.routingRegistry !== null && typeof project.repository?.routingRegistry !== 'string') {
          errors.push(`Project ${project.projectKey ?? '<unknown>'} has invalid routingRegistry.`)
        }
        if (project.repository?.routingBootstrapPaths !== undefined) {
          if (!Array.isArray(project.repository.routingBootstrapPaths) || project.repository.routingBootstrapPaths.length === 0) {
            errors.push(`Project ${project.projectKey ?? '<unknown>'} routingBootstrapPaths must be a non-empty array.`)
          } else if (project.repository.routingBootstrapPaths.some((entry) => typeof entry !== 'string' || entry.length === 0 || entry.startsWith('/') || entry.includes('..') || (/[*]/.test(entry) && !entry.endsWith('/**')))) {
            errors.push(`Project ${project.projectKey ?? '<unknown>'} has invalid routingBootstrapPaths.`)
          }
        }
        if (!project.database?.projectId || !project.database?.databaseName || !Array.isArray(project.database?.allowedHosts) || project.database.allowedHosts.length === 0) {
          errors.push(`Project ${project.projectKey ?? '<unknown>'} has incomplete database identity.`)
        }
        if (neonProjectIds.has(project.database?.projectId)) errors.push(`Neon project ${project.database?.projectId} is assigned to more than one project profile.`)
        neonProjectIds.add(project.database?.projectId)
        if (!['required', 'disabled'].includes(project.continuity?.pmos) || !['required', 'disabled'].includes(project.continuity?.memoros) || !['required', 'disabled'].includes(project.continuity?.phr)) {
          errors.push(`Project ${project.projectKey ?? '<unknown>'} has invalid continuity policy.`)
        }
        const adapter = documents.find((document) => document.path === project.adapter)
        if (!adapter || adapter.status !== 'ACTIVE_ADAPTER') errors.push(`Project ${project.projectKey ?? '<unknown>'} adapter is not active in the governance manifest: ${project.adapter ?? '<missing>'}`)
      }
    } catch (error) {
      errors.push(`Invalid project registry JSON: ${error.message}`)
    }
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
