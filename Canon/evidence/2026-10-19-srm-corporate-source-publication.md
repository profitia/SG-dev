# SRM — publikacja sklasyfikowanej wiedzy firmowej, 19.10.2026

Status: SOURCE_CANDIDATE_NOT_RELEASED / PROGRAMME_IN_PROGRESS.

Zadanie `SRM-E1-CORPORATE-SOURCE-PUBLICATION-20261019`, profil SRM, workspace SG-dev Codespaces SRM, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority: profitia/SG-dev/main; punkt wyjścia `3d9c177d174e2e74f92c16254e8d176b34525088`. Własny PMOS/PHR; MEMOROS wyłączony profilem. Rejestracja nie jest closeout.

## Zmiana i zachowanie biznesowe

Dotychczasowy zapis katalogu zamykał transakcję w `withOrganization`. Udostępniono ten sam zapis przez `writeSharedCompany` i ten sam zapis obliczonych wskaźników przez `writeFinancialIndicators`, z jawnym klientem transakcji. Istniejące funkcje nadal otwierają dotychczasową transakcję organizacji i wywołują te pomocniki. Ciała obu zapisów są identyczne po normalizacji wcięć; nie zmieniono zapytań, obliczeń ani znaczenia wartości. Parsery, pełny przebieg raportu, KYS, stary initializer oraz pierwotne 18 migracji pozostają bez zmian.

Nowy `createSrmCorporateSourceStore` składa istniejący platformowy host SOURCE z tym samym natywnym sterownikiem pg. Przyjmuje zamknięty pakiet `srm-corporate-publication-v1` z potwierdzalną strukturą spółki KRS, tym samym NIP, dotychczasową sekcją finansową i odpowiadającymi jej faktami. Zachowuje zera, brakujące wartości, bieżące dane jakości i numeryczne dane MSR. Nie przyjmuje surowych odpowiedzi, osób, identyfikatorów właściciela ani przekazanych przez wywołującego identyfikatorów snapshotów. Kształt pakietu jest wspólny dla walidacji JS i kontrolowanej instalacji SQL; dotychczasowy moduł wiedzy firmowej dostarcza dalszą walidację znaczenia pól.

Zapis nowych wspólnych faktów otrzymuje `source_organization_id=null` i rzeczywisty identyfikator efektu SOURCE jako dowód pochodzenia. Oryginalny kalkulator korzysta z tych faktów i rzeczywistego dowodu; CURRENT_RATIO pozostaje 1.500000 w syntetycznym przykładzie. Niezmieniona treść sekcji zachowuje pierwotny dowód, a aktualne sprawdzenie i fakty mogą wskazywać następny faktyczny efekt, zgodnie z istniejącą semantyką katalogu.

## Granice bazowe i audyt

Opcjonalne `004-corporate-source.sql` tworzy osobną przestrzeń metadanych `profitia_srm_catalog`, należącą do istniejącego kontrolowanego właściciela SOURCE. Zawiera instalację, niezmienne publikacje z klasyfikowanym pakietem i skrótem rzeczywistych bajtów oraz powiązanie z rzeczywistym OUTCOME. Nie tworzy kolejnego katalogu biznesowego, kont, organizacji ani nowego rejestratora PMOS.

Opcjonalne `005-corporate-source-access.sql`, należące do właściciela dostępu, otwiera zapis wyłącznie trzech istniejących tabel katalogu dla bieżącej publikacji SOURCE. Weryfikuje zwykłą fizyczną rolę, aktualne uprawnienie źródła, NIP, zasób, manifest, digest, identyfikator efektu, decyzję i transakcję. Sam GUC, nazwa roli, dawny ALLOW lub numer starego efektu nie wystarczają. Nowe i zachowane sekcje muszą odpowiadać sklasyfikowanej treści; pierwotny algorytm skrótu treści oraz czas sprawdzenia pozostają sprawdzane. Fakty muszą pochodzić z tego pakietu, a wejścia wskaźników z rzeczywistych faktów i globalnych dowodów dla tego NIP.

Zatwierdzenie wymaga wspólnego commitu katalogu, publikacji, zakończonego efektu i OUTCOME z tej samej transakcji. Znacznik transakcji jest przechwytywany przy faktycznym wstawieniu do istniejącego, niezmiennego dziennika SOURCE. Nie wyprowadza się go z `xmin`, ponieważ bloki EXCEPTION PostgreSQL tworzą podtransakcje. Brak OUTCOME blokuje commit i nie pozostawia nowej publikacji, efektu ani zużycia budżetu. To dowód zapisu transakcyjnego, bez twierdzenia, że rollback cofa zewnętrzne wywołanie dostawcy.

Oryginalny predykat modułu nadal ogranicza odczyt HUMAN. Zapis HUMAN, kasowanie i podmiana źródła pozostają zamknięte również po omyłkowym ACL. SOURCE nie otrzymuje uprawnień do tabel kont ani członkostw. Metadane są FORCE RLS, bez bezpośrednich uprawnień runtime i z niezmiennością historii. Pliki SQL nie nadają grantów runtime, nie tworzą ról i nie aktywują aplikacji.

## Wykonana walidacja

- **146 testów natywnych**, **534 produktu** i **311 promocji**: PASS, zero pominięć, na osobnych świeżych klastrach. Zestaw 534 obejmuje pięć nowych przypadków jednostkowych; zestaw 146 obejmuje 14 nowych przypadków natywnych. Liczb nakładających się nie sumuje się.
- Rzeczywisty zwykły login SQL, oryginalny mapper i kalkulator, trwała publikacja oraz odmowy ponownego użycia klucza z inną treścią, obcego NIP, roli, środowiska, gałęzi, digestu, cofniętego źródła, wyczerpanego budżetu, podrobionych GUC/proof, błędnych skrótów, nieznanych pól i powtórzonych kluczy JSON.
- Testy potwierdzają dojście do właściwej bramki. Brak OUTCOME jest wymuszany na rzeczywistym zapisie dziennika; jego osiągnięcie potwierdza osobny syntetyczny licznik. Próby modyfikacji hash/proof potwierdzają zarówno wcześniejsze przyjęcie publikacji, jak i rzeczywistą odmowę SQL. Istniejące prywatne konta i członkostwa pozostają niewidoczne dla SOURCE nawet po omyłkowym uprawnieniu odczytu.
- Dotychczasowa regresja HUMAN działa również z zainstalowanym opcjonalnym mostem SOURCE. Wymaga nadal aktualnego kontekstu organizacji, osoby, modułu i produktu; nie uzyskuje globalnego zapisu katalogu.
- Typecheck oraz pełny build Next16/React19: PASS. Wygenerowana zmiana `next-env.d.ts` jest zachowana poza źródłem; authority zachowuje pierwotne bajty. Własne klastry zatrzymano.

Manifest zachowuje poprzednie dowody i wskazuje bieżącą rewalidację. Dokładne CI kandydata/main, osobna zgodność SG2 oraz trwałe closeouty są wymagane osobno; dokument nie deklaruje ich z wyprzedzeniem.

## Granice odbioru

Jest to publikacja już sklasyfikowanego, zapisanego pakietu. Sama nie dowodzi wcześniejszego pobrania z MGBI, licencji, poprawności każdego dokumentu źródłowego ani rozpoznania informacji osobowych ukrytych w dowolnym tekście. Nie przenosi prywatnego archiwum do wspólnej warstwy. Pełna natywna kompozycja z transportem dostawców wymaga dalszego odbioru.

Nie wykonano zmian żywego SQL, danych, ról, grantów, konfiguracji, sekretów, zasobów ani wdrożeń. Nie przepięto źródła katalogu, aplikacji ani istniejących baz i historii. Zgodność historycznych projekcji oraz ich rzeczywiste pochodzenie wymagają odczytu i kontrolowanego przyjęcia przed wydaniem; nie zakłada się ich zgodności z nowym pakietem.

E0/E1 pozostaje IN_PROGRESS. Parytet chronionych wejść, pełny przepływ dostawców, aktualne directory/dane/role, odzyskiwanie i rzeczywista sesja nadal wymagają dowodów przed autoryzowanym wydaniem Development. Brak odbioru Staging, Production i E2–E4.
