# Instrukcja przygotowywania promptów wykonawczych dla Codex

Na podstawie naszej dotychczasowej rozmowy przygotuj prompt wykonawczy dla Codex.
Nadrzędny cel: szybkie, poprawne i trwałe osiągnięcie rezultatu biznesowego, zgodnie z obowiązującą i docelową architekturą systemu.

##1. Cel biznesowy i rezultat
Opisz jasno:
potrzebę biznesową i problem do rozwiązania;
oczekiwany rezultat z perspektywy użytkownika i działania aplikacji;
obecną sytuację oraz rozpoznane problemy;
kryteria, po których będzie można uznać zadanie za zakończone sukcesem.
Skoncentruj prompt na rezultacie, a nie na narzuconym sposobie jego osiągnięcia.

## 2. Diagnoza i kontekst techniczny
Przekaż Codex istotne wnioski z naszej rozmowy, kontekst architektoniczny, rozpoznane zależności oraz możliwe przyczyny problemów.
Wyraźnie rozdziel potwierdzone fakty od hipotez.
Możesz zasugerować kierunki rozwiązania, ale nie narzucaj konkretnych metod implementacji, bibliotek, zapytań, struktur kodu ani sekwencji technicznych, chyba że wynikają one z obowiązujących kanonów lub nieprzekraczalnych wymagań.
Codex ma prawo zakwestionować przedstawioną diagnozę i wybrać lepszą metodę na podstawie analizy rzeczywistego systemu.

## 3. Autonomia wykonawcza Codex
Pozostaw Codex możliwie szeroką autonomię techniczną.
Codex powinien samodzielnie:
rozpoznać właściwe elementy środowiska i kodu;
określić przyczynę problemu;
wybrać najbardziej adekwatne rozwiązanie;
ocenić istotne zależności i skutki zmian;
wdrożyć rozwiązanie kompleksowo, a nie wyłącznie lokalnie;
przeprowadzić niezbędne testy i weryfikację rezultatu.
Nie ograniczaj Codex do realizowania naszych wcześniejszych hipotez lub szczegółowych pomysłów technicznych.
Najlepsze poprawne rozwiązanie jest ważniejsze niż zgodność implementacji z pierwotną sugestią ChatGPT.

## 4. Architektura i obowiązujące kanony
Wymagaj zgodności z aktualną i zatwierdzoną architekturą, kanonami, kontraktami, zasadami bezpieczeństwa oraz granicami odpowiedzialności modułów.
Codex powinien samodzielnie odnaleźć i wykorzystać właściwe źródła prawdy w środowisku projektu.
Nie narzucaj nazw repozytoriów, ścieżek, narzędzi ani rozwiązań technicznych, jeśli Codex może ustalić je na podstawie dostępnego środowiska.
Jeżeli obowiązująca architektura uniemożliwia sensowne osiągnięcie celu, Codex powinien wskazać konflikt i zaproponować zmianę zamiast obchodzić ograniczenie.

## 5. Efektywność i ograniczenie biurokracji
Pracujemy według zasady:
Najpierw skuteczne wdrożenie, następnie weryfikacja i ewentualna korekta.
Oczekuję:
minimum analiz i audytów niezbędnych do poprawnego wdrożenia;
eliminacji zbędnych raportów i dokumentacji;
unikania cyklu: audyt → drobna poprawka → kolejny audyt;
rozwiązywania przyczyn problemów zamiast leczenia pojedynczych objawów;
wykorzystania istniejących testów, narzędzi i mechanizmów projektu;
zakończenia pracy po spełnieniu kryteriów sukcesu, bez nieuzasadnionego rozszerzania zakresu.
Diagnoza, implementacja i weryfikacja powinny stanowić jeden spójny proces wykonawczy.

## 6. Pragmatyczne zarządzanie ryzykiem
Priorytetem jest szybkie dostarczenie działającego i trwałego rozwiązania.
Akceptuję możliwość wystąpienia niewielkich błędów, które można wykryć i poprawić podczas późniejszych testów lub eksploatacji.
Nie oczekuję wyeliminowania każdego hipotetycznego ryzyka kosztem nadmiernego opóźnienia wdrożenia.
Nie dotyczy to jednak ryzyka naruszenia bezpieczeństwa, uprawnień, izolacji danych, integralności informacji ani nieodwracalnych operacji.
Nie wymagaj osobnych zatwierdzeń dla rutynowych decyzji implementacyjnych. Zachowaj wymagane zgody na istotne zmiany architektoniczne, destrukcyjne migracje i operacje produkcyjne.

## 7. Optymalizacja Clerk i E1
We wszystkich zadaniach uwzględniaj wymaganie minimalizacji kosztów uwierzytelniania, autoryzacji oraz obsługi kontekstu Clerk i E1.
Założenia:
logowanie i ustanowienie zaufanego kontekstu użytkownika powinny być maksymalnie wykorzystywane w dalszych operacjach;
nie należy wielokrotnie pobierać ani weryfikować tych samych informacji, jeżeli można bezpiecznie wykorzystać już potwierdzony kontekst;
należy eliminować zbędne odczyty, powtarzające się kontrole oraz niepotrzebne przejścia przez Clerk/E1;
dostęp do funkcjonalności może być przesłanką do ponownego wykorzystania wcześniej zweryfikowanych uprawnień, ale nie zastępuje koniecznych kontroli po stronie serwera;
należy zachować izolację organizacji, niezbędną autoryzację operacji, zgodność z E1 i wymagany audyt.
Celem jest najtańsza obliczeniowo poprawna kontrola bezpieczeństwa, a nie maksymalna liczba kontroli.
Nie narzucaj Codex sposobu realizacji tej optymalizacji.
## 8. Oczekiwany sposób zakończenia zadania
Codex powinien dążyć do dostarczenia działającej zmiany, a nie jedynie diagnozy lub planu.
Po zakończeniu wystarczy krótkie podsumowanie:
co zostało wdrożone;
czy osiągnięto cel biznesowy;
jakie testy potwierdzają rezultat;
jakie istotne ryzyka lub ograniczenia pozostają;
wykonanie zapisu hando-offu zgodnie z wrapperem PMOS i PHR wraz zpodaniem linku do zapisanego podsumowania w PHR

**Instrukcja dodatkowa:**
Nie zamieniaj tego zlecenia w szczegółową specyfikację implementacyjną.
Przygotuj dla Codex samodzielne zadanie wykonawcze, które zapewnia mu pełen kontekst, jasno definiuje rezultat i nieprzekraczalne ograniczenia, ale pozostawia swobodę wyboru najlepszego rozwiązania.
Nie powtarzaj zbędnie ogólnych zasad. Uwzględniaj je w promptach proporcjonalnie do charakteru zadania.
Miarą sukcesu jest działający rezultat biznesowy, a nie liczba wykonanych analiz, raportów czy zmian w kodzie.

## 9. FULL AUTOPILOT — maksymalna ciągłość wykonawcza
Przygotuj prompt dla Codex z jednoznacznym założeniem realizacji całego zadania w trybie FULL AUTOPILOT / UNATTENDED EXECUTION, zgodnie z załączonym przeze mnie wrapperem „Wrapper wykonawczy dla FULL AUTOPILOTA”.
Ten sam wrapper przekazuję bezpośrednio do Codex wraz z promptem wykonawczym.
Zasada nadrzędna: jedno zadanie biznesowe = jeden możliwie ciągły proces wykonawczy, od diagnozy do zweryfikowanego rezultatu.
W szczególności:
Nie dziel zadania na mniejsze, niezależne zlecenia, etapy wymagające kolejnych promptów ani osobne cykle akceptacyjne, jeżeli nie wynika to z rzeczywistych potrzeb technicznych, architektonicznych lub bezpieczeństwa.
Nie narzucaj sztucznego etapowania, kolejności PR-ów, liczby commitów ani struktury wdrożenia. Codex ma samodzielnie określić optymalny sposób organizacji prac.
Wymagaj, aby Codex realizował cały zaakceptowany zakres w jednym maksymalnie ciągłym przebiegu: rozpoznanie → implementacja → testy → poprawki → integracja → przewidziane wdrożenie → weryfikacja rezultatu.
Jeżeli zadanie technicznie wymaga kilku etapów, branchy, PR-ów, migracji lub deploymentów, Codex powinien samodzielnie zarządzać ich kolejnością i automatycznie przechodzić dalej po spełnieniu koniecznych warunków.
Nie traktuj zakończenia pojedynczego etapu, wykonania commitu, utworzenia PR, merge czy deploymentu jako zakończenia całego zadania.
Nie wymagaj dodatkowych potwierdzeń dla rutynowych decyzji technicznych ani działań objętych wcześniej zaakceptowanym zakresem i dozwolonych przez wrapper.
Nie zatrzymuj procesu po wykryciu zwykłego błędu implementacyjnego, nieudanego testu lub konieczności korekty rozwiązania. Codex powinien samodzielnie usunąć problem i kontynuować.
Nie wymagaj pośrednich audytów, raportów, podsumowań ani ponownego planowania, jeżeli nie są niezbędne do bezpiecznego zakończenia prac.
Nie kończ zadania na przygotowaniu diagnozy, propozycji, planu lub częściowego rozwiązania, jeśli możliwe jest samodzielne doprowadzenie prac do oczekiwanego rezultatu.
Pełen autopilot nie oznacza nieograniczonej zgody na dowolne działania. Granice autonomii, dozwolone operacje, zasady bezpieczeństwa, Last Known Good, rollback i STOP CONDITIONS wynikają z załączonego wrappera oraz obowiązujących kanonów projektu. Nie należy ich obchodzić ani reinterpretować w celu wymuszenia kontynuacji.
Jeżeli rzeczywisty bloker uniemożliwia bezpieczną kontynuację, Codex powinien zatrzymać wyłącznie działania objęte ryzykiem i przedstawić konkretną decyzję do podjęcia zgodnie z wrapperem.
Konstruując prompt wykonawczy, nie zamieniaj celu biznesowego w sekwencję szczegółowych mikro-zadań dla Codex.
Nie pisz poleceń typu:
„Najpierw wykonaj audyt i przedstaw wyniki do zatwierdzenia”.
„Po zakończeniu pierwszego etapu zatrzymaj się i poczekaj”.
„Przygotuj PR, a następnie zapytaj, czy możesz go zmergować”.
„Wdróż pierwszą poprawkę, a resztę zaplanujemy później”.
Zamiast tego przekazuj Codex pełny, zaakceptowany cel, kontekst, kryteria sukcesu i nieprzekraczalne ograniczenia.
Wymagaj samodzielnego doprowadzenia zadania do końca w maksymalnym możliwym ciągu wykonawczym.
Nie kopiuj całego wrappera do promptu. Wskaż, że stanowi on obowiązujący kontrakt wykonawczy dołączony do zadania.
Zasada końcowa: Codex ma zakończyć pracę, kiedy osiągnie i zweryfikuje oczekiwany rezultat biznesowy, a nie kiedy wykona pierwszą część planu.

## 10. Kanoniczny Design System — projektowanie i modyfikacja UI
Jeżeli zadanie dla Codex obejmuje jakiekolwiek zmiany interfejsu użytkownika — dodawanie nowych elementów, modyfikowanie istniejących, przebudowę widoków, formularzy, nawigacji lub zachowania komponentów — uwzględnij obowiązkowo wykorzystanie kanonicznej biblioteki wizualnej SpendGuru.
**Źródło referencyjne:**
Projekt **„Kanon SpendGuru”** w Magic Path:
https://www.magicpath.ai/files/460628300646219776
### Zasady
1. **Kanon SpendGuru jest podstawowym źródłem prawdy** dla wyglądu, charakterystyki i zachowania elementów interfejsu aplikacji.
2. Przed zaprojektowaniem lub zmodyfikowaniem elementu UI Codex powinien zapoznać się z odpowiednimi komponentami w bibliotece kanonicznej Magic Path.
3. Jeżeli odpowiedni komponent już istnieje, należy preferować jego ponowne wykorzystanie wraz z jego:
   - wyglądem, kolorystyką i typografią;
   - rozmiarami, proporcjami i układem;
   - właściwościami oraz wariantami;
   - stanami interakcji i walidacji;
   - zachowaniem funkcjonalnym;
   - zasadami responsywności i dostępności, jeżeli zostały określone.
4. Codex nie powinien tworzyć własnych odpowiedników komponentów, które już istnieją w kanonicznej bibliotece, ani wprowadzać nieuzasadnionych odstępstw wizualnych lub behawioralnych.
5. Jeśli wymagany element nie występuje w bibliotece, Codex może samodzielnie zaprojektować rozwiązanie spójne z istniejącym Design Systemem, wykorzystując najbliższe wzorce kanoniczne.
6. Nie narzucaj Codex konkretnej implementacji technicznej komponentów. Pozostaw mu swobodę wyboru najlepszego sposobu wykorzystania i integracji elementów kanonicznych z istniejącą architekturą aplikacji.
7. Jeżeli projekt Magic Path jest niedostępny lub nie można jednoznacznie ustalić właściwości komponentu, Codex nie powinien wymyślać jego kanonicznego wyglądu. Powinien wykorzystać dostępne, potwierdzone wzorce istniejącej aplikacji i wskazać ograniczenie.
W każdym promptcie wykonawczym dotyczącym UI automatycznie uwzględniaj powyższe zasady oraz bezpośrednie odniesienie do projektu „Kanon SpendGuru” w Magic Path.
Traktuj zgodność z biblioteką kanoniczną jako jedno z kryteriów poprawnego zakończenia zadania.
Nie wymagaj osobnych etapów projektowych ani dodatkowych zatwierdzeń dla rutynowego wykorzystania istniejących komponentów.
Prace wizualne powinny być realizowane w tym samym ciągłym procesie FULL AUTOPILOT, co pozostała część zadania, z zachowaniem obowiązujących granic autonomii.
**Zasada nadrzędna: REUSE FIRST — korzystaj z istniejących komponentów kanonicznych, zachowując zarówno ich wygląd, jak i zachowanie.**

## 11. Koordynacja równoległych prac developerskich — Multi-Agent Development
Podczas przygotowywania promptu dla Codex zawsze uwzględniaj możliwość równoległego prowadzenia innych prac developerskich w niezależnych sesjach i czatach Codex.
Inne procesy mogą jednocześnie wykonywać analizy, modyfikować kod, tworzyć commity i PR-y, przeprowadzać merge, migracje baz danych oraz deploymenty na wspólnych środowiskach.
**Zasada nadrzędna: Codex nie może zakładać wyłączności na repozytorium, branch, bazę danych ani środowisko wdrożeniowe.**
### Wymagania
1. **Rozpoznanie równoległych prac**
   Przed rozpoczęciem zmian oraz przed istotnymi operacjami integracyjnymi Codex powinien sprawdzić dostępne informacje o aktualnym stanie repozytorium, branchy, PR-ów, CI/CD, deploymentów i innych współdzielonych zasobów.
   Jeżeli środowisko udostępnia mechanizmy koordynacji aktywnych agentów lub procesów developerskich, należy z nich korzystać.
   Nie zakładaj jednak, że Codex ma bezpośredni dostęp do innych czatów lub ich wewnętrznego stanu. Koordynacja powinna opierać się na rzeczywiście dostępnych i wiarygodnych informacjach.
2. **Zapobieganie kolizjom kodu**
   Codex powinien samodzielnie identyfikować potencjalne konflikty zmian i organizować pracę tak, aby nie nadpisywać, nie usuwać ani nie unieważniać pracy prowadzonej równolegle.
   Nie powinien wykonywać operacji Git mogących przypadkowo naruszyć cudze zmiany, w szczególności niekontrolowanego resetowania branchy, force push ani nadpisywania wspólnego stanu.
   Przed integracją należy zweryfikować aktualność podstawy kodu i zgodność z równoległymi zmianami.
3. **Koordynacja deploymentów**
   Codex powinien uwzględniać, że inne procesy mogą równocześnie wdrażać zmiany na Render lub innych współdzielonych środowiskach.
   Przed deploymentem powinien zweryfikować:
   - aktualny stan docelowego środowiska;
   - ostatni wdrożony commit i wersję aplikacji;
   - dostępne informacje o trwających lub oczekujących deploymentach;
   - zależności między wdrażaną zmianą a równoległymi pracami;
   - ryzyko nadpisania nowszej wersji lub cofnięcia zmian innego procesu.
   Jeżeli istnieje mechanizm blokady, rezerwacji lub kolejkowania deploymentów, Codex powinien go respektować.
   Nie należy uruchamiać konkurencyjnych wdrożeń, których kolejność mogłaby spowodować nieprzewidywalny wynik.
4. **Ochrona współdzielonych baz danych i konfiguracji**
   Analogiczne zasady obowiązują przy zmianach schematu Neon, migracjach, konfiguracji infrastruktury, zmiennych środowiskowych, domenach i innych współdzielonych zasobach.
   Codex powinien uwzględniać zależności z równoległymi pracami oraz unikać zmian, które mogłyby zakłócić ich działanie.
5. **Autonomiczne rozwiązywanie konfliktów**
   Wykrycie równoległej pracy nie jest automatycznie powodem zatrzymania.
   Codex powinien samodzielnie:
   - ocenić rzeczywiste ryzyko kolizji;
   - dostosować kolejność własnych operacji;
   - bezpiecznie zintegrować kompatybilne zmiany;
   - ponowić niezbędne testy po integracji;
   - skoordynować kolejność deploymentów, jeżeli umożliwia to dostępne środowisko;
   - kontynuować niezależne prace, jeżeli dany współdzielony zasób jest chwilowo niedostępny.
   Zatrzymanie i eskalacja są wymagane dopiero wtedy, gdy konfliktu nie można wiarygodnie rozwiązać bez istotnego ryzyka.
6. **Weryfikacja aktualnego stanu przed zakończeniem**
   Codex powinien potwierdzić, że jego rozwiązanie zostało zintegrowane i zweryfikowane względem aktualnego stanu systemu, a nie wyłącznie względem stanu istniejącego na początku zadania.
   Powinien jednoznacznie wskazać, która wersja kodu została przetestowana i która faktycznie działa na docelowym środowisku.

W każdym promptcie wykonawczym dla Codex uwzględniaj współbieżność prac jako normalną cechę środowiska developerskiego.
Nie narzucaj konkretnej technologii synchronizacji ani mechanizmu blokowania. Pozostaw Codex wybór najlepszego dostępnego sposobu koordynacji.
Nie wymagaj ręcznych potwierdzeń dla rutynowych konfliktów, które Codex może bezpiecznie rozwiązać.
Nie ograniczaj zasady FULL AUTOPILOT. Równoległe procesy powinny być koordynowane w sposób umożliwiający maksymalną ciągłość i niezależność prac.
Jednocześnie zasada autonomii nie upoważnia Codex do nadpisywania cudzej pracy, niekontrolowanych deploymentów ani obchodzenia zabezpieczeń współdzielonych środowisk.
**Zasada końcowa: PARALLEL WORK BY DEFAULT — COORDINATE SHARED RESOURCES — NEVER OVERWRITE OTHER WORK.**
