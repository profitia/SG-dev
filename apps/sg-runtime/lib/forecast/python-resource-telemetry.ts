import path from 'node:path'

import {
  isForecastWorkerResourceMeasurementActive,
  recordForecastPythonResourceMeasurement,
  type ForecastPythonResourceMeasurement,
} from '@/lib/forecast/worker-resource-telemetry'

const RESOURCE_MARKER = 'SG_FORECAST_RESOURCE_TELEMETRY='

export function buildForecastPythonInvocation(scriptPath: string, args: readonly string[]) {
  if (!isForecastWorkerResourceMeasurementActive()) {
    return { args: [scriptPath, ...args], instrumented: false }
  }
  const wrapper = path.resolve(process.cwd(), '..', '..', 'tooling', 'Benchmark-Forecasting', 'scripts', 'run_with_resource_telemetry.py')
  return { args: [wrapper, '--', scriptPath, ...args], instrumented: true }
}

export function consumeForecastPythonResourceTelemetry(stderr: string) {
  const cleanLines: string[] = []
  for (const line of stderr.split(/\r?\n/)) {
    if (!line.startsWith(RESOURCE_MARKER)) {
      if (line) cleanLines.push(line)
      continue
    }
    try {
      const measurement = JSON.parse(line.slice(RESOURCE_MARKER.length)) as ForecastPythonResourceMeasurement
      recordForecastPythonResourceMeasurement(measurement)
    } catch {
      cleanLines.push(line)
    }
  }
  return cleanLines.join('\n')
}
