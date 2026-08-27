#!/usr/bin/env tsx

import {
  collectRuntimeVerificationSnapshot,
  formatRuntimeVerificationStatus,
  shouldExitOnStrictVerification,
} from '../src/lib/pmos/operations'

const snapshot = collectRuntimeVerificationSnapshot()
console.log('[pmos:verify] DEPRECATED - use npm run pmos:verify-runtime')
console.log(formatRuntimeVerificationStatus(snapshot, 'verify'))

if (shouldExitOnStrictVerification(snapshot.status)) {
  process.exit(1)
}