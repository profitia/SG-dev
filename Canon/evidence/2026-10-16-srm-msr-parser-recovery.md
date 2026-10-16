# SRM — systemowe odzyskiwanie XHTML/iXBRL

Zadanie: `SRM-DEV-MSR-PARSER-RECOVERY-20261016`. Profil SRM, środowisko Development, lokalne wykonanie w izolowanym branchu. Punkt bazowy: `ecaebb7fb4dad1fe3f21b71272fce71bb550dc07` / PR #365; reguły jakości finansowej pozostają aktywne.

## Przyczyna i reguła

ORLEN `7740001454` ujawnił dwie niezależne granice: formatowany NIP w jednostkowym XHTML oraz poprawny łańcuch 698 kontynuacji w skonsolidowanym iXBRL. Zapisane źródła istniały przed zwiększeniem limitu. Ogólny komunikat o niedostępnym XHTML nie rozróżniał błędów parsera.

Implementacja wykonuje regułę `MSR_PARSER_RECOVERY_V1` z §18.6 aktywnego kanonu finansowego. Jest wspólna dla emitentów, bez wyjątków po NIP. Zachowuje błędne receipts i oryginały, dopisuje projekcję z nową wersją oraz nie powtarza pobrania. Zmiany nie obejmują migracji schematu ani wzorów wskaźników.

## Dowody i ograniczenia

- Testy deterministyczne obejmują formatowane i sprzeczne tożsamości, długie kontynuacje, cykle i budżet pracy, jednostki, daty, zakres, dane przekształcone, historię wersji, integralność oryginału i brak płatnych powtórzeń.
- Dane z nieoznaczonych subtotalów nie są odgadywane. Przychody i wynik mogą być dostępne, gdy podstawa tradycyjnej płynności pozostaje niepotwierdzona. Koszt własny sprzedaży nie zastępuje kosztów rodzajowych.
- Potwierdzenie poprawnego parsera jest odrębne od potwierdzenia wdrożenia i pełnego raportu użytkownika. Rzeczywiste wyniki testów, CI, Last Known Good, identyfikator wdrożenia i akceptacja są dołączane do kanonicznego rekordu tego zadania w `srm_pmos`/PHR. Ten plik sam nie stanowi deklaracji wdrożenia.
- Staging i Production pozostają bez mutacji. MEMOROS jest wyłączony kanonicznie.
