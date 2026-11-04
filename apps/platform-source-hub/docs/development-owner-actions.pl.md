# Source Hub Development — brakujące czynności właściciela

Stan zweryfikowany 4 listopada 2026: właściwe projekty i branche Neon istnieją; na branchach Development istnieje wyłącznie `neondb_owner`. W PROFITIA WORKSPACE nie istnieją jeszcze `profitia-source-hub-development` ani `profitia-newsfeed-api-development`. Codex nie tworzy ani nie konfiguruje zasobów, ról lub sekretów.

Bazą jest przyjęty Stage2A `addffa47dda40c96af263973c61aa6652fb74b08` / PR885. Nowe rozszerzenia pozostają kandydatem do kontrolowanego przyjęcia; ich końcowy SHA będzie zapisany w handoffie. Nie wybierać roboczego PR do uruchomienia.

## 1. Przygotuj role w dwóch istniejących branchach Development

| Capability | Projekt | Branch | Endpoint direct / baza |
|---|---|---|---|
| Hub | `delicate-queen-44677134` | `br-orange-salad-ba2llks7` | `ep-noisy-darkness-barhqoqw.c-8.eu-central-1.aws.neon.tech` / `neondb` |
| Newsfeed | `shiny-bonus-85532609` | `br-wispy-bonus-b9ohunab` | `ep-mute-night-b9o332my.c-7.eu-central-1.aws.neon.tech` / `neondb` |

Wykonaj dokładne dwa bloki SQL z [runbooka, sekcja 2](stage2b-activation.pl.md#2-role-postgresql--właściciel-przygotowuje-ręcznie). Są to NOLOGIN ownerzy oraz osobne loginy runtime, Source runtime i migratorów. Nie używaj `neondb_owner` w usługach. Ustaw hasła bezpośrednio w Neon/menedżerze sekretów. Nie twórz nowych projektów, baz, branchy ani endpointów. Staging i Production pozostają bez zmian.

Przed pierwszą migracją przygotuj i potwierdź odtwarzalną kopię/snapshot Development. Nie kopiuj danych Production. Dwa połączenia direct migratorów zapisz w prywatnym lokalnym pliku 0600 poza repo, jako `SOURCE_HUB_MIGRATOR_DATABASE_URL` i `NEWSFEED_MIGRATOR_DATABASE_URL`. Udostępnij lokalizację tego pliku, nie jego zawartość. Migracje wykona Codex dopiero po sprawdzeniu ról, SHA i procedury odzyskania. Migratory nie należą do konfiguracji usług Render.

## 2. Przygotuj bieżące przyjęcia E1, Source i licencje

Właściwy owner Identity/E1 przyjmuje obie aplikacje `profitia-source-hub-development` i `profitia-newsfeed-api-development`, ich zwykłe runtime bindings oraz aktualne tożsamości/członkostwa/granty i mechanizm odwołania zgodnie z [sekcją 4 runbooka](stage2b-activation.pl.md#4-przyjęcie-e1-i-dopuszczenie-source). Nie kopiuj tożsamości ani grantów z fixture. Potrzebne są rzeczywiste konta testowe i co najmniej dwie organizacje do prób izolacji. Sam klucz M2M nie przyznaje tych praw.

Właściwy owner Source przyjmuje ograniczony login `source_hub_development_source_runtime`, dokładne definicje Source z kodu `src/admission.mjs`, polityki transportu, skończone budżety i aktualne metadane licencji. Odczyt definicji bez sekretów:

```sh
node --input-type=module -e "const m=await import('./apps/platform-source-hub/src/admission.mjs'); console.log(JSON.stringify(Object.keys(m.SOURCE_DEFINITIONS).map(k=>m.sourceDefinition(...k.split(':'))),null,2))"
```

Rozszerzenie TE News wymaga osobnego `source-hub.trading-economics.news-discovery` / `api.trading-economics.news-discovery`. Prognozy rynkowe wymagają jawnego przyjęcia pięciu dokładnych ścieżek kategorii `/markets/forecasts/{category}` i rzeczywistego uprawnienia API; przyjęcie prognoz wskaźników go nie dowodzi. Nie nadpisuj istniejącej niezmiennej polityki native: nowa definicja otrzymuje nowe ID i właściwe przyjęcie. Nie aktywuj opcjonalnego Markets bez potwierdzenia, że konsument go wymaga i licencja go obejmuje. Dopiero wtedy owner licencji ustawia `allow_market_forecasts=true`, a owner Source przyjmuje dokładne reguły z `sourceDefinition("trading-economics","external-forecasts",{includeMarketForecasts:true})`. Domyślna definicja ich nie zawiera. Symbol jest filtrem lokalnym w natywnej kategorii; nie deklarować pełności tego podzbioru.

Potwierdź licencję NewsAPI, Brave i właściwych rodzin TE: prywatne użycie konsumenta, zakres danych, retencję, ponowną dystrybucję oraz mały limit rzeczywistych prób i okno czasowe. Tekst Brave pozostaje fragmentem wyszukiwarki; nie jest pełnym, zweryfikowanym artykułem. Nie ustawiaj unlimited ani fikcyjnych ALLOW. Identyfikatory przyjęć/licencji i limity są jawne; klucze pozostają prywatne.

## 3. Utwórz i skonfiguruj dwie brakujące usługi Development

W istniejącym projekcie Render `prj-dbl079ou01pc73eg0ffg`, środowisku `evm-dbl079ou01pc73eg0fgg`, workspace `tea-d7lps8rbc2fs73cn80dg`: dwie **Web Service**, repo `profitia/SG-dev`, branch `main`, Frankfurt, compute `0.5c-512mb`, jedna instancja. Root Directory pusty (pełne monorepo). Auto-deploy Off, previews Off. Health `/ready`. Node `24.15.0`; procesy nasłuchują `0.0.0.0:$PORT`. Bez cronów, workerów, nowych domen i deploy hooks.

| Nazwa | Build command | Start command |
|---|---|---|
| `profitia-source-hub-development` | `npm --prefix apps/platform-source-hub ci --include=dev --install-links --ignore-scripts --no-audit --no-fund && npm --prefix apps/platform-source-hub run build` | `npm --prefix apps/platform-source-hub start` |
| `profitia-newsfeed-api-development` | `npm --prefix apps/newsfeed-runtime ci --include=dev --install-links --ignore-scripts --no-audit --no-fund && npm --prefix apps/newsfeed-runtime run build` | `npm --prefix apps/newsfeed-runtime start` |

Utworzenie usługi może rozpocząć pierwszą próbę uruchomienia. Najpierw przygotuj role, odzyskanie i przyjęcia. Nie uznawaj takiej automatycznej próby za odbiór. Przed kontrolowanym deploymentem muszą być dostępne dwa faktyczne originy i zgodna konfiguracja obu stron.

W usługach ustaw pełny katalog nazw i przeznaczeń zmiennych z [sekcji 6 runbooka](stage2b-activation.pl.md#6-pełny-katalog-środowiska). Każda zmienna ma tam przypisaną usługę i status sekretu. Wspólne muszą być dwa originy oraz identyfikator i sekret tej jednej pary M2M. Runtime URL używają pooled hostów i tylko ograniczonych ról. Wartości `deploymentId` i `configurationVersion` uzgodnij z bindingami E1/Source. Używaj Development Clerk `sk_test_` / `pk_test_`, przyjętego issuer i dokładnych authorized parties obejmujących origin Newsfeed. Nie rozszerzaj wildcardów dla wygody.

Wyłącznie w Hub ustaw trzy sekrety dostawców: `SOURCE_HUB_DEVELOPMENT_NEWSAPI_API_KEY`, `SOURCE_HUB_DEVELOPMENT_BRAVE_API_KEY`, `SOURCE_HUB_DEVELOPMENT_TRADING_ECONOMICS_API_KEY`. Klucze były wcześniej przekazane w prywatnych plikach; wymagają zapisania w odpowiedniej usłudze, nie ponownego przesłania na czat. `SOURCE_HUB_PEER_KEY_B64` zawiera ten sam losowy sekret pary w obu usługach. Migrator URL pozostają poza Render. Wybieraj Save only przy zmianach środowiska, aby nie uruchamiać niekontrolowanych wdrożeń.

## 4. Przekaż tylko metadane, a Codex wykona autoryzowaną aktywację

Przekaż dwa service ID i HTTPS originy, potwierdzenie Development/Frankfurt/auto-deploy Off, nazwy ról, lokalizację chronionego pliku migratorów oraz jawne referencje odzyskania/E1/Source/licencji i skończonego budżetu. Dla sekretów tylko informację „ustawiono w odpowiedniej usłudze”. Nie przesyłaj haseł, connection strings, tokenów sesji ani kluczy API.

Po weryfikacji tych warunków Codex wykona migracje Development, kontrolowany deployment dokładnego przyjętego SHA i ograniczone scenariusze biznesowe. Obecnie nie ma poprzedniego LKG produktu. Procedura pierwszego nieudanego wdrożenia musi pozwalać zatrzymać nowe usługi/operacje i odwołać nowe dopuszczenia; nie cofa SG2/SRM ani nie kasuje danych. Nie wykonywać DROP w ramach rollbacku aplikacji.

Kalendarz i Procurement Insights mają nadal nieprzyjęte propozycje governance. Ten etap nie nadaje im fikcyjnych tożsamości ani praw; dopóki ich runtime i odbiór nie są aktywne, dowód dotyczy danych Hub i kontraktu wejściowego, nie wdrożenia całych aplikacji.
