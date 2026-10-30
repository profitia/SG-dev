type Row = Record<string, any>;
declare global {
  interface Window {
    Clerk: any;
    __internal_ClerkUICtor: any;
  }
}
const root = document.getElementById("app")!,
  config = JSON.parse(document.getElementById("configuration")!.textContent!);
const escape = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const views: Record<string, string> = {
  dashboard: "Dashboard",
  products: "Produkty",
  packages: "Pakiety",
  metrics: "Limity",
  organisations: "Organizacje",
  assignments: "Przypisania",
  usage: "Wykorzystanie",
  history: "Historia",
};
const statusNames: Record<string, string> = {
  DRAFT: "Robocza",
  PUBLISHED: "Opublikowana",
  ACTIVE: "Aktywne",
  PLANNED: "Zaplanowane",
  ENDED: "Zakończone",
  ENABLED: "Włączone",
  SUSPENDED: "Wstrzymane",
  CANCELLED: "Anulowane",
};
const errorNames: Record<string, string> = {
  OPERATOR_REQUIRED: "To konto nie ma uprawnień operatora Profitii.",
  SIGN_IN_REQUIRED: "Zaloguj się ponownie.",
  ASSIGNMENT_OVERLAP:
    "Dla tej organizacji i produktu istnieje już przypisanie w nakładającym się okresie.",
  CONCURRENT_OR_DUPLICATE_CHANGE:
    "Dane zmieniły się w międzyczasie lub taki zapis już istnieje. Odśwież widok.",
  CANONICAL_ORGANISATION_REQUIRED:
    "Organizacja nie istnieje lub nie jest obecnie aktywna.",
  INVALID_INTERVAL: "Sprawdź oddzielne daty i granice okresów.",
  OUTSIDE_CONTRACT:
    "Przypisanie i początek wykorzystania muszą mieścić się w umowie.",
  HISTORICAL_CONTRACT_IMMUTABLE:
    "Zmiana nie może nadpisywać historycznej umowy ani zakończonego przypisania.",
  SERVICE_UNAVAILABLE: "Usługa jest chwilowo niedostępna. Spróbuj ponownie.",
  WRITE_OR_READ_NOT_CONFIRMED:
    "Nie udało się potwierdzić zapisu. Ponów tę samą akcję w tym formularzu lub sprawdź historię po odświeżeniu.",
  INVALID_BUSINESS_INPUT: "Sprawdź dane formularza.",
  INVALID_VALUE: "Wpisz nieujemną wartość, maksymalnie 6 miejsc po przecinku.",
  STALE_DRAFT: "Wersja robocza zmieniła się. Odśwież widok.",
};
let state: Row | null = null,
  view = "dashboard",
  offset = 0,
  query = "",
  message = "",
  sessionId: string | null = null,
  organisations: Row[] = [];
let refreshGeneration = 0;
let dialog: HTMLDialogElement | null = null,
  modalSubmit:
    | ((data: FormData, form: HTMLFormElement) => Promise<void>)
    | null = null,
  modalRequestId = "",
  lastFocus: HTMLElement | null = null;
const tag = (s: string, pending = false) =>
  '<span class="tag ' +
  (pending ? "pending" : "") +
  '">' +
  escape(statusNames[s] ?? s) +
  "</span>";
const action = (name: string, label: string, id = "", primary = false) =>
  '<button type="button" class="' +
  (primary ? "primary" : "") +
  '" data-action="' +
  name +
  '" data-id="' +
  escape(id) +
  '">' +
  escape(label) +
  "</button>";
const input = (
  label: string,
  name: string,
  value: unknown = "",
  type = "text",
  required = true,
) =>
  "<label>" +
  escape(label) +
  '<input name="' +
  name +
  '" type="' +
  type +
  '" value="' +
  escape(value) +
  '" ' +
  (required ? "required" : "") +
  " " +
  (type === "text"
    ? 'maxlength="256"'
    : type === "number"
      ? 'step="any" min="0"'
      : "") +
  "></label>";
const select = (
  label: string,
  name: string,
  options: [string, string][],
  value: unknown = "",
) =>
  "<label>" +
  escape(label) +
  '<select name="' +
  name +
  '">' +
  options
    .map(
      ([v, n]) =>
        '<option value="' +
        escape(v) +
        '" ' +
        (v === value ? "selected" : "") +
        ">" +
        escape(n) +
        "</option>",
    )
    .join("") +
  "</select></label>";
const productName = (id: string) =>
  state?.products.find((p: Row) => p.id === id)?.name ?? id;
const orgName = (id: string) =>
  [...(state?.organisations ?? []), ...organisations].find(
    (o: Row) => o.organisation_id === id,
  )?.display_name ?? id;
const getPackage = (id: string) =>
  state?.packages.find((p: Row) => p.id === id);
const getVersion = (id: string) =>
  state?.packages.flatMap((p: Row) => p.versions).find((v: Row) => v.id === id);
const getAssignment = (id: string) =>
  state?.assignments.find((a: Row) => a.id === id);
const dateText = (v: unknown) =>
  v
    ? new Intl.DateTimeFormat("pl", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(String(v)))
    : "—";
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(
    new Date(),
  );
async function api(path: string, data?: unknown) {
  const owner = window.Clerk.session?.id ?? null;
  const assertSession = () => {
    if ((window.Clerk.session?.id ?? null) !== owner)
      throw Object.assign(new Error("Sesja została zmieniona."), {
        stale: true,
      });
  };
  const token = await window.Clerk.session?.getToken();
  assertSession();
  const response = await fetch(path, {
    method: data ? "POST" : "GET",
    cache: "no-store",
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  assertSession();
  if (!response.ok) {
    const e = new Error(
      errorNames[result.error] ??
        "Nie udało się wykonać operacji. Sprawdź dane lub spróbuj ponownie.",
    ) as Error & { status: number };
    e.status = response.status;
    throw e;
  }
  return result;
}
async function write(operation: string, data: unknown) {
  return api("/api/command", { operation, requestId: modalRequestId, data });
}
async function refresh() {
  const generation = ++refreshGeneration;
  const next = await api(
    "/api/state?offset=" + offset + "&q=" + encodeURIComponent(query),
  );
  if (generation !== refreshGeneration) return;
  state = next;
  render();
}
function skeleton(content: string) {
  return (
    '<div class="layout"><aside class="sidebar"><div><div class="brand">P<span>Profitia</span></div><p class="small">Pakiety i limity</p></div><nav aria-label="Nawigacja główna">' +
    Object.entries(views)
      .map(
        ([id, n]) =>
          '<button data-view="' +
          id +
          '" class="' +
          (id === view ? "active" : "") +
          '" ' +
          (id === view ? 'aria-current="page"' : "") +
          ">" +
          n +
          "</button>",
      )
      .join("") +
    '</nav><footer><span class="environment">Development</span><p class="small">Panel operatora Profitii</p></footer></aside><main class="main"><header class="topbar"><span class="small">Profitia / Package & Limits</span><div class="row"><span class="environment">Development</span>' +
    action("refresh", "Odśwież") +
    action("logout", "Wyloguj") +
    '</div></header><div id="notice" role="status" aria-live="polite">' +
    (message
      ? '<div class="notice success">' + escape(message) + "</div>"
      : "") +
    "</div>" +
    content +
    "</main></div>"
  );
}
const pending =
  '<div class="notice"><strong>Definicje i przypisania są zapisywane.</strong> Pomiary wykorzystania i nadawanie uprawnień technicznych nie są jeszcze podłączone. Zapis nie aktywuje praw w SpendGuru ani SRM.</div>';
function table(headers: string[], rows: string[]) {
  return (
    '<div class="tablewrap"><table><thead><tr>' +
    headers.map((h) => "<th>" + h + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows.join("") +
    "</tbody></table>" +
    (rows.length
      ? ""
      : '<div class="empty">Brak rekordów w tym widoku.</div>') +
    "</div>"
  );
}
function pager(n: number) {
  return (
    '<div class="pager">' +
    (offset ? action("previous", "← Poprzednie") : "") +
    '<span class="small">Od rekordu ' +
    (offset + 1) +
    "</span>" +
    (n >= 25 ? action("next", "Następne →") : "") +
    "</div>"
  );
}
function packageRows() {
  return state!.packages.map((p: Row) => {
    const published = p.versions.find((v: Row) => v.state === "PUBLISHED"),
      draft = p.versions.find((v: Row) => v.state === "DRAFT");
    return (
      "<tr><td><strong>" +
      escape(p.name) +
      '</strong><span class="small">' +
      escape(productName(p.product_id)) +
      "</span></td><td>" +
      tag(p.archived ? "Archiwum" : published ? "PUBLISHED" : "DRAFT") +
      "</td><td>" +
      (published ? "v" + published.number : "—") +
      '</td><td><div class="actions">' +
      action("package-detail", "Szczegóły", p.id) +
      (draft
        ? action("edit-draft", "Edytuj roboczą", draft.id)
        : !p.archived && published
          ? action("new-version", "Nowa wersja", published.id)
          : "") +
      "</div></td></tr>"
    );
  });
}
function assignmentRows() {
  return state!.assignments.map((a: Row) => {
    const p = a.effective_payload ?? a.payload,
      t = p.terms;
    let s = a.effective_status;
    return (
      "<tr><td><strong>" +
      escape(orgName(a.organisation_id)) +
      '</strong><span class="small">' +
      escape(productName(a.product_id)) +
      "</span></td><td>" +
      escape(p.packageSnapshot.name) +
      '<br><span class="small">Rewizja ' +
      a.revision +
      (a.payload.packageVersionId !== p.packageVersionId
        ? " · zaplanowana zmiana"
        : "") +
      "</span></td><td>" +
      tag(s) +
      '<br><span class="small">' +
      escape(t.assignmentStart) +
      " → " +
      escape(t.assignmentEnd) +
      " (wyłącznie)</span></td><td>" +
      tag("Uprawnienia oczekujące", true) +
      "</td><td>" +
      action("assignment-detail", "Szczegóły i historia", a.id) +
      "</td></tr>"
    );
  });
}
function render() {
  if (!state) return;
  let content =
    '<div class="heading"><div><p class="small">Zarządzanie komercyjne</p><h1>' +
    views[view] +
    '</h1><p class="muted">Dwa niezależne produkty. Jeden spójny rejestr pakietów.</p></div>' +
    (view === "packages"
      ? action("new-package", "+ Nowy pakiet", "", true)
      : view === "assignments"
        ? action("new-assignment", "+ Nowe przypisanie", "", true)
        : view === "metrics"
          ? action("new-metric", "+ Nowa metryka", "", true)
          : view === "products"
            ? action("new-capability", "+ Nowa funkcjonalność", "", true)
            : "") +
    "</div>";
  if (view === "dashboard") {
    content +=
      '<div class="cards"><div class="card"><span class="muted">Produkty komercyjne</span><strong>' +
      state.products.length +
      '</strong><p class="small">SpendGuru · SRM Standalone</p></div><div class="card"><span class="muted">Pakiety w bieżącym widoku</span><strong>' +
      state.packages.length +
      '</strong><p class="small">Wersje robocze i opublikowane</p></div><div class="card"><span class="muted">Przypisania w bieżącym widoku</span><strong>' +
      state.assignments.length +
      '</strong><p class="small">Oddzielnie dla każdego produktu</p></div></div>' +
      pending +
      '<section class="panel"><h2>Rozpocznij pracę</h2><p>Utwórz pakiet, zdefiniuj funkcjonalności i limity, a następnie opublikuj niezmienną wersję. Przypisz ją istniejącej organizacji na podstawie zatwierdzonej umowy lub danych testowych Development.</p><div class="toolbar">' +
      action("new-package", "Utwórz pakiet", "", true) +
      action("go-assignments", "Przejdź do przypisań") +
      "</div></section>";
  }
  if (view === "products")
    content +=
      '<div class="cards">' +
      state.products
        .map(
          (p: Row) =>
            '<section class="card"><h2>' +
            escape(p.name) +
            "</h2><p>" +
            (p.id === "SPENDGURU"
              ? "Samodzielny produkt, który może obejmować embedded SRM. Nie wymaga oddzielnego zakupu SRM."
              : "Oddzielny produkt komercyjny z własnym pakietem i wykorzystaniem.") +
            '</p><p class="small">' +
            escape(p.id) +
            "</p></section>",
        )
        .join("") +
      "</div><h2>Funkcjonalności techniczne</h2>" +
      table(
        ["Identyfikator", "Nazwa i znaczenie", "Produkty"],
        state.capabilities.map(
          (c: Row) =>
            '<tr><td class="mono">' +
            escape(c.id) +
            "</td><td><strong>" +
            escape(c.name) +
            "</strong>" +
            escape(c.description) +
            "</td><td>" +
            c.products.map(productName).map(escape).join("<br>") +
            "</td></tr>",
        ),
      );
  if (view === "packages")
    content +=
      '<form id="search" class="toolbar"><label class="sr-only" for="search-query">Szukaj pakietu</label><input id="search-query" name="q" placeholder="Szukaj nazwy pakietu" value="' +
      escape(query) +
      '"><button>Szukaj</button></form>' +
      table(
        ["Pakiet i produkt", "Status", "Opublikowana wersja", "Działania"],
        packageRows(),
      ) +
      pager(state.packages.length);
  if (view === "metrics")
    content +=
      '<div class="notice">Limity mają własne jednostki i okresy. UNMETERED nie wyłącza E1, autoryzacji, bezpieczeństwa ani limitów dostawcy. Total OpenAI nie sumuje ponownie cached i reasoning.</div>' +
      table(
        ["Metryka", "Jednostka / źródło", "Znaczenie naliczania"],
        state.metrics.map(
          (m: Row) =>
            "<tr><td><strong>" +
            escape(m.name) +
            '</strong><span class="mono">' +
            escape(m.id) +
            "</span></td><td>" +
            escape(m.unit) +
            "<br>" +
            escape(m.source) +
            "</td><td>" +
            escape(m.description) +
            "</td></tr>",
        ),
      );
  if (view === "organisations")
    content +=
      '<form id="organisation-search" class="toolbar"><label class="sr-only" for="org-query">Nazwa lub Organisation ID</label><input id="org-query" name="q" placeholder="Nazwa organizacji lub Organisation ID" required maxlength="256"><button class="primary">Wyszukaj</button></form><p class="small">Aktualny katalog Identity. Panel nie tworzy organizacji ani członkostw i nie wykonuje płatnych lookupów NIP.</p>' +
      table(
        ["Organizacja", "Organisation ID", "Status", "Działanie"],
        organisations.map(
          (o) =>
            "<tr><td><strong>" +
            escape(o.display_name ?? "Bez nazwy") +
            '</strong></td><td class="mono">' +
            escape(o.organisation_id) +
            "</td><td>" +
            tag(o.status) +
            "</td><td>" +
            action("assign-org", "Przypisz pakiet", o.organisation_id) +
            "</td></tr>",
        ),
      );
  if (view === "assignments")
    content +=
      pending +
      table(
        [
          "Organizacja / produkt",
          "Pakiet",
          "Obowiązywanie",
          "Stan techniczny",
          "Działania",
        ],
        assignmentRows(),
      ) +
      pager(state.assignments.length);
  if (view === "usage")
    content +=
      pending +
      '<section class="panel"><h2>Wykorzystanie nie jest jeszcze mierzone</h2><p>Brak podłączonego meteringu oznacza <strong>brak potwierdzonych danych</strong>. Nie prezentujemy go jako zerowego zużycia ani wolnego limitu.</p><p>SpendGuru, w tym embedded SRM, obciąża własny pakiet. SRM Standalone obciąża wyłącznie swój pakiet. Nie ma automatycznego fallbacku ani transferu jednostek.</p><p class="small">Koszt API OpenAI Profitii pozostaje oddzielny od jednostek i ceny umowy klienta.</p></section>';
  if (view === "history")
    content +=
      table(
        ["Czas", "Operacja", "Obiekt", "Operator", "Powód"],
        state.audit.map(
          (a: Row) =>
            "<tr><td>" +
            dateText(a.recorded_at) +
            "</td><td>" +
            escape(a.operation) +
            '</td><td class="mono">' +
            escape(a.entity_id) +
            '</td><td class="mono">' +
            escape(a.actor_id) +
            "</td><td>" +
            escape(a.reason ?? "—") +
            "</td></tr>",
        ),
      ) + pager(state.audit.length);
  root.innerHTML = skeleton(content);
}
function modal(
  title: string,
  html: string,
  submit:
    | ((data: FormData, form: HTMLFormElement) => Promise<void>)
    | null = null,
  save = "Zapisz",
) {
  dialog?.remove();
  lastFocus = document.activeElement as HTMLElement;
  modalRequestId = crypto.randomUUID();
  modalSubmit = submit;
  dialog = document.createElement("dialog");
  dialog.innerHTML =
    '<div class="dialoghead"><h2>' +
    escape(title) +
    '</h2><button type="button" data-action="close" aria-label="Zamknij">×</button></div><form id="modal-form">' +
    html +
    '<div id="modal-error" role="alert" aria-live="assertive"></div><div class="dialogactions">' +
    action("close", "Zamknij") +
    (submit
      ? '<button class="primary" type="submit">' + escape(save) + "</button>"
      : "") +
    "</div></form>";
  document.body.append(dialog);
  const owned = dialog;
  owned.addEventListener("close", () => {
    owned.remove();
    if (dialog === owned) {
      dialog = null;
      modalSubmit = null;
      lastFocus?.focus();
    }
  });
  owned.showModal();
}
const val = (d: FormData, k: string) => String(d.get(k) ?? "");
async function done(text: string) {
  dialog?.close();
  message = text;
  await refresh();
}
function newPackage() {
  modal(
    "Nowy pakiet",
    '<div class="grid">' +
      input("Nazwa pakietu", "name") +
      select(
        "Produkt komercyjny",
        "productId",
        state!.products.map((p: Row) => [p.id, p.name]),
      ) +
      "</div>",
    async (d) => {
      const r = await write("package.create", {
        name: val(d, "name"),
        productId: val(d, "productId"),
      });
      offset = 0;
      query = "";
      await done("Utworzono wersję roboczą.");
      editDraft(r.id);
    },
  );
}
function limitRow(l: Row = {}): string {
  return (
    '<div class="limit">' +
    select(
      "Metryka",
      "metricId",
      state!.metrics.map((m: Row) => [m.id, m.name + " · " + m.unit]),
      l.metricId,
    ) +
    select(
      "Tryb limitu",
      "mode",
      [
        ["LIMITED", "Limit liczbowy"],
        ["UNMETERED", "UNMETERED"],
        ["DISABLED", "Wyłączone"],
      ],
      l.mode ?? "LIMITED",
    ) +
    input("Wartość", "value", l.value ?? "", "number", false) +
    '<div class="periods">' +
    select(
      "Okres",
      "period",
      [
        ["DAY", "Dzienny"],
        ["WEEK", "Tygodniowy"],
        ["MONTH", "Miesięczny"],
        ["YEAR", "Roczny"],
        ["CONTRACT", "Cała umowa"],
      ],
      l.period ?? "MONTH",
    ) +
    select(
      "Początek okresu",
      "anchor",
      [
        ["CALENDAR", "Kalendarz"],
        ["ASSIGNMENT", "Od aktywacji"],
      ],
      l.anchor ?? "CALENDAR",
    ) +
    input("Strefa IANA", "timezone", l.timezone ?? "Europe/Warsaw") +
    input(
      "Ostrzeżenie (%)",
      "warningPercent",
      l.warningPercent ?? "",
      "number",
      false,
    ) +
    '</div><div class="full">' +
    action("remove-limit", "Usuń limit") +
    "</div></div>"
  );
}
function readLimits(form: HTMLFormElement) {
  return [...form.querySelectorAll(".limit")].map((el) => {
    const v = (name: string) =>
      (
        el.querySelector('[name="' + name + '"]') as
          | HTMLInputElement
          | HTMLSelectElement
      ).value;
    return {
      metricId: v("metricId"),
      mode: v("mode"),
      value: v("mode") === "LIMITED" ? v("value") : null,
      period: v("period"),
      anchor: v("anchor"),
      timezone: v("timezone"),
      warningPercent: v("warningPercent") ? Number(v("warningPercent")) : null,
    };
  });
}
function editDraft(versionId: string) {
  const v = getVersion(versionId);
  if (!v) {
    message = "Odśwież widok pakietów, aby otworzyć wersję.";
    render();
    return;
  }
  const p = getPackage(v.package_id),
    s = v.snapshot;
  modal(
    "Wersja robocza · v" + v.number,
    '<div class="grid">' +
      input("Nazwa wersji pakietu", "name", s.name) +
      input(
        "Cena oferty (opcjonalnie)",
        "price",
        s.price ?? "",
        "number",
        false,
      ) +
      input(
        "Waluta ceny (np. PLN)",
        "currency",
        s.currency ?? "PLN",
        "text",
        false,
      ) +
      '</div><fieldset class="fieldset"><legend>Funkcjonalności</legend>' +
      state!.capabilities
        .filter((c: Row) => c.products.includes(p.product_id))
        .map(
          (c: Row) =>
            '<label class="check"><input type="checkbox" name="capabilities" value="' +
            c.id +
            '" ' +
            (s.capabilities.includes(c.id) ? "checked" : "") +
            ">" +
            escape(c.name) +
            "</label>",
        )
        .join("") +
      '</fieldset><h3>Limity</h3><p class="small">Jedna metryka może wystąpić raz. Wybierz odpowiadającą jej funkcjonalność. Cena oferty nie jest kosztem API Profitii. Brak limitu nie oznacza automatycznego UNMETERED.</p><div id="limits">' +
      s.limits.map(limitRow).join("") +
      "</div>" +
      action("add-limit", "+ Dodaj limit") +
      '<div class="notice">Publikacja zamraża wersję. Nowa oferta nie zmieni istniejących przypisań. UNMETERED nie wyłącza kontroli technicznych.</div>',
    async (d, f) => {
      await write("draft.save", {
        versionId: v.id,
        revision: v.revision,
        snapshot: {
          name: val(d, "name"),
          capabilities: d.getAll("capabilities").map(String),
          limits: readLimits(f),
          price: val(d, "price") || null,
          currency: val(d, "currency") || null,
        },
      });
      await done(
        "Zapisano wersję roboczą. Opublikuj ją ze szczegółów pakietu.",
      );
      packageDetail(v.package_id);
    },
  );
}
function packageDetail(packageId: string) {
  const p = getPackage(packageId);
  if (!p) return;
  modal(
    p.name,
    "<p>" +
      escape(productName(p.product_id)) +
      " · " +
      tag(p.archived ? "Archiwum" : "Oferta dostępna") +
      "</p>" +
      p.versions
        .map(
          (v: Row) =>
            '<section class="fieldset"><h3>Wersja ' +
            v.number +
            " · " +
            tag(v.state) +
            "</h3><p>" +
            escape(v.snapshot.name) +
            '</p><p class="small">' +
            v.snapshot.capabilities
              .map(
                (id: string) =>
                  state!.capabilities.find((c: Row) => c.id === id)?.name ?? id,
              )
              .map(escape)
              .join(" · ") +
            "</p>" +
            table(
              ["Metryka", "Tryb i wartość", "Okres"],
              v.snapshot.limits.map(
                (l: Row) =>
                  "<tr><td>" +
                  escape(
                    state!.metrics.find((m: Row) => m.id === l.metricId)
                      ?.name ?? l.metricId,
                  ) +
                  "</td><td>" +
                  escape(l.mode) +
                  " " +
                  escape(l.value ?? "") +
                  "</td><td>" +
                  escape(l.period) +
                  " / " +
                  escape(l.anchor) +
                  "<br>" +
                  escape(l.timezone) +
                  "</td></tr>",
              ),
            ) +
            '<div class="toolbar">' +
            (v.state === "DRAFT"
              ? action("edit-draft", "Edytuj roboczą", v.id) +
                action("publish", "Opublikuj wersję", v.id, true)
              : action("new-version", "Utwórz nową wersję", v.id)) +
            '</div><p class="small">' +
            (v.state === "PUBLISHED"
              ? "Opublikowano " +
                dateText(v.published_at) +
                " · niezmienna wersja."
              : "Rewizja robocza " + v.revision) +
            "</p></section>",
        )
        .join("") +
      '<div class="toolbar">' +
      action(
        p.archived ? "restore" : "archive",
        p.archived ? "Przywróć ofertę" : "Archiwizuj ofertę",
        p.id,
      ) +
      "</div>",
  );
}
const defaults = () => ({
  contractStart: today(),
  contractEnd: today().replace(/^\d{4}/, String(new Date().getFullYear() + 1)),
  assignmentStart: today(),
  assignmentEnd: today().replace(
    /^\d{4}/,
    String(new Date().getFullYear() + 1),
  ),
  usageStart: today(),
  usageCycle: "MONTH",
  usageAnchor: "CALENDAR",
  billingStart: today(),
  billingEnd: today().replace(/^\d{4}/, String(new Date().getFullYear() + 1)),
  invoiceDate: "",
  dueDate: "",
  timezone: "Europe/Warsaw",
  basis: "MANUAL_CONTRACT",
  reference: "",
  purchaseType: "MANUAL_SUBSCRIPTION",
});
function termsFields(t: Row) {
  return (
    '<fieldset class="fieldset"><legend>Podstawa komercyjna</legend><div class="grid">' +
    select(
      "Źródło",
      "basis",
      [
        ["MANUAL_CONTRACT", "Ręczna umowa"],
        ["DEVELOPMENT_TEST", "Dane testowe Development — bez płatności"],
      ],
      t.basis,
    ) +
    input("Referencja umowy lub testu", "reference", t.reference) +
    select(
      "Rodzaj zakupu",
      "purchaseType",
      [
        ["ONE_OFF", "Zakup jednorazowy"],
        ["MANUAL_SUBSCRIPTION", "Subskrypcja — ręczne odnowienie"],
      ],
      t.purchaseType,
    ) +
    input("Strefa IANA", "timezone", t.timezone) +
    '</div><p class="small">Źródłem praw jest zatwierdzona podstawa handlowa. Ten panel nie potwierdza płatności PSP, nie wystawia faktur i nie odnawia automatycznie umów.</p></fieldset><fieldset class="fieldset"><legend>Oddzielne okresy</legend><div class="grid">' +
    input("Umowa od", "contractStart", t.contractStart, "date") +
    input("Umowa do (wyłącznie)", "contractEnd", t.contractEnd, "date") +
    input("Przypisanie od", "assignmentStart", t.assignmentStart, "date") +
    input(
      "Przypisanie do (wyłącznie)",
      "assignmentEnd",
      t.assignmentEnd,
      "date",
    ) +
    input("Wykorzystanie od", "usageStart", t.usageStart, "date") +
    select(
      "Cykl wykorzystania",
      "usageCycle",
      [
        ["MONTH", "Miesięczny"],
        ["YEAR", "Roczny"],
      ],
      t.usageCycle,
    ) +
    select(
      "Kotwica wykorzystania",
      "usageAnchor",
      [
        ["CALENDAR", "Kalendarz"],
        ["ASSIGNMENT", "Od aktywacji"],
      ],
      t.usageAnchor,
    ) +
    input("Okres billing od", "billingStart", t.billingStart, "date") +
    input("Okres billing do (wyłącznie)", "billingEnd", t.billingEnd, "date") +
    input(
      "Data faktury (opcjonalnie)",
      "invoiceDate",
      t.invoiceDate,
      "date",
      false,
    ) +
    input(
      "Termin płatności (opcjonalnie)",
      "dueDate",
      t.dueDate,
      "date",
      false,
    ) +
    '</div><p class="small">Koniec okresu jest wyłączny. Brak automatycznego trial, grace, proration i przenoszenia jednostek.</p></fieldset>'
  );
}
function readTerms(d: FormData) {
  const keys = [
    "contractStart",
    "contractEnd",
    "assignmentStart",
    "assignmentEnd",
    "usageStart",
    "usageCycle",
    "usageAnchor",
    "billingStart",
    "billingEnd",
    "invoiceDate",
    "dueDate",
    "timezone",
    "basis",
    "reference",
    "purchaseType",
  ];
  return Object.fromEntries(keys.map((k) => [k, val(d, k) || null]));
}
function assignmentForm(organisationId = "", a?: Row) {
  const p = a?.payload,
    t = p?.terms ?? defaults();
  const versions = state!.packages
    .filter((k: Row) => !k.archived && (!a || k.product_id === a.product_id))
    .flatMap((k: Row) =>
      k.versions
        .filter((v: Row) => v.state === "PUBLISHED")
        .map((v: Row) => [
          v.id,
          k.name + " · v" + v.number + " · " + productName(k.product_id),
        ]),
    ) as [string, string][];
  if (!versions.length) {
    message = "Najpierw opublikuj wersję pakietu.";
    view = "packages";
    render();
    return;
  }
  modal(
    a ? "Wersjonowana zmiana przypisania" : "Nowe przypisanie",
    '<p class="small">Wybierz organizację z katalogu Identity. Nie wpisuj identyfikatora użytkownika ani NIP jako uprawnienia.</p><div class="grid">' +
      input(
        "Nazwa organizacji do wyszukania",
        "organisationQuery",
        orgName(organisationId),
        "text",
        false,
      ) +
      '<div class="row">' +
      action("modal-search-org", "Wyszukaj organizację") +
      '</div><label class="wide">Organizacja<select name="organisationId" required>' +
      [...organisations, ...(state!.organisations ?? [])]
        .filter(
          (o: Row, i: number, arr: Row[]) =>
            arr.findIndex((x) => x.organisation_id === o.organisation_id) === i,
        )
        .map(
          (o: Row) =>
            '<option value="' +
            escape(o.organisation_id) +
            '" ' +
            (o.organisation_id === (a?.organisation_id ?? organisationId)
              ? "selected"
              : "") +
            ">" +
            escape(o.display_name) +
            " · " +
            escape(o.organisation_id) +
            "</option>",
        )
        .join("") +
      "</select></label>" +
      select(
        "Opublikowany pakiet",
        "packageVersionId",
        versions,
        p?.packageVersionId,
      ) +
      input(
        "Zmiana skuteczna od (dzisiaj = chwila zapisu)",
        "effectiveFrom",
        a
          ? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
          : today(),
        "date",
      ) +
      "</div>" +
      termsFields(t) +
      '<h3>Wyjątki organizacji</h3><p class="small">Wyjątek ma własny powód i rewizję. Nie zmienia wersji pakietu.</p><div id="limits">' +
      (p?.overrides ?? []).map(limitRow).join("") +
      "</div>" +
      action("add-limit", "+ Dodaj wyjątek") +
      '<div class="fieldset"><label>Powód przypisania / zmiany<textarea name="reason" required maxlength="1000">' +
      escape(p?.reason ?? "") +
      '</textarea></label><label class="check"><input type="checkbox" name="confirmed" required>Potwierdzam podstawę ręcznej umowy lub wyraźnie oznaczonych danych testowych Development.</label></div>' +
      pending,
    async (d, f) => {
      const data: Row = {
        organisationId: val(d, "organisationId"),
        packageVersionId: val(d, "packageVersionId"),
        terms: readTerms(d),
        overrides: readLimits(f),
        reason: val(d, "reason"),
        effectiveFrom: val(d, "effectiveFrom"),
      };
      if (a) {
        data.assignmentId = a.id;
        data.revision = a.revision;
      }
      await write(a ? "assignment.change" : "assignment.create", data);
      await done(
        "Zapisano przypisanie i niezmienny ślad historii. Uprawnienia techniczne nadal oczekują na integrację.",
      );
      view = "assignments";
      render();
    },
  );
}
function assignmentDetail(id: string) {
  const a = getAssignment(id);
  if (!a) return;
  const p = a.payload,
    t = p.terms;
  modal(
    "Przypisanie · " + orgName(a.organisation_id),
    '<dl class="definition"><dt>Produkt</dt><dd>' +
      escape(productName(a.product_id)) +
      "</dd><dt>Pakiet ostatniej rewizji</dt><dd>" +
      escape(p.packageSnapshot.name) +
      "</dd><dt>Rewizja / status</dt><dd>" +
      a.revision +
      " · " +
      tag(p.status) +
      "</dd><dt>Podstawa handlowa</dt><dd>" +
      escape(t.basis) +
      " · " +
      escape(t.reference) +
      "</dd><dt>Umowa</dt><dd>" +
      escape(t.contractStart) +
      " → " +
      escape(t.contractEnd) +
      " (wyłącznie)</dd><dt>Przypisanie</dt><dd>" +
      escape(t.assignmentStart) +
      " → " +
      escape(t.assignmentEnd) +
      " (wyłącznie)</dd><dt>Billing</dt><dd>" +
      escape(t.billingStart) +
      " → " +
      escape(t.billingEnd) +
      " (wyłącznie)</dd><dt>Faktura / płatność</dt><dd>" +
      escape(t.invoiceDate ?? "—") +
      " / " +
      escape(t.dueDate ?? "—") +
      "</dd><dt>Wykorzystanie</dt><dd>" +
      escape(t.usageStart) +
      " · " +
      escape(t.usageCycle) +
      " / " +
      escape(t.usageAnchor) +
      " · " +
      escape(t.timezone) +
      '</dd><dt>Organisation ID</dt><dd class="mono">' +
      escape(a.organisation_id) +
      "</dd><dt>Techniczne uprawnienia</dt><dd>" +
      tag("Niepodłączone — oczekujące", true) +
      "</dd></dl>" +
      pending +
      '<div class="toolbar">' +
      action("change-assignment", "Zmień przez nową rewizję", a.id, true) +
      action("status-assignment", "Zmień status", a.id) +
      '</div><h3>Historia niezmiennych rewizji</h3><div class="timeline">' +
      a.history
        .map(
          (h: Row) =>
            "<article><strong>Rewizja " +
            h.revision +
            " · od " +
            dateText(h.effective_at) +
            "</strong><p>" +
            escape(h.payload.packageSnapshot.name) +
            " · " +
            escape(h.payload.status) +
            "</p><p>" +
            escape(h.payload.reason) +
            '</p><p class="small">' +
            dateText(h.recorded_at) +
            " · operator " +
            escape(h.actor_id) +
            '</p><p class="small">Wyjątki: ' +
            (h.payload.overrides ?? [])
              .map(
                (l: Row) =>
                  escape(l.metricId) +
                  " " +
                  escape(l.mode) +
                  " " +
                  escape(l.value ?? ""),
              )
              .join(" · ") +
            "</p></article>",
        )
        .join("") +
      "</div>",
  );
}
async function handleAction(name: string, id: string, button: HTMLElement) {
  switch (name) {
    case "close":
      dialog?.close();
      break;
    case "logout":
      await window.Clerk.signOut({ redirectUrl: config.origin });
      break;
    case "refresh":
      message = "";
      await refresh();
      break;
    case "next":
      offset += 25;
      await refresh();
      break;
    case "previous":
      offset = Math.max(0, offset - 25);
      await refresh();
      break;
    case "go-assignments":
      view = "assignments";
      offset = 0;
      await refresh();
      break;
    case "new-package":
      newPackage();
      break;
    case "package-detail":
      packageDetail(id);
      break;
    case "edit-draft":
      editDraft(id);
      break;
    case "add-limit":
      document
        .getElementById("limits")!
        .insertAdjacentHTML("beforeend", limitRow());
      break;
    case "remove-limit":
      button.closest(".limit")?.remove();
      break;
    case "publish": {
      const v = getVersion(id);
      modal(
        "Opublikować wersję " + v.number + "?",
        "<p>Ta wersja będzie niezmienna. Kolejne zmiany utworzą nową wersję. Istniejące przypisania nie zostaną nadpisane.</p>",
        async () => {
          await write("version.publish", {
            versionId: id,
            revision: v.revision,
          });
          await done("Opublikowano niezmienną wersję pakietu.");
          packageDetail(v.package_id);
        },
        "Opublikuj",
      );
      break;
    }
    case "new-version": {
      const v = getVersion(id);
      modal(
        "Nowa wersja pakietu",
        "<p>Skopiujemy opublikowaną wersję do nowej wersji roboczej. Historia i aktywne umowy zachowają poprzednią wersję.</p>",
        async () => {
          const n = await write("version.create", {
            packageId: v.package_id,
            fromVersionId: id,
          });
          await done("Utworzono nową wersję roboczą.");
          editDraft(n.id);
        },
      );
      break;
    }
    case "archive":
    case "restore":
      modal(
        name === "archive" ? "Archiwizuj ofertę" : "Przywróć ofertę",
        '<p>Historia i istniejące przypisania zostaną zachowane.</p><label>Powód<textarea name="reason" required maxlength="1000"></textarea></label>',
        async (d) => {
          await write(
            name === "archive" ? "package.archive" : "package.restore",
            { packageId: id, reason: val(d, "reason") },
          );
          await done("Zapisano status oferty.");
        },
      );
      break;
    case "new-assignment":
      assignmentForm();
      break;
    case "assign-org":
      assignmentForm(id);
      break;
    case "assignment-detail":
      assignmentDetail(id);
      break;
    case "change-assignment": {
      const a = getAssignment(id);
      assignmentForm(a.organisation_id, a);
      break;
    }
    case "status-assignment": {
      const a = getAssignment(id);
      modal(
        "Wersjonowana zmiana statusu",
        '<div class="grid">' +
          select(
            "Nowy status",
            "status",
            [
              ["ENABLED", "Włączone"],
              ["SUSPENDED", "Wstrzymane"],
              ["CANCELLED", "Anulowane"],
            ],
            a.payload.status,
          ) +
          input("Skuteczny od", "effectiveFrom", today(), "date") +
          '</div><label>Powód<textarea name="reason" required maxlength="1000"></textarea></label><p class="small">Zmiana dopisze rewizję. Nie usuwa poprzedniej umowy ani historii.</p>',
        async (d) => {
          await write("assignment.status", {
            assignmentId: id,
            revision: a.revision,
            status: val(d, "status"),
            reason: val(d, "reason"),
            effectiveFrom: val(d, "effectiveFrom"),
          });
          await done("Dopisano zmianę statusu.");
        },
      );
      break;
    }
    case "modal-search-org": {
      const q = (
        dialog!.querySelector("[name=organisationQuery]") as HTMLInputElement
      ).value;
      if (!q.trim()) throw Error("Wpisz nazwę organizacji.");
      const r = await api("/api/organisations?q=" + encodeURIComponent(q));
      organisations = r.organisations;
      const s = dialog!.querySelector(
        "[name=organisationId]",
      ) as HTMLSelectElement;
      s.innerHTML = organisations
        .map(
          (o) =>
            '<option value="' +
            escape(o.organisation_id) +
            '">' +
            escape(o.display_name) +
            " · " +
            escape(o.organisation_id) +
            "</option>",
        )
        .join("");
      if (!organisations.length)
        throw Error("Nie znaleziono aktywnej organizacji.");
      break;
    }
    case "new-capability":
      modal(
        "Nowa funkcjonalność",
        '<div class="grid">' +
          input("Stabilny identyfikator (A–Z, cyfry, _)", "id") +
          input("Nazwa", "name") +
          '</div><label>Znaczenie<textarea name="description" required maxlength="1000"></textarea></label><fieldset class="fieldset"><legend>Produkty</legend>' +
          state!.products
            .map(
              (p: Row) =>
                '<label class="check"><input name="products" type="checkbox" value="' +
                p.id +
                '">' +
                escape(p.name) +
                "</label>",
            )
            .join("") +
          "</fieldset>",
        async (d) => {
          await write("capability.create", {
            id: val(d, "id"),
            name: val(d, "name"),
            description: val(d, "description"),
            products: d.getAll("products").map(String),
          });
          await done(
            "Dodano definicję funkcjonalności. Integracja techniczna nie została aktywowana.",
          );
        },
      );
      break;
    case "new-metric":
      modal(
        "Nowa metryka",
        '<div class="grid">' +
          input("Stabilny identyfikator (A–Z, cyfry, _)", "id") +
          input("Nazwa", "name") +
          input("Jednostka", "unit") +
          input("Źródło", "source") +
          select(
            "Funkcjonalność",
            "capabilityId",
            state!.capabilities.map((c: Row) => [c.id, c.name]),
          ) +
          '</div><label>Semantyka naliczania<textarea name="description" required maxlength="1000"></textarea></label><p class="small">Zmieniona semantyka lub jednostka wymaga nowego identyfikatora. Metryka nie uruchamia dostawcy.</p>',
        async (d) => {
          await write("metric.create", {
            id: val(d, "id"),
            name: val(d, "name"),
            unit: val(d, "unit"),
            source: val(d, "source"),
            capabilityId: val(d, "capabilityId"),
            description: val(d, "description"),
          });
          await done("Dodano definicję metryki.");
        },
      );
      break;
  }
}
document.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  if (b.dataset.view) {
    view = b.dataset.view;
    offset = 0;
    query = "";
    void refresh().catch(showError);
    return;
  }
  if (b.dataset.action) {
    b.disabled = true;
    void handleAction(b.dataset.action, b.dataset.id ?? "", b)
      .catch(showError)
      .finally(() => {
        b.disabled = false;
      });
  }
});
document.addEventListener("submit", (e) => {
  const form = e.target as HTMLFormElement;
  if (form.id === "modal-form") {
    e.preventDefault();
    if (!modalSubmit) return;
    const buttons = [...form.querySelectorAll("button")];
    buttons.forEach((b) => (b.disabled = true));
    document.getElementById("modal-error")!.innerHTML = "";
    void modalSubmit(new FormData(form), form)
      .catch(showError)
      .finally(() => buttons.forEach((b) => (b.disabled = false)));
  }
  if (form.id === "search") {
    e.preventDefault();
    query = val(new FormData(form), "q");
    offset = 0;
    void refresh().catch(showError);
  }
  if (form.id === "organisation-search") {
    e.preventDefault();
    void api(
      "/api/organisations?q=" +
        encodeURIComponent(val(new FormData(form), "q")),
    )
      .then((r) => {
        organisations = r.organisations;
        render();
      })
      .catch(showError);
  }
});
document.addEventListener("change", (e) => {
  const target = e.target as HTMLInputElement;
  if (target.name === "mode") {
    const row = target.closest(".limit");
    const value = row?.querySelector("[name=value]") as
      | HTMLInputElement
      | undefined;
    if (value) {
      value.disabled = target.value !== "LIMITED";
      value.required = target.value === "LIMITED";
    }
  }
});
function showError(e: unknown) {
  if ((e as { stale?: boolean })?.stale) return;
  if ([401, 403].includes((e as { status?: number })?.status ?? 0)) {
    state = null;
    organisations = [];
    dialog?.close();
    accessScreen();
  }
  const target = document.getElementById(dialog ? "modal-error" : "notice");
  if (target)
    target.innerHTML =
      '<div class="notice error" role="alert">' +
      escape(
        e instanceof Error ? e.message : "Nie udało się wykonać operacji.",
      ) +
      "</div>";
}
function accessScreen() {
  root.innerHTML =
    '<main class="welcome"><div class="brand">P<span>Profitia</span></div><h1>Dostęp do panelu</h1><div id="notice" role="alert"></div><div class="toolbar">' +
    action("refresh", "Spróbuj ponownie") +
    action("logout", "Wyloguj") +
    "</div></main>";
}
async function sessionChanged() {
  const current = window.Clerk.session?.id ?? null;
  if (current === sessionId) return;
  sessionId = current;
  refreshGeneration++;
  state = null;
  organisations = [];
  dialog?.close();
  if (!current) {
    root.innerHTML =
      '<main class="welcome"><div class="brand">P<span>Profitia</span></div><h1>Pakiety i limity</h1><p>Bezpieczny panel operatora Profitii.</p><span class="environment">Development</span><div id="sign-in" class="signin"></div></main>';
    window.Clerk.mountSignIn(document.getElementById("sign-in"), {
      routing: "hash",
      withSignUp: false,
      forceRedirectUrl: config.origin,
    });
    return;
  }
  root.innerHTML =
    '<main class="welcome"><h1>Sprawdzamy uprawnienie operatora…</h1><p role="status">Proszę chwilę poczekać.</p></main>';
  try {
    await refresh();
  } catch (e) {
    if (
      (e as { stale?: boolean })?.stale ||
      current !== (window.Clerk.session?.id ?? null)
    )
      return;
    accessScreen();
    showError(e);
  }
}
window.addEventListener("load", () => {
  void (async () => {
    if (!window.Clerk)
      throw Error(
        "Nie udało się załadować bezpiecznego logowania. Odśwież stronę.",
      );
    await window.Clerk.load({
      ui: { ClerkUI: window.__internal_ClerkUICtor },
      localization: config.localization,
      signInUrl: config.origin,
    });
    sessionId = "initial";
    await sessionChanged();
    window.Clerk.addListener(() => {
      void sessionChanged().catch(showError);
    });
  })().catch((e) => {
    root.innerHTML =
      '<main class="welcome"><h1>Logowanie jest chwilowo niedostępne</h1><p>' +
      escape(e.message) +
      "</p></main>";
  });
});
export {};
