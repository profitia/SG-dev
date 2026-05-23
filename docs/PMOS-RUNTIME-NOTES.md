# PMOS Runtime Notes — SpendGuru 2.0

> Last updated: 2026-05-23

---

## Czym jest PMOS

PMOS (Project Memory Operating System) to embedded runtime continuity layer dla SpendGuru 2.0.

PMOS zapewnia:
- **Continuity** — każda sesja developerska zaczyna się od pełnego kontekstu projektu, nie od zera
- **Governance** — decyzje architektoniczne, zasady kanoniczne i ostrzeżenia są trwale zapisane
- **Lineage** — historia tego co zostało zbudowane, dlaczego i co się zmieniło
- **Roadmap** — ETAP roadmap jest jedynym source of truth dla tego co jest robione i co będzie

PMOS działa jako Next.js 14 app na porcie 3200 z Prisma + Neon PostgreSQL.
Context file (`runtime-context.md`) jest generowany przez `npm run context:build`.

---

## Czym NIE jest PMOS

PMOS **nie jest**:

- Produktem do sprzedaży ani platformą SaaS
- Dashboardem projektowym (Jira, Linear, Notion)
- Runtime orchestratorem SG2 (to rola LangGraph + Trigger.dev)
- Systemem zarządzania kodem (to rola Git)
- AI governance engine
- Osobnym repozytorium ani extractowanym frameworkiem
- Częścią UI SG2 widoczną dla użytkowników końcowych

---

## Dlaczego nie rozwijamy teraz platformy PMOS

SpendGuru 2.0 jest projektem greenfield. Celem jest zbudowanie działającego produktu procurement AI,
nie zbudowanie narzędzi deweloperskich.

PMOS ma pozostać **invisible** — użyteczny bez wymagania uwagi. Każda godzina poświęcona rozwijaniu
PMOS jako platformy to godzina odjęta od budowania SG2.

Aktualny zakres PMOS jest wystarczający:
- Runtime context generuje się i jest gotowy do injekcji w każdej sesji
- Governance artifacts są zapisywane przez PMOS UI (port 3200)
- Conversation lineage jest dostępny przez filesystem persistence
- Offline fallback zapewnia że `context:build` nigdy nie crashuje

Jeśli PMOS wymaga rozbudowy — powinna to być odpowiedź na konkretny, nazwany problem z SG2,
nie generalne ulepszanie narzędzia.

---

## Embedded runtime philosophy

PMOS jest embeddowany w SG-dev jako subdirectory (`apps/pmos/`), nie jako zewnętrzna zależność.

Oznacza to:
- Brak wersjonowania PMOS niezależnie od SG2
- Brak zewnętrznych API calls z SG2 do PMOS (PMOS jest dev-time only)
- PMOS nie jest wdrażany na produkcję razem z SG2
- PMOS uruchamiany lokalnie przez dewelopera, nie przez CI/CD

---

## Continuity-first philosophy

Każda zmiana architektoniczna w SG2 wymaga zapisu w PMOS zanim trafi do kodu.

Kolejność:

1. Decyzja architektoniczna → ADR w PMOS (`/decisions/`)
2. Implementacja
3. ETAP completion → ExecutionLog w PMOS
4. `npm run context:build` → odświeżony `runtime-context.md`

Jeśli ADR nie istnieje — decyzja nie jest udokumentowana i nie buduje ciągłości.
Jeśli `runtime-context.md` jest stary — następna sesja zaczyna się bez aktualnego kontekstu.

---

## Uruchamianie PMOS

```bash
cd apps/pmos && npm run dev      # start na porcie 3200
npm run context:build            # generuj runtime-context.md (z apps/pmos/)
npm run context:build -- --offline  # offline fallback bez dev servera
```

PMOS dashboard: http://localhost:3200

---

## Struktura runtime files

```
apps/pmos/
  .context/
    runtime-context.md           # injected into AI context (auto-generated)
  .pmos/
    conversations/
      logs/                      # ConversationEntry JSON files (lineage events)
      snapshots/                 # Context snapshots (lightweight metadata)
    governance/
      decisions/                 # ADR JSON files
      principles/                # Principle JSON files
      warnings/                  # Warning JSON files
      findings/                  # Findings JSON files
  src/lib/pmos/
    conversation-persistence.ts  # appendConversationEntry / getRecentEntries
    governance-reader.ts         # defensive filesystem governance reader
```
