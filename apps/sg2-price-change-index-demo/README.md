# Price Change Index — SG2 Development, etap 1

**ETAP 1 — FRONTEND DEMO WDROŻONY I ZWERYFIKOWANY 1:1 względem przypiętych źródeł i obowiązującego kanonu.** Wszystkie dane i działania produktu są syntetyczne, lokalne i przechowywane w pamięci. Zapis w demonstracji nie jest zapisem do systemu biznesowego.

Demonstracja: [v1](https://price-change-index.onrender.com/v1), [v2](https://price-change-index.onrender.com/v2), [v3](https://price-change-index.onrender.com/v3). [Minimalny odrębny host](https://price-change-index.onrender.com/portable) pokazuje montowanie, reset i odmontowanie publicznego komponentu. Oba motywy są dostępne także przez `?theme=dark`.

## Faktyczna tożsamość wydania

| Zasób | Wartość |
| --- | --- |
| Właściciel / profil / cel | SG2 / SG-dev / development |
| GitHub authority | profitia/SG-dev, main |
| Workspace Render | PROFITIA WORKSPACE — tea-d7lps8rbc2fs73cn80dg |
| Istniejący projekt | SpendGuru 2.0 Actual — prj-dap98ddg1s2s739ssatg |
| Istniejące środowisko | Development — evm-dap98hm0tbcc738rro10 |
| Nowy Web Service | Price Change Index — srv-dbfnd3jrjlhs73epihvg |
| URL | https://price-change-index.onrender.com |
| Przyjęty deploy / LKG | dep-dbfr7dgm7kps739icirg |
| Wdrożony zaakceptowany SHA main | b2f2fcaf28b63e708ca1a90e1aeefc4ae636d531 |
| Auto-deploy / preview | wyłączone / wyłączone |
| Konfiguracja | Node 24, Frankfurt, jedna instancja 0.5c-512mb |

Nie utworzono projektu Render. Powstał jeden odizolowany Web Service i trzy potrzebne wydania: pierwsze wdrożenie, korekta prezentacji oraz korekta źródłowej interakcji C07/C27. Dwa wcześniejsze deploye są historyczne: `dep-dbfnd4jrjlhs73epimn0` / `d792044040703994968c164da5cae74982c3d60d` i `dep-dbfplnmc6qcc73fvuc40` / `11d4211b49108324b094bb88688f8741f53645af`. Obecny LKG ma pełny wynik 181 przypadków i działający wybór waluty w natywnym dialogu. Zapis dokumentacyjnych potwierdzeń nie wymaga powtórnego wydania tego kodu.

PR-y: [734 — onboarding](https://github.com/profitia/SG-dev/pull/734), [735 — implementacja](https://github.com/profitia/SG-dev/pull/735), [736 — pierwsze korekty](https://github.com/profitia/SG-dev/pull/736), [737 — historyczny odbiór 175 przypadków](https://github.com/profitia/SG-dev/pull/737), [741 — naprawa C07/C27 i rozszerzenie do 181](https://github.com/profitia/SG-dev/pull/741). Przyjęty kod jest konkretną rewizją main; późniejsze potwierdzenia dokumentacyjne są osobnymi commitami.

## Przypięte źródła i decyzje

Projekt MagicPath: `463295321573851136`. Źródeł i biblioteki nie zmieniano.

| Widok | Komponent | Rewizja |
| --- | --- | --- |
| v1 | 463296435564220416 | 465437640712400896 |
| v2 | 463310747150213120 | 465437647490396160 |
| v3 | 463321469305384960 | 465437653945430016 |
| Zatwierdzona wspólna biblioteka, projekt 460628300646219776 | 460628347660177408 | 464039002702499840 |

Właściciel zatwierdził ciemne warianty v1/v2 według biblioteki, pierwszeństwo geometrii biblioteki dla v3 oraz widoczne selektory scenariuszy na telefonie. Dla v3 minimum przycisku wynosi32px, font12px, token promienia karty9px. Mobilne selektory to rzeczywisty C07 compact32px/12px/promień8px w osobnym wierszu48px przy oryginalnych progach960/1050px. Oryginalne deklaracje i pomiary pozostają w macierzy wraz z jawnymi przekształceniami. C95 zachowuje geometrię nagłówka, również na małym ekranie.

Naprawy wymaganej interakcji kanonicznej są jawne: zamknięcie C27 przed powrotem fokusu, dostępne cztery krawędzie C69, blokada przewijania hosta i natywny color-scheme, inspektor ponad dialogiem oraz C07/ACT-08 wewnątrz natywnego C27. Oryginalny C07 kierował popup do body poza aktywnym dialogiem, przez co nie dało się wybrać waluty. Teraz renderer pozostaje potomkiem dialogu i używa natywnego Popover API, zachowując dokładnie źródłową geometrię. Aktywna wyszukiwarka otrzymuje dokładny wariant focus z biblioteki (`#B1C9DD` przy braku tokenu). Surowe parametry nieaktywnego źródła i właściwy aktywny wariant są zapisane osobno. Inspektor powraca do wywołującej kontrolki, gdy popup został usunięty przez blur.

## Odbiór i dowody

[Macierz](verification/completeness-matrix.json): **5118 pozycji ZGODNE**, w tym1864 JSX,3246 CSS i8 kontraktów. [Manifest](verification/source-manifest.json) zawiera źródła, historię, wyniki, indeksy SHA-256 porównań i potwierdzenia faktycznego wydania. Brak niezatwierdzonych rozbieżności.

- **181 testów przeglądarkowych PASS na Render**, dodatkowo **48 pełnych ścieżek telefonu**, **4 testy zdarzeń dotyku selektorów** i **11 kontroli HTTP**.
- **78 par źródło–frontend**,7999 wierszy elementów/stylów i212 zrzutów w końcowym katalogu wyników. Pomiary obejmują geometrię, typografię, marginesy, paddingi, gapy, obramowania, cienie, przepełnienie i deklaracje ruchu.
- Oba motywy i szerokości390,560,768,900,1100,1440,1920,2560px. Ukryte sekcje, menu, filtry, dialogi, walidacja, ładowanie, zapis lokalny, reset, klawiatura, dotyk, Escape, Tab, focus i przewijanie.
- **181 testów lokalnych**, typecheck/build, **7 kontroli Node/źródeł** i **24 kontrole governance/topologii/polityki wydania — PASS**. [CI kandydata40391652425](https://github.com/profitia/SG-dev/actions/runs/40391652425) i [zaakceptowanego main40392338768](https://github.com/profitia/SG-dev/actions/runs/40392338768) mają wynik181+7 PASS.
- **49 plików statycznych Render jest identycznych bajtowo z buildem dokładnie zaakceptowanego SHA.** Kontrola plików została wykonana po odtworzeniu całego zaakceptowanego checkoutu; wcześniejszy lokalny output sprzed aktualizacji tekstów nie był właściwym punktem odniesienia dla automatycznego skanowania Tailwind.
- Brak błędów przeglądarki, produktowych żądań sieciowych i wskaźników sekretów/konfiguracji bazy w serwowanym kodzie. Log uruchomienia potwierdza port10000 i LIVE, bez błędów aplikacji.
- **21 istniejących usług authority zachowało identyfikatory deployów.** Nie wdrażano Staging/Production ani istniejących runtime.

Integralność nieaktywnego CSS oznacza zachowanie deklaracji i zatwierdzonych przekształceń; nie twierdzi, że każdy nieaktywny selektor był renderowany. Nie przyjęto tolerancji geometrii. Różnice rasteryzacji/fontu natywnego i webowego są oddzielone od pomiarów. CI stosuje jednakowe fractional hinting i dokładne Inter3.019 oraz jawne dopasowanie Fontconfig dla wagi550. Źródeł nie stylizuje się pod wynik.

Historia zachowuje nieudane przebiegi i przyczyny: przewijanie pod modalem, warstwę inspektora, font-swap przesuwający kursor, ENOSPC podczas zapisu śladu oraz wykryty później C07/C27. Poprzedni pełny odbiór175 przypadków został jawnie wycofany po wykryciu brakującej ścieżki; aktualny181-case odbiór obejmuje ją bez osłabienia wymagań. Gotowość fontów i rzeczywiste `:hover` są asercjami. Końcowe testy Render zapisują źródłowe i wynikowe zrzuty/pomiary, z wyłączonym nadmiarowym nagrywaniem śladów. CI zachowuje standardowy raport i ślady. Artefakty workflow mają retencję14dni; macierz, przypięte źródła i indeksy porównań pozostają w repozytorium, a testy są odtwarzalne.

## Reużycie i symulacje

Moduł: `packages/sg2-price-change-index-ui`. Host: `apps/sg2-price-change-index-demo`. [Kontrakt modułu](../../packages/sg2-price-change-index-ui/README.md) opisuje publiczny eksport React18 `PriceChangeIndex`, typowane `data`, `content`, `theme`, `resetKey`, `onAction`, `onThemeChange`, `onNavigate`, `onScrollLockChange`. Dane, matematyka demonstracyjna i przykładowa identyfikacja PORR znajdują się w fixtures/configu hosta. Moduł nie importuje istniejącej aplikacji, routera, sesji ani globalnego store.

Shadow DOM izoluje CSS i portale. Host dostarcza lokalne Inter/Roboto, root16px i zgodny build TypeScript/Vite/Tailwind4. Media queries i fixed/modal odpowiadają viewportowi. Inny bundler, skala root albo wąski kontener wymagają adaptera i osobnego odbioru. Potrzebne jest nowoczesne wsparcie natywnych Dialog/Popover API. Host zarządza własną nawigacją, przewijaniem i natywnym color-scheme. Montowanie odbywa się przez React root, `resetKey` resetuje projekcję, `unmount` usuwa powierzchnię, listenery i blokady. Nie implementowano iframe/postMessage/mikrofrontendu.

Inspektor: najedź element i naciśnij Control+I. Escape zamyka; Tab pozostaje wewnątrz, a focus wraca do właściwej kontrolki. Referencje komponentów, zachowań i rewizji są rzeczywistymi lokalnymi metadanymi. Brak identyfikatora jest jawny. Nie jest to automatyczna synchronizacja z MagicPath.

Lokalne symulacje: kategorie i struktura kosztów, wagi, walidacja, kalkulacja/ładowanie, braki danych/bazy/FX, opóźnienia, wykresy/miesiące, cena bazowa/waluta/jednostka, oferta, zapis/wersje/historia w pamięci oraz syntetyczne konteksty Benchmark Finder/SRM i lokalne powiązanie dostawcy. Reload resetuje dane; produkt nie ma lokalnej trwałości. Brak realnego procesu biznesowego i integracji.

## Build i izolacja

W katalogu hosta: `npm ci --install-links --include=dev --no-audit --no-fund`, `npm run typecheck`, `npm test`, `npm run build`, `npm start`. Render buduje wyłącznie ten host i jego przypiętą zależność plikową UI. Root repozytorium jest potrzebny przez sąsiedni packages; wynik to wyłącznie `apps/sg2-price-change-index-demo/dist`. Start: `node apps/sg2-price-change-index-demo/server.mjs`. Nie uruchamia istniejącej aplikacji.

`PCI_COMPARE_MAGICPATH=1 npm run test:browser` uruchamia przypięte porównania. `PCI_BASE_URL=https://price-change-index.onrender.com` kieruje je na zapisany frontend. Opcjonalny `PCI_BASE_PATH=/pci/` należy ustawić jednakowo przy buildzie i starcie: lokalnie potwierdzono cztery trasy, reload i50 żądań zasobów w prefiksie. Faktyczny Render jest skonfigurowany pod `/` i ma potwierdzone trasy oraz reload.

Serwer podaje tylko statyczny frontend przez GET/HEAD. CSP zabrania połączeń runtime, ramek i zewnętrznych skryptów. Nie ma produktowego backendu/API/bazy, migracji, ORM, workerów, cronów, dysku, auth, telemetrii, LLM ani połączeń z istniejącym SRM/SpendGuru/Macrobond. Nie kopiowano env groups/sekretów; skonfigurowano tylko NODE_VERSION. Ewidencja używa istniejącego control plane SG2, a jego sekrety nie są częścią frontendu ani tej usługi.

## Koszt, utrzymanie, ewidencja

Web Service został wybrany zgodnie z jawną decyzją właściciela. Compute: **7 USD/miesiąc**. Istniejący Performance builder kosztuje **25 USD/1000minut**; plan i globalny limit nie zostały zmienione. Opłata pipeline wynosiła25 USD przed utworzeniem i po wszystkich trzech wydaniach; nie zaobserwowano zakupu dodatkowej puli. Ostatni odczyt transferu po odbiorze:22,64/25GB. Cena7 USD dotyczy instancji; przyszłe buildy i transfer podlegają istniejącym zasadom workspace. Brak płatnych dodatków, dysku i dodatkowej instancji. [Zasady Render](https://render.com/docs/build-pipeline).

Wydania są ręczne, po bramkach i przyjętym SHA main, wyłącznie według zapisanego serviceId. `deployment/render.yaml` jest referencją; nie odtwarzać drugiej usługi ani projektu. Przyszłe kontrolowane wyłączenie wymaga osobnego polecenia właściciela: suspend tylko `srv-dbfnd3jrjlhs73epihvg`, z zachowaniem kodu, IDs i dowodów. Nie usuwać automatycznie. Aktualny przyjęty deploy jest LKG; rollback wymaga sprawdzenia jego konfiguracji i zapisanej rewizji.

Główny task: `SG2-PRICE-CHANGE-INDEX-FRONTEND-20261026`, rejestracja `cmvp9993000001352wk5crk3v`. Cztery zakresy pomocnicze mają CLOSEOUT_COMPLETE, MEMOROS SUCCEEDED i PHR PUBLISHED; zdalną ancestry publikacji potwierdzono. Ich rzeczywiste IDs są w manifeście. Końcowe potwierdzenia głównego tasku generuje kanoniczny PMOS/MEMOROS/PHR po przyjęciu aktualnego raportu; źródłem finalnych IDs jest rekord tego tasku i końcowy handoff. Nie utworzono nowego PMOS ani nie zapisano do SRM srm_pmos.

Etap2 pozostaje planem: uzgodnienie hosta i kontraktów danych/uprawnień, adapter hosta, właściwe API, osobne testy i odbiór. Nie rozpoczęto go w tym zadaniu.
