# E1: jawna tożsamość odczytu między gospodarzami

Data: 20.10.2026. Profil: ARCHITECTURE. Zadanie: `ARCHITECTURE-E1-EXPLICIT-PEER-READ-IDENTITY-20261020`. Środowisko: Development. Zakres producenta: kod kontraktu i testy, bez aktywacji konfiguracji aplikacji ani wdrożenia.

## Przyczyna i granica

Wybrany moduł Supplier Intelligence ma już osobny, stały port odczytu podsumowania korporacyjnego SRM. SpendGuru przekazuje do niego sesję rzeczywistego użytkownika. Dotychczasowy adapter poprawnie wymagał równości zweryfikowanego `azp` z origin odbiorcy. Sama obecność obu domen na liście `authorizedParties` nie dopuszczała więc tego przepływu.

Opcjonalne `IdentityApplication.bearerPeerReads` określa dokładną trójkę: origin źródła sesji, origin odbiorcy i ścieżkę. Oba origin muszą już należeć do listy zatwierdzonych origin. Konfiguracja jest kopiowana i zamrażana; liczba reguł jest ograniczona do 16. Reguły nie przyjmują wildcardów, prefiksów, dodatkowych pól, parametrów ani niejednoznacznych ścieżek.

Wyjątek od równości origin obejmuje wyłącznie `GET` zgodny z daną trójką, z ograniczonym nagłówkiem Bearer, bez Cookie i Origin. Żądanie tożsamości otrzymuje kopię nagłówków przed pierwszym oczekiwaniem na dostawcę. Przy braku reguły zachowanie pozostaje dotychczasowe. Metody zapisu, inne endpointy i odwrotny kierunek nie są dopuszczane przez tę regułę.

Oficjalny SDK nadal weryfikuje sesję człowieka. Pozostają kontrole issuer, subject, session ID, `azp`, ważności, bieżącego stanu sesji i konta oraz aktualnego powiązania z wewnętrznym identyfikatorem użytkownika. Nie powstaje własny walidator JWT, organizacja z claimu, rola dostawcy ani nowy grant. Odbiorca osobno sprawdza członkostwo, produkt, operację i zasób w swoim chronionym przepływie. Parametr organizacji w URL pozostaje niezaufanym wyborem.

## Identyfikacja źródła i odbiór

Poprzedni odcisk adaptera tożsamości: `9e1ced6498e8a127dd17fee81c5f4485a032c133bf85c08a72488e7909a0a299`. Nowy odcisk: `b7f3e09e6c62bbaf20c42752f514022c91b0dc0fef9db387f41f613a124ce0b4`. Zmiana jest opcjonalnym rozszerzeniem interfejsu 1.0.0; odcisk źródła rozróżnia kandydatów. Odciski kontraktu operacji, hosta i baz SQL pozostają niezależne i nie są przepisywane przez tę zmianę.

Każdy odbiorca wymaga osobnego przyjęcia nowego odcisku w swoim zadaniu i PMOS. Historia poprzednich przyjęć pozostaje zachowana. Test odcisku producenta wskazuje nowy kandydat jawnie. Ten dokument nie potwierdza integracji, wdrożenia ani odbioru biznesowego.

## Dowody i ograniczenia

113 testów adaptera tożsamości i nowej polityki przeszło lokalnie, w tym 65 scenariuszy nowej granicy. Obejmują dodatni odczyt, brak domyślnego rozszerzenia, niewłaściwe metody i endpointy, Cookie/Origin, błędne konfiguracje, zmianę konfiguracji i żądania podczas oczekiwania, cofniętą sesję, zablokowane konto, niewłaściwe powiązanie oraz awarię źródeł prawdy. Pełny lokalny zestaw pakietu i laboratorium, z rzeczywistymi odizolowanymi rolami PostgreSQL oraz oficjalnym SDK, zakończył się wynikiem 1171/1171. Kontrola składni pakietu przeszła. Osobna weryfikacja CI oraz przyjęcia aplikacji pozostają wymagane. Jednorazowe lokalne dane testowe usunięto po zatrzymaniu bazy, zachowując logi.

Odpowiedzi oficjalnego SDK w tych testach są deterministycznymi projekcjami testowymi. Nie są dowodem rzeczywistego logowania ani poprawności wdrożonego przepływu między domenami. Nie wykonano publikacji pakietu do rejestru, zmiany danych, sekretów, ról infrastruktury, Staging ani Production.
