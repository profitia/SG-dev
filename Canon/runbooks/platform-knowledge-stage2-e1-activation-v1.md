# Platform Knowledge — istniejący Identity/E1, aktywacja etapu 2

Status: **pakiet wykonawczy w przygotowaniu, NIEZAINSTALOWANY**. Właściciel powierzchni ARCHITECTURE; zadanie `ARCH-PK-STAGE2-E1-IDENTITY-20261111`. Nie jest to ponowna akceptacja projektu ani automatyczny grant użytkownika.

Rozszerzamy istniejący centralny Identity/E1 i ten sam canonical Root. Nie powstaje katalog kont/grantów w Platform Knowledge ani równoległy executor. Root1.37 zawiera opt-in rodziny wiedzy; dotychczasowy domyślny candidate16 i zachowanie wcześniejszych operacji pozostają oddzielnie sprawdzane. Zmiana SDK wymaga rzeczywistej adopcji i kontrolowanego CI z zachowaniem zamkniętych historycznych receiptów.

## Granice instalacji

- Centralny obecny Identity Development: Neon `spring-bread-28217539` / `br-sparkling-term-b99l107x`, baza `platform_private`; wyłącznie istniejący właściciel `profitia_access_owner`. SQL015 tworzy opcjonalne knowledge_receivers/grants/delegations i ograniczone funkcje, bez użytkowników lub grantów. `identity_b1_runtime` dostaje wyłącznie wymagane funkcje authority.
- Odbiorca: Neon `sparkling-sky-79692560` / `br-billowing-grass-b9ko5s4f`, baza `platform_knowledge`, właściciel NOLOGIN `platform_knowledge_owner` przez oddzielnego migratora. SQL016 tworzy native binding dwóch ról, bez kopii kont/uprawnień. Runtime nie może zmieniać tego bindingu.
- Installer `packages/platform-contracts/current-e1-authority/install-knowledge.mjs` sprawdza dokładną stronę, rolę i SHA-256 SQL; wywołanie we właściwej transakcji. Przed instalacją porównujemy rzeczywiste extension/schematy i przygotowane recovery. Instalacja nie jest enrollmentem ani grantem.

## Dokładny pakiet enrollmentu — do zamrożenia po finalnym źródle

Dwie istniejące aplikacje logiczne: `platform-knowledge-development-api` i `platform-knowledge-development-worker`. Każdy binding zawiera rzeczywisty finalny deploymentId, applicationId, environment=development, dokładny Neon project/branch/database/role i knowledgeSchemaDigest. Odczyt centralny i odbiorcy musi być zgodny. origin API: `https://platform-knowledge-development-api.onrender.com`; authorityOrigin: zweryfikowany istniejący host Identity Development. Issuer i authorizedParties pochodzą z rzeczywistego bieżącego Clerk/Identity, bez wildcardu lub automatycznego dopisania innego środowiska.

Worker otrzymuje odrębny Ed25519 klucz podpisu: prywatna część tylko w istniejącej usłudze Workera, publiczna w centralnym E1, niesekretny keyId w obu. Nie używamy hasła bazy ani APIkey jako tożsamości serwisu. Podpis15s wiąże job/delegację/nonce/odbiorcę/fazę. Początek zadania potwierdza bieżący stan konta Clerk; kolejne checkpointy sprawdzają native E1 i delegację, bez Clerk/chunk. Delegacja maksymalnie30min, bieżący stan konta, praw i członkostwa przed opłaconą operacją i przed publikacją wyniku.

Kandydat konta operatora z potwierdzonego bieżącego Identity: UserID `092c2d9f-a84b-4c18-b3d6-e172a61399b8`, konto Tomasza Profitii. To rozpoznanie tożsamości, **nie automatyczny grant z roli w innej aplikacji**. Konkretny grant odbioru musi wskazywać osobno scope, operacje, purpose, binding_standard, source_ref i skończone expires_at. Etap2 potrzebuje wspólnego import/read/query/publish/withdraw/delete; prywatne import/read/query/delete służą osobnemu odbiorowi zakresu konta. Nie dodajemy grantów memory ani innych kont. Dopuszczenie BINDING_STANDARD jest jawne i oddzielne od zwykłej publikacji.

Przed wymaganym szczególnym GO finalny pakiet musi zawierać dokładny SQL/digest, terminy, role i operacje, publiczny worker keyId, niezmienny kod źródła, wyniki testów i recovery. Ten dokument nie zastępuje tego finalnego pakietu i nie upoważnia do tworzenia grantów. Wcześniejszych aktualnych upoważnień do istniejących sekretów/zasobów nie pytamy ponownie.

## Readback i odbiór

Sprawdzamy właściwą rolę/środowisko, brak owner membership w runtime, zamknięte uprawnienia funkcji/tabel, zgodność dwóch native bindingów i statusy/granty/expiry. `/v1/e1/knowledge/ready` musi odpowiadać gotowości obu zarejestrowanych odbiorców. API PK odrzuca cookie, klientowski UserID i sfałszowane ALLOW; aktualny bearer przechodzi przez istniejącą sesję i kanoniczny account binding. Root kontroluje ADMIT/COMMIT/RESULT; zewnętrzne model calls nie są przedstawiane jako atomowa transakcja SQL.

Natywne testy obejmują brak grantu drugiego konta, ograniczony prywatny grant, ban konta, odwołanie delegacji, podpis Workera i brak E1 dla każdego chunka. Development wymaga rzeczywistego normalnego logowania i operacji operatora; fixture nie jest testem konta właściciela.

Pamięć i dostarczanie likwidacji konta pozostają zależnościami etapu3. W etapie2 przygotowujemy kontrakt i persistence/fencing; nie wystawiamy nieuwierzytelnionego endpointu lifecycle, nie wyciągamy deletion z nieaktywnego członkostwa i nie aktywujemy pamięci bez zgody użytkownika.
