import type { JdgRegistryData, SectionEnvelope, SupplierXRayCard } from "@profitia/srm-xray";
import { runJdgLookup } from "./jdg-lookup";
import { runXrayLookup, type XrayLookupRequest } from "./xray-lookup";

type RegistryLookups = {
  jdg: (organizationId: string, nip: string) => Promise<SectionEnvelope<JdgRegistryData>>;
  company: (organizationId: string, request: XrayLookupRequest) => Promise<SupplierXRayCard>;
};

export type RegistrySearchResult =
  | { entityType: "JDG"; nip: string; section: SectionEnvelope<JdgRegistryData> }
  | { entityType: "COMPANY"; card: SupplierXRayCard }
  | { entityType: "NOT_FOUND" }
  | { entityType: "UNAVAILABLE" };

/** CEIDG is queried first so a JDG lookup does not consume MGBI quota. */
export async function searchRegistryByNip(
  organizationId: string,
  request: XrayLookupRequest,
  lookups: RegistryLookups = { jdg: runJdgLookup, company: runXrayLookup },
): Promise<RegistrySearchResult> {
  const nip = request.identifier.value;
  const jdg = await lookups.jdg(organizationId, nip);
  if ((jdg.status === "SUCCESS" || jdg.status === "PARTIAL") && jdg.data?.entries.some((entry) => entry.nip === nip)) {
    return { entityType: "JDG", nip, section: jdg };
  }

  const company = await lookups.company(organizationId, request);
  if (company.general.data?.nip === nip && (company.general.status === "SUCCESS" || company.general.status === "PARTIAL")) {
    return { entityType: "COMPANY", card: company };
  }

  return jdg.status === "EMPTY" && company.general.status === "EMPTY"
    ? { entityType: "NOT_FOUND" }
    : { entityType: "UNAVAILABLE" };
}
