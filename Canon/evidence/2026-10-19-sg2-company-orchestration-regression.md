# SpendGuru — zgodność z przebiegiem raportu SRM, 19.10.2026

Status: SOURCE_VALIDATION_CANDIDATE / PROGRAMME_IN_PROGRESS. Zadanie `SG2-E1-COMPANY-ORCHESTRATION-REGRESSION-20261019`, profil SG2, workspace SG-dev, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority: profitia/SG-dev/main. Własne PMOS, wymagane MEMOROS i PHR; rejestracja nie jest closeout.

Kandydat przyjmuje dokładny źródłowy commit SRM `a448db222e1132a3d0f170e4e112e3d866835da7`, PR506, z odrębnego zadania `SRM-E1-COMPANY-ORCHESTRATION-20261019`. Jedyną własną zmianą SG2 jest ten dokument. Runtime SpendGuru, Dashboard oraz pakiety wspólne są identyczne bajtowo z punktem odniesienia `98aa36cdd81aee9f58cd7fff363b8810894fe95e`.

SRM zachowuje jeden dotychczasowy przebieg biznesowy raportu spółki i umożliwia kompletne, jawne podłączenie jego funkcji serwerowych. Nie skopiowano przebiegu, nie zmieniono `persistSection` ani KYS. Lokalnie potwierdzono 511 testów produktu (w tym12 nowych testów przebiegu),132 natywne i311 promocji, bez pominięć, oraz typy/build SRM. Samo to nie dowodzi zgodności SpendGuru.

Odbiór tego zadania wymaga rzeczywistego kontrolowanego CI dokładnego połączonego kandydata przez istniejący kontroler z zaufanego main. Obejmuje regresję Runtime, rzeczywiste API/PostgreSQL, typy i build, osobny Dashboard z produkcyjną odmową HTTP oraz regresję SRM. Po merge wymagane są dokładne dowody i artefakty main, a następnie kanoniczny closeout we właściwej bazie. Identyfikatory wykonań i wynik niezależnej walidacji są zapisywane w closeout dopiero po faktycznym zakończeniu. Ten dokument nie deklaruje ich z wyprzedzeniem.

Nie zmieniono polityki kontrolera, dostępu do pakietów ani sekretów. Nie odczytywano ponownie tokenu Render i nie instalowano lokalnie prywatnych pakietów przez pożyczone poświadczenie. Nie podłączono pełnej natywnej orkiestracji, nie migrowano danych i nie wykonano deploymentu. Aktualna sesja użytkownika, role/directory, odzyskiwanie, pozostałe wejścia i późniejsze wydanie Development pozostają odrębnymi warunkami pełnego E1. Brak odbioru Staging, Production i E2–E4.
