type Card = { code: string };
type Group = { id: string };
type YearMap = Record<string, number>;
export type Prefs = {
  tab: string;
  selected: string[];
  tabYears: YearMap;
  customYears: YearMap;
};
const emptyPrefs = (): Prefs => ({
  tab: "overview",
  selected: [],
  tabYears: {},
  customYears: {},
});
export function validYear(
  saved: unknown,
  available: number[],
): number | undefined {
  return typeof saved === "number" && available.includes(saved)
    ? saved
    : available[0];
}
export function validatePreferences(
  saved: unknown,
  cards: Card[],
  groups: Group[],
  years: number[],
  getYears: (code: string) => number[],
): Prefs {
  try {
    if (
      !saved ||
      typeof saved !== "object" ||
      !("selected" in saved) ||
      !Array.isArray(saved.selected)
    )
      return emptyPrefs();
    const candidate = saved as {
      selected: unknown[];
      tab?: string;
      tabYears?: Record<string, number>;
      customYears?: Record<string, number>;
    };
    const selected = cards
      .filter(
        (c) =>
          candidate.selected.includes(c.code) && getYears(c.code).length > 0,
      )
      .map((c) => c.code);
    const tabYears: YearMap = {},
      customYears: YearMap = {};
    for (const tab of ["overview", ...groups.map((g) => g.id)]) {
      const year = candidate.tabYears?.[tab];
      if (typeof year === "number" && years.includes(year))
        tabYears[tab] = year;
    }
    for (const code of selected) {
      const y = validYear(candidate.customYears?.[code], getYears(code));
      if (y !== undefined) customYears[code] = y;
    }
    return {
      tab: ["overview", "custom", ...groups.map((g) => g.id)].includes(
        candidate.tab || "",
      )
        ? candidate.tab!
        : "overview",
      selected,
      tabYears,
      customYears,
    };
  } catch {
    return emptyPrefs();
  }
}
