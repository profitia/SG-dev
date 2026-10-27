# AppShell PORR — kwalifikacja produktu i odbiór Development

## Źródła i zakres

- Authority: profitia/SG-dev/main; początek 4b59557a82a0223b01ff26f601951aafe23877a0, odświeżona baza 56b61912ccd63edf53f83f4caf8eede2736cd1ba. Kanon AppShell przyjęty w PR #748.
- MagicPath AppShell 465533749308841984, komponent 465804082116980736, rewizja 465855381789360128. Biblioteka 460628300646219776, komponent 460628347660177408, rewizja 465827262730764288. Odczytano aktualne źródła, projekt bez zmian.
- Rejestr źródłowy obejmuje 323 wpisy (170 UI produkt / 123 tylko projekt / 30 symulacja). Każdy ma osobną kwalifikację UI/danych/zachowania w towarzyszącym JSON. Nie dziedziczymy dopuszczenia z kontenera. Macierz wstępna powstała przed implementacją; ostateczna wskazuje faktycznie użyty podzbiór.
- Wyłącznie pierwszy ekran w istniejącym SG Runtime Development. Powiązany odczyt Identity osobno ARCHITECTURE, zatwierdzony przez użytkownika, PR #750, przyjęty 0272c49daa98297be6e02b08939cf2b9ac97fb3c. Bez schema/SQL/membership/grant changes.

## Produkt i wykluczenia

Nagłówek, stała geometria SVG SpendGuru, biały wariant w ciemnym motywie, opcjonalny branding istniejącego profilu wdrożenia PORR, C95 motyw, trzy pionowe karty, wizualny asystent z powitaniem, prawdziwe Wyloguj. Desktop zachowuje równą dolną krawędź kart i panelu. Mobilny układ wykorzystuje istniejące breakpointy 1100/760/420 i semantyczne tokeny/spacing kontraktu źródła.

Karty są disabled bez handlerów. Czat nie zawiera formularza ani stanu wiadomości i ma disabled pole oraz kontrolki. Nie ma CIC, Screen Context, Docka, API modułów, iframe ani modułowych importów. Rejestry delivery/provenance, inspektor, Control+I, scenariusze, etykiety projektu, popupy symulacyjne, fixtures i kod odpowiedzi są wykluczone z grafu importów, nie tylko ukryte. Lokalne testy i dokumenty nie są importowane przez produkt. Istniejące inne trasy SG2 pozostają bez przebudowy ich funkcji.

UI karty używa jawnie wymaganych nazw Benchmark Finder i ADP — Arkusz Danych Podstawowych. Nazwy PCI i Ankieta w materiale graficznym nie rozstrzygają fizycznego podłączenia produktów; żaden moduł nie zostaje podłączony. Różnice kolorów disabled wobec aktywnych atrap projektu wynikają z faktycznej dostępności i nakazu braku pozorowanych działań.

## Reużycie i pochodzenie

Odwzorowanie C01/C02, C31/C32/C33/C35, C37–C40, C62, C95, tokenów i SVG na podstawie przypiętych źródeł; bez rejestrów inspekcji w publicznym kodzie. Karty i nagłówek zachowują zatwierdzoną kompozycję AppShell. Brak nowej propozycji kanonu. Nie deklarujemy zależności synchronizowanej z MagicPath: zamknięta, lokalna kompozycja z udokumentowanym pochodzeniem. Źródłowe inspektory są narzędziami projektowymi i celowo nie są wdrażane.

## Tożsamość i autoryzacja

Root i istniejący callback /pl/account oraz /en/account używają tej samej bramki konta. Anonimowy użytkownik wybiera istniejące logowanie lub rejestrację. Self-service i Clerk opt-in pozostają wymagane; inne tryby nie zmieniają zachowania.

Backend odczytuje wyłącznie istniejące własne konto, awatar i nowy własny salutation przez bearer-only GET do stałego Identity. Wołacz pochodzi z utrwalonego profilu i wersji słownika, firstName używany w EN. Brak danych daje neutralne powitanie. Awatar dokładnie odpowiada avatarSex, niezależnie od imienia/płci słownikowej; null nie wybiera domyślnie żadnej persony. AppShell nie dodaje własnego wyboru persony. Zmiana użytkownika/sesji abortuje stare żądania; przeterminowanie dowodu usuwa ekran i wymaga ponownej weryfikacji, świeży dowód odświeżany istniejącym SDK. Logout używa istniejącego Clerk session signOut.

Konto ACCOUNT_SELF nie daje członkostwa PORR ani dostępu do produktu. Statyczny katalog nie ma danych prywatnych; branding konfiguracji nie jest organizacją w Operation Context. Wszystkie dotychczasowe operacje biznesowe nadal wymagają serwerowej autoryzacji. Nowa rejestracja nie otrzymuje nowych uprawnień.

## Weryfikacja i release

- Identity: lokalnie typecheck/build/lint i 358/358 testów z izolowanym PostgreSQL, dwoma kontami, cofnięciem sesji i odmową nieuprawnionemu peerowi; PR #750 wszystkie kontrole PASS.
- AppShell: lokalnie 7/7 testów pierwszego widoku i granicy produktu przed finalnym CI. Rozszerzone testy adaptera obejmują obcy profil, dane nadmiarowe, nieprawidłową wersję, cofnięcie dostępu podczas trzeciego odczytu i niezależność imienia/awatara.
- Kontrolowany CI dokładnej rewizji, build, typy, komplet regresji, przegląd chunków i testy w przeglądarce są wymagane przed odbiorem. Stan wykonania zapisany w raporcie wydania / PMOS; sam dokument nie deklaruje ich zaliczenia.
- Odbiór live: A logowanie, B rzeczywista nowa rejestracja (adres użytkownika, hasło/OTP wprowadza użytkownik), C ponowne wejście i refresh, logout, oba motywy, 390/768/1440/2560 i szerokości pośrednie. Nie wolno uznać testu lokalnego za live.

## Operacje i ograniczenia

Wydanie tylko istniejącego srv-dapa3tid0e5s73f8bc5g plus osobno zatwierdzony srv-dbcse6jrjlhs73eib3sg. Bez tworzenia zasobów, Render workers/dashboard/PCI/SRM releases, konfiguracji Clerk/Neon i migracji. Identity wymaga aktualizacji istniejącego niepoufnego guarda expected SHA do przyjętej rewizji; pozostała konfiguracja zachowana. Bieżące LKG odczytane u providera zapisano w release JSON, niezależnie od starszej migawki topologii. Rollback najpierw SG2 na LKG; przy rollbacku Identity przywrócić pin SHA i jego LKG, ponieważ nowy SG2 wymaga odczytu salutation.

Przed implementacją zakres poszerzono zgodnie z akceptacją użytkownika i ponownie przeprowadzono pełne require-begin dla dokładnych ścieżek. Pierwotna rejestracja zadania zachowana. Pomocniczy omyłkowy plik poza zakresem natychmiast usunięto przed commit/push; brak wpływu na produkt. Brak zmiany ownership, routingu i aktywnych kanonów.

## Korekta widżetu — polecenie użytkownika po odbiorze 27.10

Na aktualnej, niezmienionej rewizji MagicPath 465855381789360128, C36/C37 (pasek/zwijanie) i C38 (odpięcie/przyłączenie) mają status produktowy. Najnowsze polecenie użytkownika uruchamia te zachowania prezentacji. Pozostała rozmowa, historia, zmiana preferencji profilu i moduły biznesowe nadal nie są integrowane.

Widżet wydzielono do AssistantWidget; useAssistantWindow ma jednego właściciela React, kontrolowane osobne okno bez credentiali i identyfikatorów w URL, wspólny aktualny motyw i awatar. Zamknięcie krzyżykiem, przyłączenie, zmiana dokumentu, wylogowanie/wygaśnięcie sesji/unmount oraz pagehide sprzątają okno i obserwator. Zablokowanie popupu pozostawia widżet w biurku z rzeczywistym komunikatem błędu. Zwijanie przenosi fokus, a wsunięty panel jest inert.

Brak przekazanej preferencji nie daje już pustego miejsca: ramka C33 pokazuje neutralny znak z istniejącego SVG SpendGuru. Nie jest to męska ani żeńska preferencja i nie zapisuje wartości do profilu. Nie ma wyprowadzania płci z imienia/słownika. Znana male/female nadal wybiera dokładny zatwierdzony zasób, także na pasku i w oknie. Błąd zasobu obrazu także otrzymuje neutralny znak.

Zrzut oraz żywy DOM użytkownika potwierdziły brak elementu img w dotychczasowym widżecie. Z przepływu dotychczasowego AccountLanding wynika brak przekazanej wartości male/female; nie deklarujemy odczytania prywatnego rekordu w bazie. Zbiorcze zapytanie diagnostyczne po imieniu zostało odrzucone automatycznie i nie wykonano go. Użytkownik wskazał konto tomasz@profitia.pl; dalsze zawężenie do konkretnego UUID nie powiodło się przez brak dostępu SSH. Nie zmieniono danych profilu, rejestracji, grantów ani Identity.

Lokalne testy SSR/granicy: 10/10 PASS. W Chrome sprawdzono zwijanie/wysuwanie i fokus, rzeczywiste osobne okno, wspólną zmianę motywu i ten sam żeński awatar. Pozostałe dowody interakcji i wydania są rejestrowane faktycznie, a nie przewidywane. Ta korekta nie oznacza działającej rozmowy/CIC ani naprawionej preferencji w prywatnym profilu.
