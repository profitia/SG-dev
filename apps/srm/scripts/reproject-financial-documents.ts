import { withOrganization, getPool, runtimeConnectionString } from "../src/server/db";
import { productOrganizationId } from "../src/server/runtime-environment";
import { saveFinancialDocuments, FINANCIAL_DOCUMENT_MAPPING_VERSION } from "../src/server/financial-documents";

async function main() {
  const organizationId = productOrganizationId();
  if (process.env.TARGET_ENVIRONMENT !== "development" || process.env.SRM_NEON_PROJECT_ID !== "snowy-breeze-40315151" || process.env.SRM_NEON_BRANCH_ID !== "br-dark-surf-b1vrhda9" || !organizationId || process.env.SRM_REPROJECT_ORGANIZATION_ID !== organizationId) throw new Error("Development branch/project/organization identity required");
  const url = new URL(runtimeConnectionString());
  if (url.hostname.replace("-pooler", "") !== "ep-red-smoke-b16ih64d.c-5.eu-central-1.aws.neon.tech" || url.pathname !== "/srm_app") throw new Error("Development endpoint/database identity mismatch");
  const nips = process.argv.slice(2);
  if (nips.length > 10 || nips.some((nip) => !/^\d{10}$/.test(nip))) throw new Error("Supply at most ten explicit NIPs");
  if (!nips.length) throw new Error("Explicit NIPs required; no unbounded backfill");
  const summary = [];
  for (const nip of nips) {
    const archive = await withOrganization(organizationId, async (client) => (await client.query<{ payload_json: { pages: unknown[] } }>(
      "SELECT payload_json FROM srm.mgbi_source_archives WHERE organization_id=$1 AND nip=$2 AND model='pl-krs-rdf-record'", [organizationId, nip])).rows[0]);
    if (!archive) { summary.push({ found: false, documents: 0, positions: 0 }); continue; }
    const result = await saveFinancialDocuments(organizationId, nip, archive.payload_json.pages);
    summary.push({ found: true, ...result });
  }
  console.info(JSON.stringify({ environment: "development", projectId: "snowy-breeze-40315151", branchId: "br-dark-surf-b1vrhda9", database: "srm_app", organizationId, mappingVersion: FINANCIAL_DOCUMENT_MAPPING_VERSION, archives: summary }));
}
main().finally(() => getPool().end()).catch(() => { console.error("Financial document reprojection failed; existing valid projections retained."); process.exitCode = 1; });
