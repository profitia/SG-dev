import type { JdgRegistryData, SectionEnvelope, SupplierXRayCard } from "@profitia/srm-xray";
import { runJdgLookup } from "./jdg-lookup";
import { runXrayLookup, type XrayLookupRequest } from "./xray-lookup";
import { readFreshCompany } from "./shared-catalog";
import { isKnownMgbiCompany } from "./company-source-policy";

type RegistryLookups = {
  jdg: (organizationId: string, nip: string) => Promise<SectionEnvelope<JdgRegistryData>>;
  company: (organizationId: string, request: XrayLookupRequest) => Promise<SupplierXRayCard>;
  catalog?: (organizationId: string, nip: string) => Promise<boolean>;
};

const defaultLookups: RegistryLookups = {
  jdg: runJdgLookup, company: runXrayLookup,
  catalog: async (organizationId, nip) => isKnownMgbiCompany(await readFreshCompany(organizationId, nip), nip),
};

export type RegistrySearchResult =
  | { entityType: "JDG"; nip: string; section: SectionEnvelope<JdgRegistryData> }
  | { entityType: "COMPANY"; card: SupplierXRayCard }
  | { entityType: "NOT_FOUND" }
  | { entityType: "UNAVAILABLE"; unavailableProvider: "CEIDG" | null };

function acceptedCompanyOutcome(company: SupplierXRayCard, nip: string): boolean {
  const general = company.general, data = general.data;
  if (!(general.status === "SUCCESS" || general.status === "PARTIAL") || data?.nip !== nip
    || company.identity.nip !== nip || company.identity.krs !== data.krs || company.identity.name !== data.legalName) return false;
  // Existing checksum-verified historical removal evidence can withhold a
  // report even when the old record has no KRS/name. It cannot admit finances
  // or become positive identity proof through a CEIDG availability error.
  if (data.registrationStatus === "DEREGISTERED" && data.krs === null)
    return company.financial.status === "NOT_REQUESTED" && company.financial.data === null;
  return typeof data.krs === "string" && /^\d{10}$/.test(data.krs)
    && typeof data.legalName === "string" && !!data.legalName.trim()
    && (!data.registryHistory || data.registryHistory.currentKrs === data.krs);
}

/** Current catalog proof precedes classification. An unavailable CEIDG is not
 * absence: only an independently verified company can resolve that case. */
export async function searchRegistryByNip(
  organizationId: string,
  request: XrayLookupRequest,
  lookups: RegistryLookups = defaultLookups,
): Promise<RegistrySearchResult> {
  const nip = request.identifier.value;
  if (lookups.catalog && await lookups.catalog(organizationId, nip)) {
    const company = await lookups.company(organizationId, request);
    // Do not reclassify or acquire a second report if the selected company
    // fails validation after the routing read (including a concurrent change).
    return acceptedCompanyOutcome(company, nip)
      ? { entityType: "COMPANY", card: company }
      : { entityType: "UNAVAILABLE", unavailableProvider: null };
  }
  const jdg = await lookups.jdg(organizationId, nip);
  if (jdg.status === "SUCCESS" || jdg.status === "PARTIAL") {
    // A successful but incomplete/conflicting response is not registry absence.
    return jdg.data?.entries.length && jdg.data.entries.every((entry) => entry.nip === nip)
      ? { entityType: "JDG", nip, section: jdg }
      : { entityType: "UNAVAILABLE", unavailableProvider: "CEIDG" };
  }

  if (jdg.status !== "EMPTY" && jdg.status !== "ERROR") return { entityType: "UNAVAILABLE", unavailableProvider: "CEIDG" };

  const company = await lookups.company(organizationId, request);
  if (acceptedCompanyOutcome(company, nip)
    && (jdg.status === "EMPTY" || company.general.data?.krs !== null)) {
    return { entityType: "COMPANY", card: company };
  }

  return jdg.status === "EMPTY" && company.general.status === "EMPTY"
    ? { entityType: "NOT_FOUND" }
    : { entityType: "UNAVAILABLE", unavailableProvider: jdg.status === "ERROR" ? "CEIDG" : null };
}
