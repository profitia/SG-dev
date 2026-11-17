# ADP → Newsfeed: minimalne przekazanie zweryfikowanego dostawcy v1

Status: **OWNER_APPROVED — WŁĄCZONY PRZEZ §8 KANONU ADP; ODBIÓR LIVE NIEPOTWIERDZONY**.
Decyzja właściciela SRM i SG2: 17 listopada 2026; zaakceptowany zakres `f0ca90181cffd6200eae33a221c68a1b001cb785` w PR #1156.
Środowisko: SG2 Development. Zadanie: `ARCH-PI-ADP-NEWSFEED-CONTRACT-20261117`.

## Rezultat użytkownika

Użytkownik pracujący w ADP na rzeczywistym, wcześniej zweryfikowanym dostawcy wybiera istniejącą akcję Newsfeed. AppShell otwiera zakładkę Newsfeed Procurement Insights z nazwą i NIP tego samego dostawcy. Użytkownik sam decyduje o wyszukaniu informacji lub zapisaniu obserwacji.

## Wąska decyzja do przyjęcia

Dopuścić powyższe przekazanie tożsamości dostawcy jako jedyny wyjątek od prezentacyjnego/local-state zakresu §4–5 [kanonu montowania ADP](../v1.1-srm-adp-presentation-mounting-amendment.md). Pozostałe funkcje ADP zachowują swój obecny zakres. Przyjęcie wymaga jawnej decyzji właściciela SRM i właściciela integracji SG2/AppShell; ten dokument sam nie jest taką decyzją.

## Obowiązujący kontrakt po przyjęciu

1. Źródłem tożsamości jest istniejący, uprzednio zweryfikowany wpis/wybór SRM (`SupplierSelection`) wraz z jego rzeczywistym powiązaniem ze źródłem. Nazwa lub NIP wpisane do lokalnego formularza ADP, demonstrator i snapshot nie stanowią potwierdzenia tożsamości. Nie powstaje drugi katalog dostawców.
2. Zaufany backend istniejącego właściciela SRM potwierdza dostęp bieżącego użytkownika/organizacji do istniejącego źródła i wskazanego dostawcy. Stosuje aktualne Identity/E1 oraz istniejące zasady ważności. Parametr URL i dane klienta nie są grantem. Brak uprawnienia, potwierdzonego wpisu lub jego powiązania kończy przekazanie odmową, bez zgadywania ani niejawnego uzupełniania.
3. Minimalny kontekst obejmuje potwierdzoną nazwę i NIP, a istniejący identyfikator/odnośnik źródłowy wyłącznie wtedy, gdy źródło rzeczywiście go posiada. Nie tworzy się pozornego SupplierID. OrganisationID pochodzi z zaufanego kontekstu sesji. Dane finansowe i dokumenty dostawcy nie są przekazywane.
4. SRM pozostaje właścicielem potwierdzenia tożsamości; SG2/AppShell — globalnej nawigacji i kontekstu; Newsfeed — wyszukiwania, obserwacji, historii i ich uprawnień. Minimalna zmiana istniejącego kontraktu prezentacyjnego, jeśli będzie konieczna, jest przygotowywana u właściciela SRM z właściwymi gate'ami i continuity. Nie dodaje się routera/API do pakietu prezentacyjnego ADP.
5. Samo przejście odczytuje istniejące dopuszczone dane. Nie wywołuje ponownej weryfikacji KRS, Brave ani LLM, nie pobiera nowych źródeł, nie tworzy/duplikuje obserwacji i nie wznawia wstrzymanych obserwacji ani delegacji. Istniejące uprawnione obserwacje można wskazać do wyboru; stworzenie nowej pozostaje jawną akcją użytkownika.
6. Kontekst dostawcy jest czyszczony lub ponownie autoryzowany po zmianie organizacji, wylogowaniu, wygaśnięciu albo cofnięciu dostępu. Newsfeed stosuje własną aktualną kontrolę dostępu przy każdej operacji. Wspólny CIC nie otrzymuje kontekstu automatycznie.
7. Wykorzystywana jest istniejąca akcja ADP i kanoniczne komponenty Kanon SpendGuru; bez przebudowy układu i regresji pozostałych funkcji ADP, AppShell ani Kalendarza rynkowego.

## Odbiór wymagany przed uznaniem integracji za działającą

- LIVE: rzeczywisty uprawniony użytkownik wybiera rzeczywistego zweryfikowanego dostawcę w ADP; Newsfeed pokazuje dokładnie jego potwierdzoną nazwę i NIP. Dowód wskazuje rzeczywiste źródło powiązania i wdrożony SHA.
- Samo przejście powoduje zero nowych pobrań od dostawców, zero wywołań AI i zero nowych obserwacji; ponowne przejście nie tworzy duplikatów.
- Lokalny niezweryfikowany formularz, podmieniony identyfikator, inna organizacja, cofnięte prawo i stary kontekst nie umożliwiają niedozwolonego odczytu ani akcji.
- Testy właściwych kontraktów oraz regresja AppShell/ADP/Newsfeed przechodzą; test izolowany nie zastępuje powyższego LIVE.

## Granice decyzji

Przyjęcie obejmuje wyłącznie opisany zakres funkcjonalny i jego przygotowanie zgodnie z routingiem właścicieli. Nie nadaje grantów, nie rozszerza licencji/budżetu, nie aktywuje nowego dostawcy i nie stanowi finalnego GO wydania. Migracje, chronione konfiguracje i wydanie dokładnej wersji przechodzą istniejące wymagane kontrole. Staging i Production są poza zakresem.

Powiązanie: [plan dostarczenia Procurement Insights end-to-end](../runbooks/procurement-insights-end-to-end-delivery-plan-v1.md). Po właściwym przyjęciu niniejszy wąski kontrakt powinien zostać włączony do obowiązującego kanonu tą samą kontrolowaną ścieżką, z zachowaniem historycznej decyzji prezentacyjnej.
