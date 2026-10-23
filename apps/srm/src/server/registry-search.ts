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
  | { entityType: "UNAVAILABLE"; unavailableProvider: "CEIDG" | null };

/** CEIDG classification always precedes the company provider. Errors never prove absence. */
export async function searchRegistryByNip(
  organizationId: string,
  request: XrayLookupRequest,
  lookups: RegistryLookups = defaultLookups,
): Promise<RegistrySearchResult> {
  const nip = request.identifier.value;
  const jdg = await lookups.jdg(organizationId, nip);
  if ((jdg.status === "SUCCESS" || jdg.status === "PARTIAL") && jdg.data?.entries.some((entry) => entry.nip === nip)) {
    return { entityType: "JDG", nip, section: jdg };
  }

  if (jdg.status !== "EMPTY") return { entityType: "UNAVAILABLE", unavailableProvider: "CEIDG" };

  const company = await lookups.company(organizationId, request);
  if (company.general.data?.nip === nip && (company.general.status === "SUCCESS" || company.general.status === "PARTIAL")) {
    return { entityType: "COMPANY", card: company };
  }

  return jdg.status === "EMPTY" && company.general.status === "EMPTY"
    ? { entityType: "NOT_FOUND" }
    : { entityType: "UNAVAILABLE", unavailableProvider: null };
}
