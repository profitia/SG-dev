# Platform Knowledge R6 — aneks wykonania pinu Identity

Status: KONKRETNA PROPOZYCJA DO ODRĘBNEGO GO; niczego nie aktywuje. Tylko Development.

## Problem i minimalna korekta

Statyczny odczyt zatwierdzonego `native-identity-release-pin-r6.py` wykazał pozostawione w wierszu14 sprawdzenie adresu dokumentu R5. Zatwierdzona koperta R6 zwraca prawidłowo adres zamrożonego pakietu R6 z02044f7d. Te dwa warunki są sprzeczne: stary wykonawca odmówiłby przed wywołaniem Render. Nie wykonano tej próby, nie utworzono intencji pinu ani żadnego zapisu konfiguracji.

[Poprawiony dodatkowy wykonawca](../proposals/platform-knowledge-stage2-r6-pin-annex/native-identity-release-pin-r6-annex.py) zmienia dokładnie jedną linię: zamiast wzorca dokumentu R5 wymaga równości z dokładnym, faktycznie zatwierdzonym adresem:

`https://github.com/profitia/SG-dev/blob/02044f7d7315f960c91a535a36ea07b7e81861ac/Canon/evidence/2026-11-18-platform-knowledge-stage2-acg-composition-release-r6.md`.

Oryginalne publiczne szablony, manifest R6, guard i renderer pozostają bajtowo zachowane. Dodatkowy wykonawca jest osobnym plikiem z własnym zatwierdzeniem; oryginalna koperta i wszystkie jej warunki nadal muszą przejść. Nie podmieniamy adresu GO R6 na historyczne R5 i nie tworzymy fikcyjnej zgody człowieka dla później wybranego SHA.

## Dokładne bajty i sprawdzenia

- Oryginalny szablon SHA256: `5cdd3b68e97c310f6e038d2cb3cd27d7d19eb2a76a3c12a8c8626df56d04e024`.
- Poprawiony dodatkowy szablon SHA256: `345e381f85f3ecddaf6f35f0ade155b90689ba9af4ee44689e426b2c9f80b0af`.
- Jedna zmieniona linia, wszystkie pozostałe bajty identyczne, poprawna składnia Python.
- [Dowód sprawdzeń](../proposals/platform-knowledge-stage2-r6-pin-annex/pin-reference-predicate-evidence.json):7/7 PASS. Dokładne R6 jest przyjmowane; R5, inne SHA przeglądu, obce repozytorium, HTTP, query suffix i inny dokument są odrzucane. To test samego warunku, nie runtime ani zgoda. Zero odczytów poświadczeń i wywołań dostawcy.

## Niezmieniona granica wykonania

[Zatwierdzone R6](https://github.com/profitia/SG-dev/blob/02044f7d7315f960c91a535a36ea07b7e81861ac/Canon/evidence/2026-11-18-platform-knowledge-stage2-acg-composition-release-r6.md) nadal obowiązuje. Przyjęty source to `cfa76c865083b43d14408f4bbfa27b2287c03972`, wynikowy main `2f77dcd19a5ba0bb4dd4c30ed375f4c1d3213586`. Source13/13 CI PASS, oryginalny controlled44365374661/artifact14458522453 niezależnie PASS. [Wynikowy main44370565964](https://github.com/profitia/SG-dev/actions/runs/44370565964) w chwili sporządzenia aneksu jest w toku; wymagane pełne CI i jego oryginalny dowód muszą przejść przed aktywacją.

145 własnych źródeł,478 raw inputs,33 historyczne receipty i dwa zatwierdzone pliki CI pozostają identyczne. Nie zmienia się żaden plik aplikacji, migracjaSQL001/015/016,11 ograniczonych grantów, dwa bindingi, termin lub budżet10USD łącznie/1USD na dokument. Nie pojawia się nowy zasób ani system tożsamości.

Po faktycznym GO tego aneksu oraz istniejącym gate R6 dodatkowy wykonawca zostanie wyrenderowany wyłącznie dotychczasowym markerem `__PK_DEPLOYED_SOURCE_SHA__` na rzeczywiście wybrany, sprawdzony SHA. Przed uruchomieniem jego bajty będą porównane z powyższym publicznym szablonem po tym jedynym podstawieniu. Metadane wykonawcze wiążą wybór wydania z rzeczywistym R6; oryginalny zapis odpowiedzi człowieka i wcześniejsze aktywne metadane są zachowane bajtowo w osobnych plikach, a wyliczone hashe mają jawną proweniencję.

Operacja nadal dotyczy wyłącznie publicznego `IDENTITY_RUNTIME_EXPECTED_SOURCE_SHA` w istniejącej usłudze `srv-dbcse6jrjlhs73eib3sg`, workspace `tea-d7lps8rbc2fs73cn80dg`. Zachowane są istniejąca natywna sesja operatora, kontrola właściciela/usługi/main/buildCommand, dokładny obecny pin LKGf78f5867, brak aktywnego obcego deploymentu, zapis bez deploymentu i niezależny odczyt tego samego klucza. Sześć pozostałych wcześniej dopuszczonych kluczy i trzy usługi pozostają w pierwotnym zakresie.

Recovery pozostaje takie samo: przywrócenie publicznego pinu do dokładnego LKGf78f5867064c96f4497e13bcd53c97af2da2e07a przed jego rebuildem, tylko własne wdrożenie/konfiguracja, zachowanie schematów, audytu, historii i kosztów; wynik UNKNOWN wymaga odczytu przed ponowieniem. Nie resetujemy wspólnego limitu24 transakcji centralnych.

## Wymagana decyzja

GO tego aneksu upoważnia do użycia wyłącznie powyższego dodatkowego wykonawcy, jego opisanego podstawienia SHA i dalszej realizacji pozostałego zatwierdzonego R6 aż do rzeczywistego E2E. Odrębna decyzja jest wymagana przez CORE§10.1 i dokładną granicę R6: zmiana warunku w publicznym wykonawcy wykracza poza samo podstawienie dotychczasowych markerów. Nie jest to nowe GO źródeł aplikacji, zmiana CI ani odstąpienie od kontroli.
