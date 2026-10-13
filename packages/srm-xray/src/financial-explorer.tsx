"use client";
import { CanonElement, CanonButton, CanonInput } from './ui-canon';
import React, { useEffect, useRef, useState } from "react";

import type { IndicatorViewContext } from "./assistant-context";

type Card = {
  code: string;
  name: string;
  buyer: string;
  definition: string;
  importance: number;
  unit: string;
};
type Group = { id: string; name: string; codes: string[] };
type Metric = {
  value: string | null;
  unit: string;
  importance: number;
  reason: string | null;
};
type YearMap = Record<string, number>;
type Prefs = {
  tab: string;
  selected: string[];
  tabYears: YearMap;
  customYears: YearMap;
};
type Props = {
  cards: Card[];
  groups: Group[];
  overviewCodes: string[];
  years: number[];
  storageKey: string | null;
  getMetric: (code: string, year: number) => Metric;
  formatValue: (value: string | null, unit: string, full?: boolean) => string;
  onHistory: (code: string, year?: number) => void;
  onContextChange?: (context: IndicatorViewContext) => void;
};
const emptyPrefs = (): Prefs => ({
  tab: "overview",
  selected: [],
  tabYears: {},
  customYears: {},
});
const shortLabels: Record<string, string> = {
  liquidity: "Płynność",
  debt: "Zadłużenie",
  profit: "Rentowność i wyniki",
  cash: "Gotówka",
};
const shortBuyer: Record<string, string> = {
  CURRENT_RATIO:
    "Niska płynność może utrudnić finansowanie zamówień. Wysoką wartość sprawdź pod kątem zapasów i należności.",
  QUICK_RATIO:
    "Pokazuje pokrycie zobowiązań bez sprzedaży zapasów — przydatne u dostawców z dużym magazynem.",
  NET_WORKING_CAPITAL:
    "Ujemny bufor może utrudnić finansowanie bieżących zamówień i zwiększenie produkcji.",
  CASH_CONVERSION_CYCLE:
    "Długi cykl wiąże gotówkę i może ograniczać finansowanie kolejnych zamówień.",
  LIABILITIES_TO_ASSETS:
    "Rosnący udział może zmniejszać odporność na trudniejszy okres. Obejmuje więcej niż kredyty.",
  EQUITY_TO_ASSETS:
    "Wyższy udział może zapewniać większy bufor na straty i nieprzewidziane wydatki.",
  INTEREST_COVERAGE:
    "Słabe pokrycie odsetek może ograniczać środki na wykonanie kontraktu.",
  NET_DEBT_TO_EBITDA:
    "Wysoki poziom może ograniczać inwestycje dostawcy. EBITDA nie jest dostępną gotówką.",
  OPERATING_MARGIN:
    "Spadek marży może zapowiadać presję na ceny, jakość lub terminowość dostaw.",
  NET_MARGIN:
    "Utrzymujące się straty mogą osłabiać zdolność do realizacji długich kontraktów.",
  EBITDA_MARGIN:
    "Pomaga śledzić wynik operacyjny, ale nie potwierdza gotówki dostępnej na realizację zamówień.",
  ROA: "Spadek może sugerować słabsze wykorzystanie zasobów potrzebnych do obsługi zamówień.",
  ROE: "Wspiera ocenę trwałości finansowania. Przy niskim lub ujemnym kapitale wynik może być mylący.",
  REVENUE_YOY:
    "Gwałtowny spadek uzasadnia rozmowę o obłożeniu i ciągłości dostaw. Wzrost nie przesądza o kondycji.",
  MATERIALS_ENERGY_SHARE:
    "Wysoki udział zwiększa znaczenie zabezpieczenia cen surowców i energii w kontrakcie.",
  FREE_CASH_FLOW:
    "Ujemną wartość sprawdź pod kątem inwestycji i trudności operacyjnych.",
};
const fold = (value: string) =>
  value
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
import { validYear, validatePreferences } from "./financial-explorer-model";
function Importance({ level }: { level: number }) {
  const label = ["", "Pomocniczy", "Istotny", "Kluczowy"][level] || "Istotny";
  return (
    <CanonElement as="span" canonId="SRM-C15" usage="financial-explorer:01"
      className="srm-importance"
      data-level={level}
      aria-label={label}
      title={label + " — znaczenie dla kupca"}
    >
      <span className="srm-dots" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <i key={n} className={n <= level ? "filled" : ""} />
        ))}
      </span>
      <span>{label}</span>
    </CanonElement>
  );
}
function YearPills({
  years,
  value,
  label,
  onChange,
  compact = false,
}: {
  years: number[];
  value: number | undefined;
  label: string;
  onChange: (year: number) => void;
  compact?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const handleKey = (e: React.KeyboardEvent, index: number) => {
    let next: number | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      next = (index + 1) % years.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (index + years.length - 1) % years.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = years.length - 1;
    if (next !== undefined) {
      e.preventDefault();
      onChange(years[next]);
      container.current
        ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
        [next]?.focus();
    }
  };
  return (
    <div
      ref={container}
      className={"srm-year-pills " + (compact ? "is-compact" : "")}
      role="radiogroup"
      aria-label={label}
    >
      {years.map((y, index) => (
        <CanonButton canonId="SRM-C09" usage="financial-explorer:02"
          key={y}
          type="button"
          role="radio"
          aria-checked={value === y}
          tabIndex={
            value === y || (value === undefined && index === 0) ? 0 : -1
          }
          onClick={() => onChange(y)}
          onKeyDown={(e) => handleKey(e, index)}
        >
          {y}
        </CanonButton>
      ))}
    </div>
  );
}
function CategoryCheck({
  group,
  count,
  total,
  onChange,
}: {
  group: Group;
  count: number;
  total: number;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = count > 0 && count < total;
  }, [count, total]);
  return (
    <label className="srm-picker-group-check">
      <CanonInput canonId="SRM-C11" usage="financial-explorer:03"
        ref={ref}
        type="checkbox"
        checked={total > 0 && count === total}
        disabled={total === 0}
        onChange={onChange}
        aria-label={"Cała kategoria: " + group.name}
      />
      <span className="srm-picker-category-name">{group.name}</span>
      <span>
        {count} z {total}
      </span>
    </label>
  );
}
function IndicatorPicker({
  cards,
  groups,
  selected,
  customYears,
  getMetric,
  getYears,
  formatValue,
  onClose,
  onApply,
}: Pick<Props, "cards" | "groups" | "getMetric" | "formatValue"> & {
  selected: string[];
  customYears: YearMap;
  getYears: (code: string) => number[];
  onClose: () => void;
  onApply: (ids: string[], years: YearMap) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    search = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(selected),
    [draftYears, setDraftYears] = useState<YearMap>({ ...customYears }),
    [query, setQuery] = useState("");
  const queryText = fold(query.trim());
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    search.current?.focus();
    return () => {
      dialog.current?.close();
      previous?.focus();
    };
  }, []);
  const visibleGroups = groups
    .map((g) => ({
      ...g,
      visible: g.codes.filter((code) => {
        const card = cards.find((c) => c.code === code)!;
        return (
          !queryText ||
          fold(card.name + " " + g.name + " " + code).includes(queryText)
        );
      }),
    }))
    .filter((g) => g.visible.length);
  const toggle = (code: string) => {
    const y = validYear(draftYears[code], getYears(code));
    if (y === undefined) return;
    setDraft((ids) =>
      ids.includes(code) ? ids.filter((id) => id !== code) : [...ids, code],
    );
    setDraftYears((old) => ({ ...old, [code]: y }));
  };
  const toggleGroup = (group: Group) => {
    const possible = group.codes.filter((code) => getYears(code).length);
    setDraft((ids) =>
      possible.every((code) => ids.includes(code))
        ? ids.filter((id) => !possible.includes(id))
        : [...new Set([...ids, ...possible])],
    );
    setDraftYears((old) => {
      const next = { ...old };
      for (const code of possible)
        next[code] = validYear(old[code], getYears(code))!;
      return next;
    });
  };
  const apply = () => {
    const ids = cards
        .filter((c) => draft.includes(c.code) && getYears(c.code).length)
        .map((c) => c.code),
      years: YearMap = {};
    for (const code of ids)
      years[code] = validYear(draftYears[code], getYears(code))!;
    onApply(ids, years);
  };
  return (
    <CanonElement as="dialog" canonId="SRM-C12" usage="financial-explorer:04"
      ref={dialog}
      className="srm-ui srm-picker srm-period-picker"
      aria-labelledby="picker-title"
      aria-describedby="picker-description"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="srm-picker-head">
        <div>
          <span className="srm-eyebrow">WŁASNY WIDOK</span>
          <h2 id="picker-title">Wybierz wskaźniki i lata</h2>
          <p id="picker-description">
            Jeden rok dla każdego wskaźnika. Kliknięcie roku dodaje wskaźnik do
            zestawu.
          </p>
        </div>
        <CanonButton canonId="SRM-C02" usage="financial-explorer:05" className="srm-btn" onClick={onClose}>
          Zamknij
        </CanonButton>
      </div>
      <div className="srm-picker-search">
        <label htmlFor="indicator-search">Szukaj wskaźnika lub kategorii</label>
        <div>
          <CanonInput canonId="SRM-C06" usage="financial-explorer:06"
            ref={search}
            id="indicator-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Np. płynność, marża, kapitał…"
          />
          {query && (
            <CanonButton canonId="SRM-C55" usage="financial-explorer:07"
              className="srm-text-link"
              onClick={() => {
                setQuery("");
                search.current?.focus();
              }}
            >
              Wyczyść
            </CanonButton>
          )}
        </div>
      </div>
      <div className="srm-picker-tools">
        <span aria-live="polite">Wybrano {draft.length}</span>
        <span>Pokazujemy tylko lata z dostępną wartością.</span>
        <CanonButton canonId="SRM-C55" usage="financial-explorer:08"
          className="srm-text-link"
          onClick={() => setDraft([])}
          disabled={!draft.length}
        >
          Odznacz wszystkie
        </CanonButton>
      </div>
      <div className="srm-picker-list">
        <div className="srm-picker-column-labels" aria-hidden="true">
          <span>Wskaźnik</span>
          <span>Rok sprawozdawczy</span>
          <span>Wartość</span>
        </div>
        {!visibleGroups.length && (
          <div className="srm-picker-no-results">
            <h3>Brak pasujących wskaźników</h3>
            <p>
              Zmień nazwę lub wyczyść wyszukiwanie. Twój wybór został zachowany.
            </p>
            <CanonButton canonId="SRM-C02" usage="financial-explorer:09" className="srm-btn" onClick={() => setQuery("")}>
              Pokaż wszystkie
            </CanonButton>
          </div>
        )}
        {visibleGroups.map((group) => {
          const possible = group.codes.filter((code) => getYears(code).length);
          return (
            <fieldset key={group.id} className="srm-picker-group">
              <legend className="srm-sr-only">{group.name}</legend>
              <CategoryCheck
                group={group}
                count={possible.filter((code) => draft.includes(code)).length}
                total={possible.length}
                onChange={() => toggleGroup(group)}
              />
              {group.visible.map((code) => {
                const card = cards.find((c) => c.code === code)!,
                  years = getYears(code),
                  period = validYear(draftYears[code], years),
                  isSelected = draft.includes(code),
                  metric =
                    period === undefined ? null : getMetric(code, period);
                return (
                  <div
                    key={code}
                    className={
                      "srm-period-item " + (isSelected ? "is-checked" : "")
                    }
                    data-indicator={code}
                  >
                    <label className="srm-period-indicator">
                      <CanonInput canonId="SRM-C10" usage="financial-explorer:10"
                        type="checkbox"
                        checked={isSelected}
                        disabled={!years.length}
                        onChange={() => toggle(code)}
                      />
                      <span>{card.name}</span>
                    </label>
                    {years.length ? (
                      <YearPills
                        compact
                        years={years}
                        value={isSelected ? period : undefined}
                        label={"Rok: " + card.name}
                        onChange={(y) => {
                          setDraftYears((old) => ({ ...old, [code]: y }));
                          setDraft((ids) =>
                            ids.includes(code) ? ids : [...ids, code],
                          );
                        }}
                      />
                    ) : (
                      <span className="srm-no-years">
                        Brak dostępnych okresów
                      </span>
                    )}
                    <span className="srm-picker-period-value">
                      {isSelected && metric
                        ? formatValue(metric.value, metric.unit)
                        : "—"}
                    </span>
                  </div>
                );
              })}
            </fieldset>
          );
        })}
      </div>
      <div className="srm-picker-foot">
        <p>Wskaźniki i lata pozostaną po odświeżeniu tej karty.</p>
        <div>
          <CanonButton canonId="SRM-C02" usage="financial-explorer:11" className="srm-btn" onClick={onClose}>
            Anuluj
          </CanonButton>
          <CanonButton canonId="SRM-C01" usage="financial-explorer:12" className="srm-primary-button" onClick={apply}>
            Pokaż wybrane ({draft.length})
          </CanonButton>
        </div>
      </div>
    </CanonElement>
  );
}
export function IndicatorExplorer({
  cards,
  groups,
  overviewCodes,
  years,
  storageKey,
  getMetric,
  formatValue,
  onHistory,
  onContextChange,
}: Props) {
  const getYears = (code: string) =>
    years
      .filter((y) => {
        const v = getMetric(code, y).value;
        return v !== null && Number.isFinite(Number(v));
      })
      .sort((a, b) => b - a);
  const [prefs, setPrefs] = useState<Prefs>(emptyPrefs);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [picker, setPicker] = useState(false),
    [storageAvailable, setStorageAvailable] = useState(true),
    [message, setMessage] = useState("");
  const tabList = useRef<HTMLDivElement>(null);
  const tabs = [
    { id: "overview", label: "Przegląd" },
    ...groups.map((g) => ({ id: g.id, label: shortLabels[g.id] || g.name })),
    { id: "custom", label: "Własne" },
  ];
  useEffect(() => {
    if (!storageKey) {
      setStorageAvailable(false);
      return;
    }
    try {
      setPrefs(
        validatePreferences(
          JSON.parse(sessionStorage.getItem(storageKey) || "null"),
          cards,
          groups,
          years,
          getYears,
        ),
      );
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
    setLoadedKey(storageKey);
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey || loadedKey !== storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(prefs));
    } catch {
      setStorageAvailable(false);
    }
  }, [prefs, storageKey, loadedKey]);
  const isCustom = prefs.tab === "custom";
  const codes =
    prefs.tab === "overview"
      ? overviewCodes
      : isCustom
        ? prefs.selected
        : groups.find((g) => g.id === prefs.tab)?.codes || [];
  const shown = codes
    .map((code) => cards.find((c) => c.code === code))
    .filter((c): c is Card => !!c);
  const tabPeriods = [...new Set(shown.flatMap((c) => getYears(c.code)))].sort(
    (a, b) => b - a,
  );
  const tabYear = validYear(prefs.tabYears[prefs.tab], tabPeriods);
  const title =
    prefs.tab === "overview"
      ? "Przegląd finansowy"
      : isCustom
        ? "Twój zestaw wskaźników"
        : groups.find((g) => g.id === prefs.tab)?.name;
  // Publish the actual visible selection, including independently chosen years.
  const viewSignature = JSON.stringify({
    tab: prefs.tab, label: title ?? "Wskaźniki",
    items: shown.map(card => {
      const year = isCustom ? validYear(prefs.customYears[card.code], getYears(card.code)) : tabYear;
      const metric = year === undefined ? null : getMetric(card.code, year);
      return { code: card.code, name: card.name, year: year ?? null, value: metric?.value ?? null,
        unit: card.unit, availability: metric?.value != null ? "available" : "missing", reason: metric?.reason ?? null };
    }),
  });
  useEffect(() => { onContextChange?.(JSON.parse(viewSignature) as IndicatorViewContext); }, [viewSignature, onContextChange]);
  const setTab = (tab: string) => {
    setPrefs((old) => ({ ...old, tab }));
    setMessage("");
  };
  const selectTabWithKey = (e: React.KeyboardEvent, index: number) => {
    let next: number | undefined;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next !== undefined) {
      e.preventDefault();
      setTab(tabs[next].id);
      tabList.current
        ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
        [next]?.focus();
    }
  };
  return (
    <section
      className="srm-metrics srm-explorer"
      aria-labelledby="metrics-title"
    >
      <div className="srm-metrics-heading">
        <div>
          <h2 id="metrics-title" tabIndex={-1}>
            Wskaźniki finansowe
          </h2>
          <p>Przeglądaj obszary lub zbuduj własny zestaw.</p>
        </div>
        <CanonButton canonId="SRM-C55" usage="financial-explorer:13"
          className="srm-text-link srm-reset-view"
          onClick={() => {
            setPrefs(emptyPrefs());
            setMessage("Przywrócono domyślny widok i najnowsze okresy.");
          }}
        >
          Przywróć domyślny widok
        </CanonButton>
      </div>
      <div
        ref={tabList}
        className="srm-category-tabs"
        role="tablist"
        aria-label="Kategorie wskaźników finansowych"
      >
        {tabs.map((tab, index) => (
          <CanonButton canonId="SRM-C08" usage="financial-explorer:14"
            key={tab.id}
            id={"metric-tab-" + tab.id}
            role="tab"
            aria-selected={prefs.tab === tab.id}
            aria-controls={"metric-panel-" + tab.id}
            tabIndex={prefs.tab === tab.id ? 0 : -1}
            onClick={() => setTab(tab.id)}
            onKeyDown={(e) => selectTabWithKey(e, index)}
          >
            {tab.label}
          </CanonButton>
        ))}
      </div>
      <div
        id={"metric-panel-" + prefs.tab}
        role="tabpanel"
        aria-labelledby={"metric-tab-" + prefs.tab}
        tabIndex={0}
        className="srm-metric-tabpanel"
      >
        <div className="srm-panel-toolbar">
          <div>
            <h3>{title}</h3>
            {isCustom && shown.length > 0 && (
              <p>Każda karta pokazuje wybrany dla niej okres.</p>
            )}
          </div>
          {isCustom && shown.length > 0 && (
            <CanonButton canonId="SRM-C01" usage="financial-explorer:15"
              className="srm-primary-button"
              onClick={() => setPicker(true)}
            >
              Wybierz wskaźniki i lata
            </CanonButton>
          )}
        </div>
        {!isCustom && (
          <div className="srm-tab-periods">
            <span>Rok sprawozdawczy</span>
            {tabPeriods.length ? (
              <YearPills
                years={tabPeriods}
                value={tabYear}
                label={
                  "Rok zakładki: " + tabs.find((t) => t.id === prefs.tab)?.label
                }
                onChange={(y) =>
                  setPrefs((old) => ({
                    ...old,
                    tabYears: { ...old.tabYears, [old.tab]: y },
                  }))
                }
              />
            ) : (
              <span>Brak dostępnych okresów</span>
            )}
          </div>
        )}
        {message && (
          <p className="srm-preference-message" role="status">
            {message}
          </p>
        )}
        {!shown.length && (
          <div className="srm-custom-empty">
            <h3>Twój widok, Twoje priorytety</h3>
            <p>
              Połącz wybrane wskaźniki i dobierz rok osobno dla każdego z nich.
            </p>
            <CanonButton canonId="SRM-C02" usage="financial-explorer:16" className="srm-btn" onClick={() => setPicker(true)}>
              Utwórz własny zestaw
            </CanonButton>
          </div>
        )}
        <div className="srm-card-grid">
          {shown.map((card) => {
            const period = isCustom
              ? validYear(prefs.customYears[card.code], getYears(card.code))
              : tabYear;
            const m =
                period !== undefined
                  ? getMetric(card.code, period)
                  : {
                      value: null,
                      unit: card.unit,
                      importance: card.importance,
                      reason: null,
                    },
              missing = m.value === null;
            return (
              <article
                key={card.code}
                data-financial-indicator={card.code}
                className={"srm-metric-card " + (missing ? "is-missing" : "")}
                aria-labelledby={"card-title-" + card.code}
              >
                <div className="srm-card-top">
                  <h4 id={"card-title-" + card.code}>
                    {card.name}
                    <span className="srm-colon">:</span>
                  </h4>
                  <strong
                    className="srm-card-value"
                    title={formatValue(m.value, m.unit, true)}
                  >
                    {formatValue(m.value, m.unit)}
                  </strong>
                </div>
                <p className="srm-card-definition">{card.definition}</p>
                <p className="srm-buyer">
                  <span>Dla kupca</span>
                  {shortBuyer[card.code] || card.buyer}
                </p>
                <CanonElement as="div" canonId="SRM-C14" usage="financial-explorer:17" className="srm-card-footer">
                  <span className="srm-card-period">
                    {period !== undefined
                      ? "Sprawozdanie " + period
                      : "Brak dostępnego okresu"}
                    {missing && period !== undefined ? " · brak wartości" : ""}
                  </span>
                  <span className="srm-card-actions">
                    <Importance level={m.importance} />
                    <CanonButton canonId="SRM-C03" usage="financial-explorer:18"
                      className="srm-text-link"
                      aria-label={"Zobacz historię: " + card.name}
                      onClick={() => onHistory(card.code, period)}
                    >
                      Zobacz historię
                    </CanonButton>
                  </span>
                </CanonElement>
              </article>
            );
          })}
        </div>
      </div>
      {tabs
        .filter((tab) => tab.id !== prefs.tab)
        .map((tab) => (
          <div
            key={tab.id}
            id={"metric-panel-" + tab.id}
            role="tabpanel"
            aria-labelledby={"metric-tab-" + tab.id}
            hidden
          />
        ))}
      <div className="srm-explorer-foot">
        <p>
          {storageAvailable
            ? "Wskaźniki i lata zapamiętane w tej karcie przeglądarki."
            : "Wybór działa do odświeżenia strony — pamięć sesji jest niedostępna."}
        </p>
        <div className="srm-priority-legend">
          <span>Znaczenie dla kupca</span>
          <Importance level={1} />
          <Importance level={2} />
          <Importance level={3} />
        </div>
      </div>
      {picker && (
        <IndicatorPicker
          cards={cards}
          groups={groups}
          selected={prefs.selected}
          customYears={prefs.customYears}
          getMetric={getMetric}
          getYears={getYears}
          formatValue={formatValue}
          onClose={() => setPicker(false)}
          onApply={(ids, selectedYears) => {
            setPrefs((old) => ({
              ...old,
              tab: "custom",
              selected: ids,
              customYears: selectedYears,
            }));
            setPicker(false);
            setMessage("Zestaw został zaktualizowany.");
          }}
        />
      )}
    </section>
  );
}
