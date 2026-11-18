# Kalendarz — uzupełniający pakiet zgodności z PK R4

**PROPOZYCJA DO DECYZJI, BEZ AKTYWACJI. Pełne prywatne testy dokładnych inputów zakończone.**

Zatwierdzony [pakiet1161](https://github.com/profitia/SG-dev/issues/1161) zachowuje ważność w niezmienionym zakresie. Polityka24775757 została prawidłowo przyjęta w [PR1176](https://github.com/profitia/SG-dev/pull/1176), z oryginalnym dokładnym dowodem oraz całym wynikowym main. Cel biznesowy pozostaje: **15 rzeczywistych serii EIA, cztery oficjalne harmonogramy, powiadomienia e-mail opt-in, rzeczywisty odbiór E2E i zamknięcie PMOS/PHR**. [Zamrożony plan](https://github.com/profitia/SG-dev/blob/69d02834e863a51506aa4f50fbeb20f7fda3575b/apps/economic-calendar-runtime/operations/complete-functional-owner-plan.json) jest bajtowo niezmieniony.

Po przyjęciu PI1.2.1 i uzgodnieniu kolejności z PK R4 potrzebna jest jedna dokładna aktualizacja źródła i CI. **PK617 jest warunkiem do czasu jego rzeczywistej adopcji; zgoda lub prywatny test nie stanowią przyjęcia na main.** Root1.37/E1.4, PI i CIC pozostają zachowane.

| Przedmiot | Dokładny input |
| --- | --- |
| Źródło Kalendarza | 80e151c1317fba7d7cb3a75c2d81b2afad7e7f17 |
| Własna polityka CI | 615be4788ad5784eb79e44e30139100ecebb4646 |
| Wymagane źródło PK R4 | 617ae48d975e241e1df7d6b051ce586e0d5074bd |
| Rzeczywisty main przy przygotowaniu | 74c4e7f16bdb5d6b09aea289dc0d44ac1b0cdde7 |

Przed publikacją main odświeżono do **3109989f6a2c6378b3eddfb84cf99d1a199d1f1e**: polityka PK R4 została już przyjęta w [PR1180](https://github.com/profitia/SG-dev/pull/1180), a jej rzeczywiste drzewo jest identyczne z neutralną bazą własnego diffu CI. Przyjęcie źródła PK617 nadal pozostaje osobnym warunkiem.

Jeden pakiet obejmuje pełny [diff źródła82 plików](../proposals/calendar-pk-r4-20261118/source.patch), [własny diff dwóch plików CI](../proposals/calendar-pk-r4-20261118/policy.patch), [blob/status/mode/ownership](../proposals/calendar-pk-r4-20261118/closed-source-review.json), [pochodzenie i sumy patchy](../proposals/calendar-pk-r4-20261118/source-input-provenance.json), [testy](../proposals/calendar-pk-r4-20261118/predeployment-test-summary.json) i [procedurę adopcji](../proposals/calendar-pk-r4-20261118/normal-adoption-plan.json). Prywatne inputy nie są jeszcze opublikowanym kodem ani aktywną polityką; pełne proponowane bajty są w załącznikach.

Zakres własny to **66 ścieżek ARCHITECTURE i16 SG2, bez nowych zmian SRM**. Graf562 źródeł uwierzytelnia niezmieniony Cal69 i PK617/PI przed odczytem właściwego historycznego poprzednika. Oryginalne58+7 przeglądy,75-plikowy input69 i historyczne potwierdzenia pozostają. Wspólny adapter Identity zachowuje oba zestawy endpointów i ograniczeń. Wszystkie oryginalne asercje zostają; jedna historyczna asercja protokołu używa dokładnego Cal69, a bieżący kandydat własnego pełnego sprawdzenia.

CI używa aktualnego **schema2/EXACT_PROTECTED_SOURCE_VALIDATION**. Nie tworzy nowego projektora historii w kontrolerze ani wyjątku od zakazów zwykłego rejestru. Wiąże cały82-plikowy przegląd, oryginalny input, PR1063/gałąź, świeży main, ancestry, czysty checkout, tryby i bajty. Jedyny wyjątek wersji lokalnego pakietu dotyczy dokładnych manifestów SourceHub1.7.1→1.8.0 z identycznym już przyjętym peer E1.4, wyłącznie pod tym zaufanym przeglądem. Pozostałe metadane i private pins pozostają wymagane. Stary Cal69 nie otrzymuje nowej zgodności. Proof wymaga całego udanego zaufanego przebiegu, izolacji, testów/typecheck/build; nie deklaruje starego protokołu, deploymentu ani dostępu klienta.

Końcowe sprawdzenia dokładnych inputów: **polityka347/347, integralność obu źródeł122/122, PostgreSQL16.16: ECR52/52, Identity393/393, SourceHub139/139; trzy buildy PASS, bez pominięć.** To oddzielne zestawy, nie jedna liczba unikalnych testów. Wcześniejsze nieudane przebiegi pozostają zachowane. Dwa ostatnie błędy pełnego kontrolera wynikały z lokalnego adresu origin kopii; poprawiono konfigurację repozytorium bez zmiany reguł lub asercji. Właściwe GitHub CI dla nowej polityki i źródła pozostaje wymagane po GO.

Nowe chronione bajty i zasady zaufania wymagają jawnej decyzji według [Canon v3§10.1](https://github.com/profitia/SG-dev/blob/main/Canon/v3.0-profitia-agent-execution-canon.md#101-mandat-i-ponowne-używanie-zgód). GO obejmuje te dokładne inputy oraz normalną adopcję, zachowując faktycznie przyjęte równoległe zmiany. Odświeżenie transportu zachowuje oryginalną historię, cały własny diff, ownership i warunki; każda próba ma własny exact-SHA proof. Inne własne chronione bajty wymagają właściwej decyzji.

**Pakiet nie jest release GO dla nieznanego przyszłego main.** Plan exactAcceptedMainOnly pozostaje. Po adopcji i kontrolach należy przedstawić konkretny accepted-main SHA, pięć zasobów Development i świeże pełne LKG. Istniejące zgody na niezmienione migracje, role,17 rekordów kuracji,15/4 dane, sześć powiązań, jeden mail i odbiór pozostają używane.

Dostęp wykonawcy Render do pięciu zasobów sprawdzono we właściwym workspace, bez nowego tokena. Aktualny LIVE SG2 jest już nowszym PI d5eb40a0/dep-dbul4gdckfvc73chhgk0; poprzedni80875d8f jest historyczny. Sześć odczytanych wersji: dispatch54/source56/e1v9/component7/composer10/counter10. Przed operacjami obowiązuje ponowny odczyt, pełne LKG i CAS bez nadpisania nowszej cudzej wersji.

**Produkt pozostaje w toku:0 deploymentów,0 migracji i0 wysłanych maili Kalendarza.** Prywatne testy nie zastępują GitHub CI, źródłowej adopcji, LIVE, rzeczywistej skrzynki ani publikacji PHR.
