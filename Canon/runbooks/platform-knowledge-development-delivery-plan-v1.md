# Platform Knowledge — finalny harmonogram realizacji v1.0

| Pole | Wartość |
|---|---|
| Status planu | OWNER_APPROVED; ACTIVE po kontrolowanym przyjęciu do authority main |
| Data akceptacji | 11 listopada 2026, Europe/Warsaw |
| Cel wydania | Pełne Platform Knowledge v1 end-to-end na Development |
| Podstawa | [Kanon Platform Knowledge v1.0, rewizja 4](../v1.0-platform-knowledge-business-and-architecture-canon.md) |
| Właściciel platformowy | Architecture Platform / ARCHITECTURE |
| Integracje | Właściwi właściciele SG2, CIC i współdzielonych kontraktów |
| Tryb realizacji | Full Autopilot, bez ponownej akceptacji planu i przejść między etapami |
| Stan realizacji przy publikacji | NIE_ROZPOCZĘTA; opublikowanie harmonogramu nie oznacza implementacji |

## 1. Cel i wiążąca definicja ukończenia

Rezultatem jest działający na Development przepływ:

`upload dokumentu → automatyczne opracowanie → zapis wiedzy → naturalne pytanie lub podsumowanie → właściwy kontekst przez CIC/ACG → odpowiedź ze źródłami → skuteczne wycofanie lub usunięcie`.

**Zadanie wdrożeniowe wolno zakończyć dopiero po potwierdzeniu wszystkich kryteriów etapu trzeciego na Development, w tym całego §29 kanonu. Samo zbudowanie aplikacji, zakończenie etapu drugiego, zielone CI, merge, HTTP 200 ani status deploymentu nie stanowią ukończenia całości.**

Harmonogram i pełny zakres zostały zaakceptowane. Nie wymagają ponownej akceptacji właściciela ani zatwierdzania przejść między etapami. Bieżące polecenie obejmuje utrwalenie i publikację planu; wykonanie implementacji rozpoczyna odrębne zlecenie realizacji już zaakceptowanego planu, bez ponownego otwierania projektowania koncepcyjnego.

Dokument określa kolejność, rezultaty i sposób śledzenia realizacji. Nie zmienia architektury ani nie ogranicza zakresu v1. Szczegóły operacyjne, takie jak konkretne modele, limity i zestaw referencyjny, ustala wykonawca w granicach kanonu i dopuszczonego budżetu.

## 2. Zasady wykonania i podział odpowiedzialności

Obowiązują wskazane przez właściciela wrappery:

- [BUSINESS OUTCOME ENGINEERING v1.1](https://github.com/profitia/SG-dev/blob/docs/codex-wrapper-library-20261110/docs/agent-instructions/business-outcome-engineering-v1.1.md).
- [SpendGuru 2.0 — SG2 / E1 / PMOS](https://github.com/profitia/SG-dev/blob/docs/codex-wrapper-library-20261110/docs/agent-instructions/sg2-e1-wrapper.md).
- [FULL AUTOPILOT — OUTCOME FIRST v2.0](https://github.com/profitia/SG-dev/blob/docs/codex-wrapper-library-20261110/docs/agent-instructions/full-autopilot-v2.md).

Wrapper SG2 stosuje się do prac właściwego profilu SG2. Producent Platform Knowledge pozostaje w ARCHITECTURE, a CIC we własnym profilu. Każdy zachowuje właściwe routing, taskId, PMOS, kontrakty i dopuszczenia. Wspólny cel biznesowy nie nadaje prawa do zapisu cudzych powierzchni przez zmianę profilu.

**Przygotowanie wymaganych środowisk i projektów Render, GitHub oraz Neon wykonuje właściciel według instrukcji wykonawcy. Agent nie tworzy ich w zastępstwie właściciela.** W pierwszej kolejności sprawdza się możliwość ponownego wykorzystania istniejących zasobów; nowe repozytoria lub projekty nie są domyślnym wymaganiem.

Wykonawca przygotowuje wcześnie jeden zbiorczy pakiet niezbędnych instrukcji i decyzji, a następnie kontynuuje niezależne, dopuszczone prace. Pakiet nie służy ponownemu zatwierdzaniu harmonogramu. Obejmuje czynności zastrzeżone dla właściciela oraz rzeczywiście brakujące dopuszczenia.

Po zleceniu realizacji rutynowe poprawki kodu, testów, kontraktów, integracji, migracji i konfiguracji potrzebne do uzgodnionego rezultatu są częścią jednego ciągu prac. Instalacje, migracje i deploymenty wykonuje się w dopuszczonym zakresie, właściwą rolą i środowisku. Wcześniej udzielonych, aktualnych upoważnień nie potwierdza się ponownie tylko z powodu zmiany etapu.

Akceptacja harmonogramu nie zastępuje rzeczywistych uprawnień, rejestracji powierzchni ani szczególnego finalnego GO, jeżeli wymaga go aktywny kontrakt. Nie obejmuje automatycznie nowych kosztów, grantów, zasobów, Staging lub Production. Brak dopuszczenia zatrzymuje zależną czynność; pozostałe dopuszczone prace są kontynuowane.

Testy, ochrona danych, kontrola kosztów, monitoring i wymagane closeout są częścią każdego etapu. Nie powstaje dodatkowy etap audytowy ani obowiązkowy human review pomiędzy etapami.

## 3. Kolejność i równoległość prac

Harmonogram jest oparty na zależnościach i dowodach, bez deklarowania dat realizacji przed rozpoczęciem wykonania.

1. Na początku etapu pierwszego ustalane są kontrakty integracji, routing, zależności i pakiet właścicielski.
2. Gdy właściciel przygotowuje zasoby, mogą rozpocząć się niezależne części etapu drugiego, o ile ich powierzchnie i operacje są już dopuszczone.
3. Wczesny minimalny przepływ integracyjny oraz adapter powstają w etapie drugim, przed ukończeniem całego silnika.
4. Kolejne dopuszczone integracje etapu trzeciego mogą być przygotowywane po ustabilizowaniu potrzebnych kontraktów. Pełny odbiór następuje na rzeczywistym Development.

Zakończenie etapu pierwszego jest kamieniem milowym gotowości, a nie globalną blokadą wszelkiego kodowania. Etap może pozostawać W_TOKU, podczas gdy wykonywane są niezależne prace kolejnego etapu. Nie pozwala to ogłosić wcześniejszego etapu zakończonym bez jego dowodów.

## 4. Etap 1 — przygotowanie realizacji i integracji

### Zakres

- Krótkie sprawdzenie aktualnych mechanizmów Memoros oraz zależności potrzebnych do wykonania; ponowne wykorzystanie istniejących kodu, kontraktów, komponentów i dowodów.
- Ustalenie rzeczywistego kontraktu Platform Knowledge ↔ ACG ↔ CIC: zapytanie, rodzaj zadania, prywatny zakres UserID, ograniczenia źródła, wersje, budżet tokenów, cytowania, kompletność i stany braku odpowiedzi.
- Rozróżnienie wyszukania znanego dokumentu od odkrycia wiedzy naturalnym pytaniem oraz pełnego podsumowania dokumentu.
- Sprawdzenie potrzebnych operacji Identity/E1, zaufanej tożsamości użytkownika, delegacji workera, pamięci, historii rozmów i likwidacji konta. Każdy brak ma zakres, właściciela i zależność wykonawczą; gotowa specyfikacja nie jest przedstawiana jako gotowa implementacja.
- Rejestracja wymaganych powierzchni i właścicieli przed zapisem kodu, zgodnie z wymaganym G1 i routingiem. Docelowe nowe powierzchnie: `apps/platform-knowledge-runtime/**`, `packages/platform-knowledge-contracts/**`, `packages/platform-knowledge-core/**`, `.github/workflows/platform-knowledge-ci.yml`. Integracje istniejących powierzchni zachowują ich właścicieli.
- Określenie klasy danych, właściciela, autora i dozwolonych operacji przed utrwalaniem danych. OrganisationID nie daje dostępu do prywatnej biblioteki.
- Przygotowanie pakietu instrukcji Render/GitHub/Neon: istniejące lub potrzebne zasoby, nazwy i identyfikatory, środowisko, konfiguracja bez jawnych sekretów, role runtime i migratora, magazyn uploadów, sposób przekazania poświadczeń i sprawdzenia gotowości.
- Ustalenie skończonego budżetu OpenAI i limitów dokumentów, czasu, prób, tokenów oraz współbieżności przed płatnym przetwarzaniem. Wspólny budżet platformowy nie oznacza braku limitu.
- Przygotowanie wersjonowanego zestawu referencyjnego i progów jakości przed testami: rzeczywiste formaty, długi dokument, dokumenty konkurujące, pytania wielofragmentowe, dokładne identyfikatory, tabele, sprzeczności, brak odpowiedzi i odmowy dostępu. Wzorzec nie opiera się wyłącznie na samoocenie modelu.
- Ustalenie właściwej instrumentacji API i workera oraz wykonalnego odzyskania danych i wydania. Dla pierwszego deploymentu jawnie wskazuje się brak poprzedniej wersji i procedurę bezpiecznego zatrzymania; nie tworzy się fikcyjnego Last Known Good.

### Kryteria sukcesu

- Kontrakty docelowe i potrzebne zmiany są jednoznaczne, a zależności mają właściwych właścicieli.
- Routing i wymagane dopuszczenia do przewidzianych prac są gotowe; brakujące implementacje mają określony zakres wykonania.
- Właściciel wykonał potrzebny pakiet przygotowania zasobów, a ich tożsamości Development, konfiguracja i właściwe role zostały potwierdzone.
- Budżet, konfiguracja dostawcy, profil walidacji oraz warunki odzyskiwania pozwalają przeprowadzić następne zależne operacje.

### Rezultat biznesowy

Gotowe warunki do ciągłej realizacji, z wcześnie rozstrzygniętymi podstawowymi zależnościami integracji i ograniczeniem oczekiwania na pojedyncze czynności właścicielskie.

## 5. Etap 2 — działająca biblioteka wiedzy na Development

### Zakres

- Automatyczny import PDF, DOC/DOCX, PPT/PPTX, TXT, MD/Markdown, z OCR tam, gdzie jest potrzebny. Google Docs po eksporcie; bez obowiązkowego konektora.
- Weryfikacja rzeczywistego formatu, niebezpiecznej zawartości i limitów, izolacja parserów, brak makr i aktywnej zawartości oraz ochrona przed instrukcjami dokumentu.
- Inwentaryzacja źródła, odczyt struktury, tabele i wykresy z oznaczeniem ograniczeń, lokalizacje źródłowe bez fikcyjnych numerów stron.
- Adaptacja automatycznych mechanizmów Memoros: podział przed analizą AI, przetworzenie wszystkich partii, chunkowanie bez utraty odczytanego tekstu, powiązania wiedzy ze źródłem, embeddingi OpenAI, indeksy tekstowe i wektorowe.
- Jeden logiczny magazyn Postgres/pgvector, chronione zakresy danych, neutralne wersjonowane API i niezależność od serwera oraz bazy Memoros. Preferowanie istniejących mechanizmów; dodatkowy silnik lub kolejka wymagają rzeczywistego uzasadnienia.
- Metadane, ranga i aktualność źródła, prawa do przetwarzania i ekspozycji oraz dziedziczenie ograniczeń przez pochodne. Nieznana klasyfikacja nie przypisuje organizacji i nie rozszerza praw.
- Trwałe zadania, punkty wznowienia, ograniczone próby, kontrola kosztów i niepewnych płatnych wyników, odporność na spóźnionego wykonawcę, bezpieczne generacje indeksów.
- Usuwanie oryginałów po potrzebnym przetwarzaniu, maksymalnie po 24 godzinach od uploadu; zachowanie reprezentacji potrzebnej do RAG i jawna potrzeba ponownego uploadu, jeśli nowy parser wymaga usuniętego oryginału.
- Prosty panel administratora: upload, postęp, pokrycie, braki, wynik, publikacja całego materiału, wycofanie i usunięcie. Bez ręcznej akceptacji chunków lub embeddingów.
- Wczesne przygotowanie adaptera ACG i testów kontraktowych producenta/odbiorcy. Minimalny przepływ wykorzystuje docelowy kontrakt planu CIC, rzeczywisty adapter i Platform Knowledge oraz niezależnego konsumenta testowego, przed ukończeniem całego silnika. Test oparty na fixture nie jest deklarowany jako rzeczywista konwersacja CIC.
- Przygotowanie niezależnych części pamięci, retencji i cyklu życia konta oraz testów ich kontraktów. Przyjęcie potrzebnych zmian u właściwych właścicieli odbywa się w dopuszczonym zakresie; nie odkłada się wszystkich braków Identity/E1 do etapu trzeciego.
- Uruchomienie API, workera i panelu na przygotowanym Development, wraz z kontrolą błędów, wydajności, kosztu i poprawności biznesowej procesów.

### Kryteria sukcesu

- Rzeczywiste pliki wszystkich wspieranych rozszerzeń przechodzą proces, a dokument około 100 stron dostarcza wiedzę z początku, środka i końca.
- Wszystkie jednostki źródła są rozliczone; braki są jawne. Przypadek niepełny kończy się wynikiem częściowym, nie pozornym sukcesem.
- Kilka dokumentów konkuruje o trafienie. Naturalne pytania bez technicznej podpowiedzi źródła odnajdują potrzebne dowody, również z kilku fragmentów. Sprawdzane są dokładne identyfikatory, tabele, sprzeczności i brak odpowiedzi.
- Niezależny konsument otrzymuje użyteczną paczkę kontekstu z poprawną lokalizacją i dowodami wspierającymi oczekiwane twierdzenia; działa minimalny przepływ adaptera i testy kontraktowe.
- Wiedza działa po usunięciu oryginału. Przerwane zadania są odzyskiwane, a błędna przebudowa nie niszczy poprzedniej prawidłowej generacji.
- Administrator rzeczywiście importuje, publikuje i wycofuje materiał na Development. Wycofanie odcina retrieval i nie jest cofane przez cache lub stare zadanie.

### Rezultat biznesowy

Profitia ma samodzielną, działającą bibliotekę wiedzy i API do jej wykorzystania. Jakość silnika oraz adapterów jest potwierdzona niezależnie od końcowej odpowiedzi asystenta. To użyteczny rezultat pośredni, nie zakończenie całego zadania wdrożeniowego.

## 6. Etap 3 — pełne wykorzystanie w SpendGuru i odbiór całości

### Zakres

- Upload użytkownika w uzgodnionym miejscu istniejącego SpendGuru, automatyczne przetwarzanie w tle i czytelne stany gotowości oraz braków.
- Prywatna biblioteka przypisana do serwerowo zweryfikowanego wewnętrznego UserID, bez udostępnienia innemu użytkownikowi lub administratorowi organizacji.
- Pełne połączenie hosta asystenta, CIC, ACG i Platform Knowledge; wiedza wspólna oraz prywatna, naturalne pytania, cytowania i podsumowanie obejmujące wszystkie części dokumentu.
- Budżet kontekstu: CIC określa potrzebę, Platform Knowledge lokalnie wyszukuje i szereguje, ACG przydziela i agreguje, host rozlicza całe okno modelu. Istotne pominięcia są ujawniane.
- Pamięć między rozmowami po jednorazowym czytelnym włączeniu, z pochodzeniem, aktualizacją, korektą, przeglądaniem, wyłączeniem i usuwaniem. Historia rozmów pozostaje u obecnego właściciela.
- Retencja prywatnej wiedzy i pamięci: 180 dni zgodnie z definicją merytorycznego użycia w kanonie; techniczne skanowanie nie przedłuża retencji. Biblioteka wspólna respektuje własną politykę źródłową.
- Utrata praw i zmiana organizacji respektują ograniczenia K4/K5, bez usuwania całej niezależnej wiedzy prywatnej lub nadawania organizacji prawa odczytu.
- Likwidacja konta przez istniejący autorytatywny kontrakt Identity: odcięcie użycia, trwałe i idempotentne czyszczenie oraz potwierdzenie wykonania, bez sesji zamkniętego użytkownika i bez odtworzenia danych przez powracający wynik.
- Minimalizacja wywołań Clerk/E1: zaufany kontekst i ograniczona delegacja zadania, bez ponownego uwierzytelniania każdego chunka, z zachowaniem aktualnych kontroli granic operacji i cofnięcia dostępu.
- Końcowe wdrożenia, testy na rzeczywistych kontach Development, naprawy wykrytych usterek, potwierdzenie wersji i danych oraz właściwe closeout wszystkich objętych profili.

### Dwa obowiązkowe scenariusze biznesowe

1. Administrator publikuje dopuszczony materiał wspólny. Uprawniony użytkownik zadaje naturalne pytanie; asystent odnajduje i wykorzystuje właściwe fragmenty, podaje źródła oraz respektuje późniejsze wycofanie.
2. Użytkownik przesyła własny duży dokument. Otrzymuje podsumowanie lub odpowiedź ze źródłami, a później korzysta z dopuszczonej wiedzy w nowej rozmowie. Pamięć działa dopiero po włączeniu; drugi użytkownik nie uzyskuje dostępu. Wyłączenie, usunięcie i likwidacja konta mają wymagane skutki.

Przebiegi wykorzystują rzeczywisty host, CIC/ACG, Platform Knowledge, OpenAI i persistence w autoryzowanym Development. Nie otrzymują ukrytej podpowiedzi dokumentu. Oceniane są fragmenty faktycznie dostarczone do modelu i użyte w odpowiedzi. Wiedza ogólna modelu, fixture lub mock nie zastępują tego dowodu.

### Rezultat biznesowy

Pełne Platform Knowledge v1 działa w SpendGuru Development: Profitia zasila wiedzę wspólną, użytkownik korzysta z własnych dokumentów i pamięci, a asystent automatycznie otrzymuje właściwy, uprawniony i użyteczny kontekst.

## 7. Rejestr realizacji etapów

Statusy: NIE_ROZPOCZĘTY, W_TOKU, CZĘŚCIOWY, ZABLOKOWANY, ZAKOŃCZONY. ZABLOKOWANY wskazuje konkretną zależność i nie zatrzymuje niezależnych prac. ZAKOŃCZONY wymaga dowodów kryteriów etapu; nie jest nadawany po samym merge.

| Etap | Status aktualny | Początek / koniec | Dowody taskId / PR / SHA / deploy / test | Rzeczywiste braki |
|---|---|---|---|---|
| 1. Przygotowanie realizacji i integracji | W_TOKU | 2026-11-11 / — | ARCH-PLATFORM-KNOWLEDGE-STAGE1-G1-20261111; [przygotowanie integracji i pakiet właścicielski](platform-knowledge-development-foundation-v1.md) | Zasoby właściciela, poświadczenia/budżet i kontrakty wykonywalne do potwierdzenia |
| 2. Biblioteka wiedzy na Development | NIE_ROZPOCZĘTY | — / — | — | Implementacja i uruchomienie do wykonania |
| 3. Pełne wykorzystanie w SpendGuru | NIE_ROZPOCZĘTY | — / — | — | Integracja i cały odbiór Development do wykonania |

Wykonawca aktualizuje rejestr po rzeczywistych wynikach, bez ponownej akceptacji planu. Operacyjne dowody pozostają w istniejących PMOS/PHR, CI i artefaktach wydania; tabela odsyła do nich zamiast tworzyć konkurencyjną historię. Sama publikacja tego dokumentu nie realizuje żadnego etapu wdrożeniowego. Właściciel zlecił rozpoczęcie etapu pierwszego 11 listopada 2026 r.; stan przy pierwotnej publikacji w nagłówku pozostaje historyczny, a bieżący postęp wskazuje tabela.

## 8. Lista końcowego odbioru etapu trzeciego

Poniższa lista grupuje obowiązki odbioru; **obowiązuje także każdy wiersz §29 kanonu**, z przypisaniem do testu i dowodu. Dowody etapu drugiego mogą być ponownie wykorzystane, jeżeli nadal dotyczą właściwych wersji, konfiguracji i zależności. Pełnego przepływu asystenta nie zastępują dowody silnika.

| ID | Warunek do potwierdzenia | Stan przy publikacji / dowód |
|---|---|---|
| E3-01 | Oba scenariusze biznesowe rzeczywiście działają na Development, z rozpoznawalnymi wersjami usług i kontraktów | DO_POTWIERDZENIA / — |
| E3-02 | Wszystkie formaty, długi dokument, pełne rozliczenie źródła, brak cichej utraty tekstu i jawne wyniki częściowe | DO_POTWIERDZENIA / — |
| E3-03 | Wyszukiwanie hybrydowe, dokumenty konkurujące, naturalne pytania bez wskazania dokumentu i łączenie kilku dowodów | DO_POTWIERDZENIA / — |
| E3-04 | Rzeczywisty CIC–ACG–host dostarcza właściwe fragmenty; poprawne cytowania wspierają twierdzenia, a brak dowodów jest ujawniany | DO_POTWIERDZENIA / — |
| E3-05 | Podsumowanie obejmuje cały dokument; tabele i wykresy zachowują wartości, jednostki, kontekst i ograniczenia odczytu | DO_POTWIERDZENIA / — |
| E3-06 | Aktualność, ranga, sprzeczności i prawa źródłowe są respektowane również przez pochodne i API | DO_POTWIERDZENIA / — |
| E3-07 | Brak akceptacji chunków/embeddingów; publikacja wspólna wymaga jednego potwierdzenia całego materiału | DO_POTWIERDZENIA / — |
| E3-08 | Drugi użytkownik, również tej samej organizacji, ani administrator organizacji nie uzyskuje prywatnej wiedzy właściciela | DO_POTWIERDZENIA / — |
| E3-09 | K4/K5, zmiana organizacji i cofnięcie praw działają; nieznana klasyfikacja nie nadaje organizacji własności ani szerszych praw | DO_POTWIERDZENIA / — |
| E3-10 | Pamięć po opt-in działa między rozmowami; korekta, przegląd, wyłączenie i usunięcie mają wymagany skutek | DO_POTWIERDZENIA / — |
| E3-11 | Oryginał znika maksymalnie po 24h, RAG nadal działa; polityka 180 dni i skończona retencja pochodnych są egzekwowane | DO_POTWIERDZENIA / — |
| E3-12 | Wycofanie lub usunięcie źródła odcina użycie i pochodne; cache, backup lub stare zadanie nie przywracają dostępności | DO_POTWIERDZENIA / — |
| E3-13 | Identity uruchamia kontrolowane usunięcie konta; czyszczenie kończy się bez sesji, jest idempotentne i ma potwierdzenie | DO_POTWIERDZENIA / — |
| E3-14 | Likwidacja podczas zadania blokuje spóźniony wynik; abonament i członkostwo nie są mylone z kontem; wspólna publikacja operatora jest zachowana zgodnie z polityką | DO_POTWIERDZENIA / — |
| E3-15 | Odzyskiwanie zadań, skończone próby i koszt UNKNOWN działają; nowa generacja indeksu jest sprawdzana przed przełączeniem | DO_POTWIERDZENIA / — |
| E3-16 | Budżety kontekstu obejmują metadane i cytowania; istotne pominięcia są jawne; brak uwierzytelniania per chunk przy zachowaniu autoryzacji operacji | DO_POTWIERDZENIA / — |
| E3-17 | Niebezpieczne pliki i prompt injection nie przejmują wykonania; niezależny odbiorca używa publicznego kontraktu bez zależności od ACG | DO_POTWIERDZENIA / — |
| E3-18 | Monitoring API i workera ma właściwe środowisko i release, mierzy procesy oraz nie ujawnia prywatnych treści; koszt i limity są kontrolowane | DO_POTWIERDZENIA / — |
| E3-19 | Wymagane CI, rzeczywiste wdrożenia i persistence, wykonalne recovery/LKG oraz closeout PMOS/PHR i pozostałe publikacje właściwych profili są potwierdzone | DO_POTWIERDZENIA / — |

Retencję 180 dni i przypadki czasowe sprawdza się kontrolowanym zegarem oraz rzeczywistym mechanizmem zadań, bez oczekiwania 180 dni. Nie przedstawia się symulacji upływu czasu jako obserwacji 180 dni pracy środowiska. Faktyczne usunięcie oryginału, odcięcie retrieval i czyszczenie pochodnych mają własne dowody.

Niespełniony warunek oznacza wynik częściowy albo konkretną blokadę i kontynuację dopuszczonych prac. Nie obniża się kryteriów lub progów wyłącznie dla uzyskania zielonego wyniku. Zmiana istotnego zakresu wymaga właściwej decyzji; rutynowe poprawki nie wymagają nowego zlecenia.

## 9. Zamknięcie realizacji

ZAKOŃCZONY dla całości można nadać wyłącznie po potwierdzeniu całej listy E3-01–E3-19 i pełnego §29 kanonu na Development. Raport końcowy podaje rezultat biznesowy, dowody faktycznie działającego przepływu, wersje wdrożeń, rzeczywiste ograniczenia i wymagany closeout. Zmierzone koszty i czasy są odróżniane od UNKNOWN/NOT_MEASURED.

Nie jest wymagany dodatkowy odbiór właścicielski pomiędzy etapami ani ponowna akceptacja tego harmonogramu. Rzeczywiste szczególne upoważnienia i czynności zastrzeżone dla właściciela pozostają zgodne z §2. [Dowód akceptacji planu i zasady zakończenia](../evidence/2026-11-11-platform-knowledge-delivery-plan-owner-approval.md).
