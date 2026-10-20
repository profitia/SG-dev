# SG2 — rzeczywiste wywołania Source Findera

Zadanie SG2-E1-FINDER-SOURCE-TRANSPORT-20261020. Development. Status: LOCAL_NATIVE_SOURCE_VERIFIED_NOT_ACTIVATED.

Oryginalne klienty Macrobond i OpenAI korzystają z tego samego transportu platform1.23. Wymiana poświadczeń, zapytania Macrobond oraz Responses mają osobne źródła, zamknięte adresy i metody, aktualne polityki, własne rezerwacje i chroniony audyt. Nie wprowadzono drugiego writera, globalnej podmiany fetch, serwisu ani schedulera. Połączenie do dostawcy nie znajduje się wewnątrz prywatnej transakcji SQL. Wynik Source nie jest uprawnieniem człowieka do prywatnego wyniku.

Macrobond akceptuje tylko poświadczenia serwera i wartości zwrócone przez własną, uprzednio dopuszczoną wymianę. Równoległe żądania metadanych współdzielą jedną wymianę wyłącznie wewnątrz tej samej operacji. Oryginalne odświeżenie po zakończonej odpowiedzi401 zachowano. Port Findera nie przyznaje dostępu do pobierania historii szeregu ani dowolnego endpointu. W nowym scope SDK AI ma stały origin/model, wyłączone ponowienia, wyłączony zapis po stronie Responses oraz brak domyślnego wyboru organizacji/projektu dostawcy. Brak opcjonalnego poświadczenia nie wyłącza kompozycji korzystającej wyłącznie z przygotowanych metadanych; wymagające go wywołanie jest odmawiane.

Logiczne klucze wywołań wynikają z serwerowego klucza operacji i kolejności danego źródła. Metadane kontrolne zawierają HMAC zamiast prywatnej treści. Odtworzenie tej samej operacji nie uruchamia ponownie ani zakończonego wywołania bez zachowanego wyniku, ani niepewnego zakupu. Niepewność pozostaje widoczna również wtedy, gdy oryginalny klient przechwyci swój błąd. API nie podąża za przekierowaniem do innego hosta.

Dowody lokalne:

- 11/11 testów odmów podmiany adresu, modelu, poświadczeń, nagłówków, metody, obiektu żądania i dodatkowych hooków; odmowy przed SQL i siecią.
- 9/9 testów rzeczywistego PostgreSQL i HTTP loopback: oddzielna wymiana/form, zapytanie API, oryginalny klient i cache Macrobond, oryginalny SDK Responses, brak prywatnej treści i poświadczeń w rekordach, powtórzenie po odtworzeniu, niepewny wynik, brak audytu, rzeczywiste wyczerpanie małego budżetu dostawcy, niezależne wyczerpanie Source, brak ukrytych ponowień SDK oraz cofnięcie prawa podczas HTTP. Bez pominięć i bez kontaktu z płatnymi dostawcami.
- 12/12 regresji scope i oryginalnej wymiany401, w tym jedna współdzielona wymiana przy trzynastu równoległych zapytaniach metadanych. Osobny typecheck nowych portów i testów przeszedł.

Testy zachowują niezmienność przyjętej polityki natywnej: wyczerpanie budżetu potwierdzono rzeczywistymi dopuszczonymi wywołaniami lokalnymi. Użyto wyłącznie publicznego SDK OpenAI6.49.0 z dokładnego lockfile odbiorcy, bez skryptów instalacyjnych i poświadczeń pakietów. Kontrolowane CI całej aplikacji musi ponownie potwierdzić dokładny nowy kandydat.

Poprzedni, dokładny kandydat prywatnej granicy 8f8a6fb45591eeb688452defc291ce5e9323b77f przeszedł [CI39380434094](https://github.com/profitia/SG-dev/actions/runs/39380434094):645/645 testów, bez pominięć, typecheck i build. Ten wynik nie obejmuje nowych portów Source. Aktualny przyrost nie instaluje SQL, ról, polityk ani sekretów i nie aktywuje HTTP. Pozostaje kompozycja wszystkich sześciu metod i klienta, aktualne konfiguracje i ograniczone role w chmurze, kontrolowane wydanie oraz rzeczywisty odbiór Development. E1 nadal w toku.
