const RESULT_CLASSIFICATIONS = new Set([
  'HEALTHY', 'DEGRADED', 'SATURATED', 'STRUCTURAL_DUPLICATION', 'RESOURCE_EXHAUSTED',
  'PROVIDER_BOUND', 'DATABASE_BOUND', 'COMPUTE_BOUND', 'UNKNOWN_BOUND', 'NOT_CLASSIFIED',
])

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

function sumEventMetric(events, eventName, metricName) {
  return events
    .filter(({ event }) => event === eventName)
    .reduce((sum, { metrics }) => sum + Number(metrics?.[metricName] ?? 0), 0)
}

function countOutcomes(requests) {
  const outcomes = {}
  for (const request of requests) {
    let outcome = 'UNKNOWN_ERROR'
    if (!request.ok) {
      outcome = /timeout/i.test(request.error ?? '') ? 'TIMEOUT' : 'APPLICATION_ERROR'
    } else if (request.httpStatus && request.httpStatus >= 400) {
      outcome = 'HTTP_ERROR'
    } else if (request.value?.status === 'FAILED' || request.value?.data?.status === 'FAILED') {
      outcome = 'APPLICATION_ERROR'
    } else if (request.value?.status === 'NOT_AVAILABLE' || request.value?.data?.status === 'NOT_AVAILABLE') {
      outcome = 'LAWFUL_NOT_AVAILABLE'
    } else if (request.value?.cacheStatus === 'hit' || request.value?.data?.cacheStatus === 'hit') {
      outcome = 'SUCCESS_READY_HIT'
    } else {
      outcome = 'SUCCESS_COMPUTED'
    }
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1
  }
  return outcomes
}

function requestSucceeded(request) {
  const payloadStatus = request.value?.status ?? request.value?.data?.status
  return request.ok && (!request.httpStatus || request.httpStatus < 400) && payloadStatus !== 'FAILED'
}

function duplicateCount(events, eventName) {
  const counts = new Map()
  for (const event of events.filter((candidate) => candidate.event === eventName)) {
    counts.set(event.logicalArtifactKey, (counts.get(event.logicalArtifactKey) ?? 0) + 1)
  }
  return Array.from(counts.values()).reduce((sum, count) => sum + Math.max(count - 1, 0), 0)
}

function round(value) {
  return value === null ? null : Number(value.toFixed(6))
}

export function buildPhase21bResult({
  metadata,
  requests,
  events = [],
  databaseDelta = null,
  memoryAfterCooldownMb = null,
  correctnessPassed,
  notes = [],
}) {
  const latencies = requests
    .map(({ startedMonotonicMs, endedMonotonicMs }) => endedMonotonicMs - startedMonotonicMs)
    .sort((left, right) => left - right)
  const starts = requests.map(({ startedMonotonicMs }) => startedMonotonicMs)
  const ends = requests.map(({ endedMonotonicMs }) => endedMonotonicMs)
  const wallClockMs = requests.length > 0 ? Math.max(...ends) - Math.min(...starts) : 0
  const successCount = requests.filter(requestSucceeded).length
  const failureCount = requests.length - successCount
  const currentComputeCount = events.filter(({ event }) => event === 'current_compute_start').length
  const verificationComputeCount = events.filter(({ event }) => event === 'verification_compute_start').length
  const duplicateComputeCount = duplicateCount(events, metadata.scenarioId === 'P08'
    ? 'verification_compute_start'
    : 'current_compute_start')
  const logicalComputeCount = Math.max((metadata.scenarioId === 'P08' ? verificationComputeCount : currentComputeCount) - duplicateComputeCount, 1)
  const resourceEvents = events.filter(({ event }) => event === 'resource_sample')
  const rssValues = resourceEvents.map(({ metrics }) => Number(metrics?.rssBytes ?? 0))
  const peakMemoryMb = rssValues.length > 0 ? Math.max(...rssValues) / 1024 / 1024 : null
  const memoryBeforeMb = rssValues.length > 0 ? rssValues[0] / 1024 / 1024 : null
  const providerCallCount = sumEventMetric(events, 'provider_call', 'count')
  const preparedHitCount = events.filter(({ event, metrics }) => event === 'prepared_read' && metrics?.hit === true).length
  const preparedMissCount = events.filter(({ event, metrics }) => event === 'prepared_read' && metrics?.hit === false).length
  const artifactWrites = sumEventMetric(events, 'persistence', 'artifactWrites')
  const distinctWrittenKeys = new Set(events
    .filter(({ event, metrics }) => event === 'persistence' && Number(metrics?.artifactWrites ?? 0) > 0)
    .map(({ logicalArtifactKey }) => logicalArtifactKey)).size
  const duplicateArtifactWriteCount = Math.max(artifactWrites - distinctWrittenKeys, 0)
  const cpuSeconds = resourceEvents.length > 0
    ? (sumEventMetric(events, 'resource_sample', 'cpuUserMicros')
      + sumEventMetric(events, 'resource_sample', 'cpuSystemMicros')) / 1_000_000
    : null
  const classification = metadata.classification
    ?? (duplicateComputeCount > 0 ? 'STRUCTURAL_DUPLICATION' : failureCount > 0 ? 'DEGRADED' : 'HEALTHY')

  return {
    contractVersion: 1,
    stressRunId: metadata.stressRunId,
    scenarioId: metadata.scenarioId,
    environmentId: metadata.environmentId,
    sourceRevision: metadata.sourceRevision,
    startedAt: metadata.startedAt,
    endedAt: metadata.endedAt,
    concurrency: metadata.concurrency,
    keyDistribution: metadata.keyDistribution,
    loadShape: metadata.loadShape,
    releaseSpreadMs: round(metadata.releaseSpreadMs),
    benchmark: metadata.benchmark,
    datasetFingerprint: metadata.datasetFingerprint,
    modelId: metadata.modelId,
    requestsStarted: requests.length,
    requestsCompleted: requests.length,
    successCount,
    failureCount,
    errorRate: requests.length > 0 ? failureCount / requests.length : 0,
    functionalOutcomes: countOutcomes(requests),
    latencyMinMs: round(latencies[0] ?? null),
    latencyP50Ms: round(percentile(latencies, 0.5)),
    latencyP90Ms: round(percentile(latencies, 0.9)),
    latencyP95Ms: round(percentile(latencies, 0.95)),
    latencyP99Ms: round(percentile(latencies, 0.99)),
    latencyMaxMs: round(latencies.at(-1) ?? null),
    latencyMeanMs: round(latencies.length > 0 ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : null),
    throughputRps: wallClockMs > 0 ? round(requests.length / (wallClockMs / 1000)) : null,
    successfulThroughputRps: wallClockMs > 0 ? round(successCount / (wallClockMs / 1000)) : null,
    cpuSeconds: round(cpuSeconds),
    peakMemoryMb: round(peakMemoryMb),
    memoryDeltaAfterCooldownMb: memoryAfterCooldownMb === null || memoryBeforeMb === null
      ? null
      : round(memoryAfterCooldownMb - memoryBeforeMb),
    dbQueryCount: databaseDelta?.queryCount ?? null,
    dbWriteCount: databaseDelta?.writeCount ?? null,
    providerCallCount,
    forecastComputeCount: currentComputeCount,
    verificationComputeCount,
    computeOwnerCount: currentComputeCount + verificationComputeCount > 0 ? logicalComputeCount : 0,
    duplicateComputeCount,
    duplicateComputeRatio: duplicateComputeCount / logicalComputeCount,
    duplicateArtifactWriteCount,
    preparedHitCount,
    preparedMissCount,
    wallClockSeconds: round(wallClockMs / 1000),
    classification,
    bottleneckAttribution: metadata.bottleneckAttribution ?? [],
    firstRunAfterStateSetup: metadata.firstRunAfterStateSetup,
    repetitionNumber: metadata.repetitionNumber,
    excluded: metadata.excluded ?? false,
    exclusionReason: metadata.exclusionReason ?? 'NOT_EXCLUDED',
    correctnessPassed,
    notes,
  }
}

export function validatePhase21bResultShape(result, schema) {
  const resultKeys = Object.keys(result).sort()
  const schemaKeys = Object.keys(schema.properties).sort()
  const missing = schema.required.filter((key) => !Object.hasOwn(result, key))
  const additional = resultKeys.filter((key) => !Object.hasOwn(schema.properties, key))
  const errors = []
  if (missing.length > 0) errors.push(`missing: ${missing.join(', ')}`)
  if (additional.length > 0) errors.push(`additional: ${additional.join(', ')}`)
  if (JSON.stringify(resultKeys) !== JSON.stringify(schemaKeys)) errors.push('result keys do not exactly match schema properties')
  if (result.contractVersion !== 1) errors.push('contractVersion must be 1')
  if (!/^P(0[1-9]|1[01])$/.test(result.scenarioId)) errors.push('invalid scenarioId')
  if (![10, 100, 1000].includes(result.concurrency)) errors.push('invalid concurrency')
  if (!RESULT_CLASSIFICATIONS.has(result.classification)) errors.push('invalid classification')
  if (result.releaseSpreadMs < 0 || result.errorRate < 0 || result.errorRate > 1) errors.push('invalid numeric bounds')
  return errors
}