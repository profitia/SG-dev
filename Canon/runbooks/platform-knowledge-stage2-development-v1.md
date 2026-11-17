# Platform Knowledge — wykonanie i odbiór etapu 2 na Development

Status: **W_TOKU — kandydat źródeł, bez aktywacji silnika**. Zadanie `ARCH-PK-STAGE2-ENGINE-LIVE-20261111`; powiązane: `ARCH-PK-STAGE2-CONTRACTS-ADAPTER-20261111`, `ARCH-PK-STAGE2-E1-IDENTITY-20261111`, `ARCH-PK-STAGE2-ROOT-OPERATIONS-20261111`, `CIC-PK-STAGE2-QUERY-CONTRACT-20261111`. Podstawa: [kanon](../v1.0-platform-knowledge-business-and-architecture-canon.md), [harmonogram](platform-knowledge-development-delivery-plan-v1.md), obowiązujące wrappery SG2/E1 i Full Autopilot. Ten runbook wykonuje przyjęty zakres; nie zmienia kanonu.

## Rezultat i granica

Działająca samodzielna biblioteka, API i panel administratora na istniejącym Development. Odbiór obejmuje rzeczywisty import, automatyczne przetwarzanie, wyszukanie i cytowanie, publikację/wycofanie, odporność i koszt. Plan rzeczywistego CIC oraz rzeczywisty adapter ACG są sprawdzane przez niezależnego konsumenta. Nie jest to końcowa odpowiedź hosta asystenta ani aktywacja pamięci i cyklu życia konta w SpendGuru; to etap 3.

Nie zamykamy etapu po utworzeniu aplikacji, merge lub zielonym teście jednostkowym. Każdy niepotwierdzony warunek pozostaje oznaczony. Zadanie całościowe kończy się dopiero po kryteriach etapu 3 na Development; bieżące zlecenie dotyczy etapu 2.

## Istniejące zasoby

Wiążące identyfikatory: [manifest](../../apps/platform-knowledge-runtime/deployment/development.json). API `srv-dbq6n2m7bikc73dmvs8g`, Worker `srv-dbq6njec6qcc738fjf50`, ten sam projekt/środowisko Render. Neon `sparkling-sky-79692560` / `br-billowing-grass-b9ko5s4f`, baza `platform_knowledge`, prywatny bucket `platform-knowledge-uploads`. Auto-deploy Off; jedna instancja, bez nowego Redis, dysku lub kolejki zewnętrznej. Nie podnosimy planów. Migrator nie trafia do runtime. Dwa zastąpione klucze storage pozostają zgodnie z decyzją właściciela.

Obecne LKG: dwa potwierdzone deploymenty etapu 1 z `1fef8b3837c1bdd6ea9ff95dd4e976cc71cf9526`. Sam SHA lub ID obrazu CI nie jest digestem artefaktu Render. Przed zmianą zachowujemy rzeczywiste identyfikatory poprzednich deploymentów, dostępność rollbacku oraz niesekretną konfigurację. Jeżeli dostawca nie udostępnia wymaganego dowodu artefaktu, oznaczamy brak i rozstrzygamy konkretną procedurę, bez fikcyjnego LKG.

## Kolejność dopuszczenia i uruchomienia

1. Aktualny main, właściwy routing i PMOS dla każdej powierzchni. Testy kontraktów/core/Root/current E1/Identity/ACG, natywne PostgreSQL18.6 i vector0.8.6, kontener Linux nonroot i izolacja parserów dla wszystkich rzeczywistych formatów. Własne CI nie zastępuje wymaganych kontroli wspólnych kontraktów.
2. Zamknięte przyjęcie nowej wersji Root i SDK u właściwych właścicieli, z zachowaniem historycznych receiptów. Kontrolowane CI wymaga dokładnego następcy źródła/polityki; nie przepinamy historycznych hashy i nie omijamy go. Szczególne wymagane owner GO przedstawiamy dopiero jako gotowy konkretny pakiet.
3. [Istniejący Identity/E1](platform-knowledge-stage2-e1-activation-v1.md): kontrolowana instalacja opcjonalnych SQL015/016, dokładne enrollmenty, klucz publiczny workera i jawny ograniczony grant operatora. Brak inferencji z domeny e-mail, roli innej aplikacji lub aktualnej organizacji. Żadnego grantu na podstawie tego dokumentu bez właściwego dopuszczenia.
4. Izolowane sprawdzenie instalacji i recovery zgodne z foundation, bez tworzenia przez wykonawcę nowego zasobu wbrew rezerwacji właściciela. Natywne testy lokalne/CI nie są dowodem zmiany docelowej gałęzi. Zapis exact SQL SHA-256, środowiska, roli migratora i readbacku ograniczeń. Product SQL001 instaluje wyłącznie `platform_knowledge_migrator` z jawnym `SET LOCAL ROLE platform_knowledge_owner`, transakcyjnie, przez `scripts/migrate.mjs`; wymagane `PK_APPROVED_MIGRATION_SHA256`. Nie odtwarza tabel istniejącej instalacji i nie robi globalnego restore.
5. Przyjęty main i ręczne dokładne wydanie obu istniejących usług. Najpierw kompatybilna obsługa Identity, następnie PK z właściwymi bindingami i flagą. Sekrety ustawiamy bezpośrednio w odpowiadającym im środowisku, bez stdout/GitHub. Worker ma tylko własny klucz podpisu; API nie otrzymuje go. Obie usługi zachowują swoje role DB i klucze storage, TLS verify-full, zatwierdzony klucz OpenAI, region eu-central-1 i path-style. Nie kopiujemy migratora.
6. `/health/live`200 to wyłącznie proces. `/health/foundation`200 to ograniczone połączenie. `/health/ready`200 wymaga schematu i bieżącej gotowości E1; odbiór funkcjonalny nadal wymaga dokumentu i wyszukiwania. Sprawdzamy SHA obu deploymentów i sanitarny monitoring Sentry, a nie sam moment wysłania polecenia deploy.
7. Rzeczywisty operator korzysta z panelu: importuje, ogląda pokrycie/wynik, publikuje cały materiał i wycofuje go. Nie ma akceptacji pojedynczych chunków/embeddingów. Osobno wykonujemy niezależny przepływ CIC → ACG → API i profil jakości.

## Odbiór jakości i odporności

Zamrożony profil: `packages/platform-knowledge-core/fixtures/quality-profile-v1.json`; progi nie są obniżane po płatnym teście. Dane autorskie syntetyczne, bez materiałów klientów. Zapisujemy identyfikatory źródeł/generacji i hashe plików w prywatnym receipcie; publiczny dowód zawiera tylko niesekretne wyniki techniczne.

- Wszystkie 10 plików referencyjnych, w tym rzeczywiste DOC/PPT, skan PDF i dokument100stron. Rozliczenie jednostek1.0, pokrycie odczytanych znaków1.0, znaczniki początku/środka/końca. Nie utożsamiamy odczytanych znaków ze stuprocentowym rozumieniem obrazu; OCR/wykresy i pochodna struktura legacy pozostają PARTIAL z powodem.
- Co najmniej trzy konkurujące źródła: obowiązujący standard, nowsza referencja i procedura historyczna. Naturalne pytanie bez documentId/tytułu, wymagające kilku faktów; dokładne CPV/norma/liczba; sprzeczność bez premiowania samej daty; rzeczywisty brak odpowiedzi. Recall@10 naturalny≥0.9, dokładny1.0, poprawność cytowań1.0, brak fikcyjnych odpowiedzi i wycieków.
- `scripts/verify-development.mjs` ładuje rzeczywisty osobno zbudowany moduł CIC przez lokalną ścieżkę i dokładny digest, rzeczywisty adapter ACG oraz API Development. Nie kopiuje prywatnego CIC do publicznego repozytorium i nie potrzebuje credentiali prywatnego rejestru w Render. Krótkotrwała sesja pochodzi z normalnego logowania, nigdy z podszywania się pod konto. Plik sesji0600, bez wartości w komendzie/Git/logach. Niezależny licznik OpenAI otrzymuje wyłącznie potwierdzony autorski zestaw. Sukces tego podzbioru nie zastępuje całego odbioru.
- Wynik dokumentu i retrieval po potwierdzonym usunięciu oryginału. Odczyt oryginalnych cytatów/lokalizacji z zachowanej reprezentacji; nie przedstawiamy generowanej syntezy jako cytatu.
- Przejęcie przerwanego zadania, fencing starego workera, skończony deadline; brak ponownej wysyłki kosztownego niepewnego wywołania. Przywrócenie łączności z E1 nie tworzy nowej tożsamości lub grantu.
- Błędna przebudowa pozostawia poprzednią generację; poprawna przełącza indeks dopiero po walidacji. Zmiana parsera po usunięciu oryginału zgłasza potrzebę ponownego uploadu.
- Wycofanie odcina retrieval od razu, również dla cache korzystającego z kilku źródeł i dla spóźnionych wyników. Usunięcie zachowuje niezbędne rozliczenie kosztu, ale usuwa treść pochodną; nie zeruje budżetu.
- Prywatne zakresy UserID, ograniczenie organizacyjne po zmianie członkostwa, UNKNOWN bez automatycznego przypisania organizacji. Testy natywne i kontraktowe mają wskazaną granicę; nie udajemy testu na dwóch prawdziwych kontach, jeżeli go nie wykonano.

## Budżet, dane i operacje

OpenAI: 10USD łącznie, 1USD na dokument, modele gpt-6-luna i text-embedding-3-small, store=false. Trwała natywna rezerwacja przed każdym płatnym wywołaniem, konserwatywny koszt i brak automatycznego retry przy niepewnym wyniku. Ledgera nie resetujemy po teście lub usunięciu materiału. Raportujemy osobno wycenę wykorzystania i rachunek dostawcy; nie nazywamy estymacji fakturą.

Surowe pliki usuwa Worker po zakończeniu potrzebnego przetworzenia lub w cyklu retencji. Retencja działa również przy niedostępnym E1; problemy sprzątania są błędami monitorowanymi. Przy awarii Workera należy go przywrócić przed terminem24h; zaległości sprzątać przed ponownym dopuszczeniem uploadu. Neon storage nie wykonuje jeszcze samodzielnie expiration rules — zapisanie reguły nie jest dowodem usuwania. Rozliczamy rzeczywisty Delete/HEAD404, a nie tylko flagę w bazie. Aktualnie potwierdzone okno historii Neon wynosi24h; nie oznacza to natychmiastowego usuwania danych z backupu i nie zastępuje procedury dostawcy.

W razie błędu: zatrzymać nowe importy, zachować wydatki i niepewne rezerwacje, przerwać/fencować zadania, uruchomić sprzątanie. Przy błędzie wydania przywrócić potwierdzone poprzednie deploymenty i konfigurację z wyłączonym processing; zachować bazę i tombstones, bez cofania wspólnego Identity lub innych projektów. Po instalacji schematu produktu pozostawić kompatybilnego Workera etapu2 z processing=false: nadal wykonuje retencję. Worker foundation etapu1 nie sprząta danych produktu i nie jest wystarczającym rollbackiem retencji. Awaria storage nie wstrzymuje odcięcia i usuwania treści pochodnej; niesprzątnięty klucz pozostaje do ponowienia, a błąd trafia do monitoringu. Zapisujemy rzeczywisty przebieg, nie samą instrukcję.

## Warunek zamknięcia

[Dowód](../evidence/2026-11-11-platform-knowledge-stage2-development.md) i maszynowy `deployment/stage2-evidence.json` muszą wskazywać faktyczne main/CI/deploy SHA, readback schematu i E1, operatora, wszystkie formaty, jakość, retencję, recovery, monitoring i koszt. Następnie wymagany PMOS/MEMOROS/PHR closeout każdego właściwego zadania. Niespełniony warunek oznacza W_TOKU, nie sukces lub pominięcie.
