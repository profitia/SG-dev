#!/usr/bin/env tsx

import {
  collectEstateAuditSnapshot,
  collectRuntimeVerificationSnapshot,
  formatHealthStatus,
} from '../src/lib/pmos/operations'

const runtimeSnapshot = collectRuntimeVerificationSnapshot()
const estateSnapshot = collectEstateAuditSnapshot()
console.log(formatHealthStatus(runtimeSnapshot, estateSnapshot))

if (runtimeSnapshot.status === 'FAIL') {
  process.exit(1)
}