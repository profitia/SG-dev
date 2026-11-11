# UX/UI DESIGN CANON — MagicPath Integration Context

SG2.0 / SRM — UX/UI DESIGN CANON & MAGiCPATH INTEGRATION CONTEXT
1. Kontekst i cel
Pracujemy nad rozwojem interfejsu użytkownika platformy SpendGuru 2.0 oraz aplikacji SRM.
Rozwiązanie obejmuje między innymi:
SpendGuru AppShell — nadrzędny interfejs użytkownika, nawigację, motywy wizualne i integrację modułów.
X-Ray / Supplier Intelligence — analizę dostawców, danych finansowych i KYS.
Benchmark Finder / Category Builder — wyszukiwanie i kwalifikowanie benchmarków.
SRM — zarządzanie dostawcami i analizę ich kondycji.
Pozostałe moduły i elementy wspólnego interfejsu SpendGuru.
Celem jest zapewnienie jednolitego języka wizualnego, spójnych zachowań i przewidywalnych interakcji w całym ekosystemie.
W projekcie obowiązuje zasada Design Canon First.
Nie należy projektować ani wdrażać nowych wzorców UX/UI bez sprawdzenia ich zgodności z istniejącą biblioteką.

2. MagicPath — źródło kanonu UX/UI
Centralna biblioteka znajduje się w MagicPath:
Projekt: Biblioteka Elementów i Zachowań UX/UI
Adres:
https://www.magicpath.ai/files/460628300646219776
Project ID: 460628300646219776
Projekt zawiera interaktywną bibliotekę komponentów, wzorców, stanów i zachowań.
Biblioteka składa się z 16 rozdziałów, dostępnych w zakładce „Biblioteka”.
Nie jest to katalog statycznych ilustracji.
Poszczególne komponenty definiują między innymi:
wygląd, wymiary, kolorystykę i typografię;
sposób działania i reagowania na działania użytkownika;
stany aktywne, nieaktywne, loading, error, success i empty;
zasady animacji, przejść, hover i focus;
działanie formularzy, przycisków, menu, modali, tabel i wykresów;
zachowania związane z nawigacją i przepływem użytkownika;
zasady prezentacji danych i interakcji z nimi;
powiązania komponentów z rzeczywistymi ekranami aplikacji;
zasady kwalifikowania elementów do produktu.
Komponenty posiadają identyfikatory kanoniczne, m.in. z rodziny SRM-Cxx, które należy zachowywać jako odniesienia podczas implementacji.
Dostęp do MagicPath
Codex powinien korzystać z dostępnej integracji MagicPath i jej narzędzi do odczytu projektów oraz kodu komponentów.
Przed realizacją zadania:
Zweryfikuj dostęp do wskazanego projektu.
Odczytaj aktualną wersję biblioteki, a nie przypadkowy wcześniejszy snapshot.
Zidentyfikuj wzorce dotyczące konkretnego zadania.
Sprawdź powiązane komponenty, zachowania i stany.
Wykorzystaj istniejące rozwiązania, zamiast budować ich niezależne odpowiedniki.
Biblioteka zawiera również implementacje komponentów i rejestry w kodzie projektu MagicPath, m.in.:
library-registry.ts
DeliveryRuntime.tsx
delivery-registry.ts
komponenty z rodziny Canon*
Przy ich odczycie korzystaj z aktualnych zasobów MagicPath.
Nie zakładaj, że sama obecność integracji oznacza dostęp do każdego projektu. Jeśli odczyt jest niemożliwy, zgłoś ograniczenie zamiast odtwarzać kanon z domysłów.

3. Kanon UX/UI — zasady obowiązkowe
Biblioteka stanowi autorytatywne źródło zaakceptowanych wzorców wizualnych i interakcyjnych.
Obowiązują następujące reguły:
A. Reuse Before Create
Jeżeli odpowiedni komponent, zachowanie lub efekt jest już zdefiniowany, należy wykorzystać ten wzorzec.
B. No Parallel Design Systems
Nie tworzymy niezależnych systemów kolorów, przycisków, animacji, modali i formularzy dla każdego modułu.
Wyjątki mogą wynikać ze specyfiki hosta, np. osadzenia SRM w SpendGuru AppShell, ale muszą być jawne i ograniczone do właściwego kontekstu.
C. Canon Evolution
Nowe komponenty i zachowania, które nie są jeszcze opisane w bibliotece, należy zgłosić do kanonizacji.
Po akceptacji biznesowej uzupełniamy kanon, zamiast pozostawiać niezależne, nieudokumentowane rozwiązania.
D. Consistency Across Modules
Te same działania użytkownika powinny zachowywać się spójnie w SpendGuru i SRM, o ile nie istnieje uzasadniona różnica funkcjonalna.
E. Canon Status
Nie należy traktować wzorców oznaczonych jako częściowe, demonstracyjne lub oczekujące na decyzję jako automatycznie zatwierdzonych do wdrożenia.

4. Rozdział 16 — „Tylko projekt i symulacja”
To szczególnie ważna część biblioteki.
Wszystkie prototypy MagicPath muszą rozróżniać trzy rodzaje elementów.
PRODUKT
Element przeznaczony do rzeczywistej aplikacji.
Może obejmować:
widoczne komponenty interfejsu;
zaakceptowane interakcje;
funkcjonalności i zachowania;
dane pochodzące z rzeczywistego runtime'u.
Tylko jawnie zakwalifikowane elementy mogą zostać przekazane do implementacji produkcyjnej.
TYLKO PROJEKT
Elementy służące wyłącznie projektowaniu, prezentacji i dokumentowaniu rozwiązania.
Przykłady:
panele objaśniające;
komentarze projektowe;
narzędzia testowania;
przełączniki widoczności;
pomocnicze kontrolki demonstratora.
Nie należy implementować ich w aplikacji użytkownika.
SYMULACJA
Elementy przedstawiające przykładowe działanie lub dane.
Przykłady:
syntetyczne dane finansowe;
fikcyjne wyniki;
pozorowane operacje API;
demonstracyjne komunikaty;
symulowane wyszukiwanie;
lokalne atrapy odpowiedzi backendu.
Nie wolno przenosić mechanizmów symulacji jako rzeczywistej funkcjonalności aplikacji.
Kwalifikacja wielowymiarowa
Obowiązujący mechanizm rozdziela klasyfikację na trzy niezależne osie:
UI — czy element wizualny trafia do produktu?
Dane — czy prezentowana treść jest rzeczywista, projektowa czy demonstracyjna?
Zachowanie — czy interakcja ma być rzeczywiście implementowana?
Przykładowo:
Widok wykresu może mieć status produkt, ale dane pokazane w demonstratorze mogą mieć status symulacja.
W takiej sytuacji implementujemy zaakceptowany wykres i podłączamy rzeczywiste dane z istniejących kontraktów. Nie kopiujemy danych syntetycznych ani mechanizmów ich generowania.
Fail Closed
Obowiązuje zasada:
Brak jawnego dopuszczenia elementu do produktu oznacza STOP dla jego przeniesienia.
Ponadto:
oznaczenie kontenera jako produkt nie dopuszcza automatycznie jego elementów potomnych;
ukrycie elementu przez CSS nie oznacza usunięcia funkcjonalności;
narzędzia projektowe nie mogą trafić do aplikacji;
interakcje demonstracyjne nie mogą zastępować rzeczywistych operacji;
przenoszenie musi uwzględniać kwalifikację UI, danych i zachowania.
Należy respektować mechanizm i reguły z aktualnego DeliveryRuntime oraz delivery-registry.

5. Flow użytkownika — projektujemy zachowania, nie ilustracje
Makiety przygotowane w MagicPath stanowią interaktywne prototypy.
Każdy istotny element interfejsu powinien odzwierciedlać rzeczywistą sekwencję działań użytkownika.
Przykładowo:
Dashboard → wybór modułu → formularz → walidacja → loading → wynik → szczegóły → akcja → potwierdzenie
Projekt powinien uwzględniać zarówno ścieżkę poprawną, jak i istotne stany alternatywne.
Animacje, przejścia i efekty wizualne są częścią zachowania komponentów, a nie niezależną dekoracją.
Podczas wdrożenia należy zachować zaakceptowany model interakcji i odtworzyć go z użyciem rzeczywistej logiki aplikacji.
Klikalność prototypu nie oznacza, że prototyp ma działający backend.

6. Model współpracy ChatGPT → MagicPath → Codex
Przyjmujemy następujący podział odpowiedzialności.
ChatGPT — koncepcja i projektowanie
Użytkownik opisuje potrzeby biznesowe, oczekiwany wygląd i zachowanie aplikacji.
ChatGPT:
analizuje potrzeby;
sprawdza kanon UX/UI;
projektuje w MagicPath;
tworzy interaktywne flow;
kwalifikuje elementy zgodnie z zasadami rozdziału 16;
wprowadza korekty projektowe;
przygotowuje zadanie implementacyjne po akceptacji.
MagicPath — referencja projektowa
MagicPath przechowuje zaakceptowany projekt, zachowania, stany i wzorce.
Stanowi źródło referencyjne dla wyglądu i interakcji.
Nie stanowi automatycznie źródła rzeczywistej logiki biznesowej, autoryzacji, dostępu do danych ani kontraktów backendu.
Codex — implementacja
Codex odpowiada za:
identyfikację właściwego właściciela kodu;
odczyt zaakceptowanego wzorca;
implementację w istniejącej architekturze;
podłączenie rzeczywistych kontraktów;
zachowanie dotychczasowej logiki biznesowej;
testy;
integrację i deployment zgodnie z zadaniem.
Codex nie powinien samodzielnie reinterpretować zatwierdzonego UX, jeśli nie istnieją ku temu konkretne przeszkody techniczne.
W przypadku rzeczywistego konfliktu pomiędzy makietą a aplikacją należy zachować kontrakty bezpieczeństwa i logiki biznesowej oraz wskazać różnicę wymagającą decyzji.

7. Rozróżnienie biblioteki i repozytorium
MagicPath jest źródłem kanonu UX/UI.
GitHub pozostaje źródłem kodu aplikacyjnego i technicznych kontraktów.
Wdrożenie nie polega na bezrefleksyjnym kopiowaniu kodu wygenerowanego w MagicPath.
Codex musi odróżniać:
prezentację od logiki;
symulację od operacji backendowej;
wzorzec projektowy od implementacji produkcyjnej;
komponent współdzielony od wariantu specyficznego dla hosta.
W szczególności należy respektować granice pomiędzy:
apps/sg-runtime
apps/srm
packages/srm-xray
pozostałymi współdzielonymi pakietami.
Nie modyfikować samodzielnego SRM wyłącznie dlatego, że jego komponent jest osadzony w SpendGuru.
Nie tworzyć drugiej implementacji współdzielonego komponentu, jeżeli można zastosować jawny wariant hosta.

8. Wyjątek — bezpośrednie poprawki aplikacji
Nie każde zadanie wymaga przygotowania osobnego projektu MagicPath.
Jeżeli zadanie dotyczy:
naprawy istniejącego błędu;
usunięcia podwójnego komponentu;
korekty motywu jasnego/ciemnego;
dostosowania osadzonego widoku do AppShell;
usunięcia zbędnego elementu formularza;
przywrócenia zgodności z istniejącym kanonem;
można przeprowadzić bezpośrednią poprawkę kodu.
W takim przypadku Codex powinien sprawdzić odpowiednie zasady kanonu, ale nie tworzyć dodatkowej makiety, jeżeli oczekiwana zmiana jest jednoznaczna.
Nie należy generować zbędnych etapów analitycznych ani mnożyć zadań.

9. Aktualizacja kanonu
Jeżeli implementacja wprowadza nowy, zaakceptowany standard UX/UI, należy określić, czy wymaga on uzupełnienia biblioteki.
Aktualizacja kanonu powinna zawierać:
definicję komponentu lub zachowania;
identyfikator i powiązania z istniejącymi wzorcami;
wygląd i istotne stany;
reguły interakcji;
miejsce zastosowania;
kwalifikację produkt / tylko projekt / symulacja.
Nie nadpisuj istniejącego zaakceptowanego wzorca bez wyraźnej potrzeby i zgody.
Nie deklaruj synchronizacji MagicPath z repozytorium, jeśli nie została rzeczywiście wykonana i zweryfikowana.

10. Tryb realizacji
Dążymy do maksymalnie ciągłej implementacji w trybie Full Autopilot.
Preferujemy:
jedno kompleksowe zadanie zamiast wielu drobnych etapów;
wykorzystanie istniejących komponentów;
minimalny zakres zmian;
brak nadmiarowych audytów;
szybkie udostępnienie funkcji na Development;
poprawki na podstawie rzeczywistych testów i błędów.
Zasady PMOS, wrapperów, routingu repozytorium, ochrony środowisk i przekazywania handoffów są dostarczane osobno i pozostają obowiązujące.
Ten dokument ich nie zastępuje.

11. Instrukcja końcowa
Traktuj niniejszy kontekst jako stałe zasady współpracy przy zadaniach UX/UI SpendGuru 2.0 i SRM.
Dla każdego kolejnego zadania:
Zidentyfikuj jego zakres i odpowiedni kanon.
Sprawdź, czy istnieje zaakceptowany projekt MagicPath.
Wykorzystaj obowiązujące wzorce i zachowania.
Zachowaj kwalifikację elementów do produktu.
Implementuj w istniejącej architekturze bez przenoszenia symulacji.
Weryfikuj rezultat w docelowym środowisku wskazanym w zadaniu.
Priorytet: zgodność z zatwierdzonym UX/UI, poprawność rzeczywistych funkcji i szybkie dostarczenie działającego rozwiązania.
12. CANON LIVE BINDING — obowiązkowa synchronizacja elementów z biblioteką UX/UI
Zasada nadrzędna
Wszystkie nowe widoki, komponenty i interakcje projektowane w MagicPath muszą pozostawać powiązane z centralną biblioteką „Biblioteka Elementów i Zachowań UX/UI”.
Nie wystarcza zgodność wizualna. Wymagane jest rzeczywiste powiązanie z kanoniczną definicją komponentu.
Celem jest utrzymywanie jednego źródła prawdy (Single Source of Truth) dla wyglądu, zachowania i stanów elementów interfejsu.
12.1. Wykorzystanie istniejących komponentów
Jeżeli w nowym projekcie wykorzystujemy element, który został już zdefiniowany w bibliotece, należy zastosować istniejący komponent kanoniczny.
Dotyczy to między innymi:
przycisków, pól formularzy i przełączników;
kart, paneli, nagłówków i menu;
tabel, wykresów i ich kontrolek;
okien modalnych, tooltipów i komunikatów;
animacji, hover, focus, loading i innych stanów;
kolorystyki, typografii, odstępów i pozostałych tokenów wizualnych.
Nie wolno tworzyć niezależnej kopii komponentu tylko dlatego, że wygląda tak samo.
12.2. Synchronizacja zmian
Przyjmujemy następujący model:
Zmiana w kanonie → aktualizacja powiązanych komponentów → spójna zmiana we wszystkich projektach wykorzystujących dany wzorzec.
Przykład:
W bibliotece istnieje kanoniczny przycisk.
Ten sam przycisk jest wykorzystany w X-Ray, Benchmark Finder oraz SRM.
Jeżeli w przyszłości zmienimy w kanonie:
kolor przycisku;
promień zaokrąglenia;
animację hover;
sposób wyświetlania stanu disabled;
zmiany powinny zostać odzwierciedlone we wszystkich powiązanych projektach, bez konieczności ręcznej edycji każdego przycisku.
Synchronizacja powinna wynikać ze wspólnej definicji komponentu, współdzielonych tokenów lub rzeczywistego mechanizmu powiązań MagicPath.
Samo zapisanie identyfikatora kanonu w metadanych nie jest wystarczające, jeżeli komponent nadal posiada niezależną implementację.
12.3. Inspektor komponentów — CTRL + I
W projektach MagicPath obowiązuje mechanizm inspekcji elementów uruchamiany skrótem:
CTRL + I
Po wskazaniu elementu i uruchomieniu inspektora powinna być możliwa identyfikacja jego pochodzenia oraz powiązania z biblioteką.
Codex powinien zachowywać istniejące mechanizmy identyfikacji komponentów, w tym:
kanoniczny identyfikator komponentu, np. SRM-Cxx;
informację o źródłowym wzorcu;
powiązanie z centralną biblioteką;
identyfikację miejsca wykorzystania;
odpowiednie metadane potrzebne do inspekcji.
Nowe elementy powinny być projektowane tak, aby można było ustalić, z którego elementu biblioteki pochodzą.
Nie należy usuwać tych powiązań podczas modyfikowania prototypów MagicPath.
12.4. Nowe komponenty i rozszerzanie kanonu
Jeżeli nowy widok wymaga elementu, którego nie ma w bibliotece:
Zaprojektuj nowy komponent.
Określ jego wygląd, zachowania, stany i warianty.
Oznacz jego przeznaczenie zgodnie z rozdziałem 16: produkt, tylko projekt, symulacja.
Po akceptacji dodaj komponent do centralnej biblioteki.
Nadaj mu identyfikator i utwórz rzeczywiste powiązanie z projektami, które go wykorzystują.
Dalsze wykorzystania komponentu realizuj poprzez definicję kanoniczną, a nie niezależne kopie.
W ten sposób biblioteka rozwija się wraz z aplikacją.
12.5. Warianty zamiast duplikowania
Jeżeli ten sam komponent wymaga różnic pomiędzy aplikacjami, należy w pierwszej kolejności stosować kanoniczne warianty lub jawne parametry.
Przykład:
Przycisk w AppShell i przycisk w SRM mogą wykorzystywać ten sam wzorzec, ale różnić się rozmiarem lub kontekstem zastosowania.
Takie różnice powinny być deklarowane poprzez warianty, a nie kopiowanie i niezależne modyfikowanie komponentów.
Zmiana wspólnych cech powinna propagować się do wszystkich wariantów, a zmiana specyficzna dla jednego wariantu nie powinna przypadkowo wpływać na pozostałe.
12.6. Synchronizacja w MagicPath i kodzie aplikacyjnym
Rozróżniamy dwie warstwy:
Warstwa projektowa — MagicPath
Utrzymuj rzeczywiste powiązania pomiędzy projektami a centralną biblioteką. Weryfikuj je poprzez mechanizmy inspekcji i źródłowe definicje komponentów.
Warstwa implementacyjna — GitHub / React
Tam, gdzie jest to technicznie właściwe, stosuj współdzielone komponenty, tokeny i style zamiast niezależnych implementacji.
Zmiany kanonu powinny mieć jasną ścieżkę przeniesienia do aplikacji.
Synchronizacja projektów MagicPath nie oznacza automatycznego wdrożenia na Render. Wdrożenie nadal wymaga osobnego zadania implementacyjnego, testów i zatwierdzonego deploymentu.
12.7. Kontrola zgodności
Przy tworzeniu lub modyfikowaniu widoku Codex powinien sprawdzić:
Czy wykorzystane elementy istnieją w kanonie?
Czy zastosowano rzeczywiste powiązanie, a nie kopię?
Czy CTRL + I pozwala rozpoznać kanoniczne źródło elementu?
Czy zmiana wspólnej definicji może zostać odzwierciedlona w powiązanych projektach?
Czy nowo utworzone wzorce zostały dodane do biblioteki po akceptacji?
Czy klasyfikacja produkt / tylko projekt / symulacja została zachowana?
W przypadku niepewności należy sprawdzić rzeczywisty mechanizm synchronizacji MagicPath.
Jeżeli dany typ komponentu nie obsługuje automatycznej propagacji zmian pomiędzy projektami, należy jawnie wskazać to ograniczenie oraz zaproponować mechanizm współdzielenia lub kontrolowanej aktualizacji.
Nie wolno deklarować pełnej synchronizacji wyłącznie na podstawie podobieństwa wizualnego lub wspólnych nazw komponentów.
Reguła końcowa
ONE CANON → MANY PROJECTS → CONSISTENT UX/UI
Biblioteka jest centralnym źródłem definicji.
Projekty korzystają z jej komponentów.
Zmiany kanoniczne powinny propagować się do powiązanych projektów zgodnie z rzeczywistym mechanizmem współdzielenia.
Nie budujemy zbioru podobnych ekranów. Budujemy jeden spójny i rozwijany system interfejsu użytkownika.


## 13. Global Navigation — kanon zatwierdzony (2026-11-10)

Źródło: MagicPath **Kanon SpendGuru**, rozdział 17 „Global Navigation”, projekt `460628300646219776`, komponent źródłowy `460628347660177408`, implementacja referencyjna `src/components/generated/CanonGlobalNavigation.tsx`. Wzorce GN-01–GN-06 i komponenty SRM-C107–SRM-C111 mają w aktualnym rejestrze MagicPath status **Kanon**.

### 13.1. Rejestr wzorców

| Wzorzec | Kanoniczne komponenty | Reguła zachowania |
| --- | --- | --- |
| GN-01 — Global Navigation / AppShell Navigation | SRM-C107 | Host dostarcza URL, breadcrumbs, stan historii i właściciela motywu. Moduły nie duplikują nagłówka. |
| GN-02 — Biurko, Wstecz i Dalej | SRM-C108/C109 | Home otwiera biurko; Wstecz/Dalej prowadzą przez historię użytkownika, nigdy automatycznie do rodzica. |
| GN-03 — Breadcrumbs i kompaktowy wariant mobile | SRM-C110/C111 | Hierarchia widoku niezależna od historii; otwarcie z deep linku odtwarza breadcrumbs. |
| GN-04 — Motyw należy do AppShell | SRM-C95 | Jedna preferencja i stan hosta; zmiana nie resetuje danych. |
| GN-05 — Ochrona niezapisanych zmian | Reuse istniejących | Zatrzymanie przejścia, potwierdzenie lub anulowanie. Dialog bez wpisu do historii. |
| GN-06 — Klasyfikacja i właściciel wdrożenia | Reuse istniejących | Produkcja używa prawdziwego routingu i autoryzacji. Bez kopiowania syntetycznego stosu historii. |

### 13.2. Reguły implementacji i zastosowania

- **Właściciel nawigacji:** SpendGuru AppShell, nie każdy moduł z osobna. Moduły udostępniają strukturę breadcrumbs i kontekst widoku, ale nie wdrażają niezależnych pasków Global Navigation.
- **Zasada selective placement:** globalną nawigację stosujemy tylko tam, gdzie jest uzasadniona w rzeczywistym flow i odpowiada roli widoku. Widoki wejścia/rejestracji, samodzielne demonstratory, osadzone panele i dedykowany SRM nie otrzymują automatycznie przycisku „Biurko” ani drugiego AppShell.
- **Komponenty:** SRM-C107 (global navigation bar), SRM-C108 (powrót do biurka), SRM-C109 (wstecz/dalej), SRM-C110 (breadcrumbs desktop), SRM-C111 (breadcrumbs mobile). Ponownie wykorzystujemy SRM-C95 (motyw) i SRM-C27 (dialog ochrony niezapisanych zmian), wraz z istniejącymi przyciskami kanonicznymi.
- **Historia ≠ hierarchia:** Wstecz/Dalej działają na rzeczywistej historii routera; breadcrumbs przedstawiają hierarchię widoku i odtwarzają się po deep-linku. Nie zastępuj historii nawigacją do rodzica i nie używaj syntetycznego stosu demonstratora w aplikacji.
- **Niezapisane dane:** przejścia mogą wymagać blokady, anulowania lub potwierdzenia w kanonicznym dialogu; sam dialog nie tworzy dodatkowego wpisu historii.
- **Responsywność:** wariant desktop i kompaktowy mobile, stany focus/hover/disabled, światło/ciemność, aria-current, dostępność klawiaturowa oraz brak poziomego przepełnienia.
- **Minimalizm i flow:** przed dodaniem nawigacji przeanalizuj już istniejący nagłówek, przestrzeń roboczą, marginesy, padding, proporcje, typografię oraz kontekst. Usuwaj duplikaty i dostosowuj kompozycję tylko wtedy, gdy poprawia to czytelność. Zawsze zachowaj bieżące flow użytkownika.
- **Kwalifikacja do produktu:** zatwierdzony UI i zachowania paska mogą być **PRODUKT**, lecz demonstrator, scenariusze i dane przykładowe pozostają **TYLKO PROJEKT/SYMULACJA** zgodnie z rozdziałem 16. Wdrożenie wymaga prawdziwego routingu, autoryzacji i kontraktów danych.
- **Powiązania między projektami:** zgodność wyglądu, zapis identyfikatora SRM-Cxx lub podobieństwo plików nie dowodzą live binding. Zależność od centralnego źródła należy potwierdzić odczytem kodu / mechanizmu udostępniania MagicPath; gdy mechanizm nie obsługuje współdzielenia, aktualizacja musi być kontrolowana i raportowana, bez deklarowania automatycznej propagacji.

### 13.3. Referencje i granice

- Projekt źródłowy: https://www.magicpath.ai/files/460628300646219776 — rozdział 17.
- Wzorzec referencyjny prezentuje stany i interakcje; nie oznacza, że odpowiadające mu moduły zostały już wdrożone.
- GitHub jest źródłem technicznych kontraktów; ta zmiana dokumentu nie aktualizuje automatycznie projektów MagicPath ani aplikacji Development.
- W przypadku konfliktu wariantów hosta: AppShell SpendGuru zarządza nawigacją globalną, samodzielny SRM zachowuje własny odpowiedni shell, a ekrany wejściowe nie dziedziczą wymuszonego paska globalnego.
