# Price Change Index — SG2 Development, etap 1

**ODBIÓR OTWARTY: korekta C07 w natywnym dialogu C27.** Wszystkie dane oraz procesy produktu są syntetyczne i lokalne. Zapis oznacza zmianę pamięci demonstracji. Nie jest zapisem do systemu biznesowego.

Demonstracja: [wersja 1](https://price-change-index.onrender.com/v1), [wersja 2](https://price-change-index.onrender.com/v2), [wersja 3](https://price-change-index.onrender.com/v3). [Minimalny odrębny host](https://price-change-index.onrender.com/portable) pokazuje montowanie, reset i odmontowanie publicznego komponentu. Oba motywy są dostępne również przez `?theme=dark`.

## Tożsamość wydania

| Zasób | Faktyczna wartość |
| --- | --- |
| Właściciel / profil / cel | SG2 / SG-dev / development |
| GitHub authority | profitia/SG-dev, main |
| Workspace Render | PROFITIA WORKSPACE — tea-d7lps8rbc2fs73cn80dg |
| Istniejący projekt | SpendGuru 2.0 Actual — prj-dap98ddg1s2s739ssatg |
| Istniejące środowisko | Development — evm-dap98hm0tbcc738rro10 |
| Nowy Web Service | Price Change Index — srv-dbfnd3jrjlhs73epihvg |
| URL | https://price-change-index.onrender.com |
| Bieżący deploy, korekta C07 w toku | dep-dbfplnmc6qcc73fvuc40 |
| Wdrożony zaakceptowany SHA main | 11d4211b49108324b094bb88688f8741f53645af |
| Auto-deploy / preview | wyłączone / wyłączone |
| Konfiguracja | Node 24, Frankfurt, jedna instancja 0.5c-512mb |

Nie utworzono projektu Render. Pierwszy deploy `dep-dbfnd4jrjlhs73epimn0` / `d792044040703994968c164da5cae74982c3d60d` pozostaje historyczny i nie jest LKG 1:1. Dotychczas powstały dwa planowane deploye. Dodatkowa kontrola waluty C07 w natywnym C27 wykazała niedostępny popup; lokalna korekta kodu wymaga nowego kontrolowanego wydania po przyjęciu main.

PR-y: [734 — onboarding](https://github.com/profitia/SG-dev/pull/734), [735 — implementacja](https://github.com/profitia/SG-dev/pull/735), [736 — korekty i zatwierdzone selektory mobilne](https://github.com/profitia/SG-dev/pull/736). PR737 zawiera historyczny odbiór175 przypadków. Bieżąca korekta C07/C27 zachowuje ten wynik i dopisuje wykrytą później ścieżkę; lokalnie przeszło181 przypadków, a nowy deploy i odbiór Render pozostają wymagane.

## Przypięte źródła

Projekt MagicPath: `463295321573851136`. Źródeł i biblioteki nie zmieniano podczas realizacji.

| Widok | Komponent | Rewizja |
| --- | --- | --- |
| v1 | 463296435564220416 | 465437640712400896 |
| v2 | 463310747150213120 | 465437647490396160 |
| v3 | 463321469305384960 | 465437653945430016 |
| Zatwierdzona wspólna biblioteka, projekt 460628300646219776 | 460628347660177408 | 464039002702499840 |

Zatwierdzone decyzje właściciela: ciemny wariant v1/v2 według biblioteki; pierwszeństwo geometrii biblioteki dla v3 (minimum przycisku 32px, font 12px, token promienia karty 9px); pokazanie selektorów scenariuszy także na telefonie. Mobilne selektory korzystają z rzeczywistego C07 w wariancie kompaktowym: 32px/12px/promień 8px, osobny wiersz 48px przy oryginalnych progach 960/1050px. Oryginalne deklaracje i pomiary pozostają w macierzy wraz z jawnym nadpisaniem. C95 na małym ekranie zachowuje geometrię nagłówka. Poprawki C27/C69, zamykanie dialogu, focus i lokalny inspektor mają opisane powiązanie z kanonem.

## Odbiór i dowody

[Macierz](verification/completeness-matrix.json): 5117 wcześniejszych pozycji oraz nowy kontrakt interakcji C07/C27; końcowy status jest otwarty do wdrożenia korekty. [Manifest źródeł i dowodów](verification/source-manifest.json) zachowuje historię wykrytych problemów oraz finalne potwierdzenia. Potwierdzona rozbieżność: lista waluty w dialogu „Moja cena” była pod natywną warstwą modalną; jej wybór wymaga korekty frontendu.

- Render: **175 testów PASS**, dodatkowo **44 pełne ścieżki telefonu**, **4 testy rzeczywistych zdarzeń dotyku selektorów**, **11 kontroli HTTP**.
- **76 par źródło–frontend**, 7969 wierszy elementów/stylów oraz 204 zrzuty w końcowym katalogu wyników. Pomiary obejmują geometrię, typografię, marginesy, paddingi, gapy, obramowania, cienie, przepełnienie i deklaracje ruchu. Wersja 3 ma także porównania wnętrz i dialogów w ciemnym motywie.
- Oba motywy i szerokości 390, 560, 768, 900, 1100, 1440, 1920 i 2560px; klawiatura, dotyk, reset, bezpośrednie trasy, menu, filtry, dialogi i powrót fokusu.
- Typecheck, build i **7 testów Node/źródeł PASS**. Lokalnie przeszło 166 wcześniejszych przypadków oraz 40 wzmocnionych porównań stylów. Rozszerzony zestaw 175 uruchamia CI raportu. [CI kandydata 40374161015](https://github.com/profitia/SG-dev/actions/runs/40374161015) i [CI zaakceptowanego main 40375130388](https://github.com/profitia/SG-dev/actions/runs/40375130388) mają wynik 166+7 PASS.
- **49 plików statycznych Render jest identycznych bajtowo z buildem zaakceptowanego kodu.** Błędy przeglądarki i produktowe żądania sieciowe: brak. Log uruchomienia potwierdza port 10000 i LIVE, bez błędów aplikacji.
- **21 istniejących usług authority zachowało identyfikatory deployów.** Nie wdrażano Staging ani Production ani istniejących runtime.

Integralność nieaktywnego CSS oznacza zachowanie deklaracji oraz zatwierdzonych przekształceń; nie jest twierdzeniem, że każdy nieaktywny selektor został wyrenderowany. Nie przyjęto tolerancji geometrii. Różnice sposobu rasteryzacji/fontu natywnego i webowego są oddzielone od pomiarów. CI stosuje jednakowe fractional hinting i dokładne Inter 3.019 oraz jawne dopasowanie Fontconfig dla wagi 550. Oryginalnych źródeł nie stylizuje się pod wynik.

Historia zachowuje: pierwotne przewijanie pod dialogiem; korektę natywnego color-scheme i warstwy inspektora; nieudany test kursora przy przesunięciu po ładowaniu fontu; pojedynczy błąd zapisu śladu ENOSPC. Gotowość fontów i rzeczywiste `:hover` są teraz asercjami. Końcowe 175 testów Render wykonało te same wymagania z zapisami źródło–frontend i wyłączonym nadmiarowym nagrywaniem śladów; standardowe ślady i raport pozostają w CI. Nieudanych przebiegów nie oznaczono wstecz jako PASS. Artefakty workflow mają retencję 14 dni; macierz, przypięte identyfikatory, pomiary początkowe i indeks SHA-256 końcowych porównań pozostają w repozytorium, a testy są odtwarzalne.

## Kontrakt reużycia i lokalne symulacje

Moduł: `packages/sg2-price-change-index-ui`. Host: `apps/sg2-price-change-index-demo`. [Kontrakt modułu](../../packages/sg2-price-change-index-ui/README.md) opisuje publiczny eksport React 18 `PriceChangeIndex`, typowane `data`, `content`, `theme`, `resetKey`, `onAction`, `onThemeChange`, `onNavigate` i `onScrollLockChange`. Dane, matematyka demonstracyjna i przykładowa identyfikacja PORR są w fixtures/configu hosta. Moduł nie importuje istniejącej aplikacji, routera, sesji ani globalnego store.

Shadow DOM izoluje CSS i portale. Host dostarcza lokalne Inter/Roboto, root 16px oraz zgodny build TypeScript/Vite/Tailwind 4. Media queries i fixed/modal odnoszą się do viewportu. Inny bundler, skala root lub wąski kontener wymagają adaptera i osobnego odbioru. Host zarządza własną nawigacją, przewijaniem i natywnym color-scheme. Montowanie odbywa się przez React root; `resetKey` resetuje projekcję, a `unmount` usuwa powierzchnię, listenery i blokady. Nie zaimplementowano iframe, postMessage ani mikrofrontendu.

Inspektor: najedź element i użyj Control+I; Escape zamyka, Tab pozostaje wewnątrz, a focus wraca do poprzedniego elementu. Odczytuje rzeczywiste lokalne referencje komponentów, zachowań i rewizji. Brak identyfikatora jest jawny. Metadane pochodzenia nie oznaczają automatycznej synchronizacji z MagicPath.

Symulacje obejmują wybór kategorii i struktury, wagi, walidację, kalkulację/ładowanie, braki danych/bazy/FX, opóźnienia, wykresy/miesiące, cenę bazową, ofertę, zapis/wersje/historię w pamięci oraz syntetyczne konteksty Benchmark Finder/SRM i lokalne powiązanie dostawcy. Reload resetuje dane; nie ma lokalnej trwałości produktu. Przyszłe API oraz adaptery hosta są osobnym etapem.

## Budowanie i izolacja

W katalogu hosta: `npm ci --install-links --include=dev --no-audit --no-fund`, `npm run typecheck`, `npm test`, `npm run build`, `npm start`. Render buduje wyłącznie ten host i przypiętą zależność plikową modułu. Root repozytorium jest wymagany przez zależność z sąsiedniego packages; wynik to wyłącznie `apps/sg2-price-change-index-demo/dist`. Start: `node apps/sg2-price-change-index-demo/server.mjs`. Nie uruchamia istniejącego runtime.

`PCI_COMPARE_MAGICPATH=1 npm run test:browser` uruchamia przypięte porównania. `PCI_BASE_URL=https://price-change-index.onrender.com` kieruje testy na istniejącą usługę. Opcjonalny prefiks `PCI_BASE_PATH=/pci/` należy ustawić jednakowo przy buildzie i uruchomieniu: lokalnie potwierdzono cztery trasy, reload i 50 żądań zasobów w tym prefiksie. Faktyczny Render jest skonfigurowany pod `/`.

Serwer podaje wyłącznie statyczny frontend, GET/HEAD. CSP zabrania połączeń runtime, ramek i zewnętrznych skryptów. Brak produktowego backendu/API/bazy, migracji, ORM, workerów, cronów, dysku, auth, telemetrii, LLM oraz połączeń z istniejącym SRM/SpendGuru/Macrobond. Nie kopiowano env groups ani sekretów. Jedyną zmienną usługi jest NODE_VERSION. Ewidencja używa istniejącego control plane SG2; jego sekretów nie ma w frontendzie ani tej usłudze.

## Koszt, utrzymanie i ewidencja

Web Service został wybrany zgodnie z jawną decyzją właściciela. Compute: **7 USD/miesiąc**. Istniejący workspace korzysta z Performance builder **25 USD/1000 minut**; plan i globalny limit nie zostały zmienione. Opłata pipeline wynosiła 25 USD przed utworzeniem, po pierwszym i po poprawionym wydaniu: nie zaobserwowano zakupu dodatkowej puli. Ostatni odczyt transferu po wydaniu: 22,23/25GB. 7 USD jest ceną instancji; przyszłe buildy i transfer podlegają istniejącym zasadom workspace. Nie dodano płatnych dodatków, dysku ani kolejnej instancji. [Zasady Render](https://render.com/docs/build-pipeline).

Wydania pozostają ręczne, po bramkach i zaakceptowanym SHA main, wyłącznie według zapisanego serviceId. Plik deployment/render.yaml jest referencją; nie odtwarzać z niego drugiej usługi ani projektu. Przyszłe kontrolowane wyłączenie wymaga osobnego polecenia właściciela: suspend wyłącznie `srv-dbfnd3jrjlhs73epihvg`, z zachowaniem kodu, IDs i dowodów. Nie usuwać zasobu automatycznie. Nowy przyjęty LKG wymaga końcowego odbioru korekty C07; rollback wymaga ponownego sprawdzenia konfiguracji i zapisanej zaakceptowanej rewizji.

Główny task: `SG2-PRICE-CHANGE-INDEX-FRONTEND-20261026`, rejestracja `cmvp9993000001352wk5crk3v`. Cztery zakresy pomocnicze mają CLOSEOUT_COMPLETE, MEMOROS SUCCEEDED i PHR PUBLISHED; ancestry publikacji w zdalnym PHR potwierdzono. Ich rzeczywiste IDs są w manifeście. Końcowe identyfikatory głównego zamknięcia generuje kanoniczny PMOS/MEMOROS/PHR po przyjęciu tego raportu; źródłem potwierdzenia jest rekord tego tasku oraz końcowy handoff. Nie utworzono nowego PMOS modułu ani nie zapisano do SRM srm_pmos.

Etap 2 pozostaje planem: ustalenie właściwego hosta i kontraktów danych/uprawnień, adapter hosta, kontrolowane podłączenie właściwego API, osobne testy i odbiór. Nie rozpoczęto integracji.

Dodatkowa regresja C07/C27: popup zachowuje źródłowy renderer i geometrię, pozostaje potomkiem natywnego dialogu oraz używa natywnego popover do wyjścia ponad transform/overflow. Testy obejmują filtr, dotyk, wybór, dwa poziomy Escape i focus; inspektor powraca do kontrolki wywołującej, gdy popup zostaje zamknięty przez blur. Do testów wymagane są natywne Dialog/Popover API. Stan wdrożenia pozostaje w macierzy i manifeście.
