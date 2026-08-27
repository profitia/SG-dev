#!/usr/bin/env tsx

import { collectPmosStatusSnapshot, formatOperatorStatus } from '../src/lib/pmos/operations'

const snapshot = collectPmosStatusSnapshot()
console.log(formatOperatorStatus(snapshot))