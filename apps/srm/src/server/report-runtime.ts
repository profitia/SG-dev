import {withSrmPeerXRay} from "./peer-xray";
import { getSrmReportRuntime, type SrmReportRuntime } from './private-runtime'
import { createOperationReportDataHandler } from './operation-report-data'
import { reportDataHandler } from './report-data'

/** Only the host injects dependencies. The existing deployed entry and real
 * database tests use this same dispatcher; HTTP input cannot select a provider. */
export function createRuntimeSrmReportHandler(
  resolveRuntime: () => SrmReportRuntime = getSrmReportRuntime,
  legacy = reportDataHandler(),
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  return withSrmPeerXRay(async (request: Request): Promise<Response> => {
    try {
      const runtime = resolveRuntime()
      if (runtime.provider === 'legacy_demo') return await legacy(request)
      if (runtime.provider !== 'clerk') throw new TypeError('Unsupported server runtime')
      const run = () => createOperationReportDataHandler(runtime.executor, environment, {
        defaultOrganisationId: runtime.defaultOrganisationId,
      })(request)
      const response=runtime.reportAdmission?await runtime.reportAdmission.run(request,run):await run()
      response.headers.set('Cache-Control', 'private, no-store')
      response.headers.set('Vary', 'Cookie, Authorization')
      return response
    } catch {
      return Response.json({ error: 'Operation unavailable' }, { status: 503,
        headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie, Authorization' } })
    }
  },environment)
}
