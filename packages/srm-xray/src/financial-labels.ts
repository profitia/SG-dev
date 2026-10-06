/** Presentation labels for the common MGBI KRS-RDF standardized fields.
 * Unknown source fields remain available in the technical detail view and in
 * structured persistence; they are never assigned a guessed accounting name.
 */
export const financialLabels: Record<string, { label: string; group: "Bilans" | "Rachunek zysków i strat" }> = {
  BS_A_FA: { label: "Aktywa trwałe", group: "Bilans" },
  BS_A_CA: { label: "Aktywa obrotowe", group: "Bilans" },
  BS_A_TA: { label: "Aktywa razem", group: "Bilans" },
  BS_LAE_E: { label: "Kapitał własny", group: "Bilans" },
  BS_LAE_NC: { label: "Kapitał podstawowy", group: "Bilans" },
  BS_LAE_LAPFL: { label: "Zobowiązania i rezerwy na zobowiązania", group: "Bilans" },
  BS_LAE_LAPFL_LTL: { label: "Zobowiązania długoterminowe", group: "Bilans" },
  BS_LAE_LAPFL_STL: { label: "Zobowiązania krótkoterminowe", group: "Bilans" },
  PALA_NRFS: { label: "Przychody netto ze sprzedaży i zrównane z nimi", group: "Rachunek zysków i strat" },
  PALA_NRFS_CIIOP: { label: "Zmiana stanu produktów", group: "Rachunek zysków i strat" },
  PALA_NRFS_MCOPFIPOTE: { label: "Koszt wytworzenia produktów na własne potrzeby", group: "Rachunek zysków i strat" },
  PALA_OAC: { label: "Koszty działalności operacyjnej", group: "Rachunek zysków i strat" },
  PALA_OAC_D: { label: "Amortyzacja", group: "Rachunek zysków i strat" },
  PALA_OAC_MAEC: { label: "Zużycie materiałów i energii", group: "Rachunek zysków i strat" },
  PALA_OAC_ES: { label: "Usługi obce", group: "Rachunek zysków i strat" },
  PALA_OAC_TAC: { label: "Podatki i opłaty", group: "Rachunek zysków i strat" },
  PALA_OAC_TACI_ED: { label: "Podatek akcyzowy", group: "Rachunek zysków i strat" },
  PALA_OAC_R: { label: "Wynagrodzenia", group: "Rachunek zysków i strat" },
  PALA_OAC_SIAOBI: { label: "Ubezpieczenia społeczne i inne świadczenia", group: "Rachunek zysków i strat" },
  PALA_OAC_OCBT: { label: "Pozostałe koszty rodzajowe", group: "Rachunek zysków i strat" },
  PALA_OAC_VOGAMS: { label: "Wartość sprzedanych towarów i materiałów", group: "Rachunek zysków i strat" },
  PALA_PLFS: { label: "Zysk lub strata ze sprzedaży", group: "Rachunek zysków i strat" },
  PALA_OOR: { label: "Pozostałe przychody operacyjne", group: "Rachunek zysków i strat" },
  PALA_OOC: { label: "Pozostałe koszty operacyjne", group: "Rachunek zysków i strat" },
  PALA_PLFOA: { label: "Zysk lub strata z działalności operacyjnej", group: "Rachunek zysków i strat" },
  PALA_FR: { label: "Przychody finansowe", group: "Rachunek zysków i strat" },
  PALA_FC: { label: "Koszty finansowe", group: "Rachunek zysków i strat" },
  PALA_GPL: { label: "Zysk lub strata brutto", group: "Rachunek zysków i strat" },
  PALA_IT: { label: "Podatek dochodowy", group: "Rachunek zysków i strat" },
  PALA_NPL: { label: "Zysk lub strata netto", group: "Rachunek zysków i strat" },
};

/** Presentation conversion only. Persisted MGBI amounts retain their original unit. */
export function amountInThousands(amount: string, currency: string, unit: string): number | null {
  if (!/^-?\d+(?:\.\d+)?$/.test(amount) || currency !== "PLN") return null;
  if (unit !== "PLN" && unit !== "THOUSAND_PLN") return null;
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || Math.abs(numeric) > Number.MAX_SAFE_INTEGER) return null;
  return unit === "PLN" ? numeric / 1000 : numeric;
}

export function formatFinancialAmount(amount: string, currency: string, unit: string): string {
  const thousands = amountInThousands(amount, currency, unit);
  if (thousands === null) return "brak danych";
  return `${new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(thousands)} tys. zł`;
}
