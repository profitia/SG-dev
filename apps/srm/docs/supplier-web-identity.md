# Strona WWW i logo dostawcy

Status: TRANSITIONAL — rozszerzenie istniejącego SRM Runtime i SRM X-Ray Module. Właściciel transportu, bezpieczeństwa, cache i endpointu: SRM Runtime. Właściciel prezentacji: SRM X-Ray Module. Nie powstaje nowa granica modułu ani zależność od obliczeń finansowych.

## Zachowanie
Po wyszukaniu NIP nagłówek raportu asynchronicznie pokazuje logo i klikalną domenę. Logo zachowuje kolory i proporcje; pole ma 96 × 80 px (grafika 80 × 64 px), na telefonie 64 × 64 px. Brak logo oznacza neutralny symbol firmy. Niepotwierdzony adres nie staje się odnośnikiem. Dane finansowe i KYS działają niezależnie.

## Ustalanie adresu
1. Opcjonalny adres z aktualnego odpisu MGBI albo pól WWW zapisanej projekcji CEIDG. Brak pola nie zmienia kompletności dotychczasowej sekcji rejestrowej. Pełny historyczny odpis nie jest źródłem aktualnego adresu.
2. Jeśli nie ma skutecznego adresu, ograniczona lista domen utworzonych z nazwy firmy (.pl, .com). To kandydaci, nigdy dowód.
3. Kandydat musi zawierać na stronie głównej albo podstronie kontaktowej/prawnej zgodny NIP lub KRS z etykietą oraz element nazwy firmy. Przekierowanie podstrony kontaktowej do innej domeny nie stanowi dowodu. Również adres z rejestru podlega sprawdzeniu, ponieważ domeny mogą zmieniać właściciela.

To wyszukiwanie o ograniczonym zasięgu, nie pełna wyszukiwarka Internetu. Firma z nietypową domeną, witryną wymagającą JavaScript albo bez identyfikatorów rejestrowych może pozostać bez strony WWW. Nie wykorzystujemy niepotwierdzonych wyników ani komercyjnie ograniczonego RSS wyszukiwarki. Nie wywołujemy dodatkowo płatnych raportów MGBI/Vercly.

## Logo i bezpieczeństwo
Preferowane są Organization.logo, logo nagłówka i ikony strony. Transport serwerowy dopuszcza wyłącznie publiczne adresy HTTP(S), kontroluje DNS i każdy redirect, przypina sprawdzony adres do połączenia, ogranicza rozmiary, czas oraz liczbę żądań. Nie wykonuje skryptów strony. Grafika jest dekodowana i zapisywana jako PNG; aktywny SVG i odwołania zewnętrzne w SVG są odrzucane. Przeglądarka nie pobiera obrazków z zewnętrznych hostów.

## Cache i izolacja
Endpoint POST /api/xray/web-identity przyjmuje wyłącznie NIP i typ podmiotu; nie przyjmuje adresu do pobrania. Wymaga bieżącego środowiska, logowania, same-origin oraz istniejącego dostawcy/projekcji w organizacji. RLS FORCE izoluje cache po organizacji. Źródłowe payloady dostawców pozostają w dotychczasowych magazynach.

Lease na 60 s ogranicza równoległe pobrania, token chroni przed zapisem spóźnionego wyniku. Zmiana tożsamości/hintu strony unieważnia cache. Wynik z logo: 7 dni; potwierdzona strona bez logo: 1 dzień; brak dopasowania: 1 dzień; błąd transportu: 5 min. Przechowujemy datę sprawdzenia, metodę, adres dowodu i źródło logo. Nie zapisujemy tekstu odwiedzonych stron. Brak danych nie oznacza pogorszonej kondycji dostawcy.

## Integracja i wdrożenie
Host przekazuje komponentowi SupplierWebIdentity funkcję odczytu znormalizowanego SupplierWebIdentityData. Zmiana NIP anuluje poprzedni odczyt. Źródła MGBI/CEIDG i baza pozostają po stronie serwera.
Migracja 0014 jest addytywna. Uruchomić kanoniczny migrate:development na zatwierdzonej gałęzi Neon srm_app przed wdrożeniem aplikacji. PMOS/PHR wyłącznie SRM srm_pmos; MEMOROS wyłączony. Rollback kodu może pozostawić nieużywaną tabelę.

## Dalszy rozwój
Można dodać zatwierdzonego dostawcę wyszukiwania oraz ręczną korektę adresu z historią zmian. Obecne wdrożenie nie wprowadza takich zależności ani konfiguracji.
