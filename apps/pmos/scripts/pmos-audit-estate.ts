#!/usr/bin/env tsx

import {
  collectEstateAuditSnapshot,
  formatEstateAuditStatus,
  shouldExitOnStrictVerification,
} from '../src/lib/pmos/operations'

const snapshot = collectEstateAuditSnapshot()
console.log(formatEstateAuditStatus(snapshot))

if (shouldExitOnStrictVerification(snapshot.status)) {
  process.exit(1)
}
