# Calendar — zachowanie przyjętego testu SDK podczas naprawy CI

Status: **NIEAKTYWNA PROPOZYCJA — jedna decyzja uzupełniająca**. Istniejące zadanie Calendar Complete Functional Delivery, wyłącznie Development. Zgoda na poprzedni pakiet źródła `e1728a034e40e0a7004cff7b61bbe79094b145a6` i polityki `44c3517fb79b61371ece06802ba33c35de4c0bff` została odebrana i zachowuje ważność w swoim zakresie.

## Dokładna decyzja

Zatwierdzenie polityki `05db10a7eb520731393b544e28bc0b429eb2c33f` na przyjętym main `efc1290378507e947cbf9ad0bcfc1e4a71086bb6`, zachowującej nowy test SDK dodany równolegle do main, oraz zastosowanie do tego dokładnego kandydata dotychczas zatwierdzonego, ograniczonego sposobu przyjęcia naprawy historii CI. Źródło produktu pozostaje **dokładnie `e1728a034e40e0a7004cff7b61bbe79094b145a6`**; nie jest przedmiotem ponownego zatwierdzania.

Względem poprzednio zatwierdzonych trzech plików polityki nowy jest **tylko jeden postimage**: `scripts/governance/controlled-package-ci-path-coverage.test.mjs`, rozszerzony o **30 linii istniejącego testu z main**. Kontroler i workflow są bajtowo identyczne z `44c3517f`. Zachowano wszystkie wcześniejsze asercje obu zadań. Względem nowego main polityka nadal zmienia dokładnie te same trzy pliki, bez zmiany statusów, trybów i ownership.

- [Pełny diff trzech plików polityki względem aktualnego main](./2026-11-18-calendar-sdk-descriptor-compat-full-policy.diff).
- [Jedyny nowy dodatek względem poprzednio zatwierdzonych postimages](./2026-11-18-calendar-sdk-descriptor-compat-new-test-only.diff).
- [Dokładne odciski i wyniki walidacji](./2026-11-18-calendar-sdk-descriptor-compat-validation.json).
- [Bieżąca gotowość zasobów Development](./2026-11-18-calendar-sdk-descriptor-compat-readiness.json).
- [Poprzedni zatwierdzony pakiet i pełna procedura jednorazowego przyjęcia](https://github.com/profitia/SG-dev/blob/3d7883e96f73d5037e0bff4691ccadd041586673/Canon/evidence/2026-11-18-calendar-ci-history-recovery-owner-decision.md).

## Dlaczego uzupełnienie jest konieczne

Po publikacji zgodnego transportu `fd80475942364c7848c8cf52c2a2dfcb061eef55` do #1206 przyjęto nowy main. Zmienia on metadane SDK oraz dodaje test w tym samym chronionym pliku. Poprzednia decyzja dopuszczała potomny transport tylko przy niezmienionych kompletnych postimages trzech plików; jawnie wyłączała konflikt wymagający nowych chronionych bajtów. [Canon v3 §10.1](https://github.com/profitia/SG-dev/blob/efc1290378507e947cbf9ad0bcfc1e4a71086bb6/Canon/v3.0-profitia-agent-execution-canon.md#101-mandat-i-ponowne-używanie-zgód) nie pozwala rozszerzyć tego ograniczenia samym trybem Full Autopilot.

Nowy test sprawdza faktyczny przyjęty descriptor SDK: cztery rzeczywiście instalowane pakiety lokalne, odrębną integralność opcjonalnych plików źródła i odmowę nadania im prawa instalacji. Propozycja zachowuje ten test oraz wszystkie testy Kalendarza. Nie przywraca starszego descriptora SDK. Zmiany równoległe nie przecinają 83 plików zatwierdzonego źródła ani jego 579 uwierzytelnionych wejść. Bieżący SDK na main nadal ma wersję 1.37.0; ten pakiet nie integruje samodzielnie odrębnego zadania SDK/onboardingu.

## Wyniki rzeczywistych kontroli

- Dokładna propozycja polityki: **26/26 PASS**, 0 FAIL, 0 SKIP, oryginalny moduł kontroli ścieżek.
- Pełna kompozycja `d5dc3d9eccd6d3d0b91cb574467c0cab709c6c94`: ℹ tests 716; ℹ pass 716; ℹ fail 0; ℹ skipped 0.
- Uwierzytelnienie dokładnych 83 plików, trybów, pochodzenia i całego diffu względem prywatnego rodzica polityki oraz granic pakietów względem faktycznego main: **PASS**. Baza polityki jest jeszcze nieprzyjętą propozycją; ten wynik nie oznacza publicznej adopcji źródła.
- Zachowano wcześniejszą odmowę prywatnego sprawdzenia z błędnie podaną historyczną bazą diffu. Poprawiono wyłącznie wejście sprawdzenia, bez zmiany kodu.
- Wszystkie powyższe kontrole są prywatne. Nowe dokładne kontrolowane CI GitHub i jego oryginalny artefakt nadal pozostają obowiązkowe.


Dla wcześniejszego dokładnego transportu `fd804759` wszystkie publiczne kontrole poza oczekiwanym verifierem zakończyły się powodzeniem: governance, Architecture, kontrakty SG2/SRM, dashboard SG2 i pełne API/typecheck/build SRM. [Oryginalny controlled run 44402996407](https://github.com/profitia/SG-dev/actions/runs/44402996407), rzeczywisty control `0523b664a4846c99885c7debfa7b5035025b9b3f`, zakończył się odmową przed instalacją i wykonaniem kandydata. [Publiczny run 44403013144](https://github.com/profitia/SG-dev/actions/runs/44403013144) zgłosił `CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA` wyłącznie w verifierze SG2. Nie wystawiono kontrolowanego proof. Logi obu odmów i ich odciski zachowano. Te wyniki **nie są dowodem dla `05db10a7`** i nie zastąpią jego nowych kontroli.

## Sposób przyjęcia i dalsza realizacja

1. Po zgodzie i poprawnej prywatnej walidacji odczytać świeży main, #1206 i aktualne prace współdzielone. Opublikować dokładny `05db10a7` albo zwykły potomny transport zachowujący wszystkie trzy nowe postimages, statusy i tryby. Bez force push. Dodatkowe chronione bajty nie są objęte tym wnioskiem.
2. Uruchomić publiczne kontrole oraz `validate-sg2` z rzeczywiście zaufanego bieżącego main dla dokładnego HEAD. Zachować oryginalny wynik i logi. Jeśli kontrolowany przebieg przejdzie, użyć jego prawdziwego oryginalnego artefaktu i zwykłej ścieżki integracji.
3. Wyłącznie gdy rzeczywista odmowa dotyczy potwierdzonego braku historycznego wejścia w płytkim checkout przed instalacją, a **wszystkie inne wymagane kontrole przejdą** i publiczny verifier zgłosi jedynie `CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA`, zastosować wcześniej zatwierdzony jednorazowy normalny merge naprawy CI z kontrolą oczekiwanego HEAD. Bez admin/force merge, wyłączania jobów, zmian branch protection ani nazywania odmowy PASS. Każda inna przyczyna odmowy zatrzymuje tę operację.
4. Obowiązkowo przeprowadzić pełną kontrolowaną walidację wynikowego main, z rzeczywistą czystą instalacją, usunięciem poświadczenia przed wykonaniem, testami, typecheck i build. Niezależnie zweryfikować oryginalny artefakt, dokładne SHA, tożsamość całego zakończonego przebiegu i jego faktyczne wejścia `CONTROL_POLICY_FILES` (obecnie 12). Nowy przyjęty descriptor SDK zmienia digest — wcześniejszy digest nie może zostać podstawiony.
5. Dopiero po tym normalnie włączyć faktycznie przyjęty main do źródła `e1728a03` z zachowaniem wszystkich 83 postimages i historii, użyć istniejącego #1063, uzyskać jego własny dokładny controlled proof i komplet wymaganych kontroli, zintegrować normalnie oraz sprawdzić wynikowy main. **Dla źródła produktu nie ma wyjątku od CI.**
6. Zachować istniejące zgody na operacje Kalendarza. Po poznaniu faktycznego zaakceptowanego main przygotować właściwe release GO dla dokładnego SHA i pięciu istniejących zasobów, ze świeżym LKG, kontrolą konfiguracji/powiązań i rollbackiem. Ten pakiet nie zatwierdza nieznanego przyszłego wydania.
7. Następnie wykonać dopuszczone operacje Development oraz odbiór LIVE: 15 rzeczywistych serii EIA, cztery oficjalne harmonogramy w SG2, jeden oznaczony e-mail z podpisanym DELIVERED i odczytem skrzynki, replay, opt-out, wąskie cofnięcie uprawnienia oraz publikację i readback PMOS/PHR/MEMOROS. Dotychczasowy business DoD i ograniczenia pozostają bez zmian.

## Ograniczona koordynacja techniczna — ten sam wniosek

Uzupełniająca zgoda obejmuje wymianę informacji technicznych z istniejącymi czatami **„Logowanie i rejestracja”**, **„Auto-Audyt CIC”**, **„Procurement Insights”** i **„Napraw wyszukiwanie Macrobond”**, wyłącznie w celu ustalenia kolejności integracji wspólnych plików CI, zachowania obu zakresów oraz bezpiecznego okna istniejących usług Development SG2/Identity/SourceHub. Wcześniejsza zgoda dla „Platform Knowledge MEMOROS” pozostaje ważna.

Zakres wymiany: publiczne SHA/PR, stan CI, identyfikatory istniejących wdrożeń, planowane okno operacji, ownership i warunki kolizji/rollbacku. Bez sekretów i danych użytkowników, delegowania cudzych prac, rozpoczynania anulowanego onboardingu w tym czacie lub zmiany cudzych uprawnień. Żadnego nowego czatu ani nowego zadania. Do czasu zgody nie wysłano wiadomości do tych czterech czatów.

## Stan i odwracalność

Business status **IN_PROGRESS**. Nie wykonano wdrożenia funkcjonalnego Kalendarza, jego migracji, nowych grantów, zapisów powiązań/config, pozyskania 15 nowych serii ani wysłania wiadomości. PMOS/PHR biznesowe pozostają otwarte. Aktualna wersja Identity `cfa76c86` i równoległe zmiany są zachowane. Nie użyto cudzych danych ani poświadczeń.

Potwierdzono bieżące wersje pięciu zasobów i istniejący dostęp wykonawcy Render do trzech dokładnych prywatnych archiwów pakietów (SHA-512 zgodne z lockiem). Skryptów pakietów nie wykonywano; własny katalog tymczasowy usunięto. Gotowość wykonawcza nie oznacza deploymentu ani odbioru.

Gałąź dowodów służy wyłącznie przeglądowi. **Nie scalać jej jako poprawki CI ani źródła produktu**. Aktywny #1206 pozostaje na poprzednim head do nowej decyzji.
