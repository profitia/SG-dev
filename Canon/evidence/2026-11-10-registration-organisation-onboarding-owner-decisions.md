# Rejestr decyzji — rejestracja i onboarding organizacji SpendGuru
Data: 2026-11-10, Europe/Warsaw. Profil: ARCHITECTURE / Development.
Task: ARCH-REGISTRATION-ORGANISATION-CANON-20261110.
Źródło mandatu: bezpośrednie instrukcje właściciela w bieżącej rozmowie Codex. Host nie udostępnił stabilnego identyfikatora rozmowy; PMOS otrzymał jawne hostConversationId: null i wyprowadził własny task-scoped conversationId. Nie tworzono fikcyjnego approval tokenu.

## Zatwierdzone kierunki i decyzje właściciela

1. Napisać i opublikować kanon obejmujący uzgodnioną logikę, cele biznesowe, rozmieszczenie w monorepo, reuse, nowe elementy i harmonogram; podać link i potwierdzić gotowość rozpoczęcia Etapu I.
2. Centralny Identity Runtime koordynuje odrębny od konta onboarding organizacji. Profil zakupowy jest zdolnością całej platformy, dostępną dla aplikacji przez uprawnione kontrakty.
3. Pierwszy właściciel nowej organizacji opiera się na deklaracji użytkownika, bez obowiązkowego zewnętrznego dowodu umocowania. Płatności nie należą do tego etapu. To nie daje dostępu do istniejącej organizacji.
4. V1 obsługuje spółki; JDG są poza rynkiem docelowym. NIP rozróżnia organizacje; MGBI ma być ponownie wykorzystane do podstawowych danych spółki.
5. Rozmowa zbiera i zapisuje dane formalne, branżę, osobiste kategorie i wielkość zespołu; pozwala proponować i zmieniać unikatowy adres organizacji; następnie opcjonalnie zaprasza współpracowników.
6. Zaproszony użytkownik dołącza do wskazanego Organisation ID i podaje własne kategorie, bez ponownego zakładania firmy.
7. Obecnie pełna wersja; właściciel ręcznie utworzy, opublikuje i przypisze pakiet PORR w panelu Package & Limits po otrzymaniu właściwego Organisation ID. Nie hardcodować klienta ani pakietu. Trial i systemowa oferta SaaS są przyszłym zakresem.
8. Branża, wielkość zespołu i kategorie zasilają ACG/CIC razem z aktualnym kontekstem pracy; wykorzystać istniejące i równolegle rozwijane komponenty.
9. Dodać lekkie podsumowanie ostatniej pracy po nowym logowaniu, jeżeli nie wymaga rozbudowanego kosztownego systemu. Kanon ogranicza je do potwierdzonych zdarzeń i prostych szablonów.
10. Usunąć zbędne puste ekrany przed AppShellem; trwale pamiętać awatara; automatycznie zatwierdzać kompletny OTP; stosować jeden sposób wpisania kodu bez kratek.
11. Full Autopilot, Business Outcome Engineering, E1/PMOS/PHR i UX/UI obowiązują w programie. Trwałe dowody, decyzje i artefakty są na GitHubie, bez lokalnego archiwum na komputerze użytkownika.

## Przyjęte doprecyzowania projektu

Kanon scala produkcję i przemysł w jedną branżę, ustala rozłączne przedziały zespołu 1–5 / 6–10 / 11+, kategorie wielokrotnego wyboru i kategorie własne. Określa retry, wznowienie, atomową unikatowość NIP/adresu i zaproszeń, odrębne znaczenie preferencji i uprawnień, aktualne kontrole membershipu oraz częściowy sukces bez duplikowania organizacji.

Etap 0 obejmuje kanon i kompletny przyjęty UX/UI; Etap I pełną ścieżkę konto–organizacja–zespół–aktywny AppShell; Etap II profil ACG/CIC i powrót do ostatniej pracy. Testy, naprawy, właściwy release i continuity są wewnątrz etapów.

## Stan sprawdzony podczas przygotowania

Authority source: profitia/SG-dev main, bazowy commit 675e97fc6d9387bfe3157e2675d085d0f4f2d070.
Sprawdzono obowiązujący manifest, routing, Identity, Customer Lifecycle, Package & Limits, AppShell, kontekst i granice źródeł. Kanon dokumentuje wymagane rozszerzenia, nie przedstawia ich jako działających.

Istotne luki wdrożenia: rozmowa organizacyjna i profil; bezpieczny lookup przed utworzeniem organizacji; SaaS mail i zaproszenia; projection Package & Limits do E1; dynamiczne adresowanie i session handoff; źródło profilu ACG/CIC i lekka aktywność. Istniejące komponenty zachowują właścicieli. Podczas tej publikacji nie wykonano testów produktu, migracji, płatnych source calls ani deploymentu.

## Granice publikacji i ograniczona precedencja

Mandat dotyczy kanonu, jego rejestracji, zgodnych odsyłaczy i publikacji, nie nieograniczonej implementacji lub kosztów.
Nowy kanon zastępuje wyłącznie:
- dawny zakaz centralnego onboardingu organizacji w Identity §3;
- wymaganie zewnętrznego dowodu pierwszego właściciela w Customer Lifecycle CL-02/CL-02.A i odpowiednich testach CL-08;
- zbędny końcowy ekran „Konto gotowe”, bez pomijania kontroli konta.

Nie zmienia globalnego governance, E1 fail-closed, KRS tożsamości historycznej, uprawnień istniejących klientów ani przyjętych zakresów środowisk.
Akceptacja kanonu nie jest akceptacją nieistniejącej jeszcze makiety MagicPath. Przed wdrożeniem nowych interakcji potrzebny jest kompletny, zaakceptowany projekt zgodnie z wrapperem UX/UI.
