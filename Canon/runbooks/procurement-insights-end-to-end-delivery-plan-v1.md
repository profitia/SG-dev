# Procurement Insights — szczegółowy plan realizacji end-to-end v1

**Data:** 2026-11-10. **Rodzaj:** plan przyszłego wykonania, nie instrukcja uruchomiona przez tę publikację.  
**Decyzja bieżąca:** zatwierdzona publikacja czterech uzupełnień kanonu oraz przygotowanie niniejszego planu; bez implementacji produktu, migracji, nowych grantów, wywołań dostawców i deploymentów.  
**Authority:** [PI amendment v1.2](../v1.2-procurement-insights-newsfeed-ux-statistics-and-recurring-reports-amendment.md), PI v1.0/v1.1, Newsfeed v1.0/v1.1/v1.2, AppShell, Source Hub Universal i właściwe kontrakty E1/CIC/Forecast. Zachować I1–I4, C1–C3 i istniejące ownership/G1.

## Stan początkowy i zakres

Plan zastępuje organizację prac z właścicielskiego dokumentu „PROCUREMENT INSIGHTS — HARMONOGRAM REALIZACJI END-TO-END”, nie jego historyczny plik. Bazę audytu stanowi SG-dev main `22ad6f867b9bf30c8f01b326c003ea37fdd11f25`; przed przyszłym wykonaniem trzeba ponownie sprawdzić main i równoległe PR/deploymenty. Zmiana ECR przyjęta podczas audytu nie zmieniła badanych kanonów PI/Newsfeed, aplikacji Newsfeed/Insights ani kafla AppShell.

- Aktualny projekt MagicPath „Procurement Insight”: projekt `470460594609336320`, komponent `470472206477045760`, rewizja odczytana w audycie `470946459223740416`. Zawiera Newsfeed, rozwijane materiały, statystyki, bibliotekę Raportów, wspólne wejścia i oznaczone symulacje. Nie jest backendem ani dowodem trwałego zapisu.
- Wcześniejszy „Procurement Insights — Interactive Flow D0”: projekt `467661780030750720`, komponent `467697311875739648`, rewizja `467743119018962944`. Zawiera pełniejszy formularz BENCHMARK, nazwę, daty początku/końca, bezterminowość, czas/strefę i preferencje. To źródło reuse, nie drugi docelowy moduł ani dowód produkcyjnych profili/kadencji.
- W AppShell jest nieaktywny kafel Procurement Insight; brak kompletnego hosta modułu. Newsfeed API ma prywatne CRUD, historię i kontrolowany discover. Brakuje pełnej realizacji v1.2: trwałego indeksu niezależnego od TTL treści, snapshotów, relacji run–publication, sharingu i preferencji odbiorców.
- Brave i inne istniejące konektory są własnością Source Hub. Nie budujemy ich ponownie. Aktualne dopuszczenia, licencje i gotowość LIVE należy sprawdzić przed przyszłą aktywacją; obecność kodu nie zastępuje tych dowodów.
- PR #923 dostarczył kod runnera/PDF/schedulera/API wyspecjalizowany w Oil. PR #954/#958 dostarczyły selektywny kontekst Newsfeed/ACG. Ich przyjęcie source nie jest dowodem LIVE, publikacji raportu, aktualnych grantów lub pełnego modułu.

**Zakres programu:** moduł Procurement Insights, użytkownikowe obserwacje i Newsfeed przez Brave/Source Hub, własna historia/sharing/statystyki, monitoring, katalog i zamawianie/subskrybowanie cyklicznych raportów, biblioteka opublikowanych wydań i jeden asystent. **Produkcja treści Oil & Asphalt, Composer, matematyka Forecast i specjalistyczny Quality Gate są w odrębnym zadaniu.** Wspólny moduł może konsumować gotowy, dopuszczony profil/wersje tego producenta; nie przejmuje jego implementacji.

EIA/CFTC/commodities.sh/TE i przyszłe typy danych są opcjonalnymi rozszerzeniami przez istniejących ownerów. Nie są bramką uruchomienia prasowego Newsfeed z Brave. ECR pozostaje właścicielem własnych zdarzeń kalendarzowych, semantyki i dopuszczonych projekcji; nie kopiować jego silnika do Newsfeed.

## Zasady wspólne i zależności

Każde przyszłe zadanie używa aktualnego routingu, własnej rejestracji właściwego profilu, wymaganych CI i kontrolowanego acceptance. Interfejs należy do SG Runtime/AppShell, Newsfeed i Hub do Architecture Platform, Raporty do Insights Domain, a tożsamość i kontekst AI do właściwych E1/CIC ownerów. Jeden biznesowy etap może wymagać odrębnych, powiązanych rejestracji producenta i konsumenta, bez przenoszenia ownership.

Testy celowane towarzyszą każdej implementacji. Etap 8 sprawdza całość, nie zastępuje wcześniejszych testów. SUCCESS wymaga wyniku funkcjonalnego na wskazanej wersji i środowisku; sam merge/build, fixture, timer lub HTTP 200 nie wystarcza. Nie tworzyć nowych zasobów ani konfiguracji infrastruktury bez właściwego zakresu właścicielskiego. Zachować istniejące polityki UNMETERED; providerowe błędy/ograniczenia i zabezpieczenia transportu nie są zgodą na przywrócenie wewnętrznych kwot API. Retencja Source Hub 0 i istniejące, odrębnie dopuszczone projekcje pozostają pod ich własną authority.

Kolejność robocza: **1 → 2 → 3 → 4** dla Newsfeed; **1 + kontrakt gotowego producenta → 5 → 6** dla Raportów; **3/4/6 + istniejący ACG/CIC → 7 → 8 → 9**. Prace niezależne można prowadzić równolegle. Brak jednego profilu raportowego nie zatrzymuje odbioru Newsfeed. Blokady i stan częściowy muszą być jawne.

## Etap 1 — Domknięcie jednej specyfikacji UX i kontraktów wejściowych

**Cel:** przygotować jednoznaczny wzorzec do odtworzenia w aplikacji, wykorzystując już istniejące projekty.

**Zadania:**
1. Przyjąć aktualny wspólny moduł Newsfeed/Raporty jako bazę prezentacji; zachować ten sam lewy panel, AppShell, motyw, nawigację i jednego asystenta.
2. Włączyć pełniejszy formularz harmonogramu z D0 do bieżącej ścieżki Raportów: nazwa, uprawniony profil/przedmiot, daty, bezterminowość, czas/strefa, widoczność, odbiorcy i pauza/zakończenie. Oferować tylko kadencje zadeklarowane przez profil.
3. Potwierdzić rozwijane materiały SRM-C49, uczciwe oznaczenie fragmentów z wyszukiwarki, link w nowej karcie oraz stany braku fragmentu lub daty. Nie przywracać okna z trzema akcjami.
4. Opisać statystyki: frazy, miary, deduplikacja, daty i strefy, brak historii, częściowe pokrycie; przypisać pola do przyszłego odczytu backendu.
5. Zmapować każdy ekran/akcję do rzeczywistego kontraktu producenta. Wskazać brakujące operacje zamiast wypełniać je lokalnym sukcesem.
6. Zachować rejestr UI/dane/działanie, Ctrl+I, tryb „Tylko produkt”, kanoniczne komponenty i jawne ręczne aktualizowanie przypiętych rewizji. Ustalić jeden sposób wyboru kontekstu we wspólnym asystencie.

**Rezultat funkcjonalny:** jeden spójny, klikalny wzorzec obu zakładek i pełnej konfiguracji cyklu, gotowy do implementacji bez ponownego projektowania podstawowych ekranów.

**Kryteria sukcesu:** użytkownik przechodzi wszystkie główne ścieżki w prototypie; formularze walidują błędy i zachowują szkic; harmonogram ma komplet danych; brak fikcyjnych dostępnych profili/forecastów; każdy element ma klasyfikację. Przegląd obejmuje pusty stan, dane demo, loading, partial, denied, error, anulowanie, telefon i oba motywy. Wynik to **UX ACCEPTED**, nie LIVE.

## Etap 2 — Rzeczywisty host Procurement Insights w SG2 Development

**Cel:** użytkownik może otworzyć moduł w istniejącej aplikacji.

**Zadania:**
1. Podłączyć istniejący kafel AppShell i właściwy moduł, bez nowej aplikacji logowania, drugiego headera lub asystenta; ujednolicić nazwę Procurement Insights i opis Newsfeed/Raportów.
2. Zaimplementować routy obu zakładek, obserwacji, historii i wydań raportów; obsłużyć odświeżenie, back/forward, bezpośredni link i nieistniejący zasób.
3. Przenieść dopuszczone UI z MagicPath przez REUSE FIRST. Nie kopiować fixture, symulatorów statusu ani narzędzi projektowych do produktu.
4. Wykorzystać istniejącą sesję Clerk i serwerowy kontekst E1; rozdzielić użytkownika, aktora, aplikację i organizację. Nie ufać identyfikatorom uprawnień z formularza.
5. Przygotować adaptery odczytu/zapisu dla Newsfeed i Reports, z uczciwymi stanami „niedostępne” dla niegotowej funkcji. Nie pozorować zrealizowanych akcji.
6. Dodać bezpieczną telemetrię nawigacji, obsługę szkiców, i18n i zgodność z globalną nawigacją AppShell.

**Rezultat funkcjonalny:** prawdziwy moduł na SG2 Development z działającą nawigacją i kontrolą dostępu, gotowy do podłączenia funkcji etapów 3–7.

**Kryteria sukcesu:** zalogowany użytkownik otwiera obie zakładki i deep link bez nowego logowania; cofanie/odświeżenie nie przenosi do innej organizacji ani nie traci zatwierdzonego zapisu; użytkownik bez prawa otrzymuje rzeczywistą odmowę. Brak regresji X-Ray/Finder/ADP i asystenta. Wersja Development i odpowiednie CI są zapisane. Sam host nie jest pełnym odbiorem biznesowym.

## Etap 3 — Newsfeed użytkownika z Brave i trwałą historią

**Cel:** rzeczywiste wyszukanie, zapis, odtworzenie i udostępnienie informacji.

**Zadania:**
1. Rozszerzyć istniejące API/schemat Newsfeed zgodnie z v1.2, addytywnie i po wymaganych zgodach migracyjnych: wersje filtrów, snapshoty kryteriów, relacje każdego wystąpienia w run, prywatne preferencje i ACL.
2. Oddzielić bezterminowy, dozwolony indeks metadanych/URL od wygasającej treści źródłowej. Usunąć zależność dostępności tego indeksu od sztucznego przyszłego `retentionUntil`, bez zmiany licencji/retencji Hub lub ukrytego zapisu pełnych payloadów.
3. Podłączyć świadome wyszukiwanie przez Newsfeed → Source Hub → istniejący Brave. Zachować rzeczywiście wspierane filtry, provenance, nieznane daty/pokrycie, błędy i eksperymentalny status operatorów; nie obiecywać pełnej semantyki AND/OR/NOT bez dowodu.
4. Zaimplementować tworzenie/edycję/pauzę/usunięcie obserwacji i odrębne operacje „Odtwórz Newsfeed” oraz „Sprawdź nowe artykuły”; paginować historię zamiast odcinać ją do ostatnich 100 wyników bez dalszego dostępu.
5. Dodać SHARED_USERS/ORGANISATION i owner-only zapis, udostępnienie/cofnięcie. Odbiorca ma własny stan przeczytania i preferencje; nie podszywa się w RLS pod właściciela.
6. Podłączyć rozwijane karty i rzeczywisty odczyt statystyk zgodnie z amendmentem. Zapewnić spójność wykresu/tabeli, brak zmyślonej historii oraz 0 upstream przy odczycie.
7. Podłączyć kontekstową akcję ADP ze zweryfikowaną tożsamością firmy, bez duplikatu obserwacji i bez niejawnego pierwszego pobrania. Dostawca nie jest obowiązkowym rodzicem obserwacji tematycznej.

**Rezultat funkcjonalny:** użytkownik sam konfiguruje Newsfeed, wykonuje wyszukanie Brave, wraca do zapisanych wyników po ponownym zalogowaniu, przegląda statystyki i udostępnia konkretną obserwację.

**Kryteria sukcesu:** dwa rzeczywiste uprawnione konta potwierdzają zapis, odczytowe udostępnienie i cofnięcie; stary run zachowuje wynik po zmianie filtra; replay tworzy 0 nowych runów i 0 prób Hub/providerów/OpenAI; powtórzony URL nie dubluje publikacji. Dozwolone metadane pozostają dostępne zgodnie z v1.2. Ograniczony test Brave wymaga właściwej zgody na faktyczne wywołanie; fixture nie zastępuje tej akceptacji. Brak wycieków między organizacjami.

## Etap 4 — Monitoring Newsfeed i trwałe zdarzenia

**Cel:** nowe informacje pojawiają się również wtedy, gdy użytkownik nie ma otwartej aplikacji.

**Zadania:**
1. Utrwalić harmonogram obserwacji i kolejne terminy. Obsłużyć strefę, DST, zmianę wersji, pauzę, wznowienie, usunięcie i opóźnienie po awarii.
2. Wykorzystać wspólny worker/scheduler z trwałym wyborem due jobs, lease/fencing i idempotencją. Nie tworzyć procesu lub Cron Job dla każdego użytkownika.
3. Przyjąć właściwy SERVICE/delegation do prywatnej obserwacji z aktualnym prawem właściciela i odwołaniem. Sam grant odczytu wspólnej wiedzy nie jest prawem do dowolnego prywatnego filtra. Nie tworzyć fałszywych sesji Clerk ani bezterminowego technicznego ALLOW.
4. Zapisywać każdy rzeczywisty run, jego wersję, wynik i stan EMPTY/PARTIAL/FAILED/UNCERTAIN. Nie stosować nieograniczonych retry ani mnożyć prób niepewnych.
5. Deduplikować nowe wykrycia i utworzyć minimalne, trwałe zdarzenia/outbox dla uprawnionych odbiorców zgodnie z opt-in. Powtórna akwizycja/wyświetlenie nie generuje ponownego alertu.
6. Dodać diagnostykę zaległości, ostatniej próby i awarii, bez prywatnych fraz w logach. Opcjonalne typowane dane rynkowe dołączać wyłącznie przez przyjęte kontrakty właścicieli Hub/ECR; nie włączać ich samą zmianą UI.

**Rezultat funkcjonalny:** cykliczna obserwacja samodzielnie aktualizuje historię i przygotowuje trwałe powiadomienie dla właściwych odbiorców, również offline.

**Kryteria sukcesu:** rzeczywisty, autoryzowany cykl bez przeglądarkowej sesji; restart nie tworzy duplikatu runu/alertu; pauza i cofnięcie prawa blokują następny chroniony skutek; dwa odbiorniki nie powodują dwóch takich samych pobrań. Testy deterministyczne obejmują DST i awarię; test Development odróżnia faktyczną godzinę od symulacji. Brak EIA/CFTC/TE nie blokuje odbioru cyklu prasowego Brave.

## Etap 5 — Katalog, zlecenia i subskrypcje raportów

**Cel:** użytkownik może zamówić jednorazowe lub cykliczne przygotowanie raportu przez dopuszczonego producenta.

**Zadania:**
1. Przyjąć wersjonowany katalog rzeczywiście dostępnych profili: ID/wersja, producent, wejścia, uprawnione referencje, kadencje, zakres, format i dostępność. Nie uznać syntetycznej karty miedzi z makiety za gotowy produkt.
2. Rozszerzyć/reuse istniejące Insights API o ogólne definicje zamówień i subskrypcji, bez kopiowania runnera Oil. Utrwalić autora UserID, kontekst organizacji, widoczność, odbiorców oraz wersję profilu i przedmiotu.
3. Zapisać kompletny harmonogram z §4 amendmentu i historię zmian. Obliczać następny termin, obsłużyć zakończenie i zachować zakotwiczenie kadencji po restarcie.
4. Zapewnić autoryzowane create/read/update/pause/resume/end, idempotencję i separację definicji, wyzwolenia, runu i wydania. SERVICE używa aktualnej, odwoływalnej authority i nie dziedziczy prawa z samego harmonogramu.
5. Zintegrować port zlecenia/statusu/wersji z gotowym producentem. Oil może być pierwszym rzeczywiście dostępnym profilem z równoległego zadania, ale nie rozwijamy tutaj jego treści, prognoz, OpenAI ani recenzji.
6. Odróżnić niedostępność profilu, brak uprawnienia, opóźnienie, błąd, oczekiwanie na recenzję i publikację. Zachować właściwe koszty/admission; zakup/zlecenie nie daje automatycznie nowego prawa dostawcy.

**Rezultat funkcjonalny:** trwałe, użytkownikowe zamówienia i subskrypcje uruchamiają właściwy istniejący proces raportowy, a użytkownik może kontrolować przyszłe wydania.

**Kryteria sukcesu:** zlecenie i harmonogram przetrwają ponowne logowanie/restart; edycja lub pauza działa tylko na przyszłe wydania; powtórzone wyzwolenie daje ten sam biznesowy run/wydanie; inny użytkownik nie zmienia cudzej subskrypcji; producent potwierdza przyjęcie rzeczywistego zlecenia przez wersjonowany kontrakt. Bez gotowego, dopuszczonego producenta jest to blokada integracji danego profilu — nie SUCCESS E2E i nie powód do tworzenia fikcyjnego generatora.

## Etap 6 — Raporty w aplikacji, publikacja, archiwum i dystrybucja

**Cel:** użytkownik znajduje swoje zlecenia oraz zatwierdzone wydania i otrzymuje ten sam raport we wszystkich kanałach.

**Zadania:**
1. Podłączyć lewy panel: zlecenia, cykle, biblioteka, archiwum, udostępnione i dostępne analizy. Wdrożyć wyszukiwanie, sortowanie, filtry rynków/dat i paginację według przyjętego kontraktu.
2. Podłączyć formularz zamówienia oraz rzeczywisty status bez timerów demonstracyjnych i ponownego zamawiania przy odświeżeniu.
3. Oddzielić draft/recenzję od biblioteki PUBLISHED. Samo AWAITING_REVIEW/PDF z istniejącego runnera nie jest zatwierdzonym wydaniem dla klienta. Odbiór publikacji wymaga właściwej decyzji producenta i trwałego identyfikatora wersji.
4. Dostarczyć czytnik wersji z as-of, okresem, źródłami, ograniczeniami i poprzednimi wydaniami. HTML/PDF/e-mail wskazują ten sam artefakt/digest; pobranie PDF nie uruchamia nowej generacji.
5. Zaimplementować dopuszczony model widoczności, sharing i cofnięcia. Nie udostępniać automatycznie prywatnych danych wejściowych lub historii rozmowy autora.
6. Podłączyć niezależny delivery outbox i wymagany przez PI v1.0 §15 e-mail do zweryfikowanego odbiorcy według preferencji; SENT nie oznacza DELIVERED/READ. Odroczenie kanału wymaga jawnej decyzji dla wydania produktu. Nie tworzyć drugiego mail/PDF service bez właściwej potrzeby i ownership.
7. Przekazywać zdarzenie rzeczywistej publikacji do powiadomień i referencję wybranej wersji do asystenta, bez produkcji raportu w Newsfeed.

**Rezultat funkcjonalny:** kompletna zakładka Raporty z rzeczywistymi statusami, kontrolą cyklu, uprawnioną biblioteką, archiwum, czytnikiem i pobieraniem/dostarczeniem zatwierdzonych wydań.

**Kryteria sukcesu:** użytkownik zamawia, znajduje, otwiera i pobiera konkretne zatwierdzone wydanie po ponownym zalogowaniu; stare wydanie nie zmienia się po nowym cyklu; treść/digest HTML i PDF są spójne; publikacja oczekująca na review nie jest oferowana jako ukończona. Dostęp do linku/PDF/e-mail respektuje bieżące prawa. Dystrybucja jest idempotentna i ma faktyczny stan dostarczenia albo jawnie zaakceptowane odroczenie.

## Etap 7 — Jeden asystent, trwałe powiadomienia i uprawniony kontekst

**Cel:** wspólny asystent informuje o nowościach i potrafi rozmawiać o wybranym, dozwolonym materiale.

**Zadania:**
1. Rozszerzyć obecny widget AppShell i przyjęte ACG/CIC; nie tworzyć kolejnego chatu, konta, magazynu prywatnej wiedzy ani providera.
2. Dostarczyć trwałą listę zdarzeń z Newsfeed i Insights: opt-in, odczyt, wyciszenie, deduplikacja, deep link i dostęp po powrocie. Udostępnienie do organizacji nie rozsyła automatycznie alertu wszystkim.
3. Umożliwić jawny wybór bieżącej publikacji/obserwacji lub PUBLISHED reportVersion w panelu asystenta, bez przywracania okna szczegółów artykułu. Pokazać i pozwolić usunąć zakres kontekstu.
4. Użyć istniejących wersjonowanych odczytów; uzupełnić brakujące projekcje raportów/sharingu przez właścicieli. Dane przeglądarki nie są authority. Nie ładować całego indeksu do każdego pytania.
5. Zachować datowanie/as-of/provenance i rozróżnienie faktu, fragmentu wyszukiwarki, interpretacji oraz forecastu. Brak danych i aktualność mają być czytelne.
6. Unieważniać kontekst i spóźnione odpowiedzi po revocation, zmianie organizacji/użytkownika lub zasobu. Wyświetlenie alertu i wybór kontekstu nie wywołują LLM; rozmowa używa właściwej, odrębnej zgody i admission modelu.

**Rezultat funkcjonalny:** użytkownik odbiera prawdziwą informację o nowym materiale i może poprosić istniejącego asystenta o interpretację jasno wybranego źródła lub wydania.

**Kryteria sukcesu:** alert jest obecny po ponownym logowaniu; ponowne wykrycie go nie dubluje; samo wyświetlenie tworzy 0 wywołań LLM i akwizycji. Faktyczna rozmowa, jeśli osobno dopuszczona, wskazuje właściwy zasób/wersję/źródła. Cofnięte lub obce dane nie trafiają do odpowiedzi; odrzucony dostęp nie jest zastępowany symulowanym pozytywnym wynikiem. CIC nie wykonuje schedulera ani publikacji raportu.

## Etap 8 — Odbiór całego produktu na Development i Staging

**Cel:** potwierdzić spójny rezultat funkcjonalny i przygotować niezmienny kandydat wydania.

**Zadania:**
1. Wykonać pełne E2E: wejście AppShell, zapis/edycja/sharing, nowe wyszukanie Brave, replay, statystyki, monitoring offline, raport cykliczny, zatwierdzona wersja, PDF/e-mail i powiadomienia/kontekst.
2. Sprawdzić dwa rzeczywiste konta i właściwe organizacje, aktualny E1, owner-only zapis, revocation, deep linki, eksport, cache i opóźnione odpowiedzi.
3. Zweryfikować izolowane testy SQL, migracji i odtworzenia, restart/retry/idempotencję, DST i zmiany harmonogramu; rzeczywiste operacje wykonywać tylko w osobno zatwierdzonym zakresie.
4. Sprawdzić providerowe 429/timeouty, puste/niepełne wyniki, nieznane daty, niedostępność profilu i recenzji. Nie zmieniać UNMETERED ani fabrykować dat, liczb i PASS.
5. Zweryfikować zgodność UI z przyjętym projektem, keyboard/mobile/dark, wydajność i realnie zmierzone koszty. Sentry/PostHog nie mogą zapisywać prywatnych fraz, treści, tokenów lub pełnych promptów.
6. Zapisać dokładny SHA, obowiązkowe CI/controlled proof, LKG, zgodność konfiguracji i rollback. Po odrębnej zgodzie promować właściwy artefakt/SHA do istniejącego, przygotowanego Staging i powtórzyć odbiór w tym środowisku.

**Rezultat funkcjonalny:** przetestowany moduł i przyjęty release candidate na Staging, z jawnym wykazem dostępnych profili/źródeł i bez niewyjaśnionych blokad krytycznych.

**Kryteria sukcesu:** krytyczne scenariusze są PASS na dokładnej wersji, bez zastąpienia LIVE fixture; E1/izolacja/replay bez akwizycji i publikacja tylko po review potwierdzone; restore/rollback ma dowód; brak błędów blokujących. Development PASS nie oznacza Staging PASS. Jeżeli wymagane zasoby, profil lub decyzja aktywacyjna nie istnieją, status tej części pozostaje BLOCKED/NOT VERIFIED.

## Etap 9 — Kontrolowana promocja Production i odbiór biznesowy

**Cel:** udostępnić uprawnionym użytkownikom przyjęte funkcje w Production.

**Zadania:**
1. Uzyskać właściwą zgodę na konkretną promocję; ponownie sprawdzić main, wdrażany SHA/artefakt, trwające deploymenty i zależności SG2/SRM/ECR/Oil/CIC.
2. Potwierdzić odrębne tożsamości środowiska, poświadczenia, licencje i finitywne uprawnienia SERVICE. Nie kopiować ustawień Development do Production ani tworzyć zasobów w imieniu właściciela bez osobnego zakresu.
3. Wdrożyć tę samą zatwierdzoną w Staging wersję zgodnie z aktywnym kanonem promocji i LKG, z właściwą kolejnością kompatybilnych zależności. Nie uruchamiać konkurencyjnego deploymentu.
4. W osobno dopuszczonym zakresie aktywować harmonogramy i kanały, wykonać bezpieczny test na wskazanych prawdziwych danych/testowych zasobach. Nie tworzyć nieautoryzowanych zapisów produkcyjnych.
5. Potwierdzić rzeczywiste transakcje użytkownika, Brave/Hub, odtwarzanie historii, powiadomienia oraz zamówienie/dostarczenie dopuszczonego raportu od właściwego producenta; zmierzyć podstawową telemetrię i koszty.
6. Przekazać krótką instrukcję, zakres aktywnych funkcji, ograniczenia, opiekę operacyjną i dowody odbioru. Zamknąć właściwe rejestracje zgodnie z polityką projektu/środowiska; nie tworzyć Development PMOS jako zastępczego raportowania Production.

**Rezultat funkcjonalny:** Procurement Insights jest rzeczywiście używalnym modułem Production dla uprawnionych użytkowników, z działającym Newsfeed i zadeklarowanymi cyklicznymi raportami.

**Kryteria sukcesu:** wersja/SHA i działanie docelowego środowiska są potwierdzone; scenariusze biznesowe przechodzą na prawidłowych uprawnieniach; właściwy raport jest PUBLISHED i dostępny odbiorcy; monitoring i możliwość odzyskania działają; właściciel odbiera wynik. Sam deploy, health check lub istnienie PDF nie jest BUSINESS ACCEPTED.

## Co zostało wykonane przez publikację tego planu

Wyłącznie dokumentacja: cztery zatwierdzone uzupełnienia kanonu, minimalny manifest, dowód zgody i niniejszy plan. Żaden z przyszłych etapów implementacji/aktywacji nie został uruchomiony przez zapis, CI, merge lub publikację tych dokumentów. Sformułowania „wykonać”, „wdrożyć” i kryteria LIVE w etapach opisują przyszły zatwierdzany zakres, nie bieżącą zgodę wykonawczą.
