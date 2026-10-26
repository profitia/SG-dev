import {diagnosticRun} from './diagnostic-trace'
import type { PoolClient } from "pg";
import { OPERATION_CONTRACT, OperationDenied, isOperationDenied, type OperationExecutor } from "@profitia/platform-contracts/operation-context";
import { bindOrganizationTransaction } from "./db";
import { reportDataHandler, validateReportSelection } from "./report-data";

/** Existing business projection inside the accepted operation host. */
export function createOperationReportDataHandler(executor: OperationExecutor<PoolClient>, environment: Readonly<Record<string, string | undefined>> = {}, options: Readonly<{ defaultOrganisationId?: string }> = {}) {
  return reportDataHandler(undefined, environment, async (request, project) => {
    const respond = (status: number) => Response.json({ error: "Operation unavailable" }, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie, Authorization" } });
    if (request.method !== "POST") {
      const response = respond(405); response.headers.set("Allow", "POST"); return response;
    }
    let selection;
    try { selection = validateReportSelection(await request.clone().json()); }
    catch { return respond(400); }
    const organisations = new URL(request.url).searchParams.getAll("organisationId");
    if (organisations.length > 1 || (organisations.length === 1 && !organisations[0])) return respond(400);
    const organisationId = organisations[0] ?? options.defaultOrganisationId ?? null;
    // This receiver's private database uses UUIDs. Reject malformed context
    // before a database cast, instead of reporting its SQL error as an outage.
    if (organisationId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organisationId)) return respond(400);
    try {
      const result = await executor.execute({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version, operation: "supplier.report.project", organisationId,
        resourceId: `supplier-report:${selection.entityType}:${selection.nip}`, payload: { nip: selection.nip, entityType: selection.entityType }, request,
      }, async (context, client) => {
        await client.query("SELECT set_config('srm.organization_id',$1,true)", [context.organisationId]);
        const pool = bindOrganizationTransaction(context.organisationId!, client);
        const response = await diagnosticRun('REPORT_PROJECTION',()=>project(context.organisationId!, selection, pool, JSON.stringify([context.applicationId, context.subjectUserId ?? context.actorId])));
        if (!response.ok) throw new OperationDenied("POLICY_UNAVAILABLE");
        return response;
      });
      return result.value;
    } catch (error) {
      const reason = isOperationDenied(error) ? error.reasonCode : "POLICY_UNAVAILABLE";
      return respond(reason === "UNVERIFIED_IDENTITY" ? 401 : ["AUDIT_UNAVAILABLE", "POLICY_UNAVAILABLE"].includes(reason) ? 503 : reason === "CONTEXT_INVALID" ? 400 : 403);
    }
  });
}
