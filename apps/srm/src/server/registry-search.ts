import type { JdgRegistryData, SectionEnvelope, SupplierXRayCard } from "@profitia/srm-xray";
import { runJdgLookup } from "./jdg-lookup";
import { runXrayLookup, type XrayLookupRequest } from "./xray-lookup";
import { readFreshCompany } from "./shared-catalog";

type RegistryLookups = {
  jdg: (organizationId: string, nip: string) => Promise<SectionEnvelope<JdgRegistryData>>;
  company: (organizationId: string, request: XrayLookupRequest) => Promise<SupplierXRayCard>;
  catalog?: (organizationId: string, nip: string) => Promise<boolean>;
};

const defaultLookups: RegistryLookups = {
  jdg: runJdgLookup, company: runXrayLookup,
  catalog: async (organizationId, nip) => Boolean(await readFreshCompany(organizationId, nip)),
};

export type RegistrySearchResult =
  | { entityType: "JDG"; nip: string; section: SectionEnvelope<JdgRegistryData> }
  | { entityType: "COMPANY"; card: SupplierXRayCard }
  | { entityType: "NOT_FOUND" }
  | { entityType: "UNAVAILABLE" };

/** A known company is served from the catalog; unknown NIPs still check CEIDG first. */
export async function searchRegistryByNip(
  organizationId: string,
  request: XrayLookupRequest,
  lookups: RegistryLookups = defaultLookups,
): Promise<RegistrySearchResult> {
  const nip = request.identifier.value;
  if (lookups.catalog && await lookups.catalog(organizationId, nip)) {
    const company = await lookups.company(organizationId, request);
    if (company.general.data?.nip === nip && (company.general.status === "SUCCESS" || company.general.status === "PARTIAL")) {
      return { entityType: "COMPANY", card: company };
    }
  }
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
