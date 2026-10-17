# E1 — lokalny moduł Supplier Intelligence w kontrolowanym CI, 17.10.2026

**Zadanie:** ARCHITECTURE-E1-LOCAL-SUPPLIER-MODULE-CI-20261017, ARCHITECTURE / SG-dev Architecture / development / local. Begin cmvcp7zoo00009urime2ks903; conversationId pmos-task-v2:be31701b47517fa70793305dda0ab94e2f67277d7fb3442ade4d4f4878d00aff. Rejestracja nie jest dowodem closeout. Jest to zależność osobnego przyjęcia modułu przez SG2 w zaakceptowanym E1, nie nowe upoważnienie do wydania.

## Problem i zmiana

Dotychczasowa polityka kontrolera dopuszczała trzy przypięte prywatne pakiety i lokalny platform-contracts, lecz odrzucała istniejący srm-xray. Pakiet Supplier Intelligence znajduje się już w tym samym repozytorium. Nie potrzeba nowego pakietu w rejestrze, nowej tożsamości, tokenu ani praw dostępu.

Dopuszczone lokalne źródła są zamkniętą mapą nazw i dokładnych ścieżek: @profitia/platform-contracts → packages/platform-contracts oraz @profitia/srm-xray → packages/srm-xray. Manifest i lockfile muszą wskazywać własny file target; wpis musi być top-level, bez link/alias/registry replacement. Rzeczywista ścieżka i manifest nie mogą być dowiązaniami. Nazwa i wersja manifestu muszą odpowiadać lockfile. Wymagana jest istniejąca definicja lokalnego pakietu w trusted authority, a jego zależności/overrides/workspaces są sprawdzane tą samą polityką bez importu JavaScript. Weryfikacja jest wykonywana przed credential install i ponawiana przez istniejący checkCandidate.

Zachowano dokładne trzy prywatne nazwy i authority pins/integrity, konfigurację npm, main-only environment i actor, dopuszczenie tylko własnego przeglądanego SG2 PR oraz exact SHA. Polityki tokenu, credential phase, proof, digestu i workflow nie zmieniono. Nie poszerzono Manage Actions access, widoczności pakietów ani uprawnień tokenu. Nowa polityka ma własny digest wynikający z rzeczywistego source; nie ma wyjątku dla starych digestów.

## Walidacja lokalna

37 testów kontrolera, governance i workspace PASS, zero skipped. Sam kontroler ma14 testów. Pozytywne i negatywne przypadki obejmują obie dokładne lokalne mapy, registry/alias/nested/link/path substitution, brak authority, nazwę/wersję, dodatkowe prywatne zależności, workspaces i overrides oraz rzeczywiste dowiązania katalogu i manifestu.

Test na aktualnym SG2 lockfile i obu istniejących manifestach potwierdził dotychczasowe zależności i ograniczone dodanie lokalnego srm-xray w kopii pamięciowej; wszystkie trzy prywatne rekordy pozostają dokładnie równe. Nie zmieniono plików zależności aplikacji.

Rzeczywisty syntetyczny npm ci --install-links --ignore-scripts --offline potwierdził kopiowanie lokalnego źródła i brak wykonania prepare/postinstall z poświadczeniem testowym. Następny npm rebuild uruchomił lifecycle dopiero bez credentiala. Fixture nie używa sieci, rzeczywistego tokenu ani bazy. Pierwsza asercja actual-path miała błąd dekodowania spacji URL w samym teście; zastosowano fileURLToPath i ponowiono wszystkie37 testów bez zmiany wymagań produktu.

## Przyjęcie i granice dowodu

PR polityki może zachować niezmienione zależności SG2 i przejść kontrolowany tor z aktualnego trusted main w osobnym zadaniu kompatybilności SG2. Publiczny weryfikator PR pobiera kontroler z aktualnego main, nie z gałęzi kandydata; nowy kontroler otrzymuje testy bez poświadczeń. Po merge nowa polityka generuje nowe dowody dla exact main. Nie wprowadza się dodatkowego trybu bootstrap ani kontrolera przejściowego.

Osobne zadanie SG2 dopiero przyjmie moduł w rzeczywistym chronionym przepływie i osobno zweryfikuje UI React18. Dopuszczenie local source nie oznacza, że wszystkie komponenty React19 mają zgodność18. W tym przyroście nie zmieniono produktu, receipt, wspólnego kontraktu, dependency pins, kluczy, chmurowej konfiguracji lub baz. Brak deploymentu; pełne E1 i wydania Development/Staging nie są odebrane.

Źródła: [runbook CI](../runbooks/controlled-package-ci-v1.md), [publiczny port modułu](2026-10-17-srm-supplier-summary-public-port.md), [wspólny odczyt finansowy](2026-10-17-srm-shared-financial-read-port.md). Źródłowe testy lokalne nie zastępują wyniku dokładnego zdalnego CI ani kanonicznego closeout tej jednostki.
