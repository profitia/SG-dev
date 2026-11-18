# Kalendarz — uzupełniająca zgodność z PK R5: jedna dokładna decyzja

**PROPOZYCJA DO DECYZJI. Dokument nie aktywuje źródeł, CI ani produktu.**
Cel pozostaje taki sam: Development, 15 rzeczywistych serii EIA i 4 oficjalne harmonogramy w Kalendarzu SG2, jeden rzeczywiście dostarczony oznaczony e-mail po opt-in, odbiór negatywny i zamknięcie PMOS/PHR.

## Przedmiot decyzji

Zatwierdzenie dokładnego źródła **073808bd1d7129f80734a0494204033a9b656687**, polityki **c4248d8803f0e60623ace8b59a491a5e84c533fc** i opisanej normalnej integracji, po rzeczywistym przyjęciu PK R5. Wcześniejsze zgody69d02834/24775757 oraz80e151c1/615be478 zachowują ważność; ten pakiet obejmuje tylko nowe dokładne różnice zgodności.

- [Pełny diff źródła:82 własne ścieżki](../proposals/calendar-pk-r5-final-20261118/source.patch)
- [Pełny diff własnej polityki:2 pliki](../proposals/calendar-pk-r5-final-20261118/policy.patch)
- [Zamknięty wykaz blob/tryb/status/owner/routing](../proposals/calendar-pk-r5-final-20261118/closed-source-review.json)
- [Pochodzenie i sześć własnych zmian względem zatwierdzonego80](../proposals/calendar-pk-r5-final-20261118/source-input-provenance.json)
- [Wyniki, odciski logów i zachowane wcześniejsze błędy](../proposals/calendar-pk-r5-final-20261118/predeployment-test-summary.json)
- [Warunki i kolejność normalnego przyjęcia](../proposals/calendar-pk-r5-final-20261118/normal-adoption-plan.json)

## Przyczyna i zakres

PK R5 naprawia rzeczywisty cel Root w SRM i test jego pochodzenia. Kalendarz zachowuje tę korektę, dokładne źródło PK2706f13a5fb37a45daf4aea7be5e9d88ee7e4024 oraz jego samodzielny test. Nie przejmuje ścieżek SRM: własny diff nadal ma66ARCHITECTURE+16SG2. Bieżący graf uwierzytelnia562 ścieżki. Sześć własnych plików zgodności zmienia dokładne bloby wymienione w załączniku. Metadane bieżącego SDK wskazują rzeczywiste PK1.37, a dawny protokół Kalendarza1.36 pozostaje jawnie historycznym poprzednikiem. Wszystkie wcześniejsze reviews i receipts są zachowane.

Plan funkcjonalny jest niezmieniony: SHA256 **e43b5d49abef12818956f2195f0b11225fa4aef28d4fb1f2895900f8d721be9c**. Bez zmian pozostają zatwierdzone funkcjonalne bajty runtime i SQL,15serii/4harmonogramy, limit jednego e-maila i Development.

Polityka zachowuje zatwierdzone reguły schema2 z615be478, aktualizuje dokładne dane zamkniętego przeglądu i zachowuje niezależną politykę PK R5b3838a8bdf80ceb3b36a478ba264e79c7be8a036. Wyjątek SourceHub1.7.1→1.8 pozostaje pojedynczy. Nie powstaje ogólne dopuszczenie pakietów ani nowy projektor historii w kontrolerze.

Historyczne testy otrzymują niezmienne wejście PK R5, ponieważ starsza ścieżka kontroli prawidłowo odmawiała przyjęcia późniejszego połączonego grafu. Wszystkie asercje pozytywne i negatywne pozostają. Cztery obowiązkowe testy schema2 nadal uwierzytelniają aktualne źródło, pełny przegląd, tryby, symlinki, brakujące lub zmienione bajty, pochodzenie, pakiety i dowód całego przebiegu. Nie dodano pomijania testów ani osłabienia bramek.

## Sprawdzenia

- Pełny kontroler na zamrożonej samej polityce: **348/348 PASS,0 pominięć**.
- Pełny kontroler na zamrożonym połączeniu źródła i polityki: **348/348 PASS,0 pominięć**.
- Integralność dokładnego źródła: **282/282 PASS,24 pliki testowe,0 pominięć**.
- Pozostałe16 plików governance, łącznie z SourceHub foundation: **347/347 PASS,0 pominięć**. Cały governance na połączonym wejściu:348+347=695 testów, bez pominięć; osobny kontekst polityki nie jest doliczany ponownie.
- Wejścia końcowych sprawdzeń niezmienione:HEAD,drzewo i czysty stan przed/po.

To osobne prywatne zestawy, nie jedna suma unikalnych testów. Zachowano wcześniejsze błędy oraz jawnie unieważniony przebieg. Historyczne wyniki PostgreSQL16.16 ECR52/52,Identity393/393,SourceHub139/139 i trzy buildy dotyczą źródła80; nie zastępują nowych kontroli GitHub.

## Przyjęcie i granice

Najpierw rzeczywiste przyjęcie PK R5 przez właściwego ownera. Scalenie źródła Kalendarza wymaga następnie uzgodnionego handoffu po jego migracji/aktywacji/odbiorze lub odrębnego konkretnego okna, ponieważ wykonawca PK wymaga niezmienionych460 ścieżek podczas aktywacji i recovery. Potem normalna integracja polityki i kompletnego źródła Kalendarza z aktualnym main, zachowaniem oryginalnych commitów w historii i identycznością całego własnego diffu. Neutralne przyjęte zmiany równoległe pozostają zachowane. Zmiana własnych zatwierdzanych bajtów lub reguł poza tym pakietem wymaga właściwej nowej decyzji. Sam transport identycznych bajtów do kolejnego main jej nie tworzy.

Każda próba wymaga kontrolowanego przebiegu z zaufanego main dla dokładnego HEAD, niezależnej weryfikacji oryginalnego artefaktu, zgodności aktualnych10plików polityki, pełnego sukcesu i kontroli wejść przed/po, wszystkich publicznych kontroli ownerów i wynikowego main. Starszy PASS nie zastępuje tych dowodów.

Ten pakiet nie jest release GO dla nieznanego przyszłego SHA. Dokładne wydanie i pięć zasobów Development wymagają konkretnej decyzji po przyjęciu źródła i świeżym pełnym Last Known Good. Wykonanie produktu pozostaje ograniczone istniejącym planem i zgodami. Dokument nie tworzy grantów, sekretów, kosztu ani zasobów i nie uruchamia Staging,Production lub anulowanego onboardingu.

Zadanie kończą dopiero odbiór15/4, podpisany DELIVERED i odczyt wiadomości w uzgodnionej skrzynce, brak duplikatu, zatrzymanie wysyłek po opt-out/cofnięciu uprawnień oraz opublikowany i odczytany PHR właściwych PMOS.

Podstawa decyzji:[Canon v3§10.1](../v3.0-profitia-agent-execution-canon.md#101-mandat-i-ponowne-używanie-zgód). [Zadanie i wcześniejsze zgody](https://github.com/profitia/SG-dev/issues/1161). [Zatwierdzony pakiet R4](https://github.com/profitia/SG-dev/blob/401539d6e991d19256b90bfcec531ef26aa9470b/Canon/evidence/2026-11-18-calendar-pk-r4-owner-decision.md).
