import { createBenchmarkRequester } from './benchmark-request'

/** Original Finder request surface; credentials and logical keys share one implementation. */
export function createDiscoveryRequester(options: Parameters<typeof createBenchmarkRequester>[0]) {
  return createBenchmarkRequester(options, 'discovery')
}
