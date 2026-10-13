# E0-A-04: trzy odrębne przestrzenie Development

**Status:** ACTIVE_RUNBOOK — przygotowanie przestrzeni nie zastępuje aktywacji profilu ani odbioru równoległości.

**Wersja:** 1.0, 13 października 2026.

Źródłem konfiguracji jest [rejestr przestrzeni](../registries/development-workspaces-v1.json). Każda przestrzeń korzysta z osobnego checkoutu SG-dev, instalacji zależności, lokalnych konfiguracji, katalogów PMOS i klonu profitia/project-history-repository na main. Implementacja PMOS pozostaje wspólna.

## Przygotowanie lokalne

Z aktualnego checkoutu profitia/SG-dev uruchom dla każdego klucza SG2, SRM i ARCHITECTURE:

```bash
node scripts/governance/development-workspace.mjs prepare --project SG2 --parent /absolute/path/to/development
```

Polecenie pobiera świeży main, tworzy nowy checkout na odłączonym HEAD i własny klon PHR. Nie resetuje istniejącego katalogu, nie nadpisuje konfiguracji ani pracy. Istniejąca przestrzeń musi mieć właściwe repozytorium, aktualny main i brak zmian. Przygotowanie ARCHITECTURE jest dozwolone przed aktywacją, lecz nie pozwala rozpocząć zwykłego zadania z nieaktywnym profilem.

Zależności instaluje się osobno w danej przestrzeni:

```bash
node scripts/governance/development-workspace.mjs install --project SG2 --root /absolute/path/to/development/sg2
node scripts/governance/development-workspace.mjs install --project SG2 --root /absolute/path/to/development/sg2 --product
```

Pierwsza wersja instaluje PMOS i generuje jego klienta. `--product` dodatkowo instaluje wskazane aplikacje; SG2 wymaga dostępu do istniejących prywatnych pakietów Profitia. Nie współdzieli się node_modules, katalogów buildu ani połączeń między przestrzeniami. Dane uwierzytelniające pozostają w chronionej konfiguracji, nigdy w rejestrze lub raporcie.

## Tożsamość i połączenia

Root `.env.local` przechowuje niesekretne powiązanie przestrzeni z kluczem projektu, Development i dedykowanym klonem PHR. `apps/pmos/.env.local` otrzymuje wyłącznie połączenia właściwe dla PMOS wybranego profilu, jego nazwę projektu/przestrzeni, TARGET_ENVIRONMENT i politykę Memoros. Konfiguracji innego profilu nie kopiuje się jako szablonu sekretów.

```bash
node scripts/governance/development-workspace.mjs check --project SG2 --root /absolute/path/to/development/sg2 --require-config
```

Pełne sprawdzenie odrzuca błędny projekt, środowisko, host lub nazwę bazy, niewłaściwy klon PHR i nieaktywny profil. Jeżeli profil deklaruje ograniczoną rolę runtime, jest ona również egzekwowana. Bez `--require-config` sprawdza się przygotowanie, nie gotowość do zapisu.

| Tor | PMOS lokalnie | Aplikacja/laboratorium |
| --- | --- | --- |
| SG2 | 3201 | runtime 3001, dashboard 3002 |
| SRM | 3202 | runtime 3400 |
| ARCHITECTURE | 3203 | laboratoryjny adapter 3500 |

Port PMOS należy przekazać jawnie do Next (`node node_modules/next/dist/bin/next dev --port 3201` z apps/pmos). Dotychczasowe skrypty produktu zachowują swoje porty. Przyszły most z 09 wybierze port i kontekst automatycznie po pełnych bramkach.

## Codespaces

Wybierz właściwy devcontainer: `.devcontainer/sg2`, istniejący `.devcontainer/srm` albo `.devcontainer/architecture`. Każdy Codespace jest odrębnym wykonawcą. Po uruchomieniu wykonaj `bind --project <KEY> --parent /workspaces/history` i instalację z powyższych poleceń. Wymagany zapis PHR korzysta z permissions contents:write w konfiguracji Codespaces.

Konfiguracja devcontainer jest receptą uruchomienia. Sam plik lub lokalna próba nie potwierdza utworzenia i działania chmurowego Codespace. Źródła i wdrożenia cloud mają odrębne dowody.

## Granice

PMOS `.pmos`, `.context`, pending, closeout i lock są lokalne dla checkoutu. Żaden workspace nie jest właścicielem wszystkich projektów tylko dlatego, że zawiera całe monorepo. Przed zadaniem trzeba utworzyć krótki branch, załadować kanon, wykonać pełny preflight i zarejestrować własny taskId. Trzy przestrzenie i ich porty nie są Organisation ID ani User ID produktu.

Po 04 aktywacja, rzeczywiste zapisy ARCHITECTURE i próba trzech torów wymagają 05–08. Istniejące bazy produktu, Staging/Production, CIC i historyczny freeze są zachowane.
