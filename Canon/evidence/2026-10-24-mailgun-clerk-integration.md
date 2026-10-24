# Clerk → Mailgun: przygotowanie integracji Development, 24.10.2026

Task: `ARCHITECTURE-MAILGUN-CLERK-INTEGRATION-20261024`; owner ARCHITECTURE;
PMOS `architecture_pmos`; MEMOROS disabled. Authority `profitia/SG-dev:main`,
izolowany branch `architecture/mailgun-clerk-integration-20261024`.
Stan odniesienia main `59173852bd2a16a3cfc78179ab6b32ac28abc14b`.
Równoległy PR #672 dotyczył rozłącznych plików KRS; przyjęto go bez zmiany
naszych plików, po zabezpieczeniu ich ograniczonej kopii. Preflight ponownie PASS.

## Zakres i dowody

Przygotowano podpisany webhook, zaszyfrowaną trwałą kolejkę, minimalny grant
SERVICE dla preferencji awatara, transport własnej domeny z grafikami CID,
domyślnie wyłączone podłączenie runtime, addytywną migrację i runbook aktywacji.
Zmiany źródłowe kontynuują sandbox i szablony z PR #670. Nie wykonano deploymentu,
migracji na Neon, zmiany konfiguracji Render ani przełączenia szablonów Clerk.

- Pełny governance preflight PASS: dokładne ścieżki, owner/code state, aktywne
  dokumenty i PMOS begin/resume. Istniejąca praca i zmiany równoległe zachowane.
- Izolowany PostgreSQL: **31/31** testów nowego outboxa i istniejącego Identity/
  profilu. Zwykła rola, FORCE RLS, dowód związany z transakcją, brak dostępu do
  tabel, odmowa fałszywego kontekstu i obcych kont; istniejące E1/granty bez regresji.
- Podpisane syntetyczne zdarzenie SDK → realny lokalny SQL → kanoniczny renderer
  → multipart/CID dla male/female/neutral; cztery powtórzenia tego samego zdarzenia
  nie powodują dodatkowej próby wysyłki. Transport zewnętrzny zastąpiony kontrolowaną
  atrapą. Test nie wysyła prawdziwego OTP ani wiadomości.
- Sprawdzone awarie przed/po rozpoczęciu wysyłki, restarty, tamper szyfrogramu,
  terminy, limit kolejki i godzinowy, obowiązkowy audyt, kill switch i powrót do
  poprzedniego profilu/rejestracji z pozostawioną addytywną migracją.
- Rzeczywisty odczyt czterech zatwierdzonych publicznych PNG: SHA-256 zgodne,
  wszystkie referencje w renderach zastąpione CID, kod zachowany; bez wysyłki.
- Końcowa seria Identity **237/237**, lint/typecheck/build PASS, w tym rzeczywisty
  adapter HTTP: większy limit tylko dla dokładnego włączonego POST webhooka.
  Regresje kontraktów platformy **189/189**, governance **24/24**, manifest poprawny.
  Wynik zdalnego CI jest raportowany osobno w PR/PMOS.

## Odczyt środowisk

Render: `identity-runtime-development`, `srv-dbcse6jrjlhs73eib3sg`, poprzednie
wydanie `dep-dbds1g4ipgvc739uj05g`, commit
`a6ffcefb96d1b4182764343b349dcb092d0f891b`; auto-deploy wyłączony. To odczyt
metadanych, nie odbiór E2E nowego kodu i nie nowy zweryfikowany LKG.

Neon: `profitia-platform-private` / `spring-bread-28217539`, Development
`br-sparkling-term-b99l107x`, baza docelowa `platform_private`. Sprawdzono projekt
i branch, nie wykonano SQL ani migracji na tym środowisku.

Mailgun EU `GET /v4/domains/spendguru.app`: domena własna **active**; wymagane SPF
i DKIM oraz CNAME śledzenia mają **valid**. Publiczny DNS potwierdza łańcuch SPF
GoDaddy → `mailgun.org`, DKIM potwierdzony przez dostawcę, CNAME `eu.mailgun.org`.
DMARC istnieje: `p=quarantine; pct=100; adkim=r; aspf=r` oraz adresy raportowania.
Nie zmieniono rekordów. Brak MX/MX Mailgun niepotwierdzone dotyczy odbioru poczty,
którego nie uruchamiano. Weryfikacja domeny nie dowodzi doręczenia przez Office 365.

## Otwarte bramki

- Brak dowodu powiązania **pierwszego OTP** z konkretnym SignUp i jego wyborem
  awatara. Neutralny fallback nie jest pełnym wdrożeniem tej personalizacji.
- Rzeczywisty format podpisanego zdarzenia zaproszenia wymaga potwierdzenia przed
  włączeniem parsera. Brak testu rzeczywistego kodu/linku w tej części zadania.
- Brak przełączenia globalnego szablonu Clerk, dopóki lista odbiorców pilota nie
  pokrywa wszystkich użytkowników instancji lub nie ma wydzielonej instancji.
- Przyszłe uruchomienie wymaga własnego begin/preflight, zmierzonego LKG,
  zweryfikowanego branch/snapshot rollbacku, instalacji grantu/migracji, sekretów
  domenowych, wdrożenia i E2E. Żadnego z tych kroków nie zastępuje zielone CI.

Instrukcja: `Canon/runbooks/mailgun-avatar-delivery-development-v1.md`.
Dokumentacja dostawcy: https://documentation.mailgun.com/docs/mailgun/user-manual/domains/domains-verify
