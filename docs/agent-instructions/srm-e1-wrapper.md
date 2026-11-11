# Wrapper SRM — E1

Pracujesz nad projektem SRM — profil SRM.
TARGET_ENVIRONMENT=development
Repozytorium authority: https://github.com/profitia/SG-dev
Branch authority: main.
Właściwy profil workspace: SG-dev Codespaces SRM. Rzeczywiste miejsce wykonania potwierdź zgodnie z aktywnym profilem i wymaganiami zadania. Nie stosuj profilu SG2 tylko dlatego, że SG2 i SRM znajdują się w tym samym repozytorium.
Zakres, kryteria odbioru i upoważnienia wynikają z zaakceptowanego zadania lub planu. Ten wrapper określa zasady wykonania i nie stanowi samodzielnej zgody na implementację, utworzenie zasobów, koszty ani deployment. Dotyczy Development; nie rozszerza upoważnienia na Staging lub Production.
Przed rozpoczęciem każdego zarządzanego zadania Development — także audytu read-only — oraz przed każdą mutacją:

• Załaduj root AGENTS.md, wszystkie właściwe zagnieżdżone AGENTS.md, aktywny manifest, dokumenty CORE i SRM w wymaganej kolejności oraz aktywny adapter SRM.
• Odśwież origin/main. Potwierdź repozytorium, branch, HEAD, upstream, stan working tree, rozbieżności i równoległe zmiany. Zachowaj istniejącą pracę i użyj izolowanej przestrzeni oraz gałęzi.
• Zadeklaruj taskId, profil SRM, workspace, rzeczywiste miejsce wykonania, TARGET_ENVIRONMENT, zakres, kryteria odbioru i wszystkie dokładne target paths. Oddziel środowisko docelowe od miejsca wykonania, takiego jak komputer lokalny, Codespaces lub CI.
• Potwierdź routing owner, dopuszczony profil i code state każdej ścieżki. Nowe ścieżki również wymagają sprawdzenia przed edycją.
• Wykonaj walidację manifestu i pełny, właściwy dla zadania fail-closed governance preflight. Bramka BLOCKED zatrzymuje objętą nią mutację.
• Potwierdź tożsamość połączenia PMOS względem aktywnego profilu SRM: projekt Neon, endpoint i bazę srm_pmos, a także rolę runtime, jeśli wymaga jej profil. Nie używaj bazy produktu. Nazwa bazy bez zgodnego endpointu nie jest wystarczającym dowodem.
• Wykonaj kanoniczne pmos:begin z apps/pmos z profilem SRM wyłącznie we właściwej bazie PMOS. Przekaż rzeczywisty hostConversationId. Jeśli host go nie udostępnia, zastosuj --host-conversation-unavailable i jawne null w wejściu rejestracji. Nie wymyślaj identyfikatora; conversationId wyprowadza PMOS.
• Po rejestracji ponów preflight z --require-begin i tą samą tożsamością hosta. Po zmianie zakresu, ścieżek, środowiska lub istotnych warunków ponów odpowiednie bramki.
Nie zapisuj historii SRM w PMOS SG2, CIC, ARCHITECTURE ani w bazie produktu. Współdzielone pakiety przyjmuj zgodnie z routingiem i procesem integracji; producent i odbiorca zachowują osobne zadania, profile i PMOS.
Kontekst operacji, dane i E1
Przed implementacją określ wpływ zadania na tożsamość, właścicielstwo danych i dostęp. Dla zmiany wyłącznie prezentacyjnej odnotuj brak wpływu z krótkim uzasadnieniem.
• Załaduj aktywny kontrakt kontekstu operacji, macierz dostępu i właściwe kontrakty odbiorcy. Rozróżniaj wymagania docelowe, istniejącą implementację i faktycznie wdrożony zakres.
• Dla nowych lub zmienianych danych określ przed implementacją klasę danych, właściciela, autora, zakres udostępniania oraz wymagane operacje, uprawnienia i dostęp produktu. Oddziel wiedzę wspólną od prywatnych przypisań, ustawień, historii zleceń i metadanych. Nie zakładaj, że cały raport lub surowy payload MGBI/Vercly jest wiedzą wspólną.
• Korzystaj z przyjętego wspólnego mechanizmu E1. Rzeczywiste User ID, Organisation ID i prawa rozstrzygaj po stronie serwera na podstawie zweryfikowanej tożsamości oraz autorytatywnego stanu dostępu. Identyfikator z formularza, URL lub nagłówka nie stanowi samodzielnego upoważnienia.
• Nie przypisuj stałych ID klientów ani użytkowników do komponentów wielokrotnego użytku. Zachowuj zatwierdzone powiązania aplikacji gospodarza i środowiska. Nie utożsamiaj identyfikatora Clerka, projectKey, taskId ani conversationId z wewnętrznym User ID lub Organisation ID.
• Rozróżniaj właściciela danych od autora. Nie przenoś automatycznie danych demo ani danych poprzedniego właściciela. Zadania usługowe zachowują własną tożsamość i właściwą delegację.
• Zachowaj granice dostępu we wszystkich objętych zmianą API, eksportach, integracjach, zadaniach w tle, cache i plikach. Używaj właściwych ograniczonych ról bazowych i zabezpieczeń SQL. Nie obchodź E1 ścieżką demo, uprzywilejowanym połączeniem lub alternatywnym endpointem.
• Dobierz testy pozytywne i negatywne do wpływu zmiany, uwzględniając właściwe przypadki różnych organizacji, użytkowników i cofnięcia dostępu. Zachowaj wymagany audyt operacji bez sekretów i surowych danych prywatnych.

Zasady ładowania governance, preflight i PMOS dotyczą każdego zarządzanego zadania Development, w tym audytu read-only, nawet jeżeli zadanie nie przewiduje mutacji. Uruchom dokładnie kanoniczne pmos:begin z apps/pmos, a po uzyskaniu faktycznych wyników wykonaj PMOS closeout; zwykły audyt read-only publikuje PHR tylko wtedy, gdy ustanawia zaakceptowaną decyzję lub nowy baseline.
Traktuj kontrakt E1 jako normatywny cel, ale przed użyciem wspólnego mechanizmu potwierdź w aktualnym kodzie, rejestrach E1 i evidence właściwego konsumenta, że dokładna operacja oraz target path rzeczywiście przyjęły daną wersję kontraktu. Status kontraktu docelowego, obecność kodu albo wcześniejszy test nie są samodzielnym dowodem adopcji lub wdrożenia.
Uniwersalny development, pełny zakres funkcjonalny i mandat wykonawczy
Domyślnym celem developmentu jest budowanie uniwersalnych komponentów i funkcjonalności, możliwych do wykorzystania przez różne aplikacje, organizacje i użytkowników. Nie ograniczaj implementacji do bieżącego klienta ani nie zapisuj jego identyfikatorów w komponentach wielokrotnego użytku.
Rozdziel trzy zagadnienia:
• pełny zakres możliwości funkcjonalności;
• szczegółowe przypisanie tych możliwości rolom biznesowym;
• obowiązujące granice tożsamości, właścicielstwa i dostępu do danych.
Funkcjonalność może najpierw powstać z pełnym zakresem możliwości, a szczegółowa macierz ról biznesowych może zostać opracowana w kolejnym, jawnym etapie. Przed utrwalaniem danych ustal jednak ich klasę, właściciela i autora. Izolacja organizacji oraz danych osobistych obowiązuje przez cały development.
Do walidacji wykorzystuj jawnie wskazane konta i organizacje testowe. Profil testowy może otrzymać wszystkie operacje funkcjonalne objęte zadaniem, w zatwierdzonym zakresie organizacji i zasobów. Nowe operacje definiuj jawnie i przyjmuj przez właściwy kontrakt E1. Pełny dostęp funkcjonalny nie oznacza dostępu do cudzych danych, uprawnień administratora bazy, wyłączenia RLS ani pominięcia audytu.
W zadaniu objętym zaakceptowanym zakresem i kontraktem Full Autopilot mandat wykonawczy obejmuje również bezpieczne, konieczne prace pomocnicze: poprawki kodu, testów, kontraktów, integracji i migracji oraz konfigurację potrzebną do osiągnięcia uzgodnionego rezultatu. Ich wykonanie w działającym środowisku wymaga, aby upoważnienie obejmowało odpowiednią instalację lub deployment.
Nie traktuj nowego numeru SQL, dodatkowego pliku, poprawki technicznej ani konieczności utworzenia podzadania jako samodzielnego powodu do ponownego pytania o zgodę. Oceń rzeczywisty wpływ zmiany względem zaakceptowanego celu, środowiska, danych, dostępu i kosztów. Jawne wyłączenia oraz zamknięte listy dopuszczonych zmian pozostają wiążące.
Jeżeli realizacja wymaga rozszerzenia wspólnego mechanizmu ARCHITECTURE i przyjęcia go przez SG2 lub SRM, rozpisz te prace jako zależne zadania właściwych profili. Jeżeli mieszczą się w udzielonym upoważnieniu, wykonuj je bez kolejnej akceptacji przejścia między etapami. Zachowaj odrębne taskId, routing, PMOS i kryteria odbioru; nie przejmuj cudzych ścieżek przez zmianę profilu.
Bramki governance pozostają obowiązujące. Nie obchodź BLOCKED. Jeżeli potrzebna jest zmiana samego governance, potraktuj ją jako jawny zakres wymagający właściwego upoważnienia i testów.
Stosuj STOP CONDITION z kontraktu Full Autopilot przy nowym istotnym ryzyku lub konieczności przekroczenia udzielonego upoważnienia. Nowe repozytoria i projekty GitHub, Render oraz Neon nadal tworzy użytkownik. Nie zakładaj zgody na nowe koszty, dostęp do innych organizacji ani Staging lub Production.
Raportuj oddzielnie gotowość funkcjonalności, działanie profilu testowego, gotowość szczegółowego modelu ról oraz rzeczywiste wdrożenie. Odłożenie macierzy ról nie może zostać przedstawione jako zakończony odbiór bezpieczeństwa.
Monitoring i obserwowalność — Observability by Default
Każda nowa lub modyfikowana funkcjonalność powinna być automatycznie obejmowana istniejącym systemem monitoringu aplikacji, w zakresie odpowiadającym charakterowi zmiany. Monitoring jest integralnym elementem developmentu i kryteriów odbioru, a nie osobnym zadaniem wymagającym dodatkowego etapu lub odrębnej akceptacji, jeżeli mieści się w zatwierdzonym zakresie prac.

Zasady implementacji:
- Wykorzystuj istniejącą instrumentację Sentry i przyjęte mechanizmy telemetryczne aplikacji. Nie twórz równoległych systemów monitorowania, nie duplikuj zdarzeń i nie przebudowuj działającej instrumentacji bez rzeczywistej potrzeby.
- Nowe komponenty frontendowe, endpointy API, integracje i operacje backendowe powinny korzystać z automatycznego przechwytywania wyjątków i monitoringu wydajności, jeżeli są wykonywane w runtime objętym Sentry.
- Dla nowych lub zmienianych istotnych procesów biznesowych uzupełnij telemetrię o rozpoznawalne etapy wykonania, czas trwania, wynik operacji oraz techniczne przyczyny niepowodzeń. Sam status HTTP 200 nie jest dowodem sukcesu biznesowego.
- Szczególnie monitoruj procesy krytyczne: rejestrację i logowanie, ustanawianie i odnawianie sesji, komunikację z Clerk i E1, operacje bazodanowe, integracje zewnętrzne, przetwarzanie danych, kalkulacje oraz zadania wykonywane w tle — w zakresie należącym do modyfikowanego runtime'u.
- Rozróżniaj awarie techniczne od oczekiwanych wyników biznesowych, takich jak brak danych, błędny kod OTP, odmowa dostępu lub przekroczenie limitu. Nie generuj incydentów Sentry dla każdego poprawnie obsłużonego przypadku odmowy.
- Nowy niezależny runtime, worker lub usługa wymaga jawnego sprawdzenia zakresu istniejącej instrumentacji. Nie zakładaj, że monitoring obejmie go automatycznie tylko dlatego, że kod znajduje się we wspólnym repozytorium.
- W przypadku funkcjonalności krytycznej zapewnij możliwość wykrywania istotnych awarii i regresji wydajności poprzez istniejące alerty lub odpowiednie rozszerzenie ich konfiguracji w zatwierdzonym zakresie. Nie twórz nadmiernych, powielających się powiadomień.

Izolacja i bezpieczeństwo:
- Zachowuj przypisanie telemetrii do właściwej aplikacji, projektu Sentry, środowiska, usługi i release SHA. Development, Staging i Production muszą być jednoznacznie rozróżnialne.
- Istniejący projekt `profitia/sg-porr` dotyczy zatwierdzonego zakresu SpendGuru dla PORR. Nie kieruj do niego automatycznie zdarzeń SRM, przyszłego SaaS ani niezależnych usług. Dla innych runtime'ów wykorzystuj wyłącznie ich właściwą, zaakceptowaną konfigurację monitoringu.
- Nie przesyłaj do Sentry haseł, tokenów, kodów OTP, cookies, surowych danych finansowych, danych osobowych, zawartości prywatnych requestów ani poufnych payloadów. Zachowaj istniejące mechanizmy sanitizacji, pseudonimizacji i ograniczania szczegółowości danych.
- Monitoring nie może inicjować dodatkowych odczytów tożsamości Clerk/E1, ponawiać operacji biznesowych, uruchamiać dodatkowych kalkulacji ani zmieniać zasad autoryzacji lub dostępu.
- Błąd lub niedostępność systemu telemetrycznego nie może blokować działania aplikacji. Zachowaj minimalny narzut wydajnościowy i istniejące zasady próbkowania.
- Nie twórz nowych projektów, płatnych zasobów ani połączeń zewnętrznych bez właściwego upoważnienia. Sam wrapper nie autoryzuje aktywacji monitoringu w Staging lub Production.

Walidacja i ciągłość monitoringu:
- W ramach standardowych testów zmiany sprawdź, czy nowa funkcjonalność zachowuje istniejące przechwytywanie błędów i tracing, a wymagane dodatkowe sygnały są poprawnie emitowane.
- Wykorzystuj testy z kontrolowanym transportem telemetrycznym. Rzeczywisty odbiór zdarzeń w Sentry potwierdzaj przy pierwszym uruchomieniu instrumentacji lub istotnej zmianie jej działania w środowisku objętym upoważnieniem. Nie generuj sztucznych błędów na Production.
- Nie wymagaj osobnego audytu Sentry przy każdej zmianie kodu. Dla zwykłych zmian korzystających z istniejącej instrumentacji wystarczy zachowanie odpowiednich mechanizmów oraz standardowa regresja.
- Jeżeli zmiana dotyczy współdzielonego mechanizmu należącego do innego profilu, zachowaj routing owner i właściwą ścieżkę adopcji. Nie rozszerzaj samodzielnie uprawnień do instrumentowania cudzych usług.
- W końcowym handoffie krótko wskaż status monitoringu: `REUSED`, `EXTENDED`, `NOT_APPLICABLE` lub `BLOCKED`. Przy rozszerzeniu wymień nowe sygnały i sposób ich weryfikacji. Nie wymagaj osobnego raportu, jeżeli monitoring pozostał bez zmian.

Zasada nadrzędna:
Rozwijaj monitoring równocześnie z rozwojem funkcjonalności, wykorzystując istniejącą architekturę observability. Nie odkładaj koniecznej instrumentacji nowego procesu na osobne przyszłe zadanie, jeżeli jej wykonanie mieści się w bieżącym mandacie Full Autopilot. Jednocześnie nie rozszerzaj zakresu monitoringu poza zatwierdzone aplikacje, środowiska i zasoby.

Deployment i odzyskiwanie
Przed każdym deploymentem utwórz i zweryfikuj Last Known Good: poprzedni działający source SHA, identyfikator i digest zachowanego artefaktu, zgodną wersję konfiguracji bez wartości sekretów, stan migracji oraz wykonalną procedurę przywrócenia. Sam SHA ani możliwość ponownego zbudowania aplikacji nie dowodzą odtworzenia poprzedniego artefaktu.
Przy pierwszym wdrożeniu jawnie oznacz brak poprzedniej wersji. Zweryfikuj procedurę zatrzymania nieudanego uruchomienia i usunięcia jego skutków lub odtworzenia zasobu oraz danych. Nie wpisuj fikcyjnego LKG.
Dla zmian danych zapewnij właściwy backup, snapshot lub branch Neon oraz sprawdzoną procedurę odzyskania. Nie rozpoczynaj deploymentu bez potwierdzenia wykonalności odzyskania. W razie regresji zatrzymaj propagację i przywróć działający stan, bez automatycznego cofania nieodwracalnych migracji lub utraty danych.
Szczegółowe wymagania aktywnego kontraktu wydania pozostają obowiązujące; ten wrapper ich nie zastępuje.
Walidacja i closeout
Po implementacji wykonaj odpowiednie testy, typecheck, build i kontrole funkcjonalne oraz weryfikację GitHub, Render i Neon w zakresie zmiany. Potwierdź zachowanie istniejących funkcjonalności.
Wykonaj kanoniczny PMOS closeout i wymaganą publikację PHR zgodnie z aktualną polityką SRM i charakterem zadania. Zwykły audyt odczytowy nie wymaga automatycznie publikacji PHR.
MEMOROS jest obecnie dla SRM kanonicznie wyłączony. Nie włączaj go ani nie zastępuj polityki zmienną środowiskową; disabled nie oznacza delivered.
Odczytaj zapisane dowody. Nie deklaruj zakończenia, dopóki wymagane publikacje nie zakończą się sukcesem, zapis we właściwej bazie i archiwum nie zostanie potwierdzony, a pending slot i advisory lock nie zostaną prawidłowo zwolnione. Przy błędzie zachowaj dane potrzebne do recovery.
