# Assistant Continuous Quality — etap 1 i rejestracja źródeł

Data: 2026-11-12, Europe/Warsaw. Profil: ARCHITECTURE / Development. Task: `ARCH-CIC-QUALITY-STAGE1-G1-20261112`. Authority przed zmianą: `d5bead649c3de7430c63e9fc1b64fc0b452e7a2a`.

## Podstawa właścicielska

Właściciel zaakceptował projekt v1 w DEC-03 oraz ustalił osobno zlecane etapy w DEC-05. Następnie wydał jawne zlecenie:

> Rozpocznij realizację wyłącznie etapu 1 w trybie Full Autopilot, zgodnie z Kartą Projektu w rewizji 8. Po zakończeniu przedstaw wynik i dowody do mojej weryfikacji. Nie rozpoczynaj etapu 2 bez mojego osobnego zlecenia.

Zlecenie odwołuje się do [PDR rewizji 8](https://github.com/profitia/SG-dev/blob/92dba2a44c33d90e767a651d3519542a654d548f/Canon/proposals/bsdc/ARCHITECTURE/cic-assistant-continuous-quality.md), blob `c6d24130cc0599b50b05d9bfc587bdf550d78cf3`, oraz Universal Project Execution v1.2 i Full Autopilot v2.0 na main. Host nie udostępnił stabilnego identyfikatora tej rozmowy; nie jest on zastępowany identyfikatorem wymyślonym.

E1-T01 jawnie obejmuje dopuszczenie źródeł wskazanych w §4 i §4.7 PDR przed ich implementacją. W ramach tego zlecenia materializuje się G1 dla dwóch powierzchni Architecture Platform:

| ID | Powierzchnia | Granica |
| --- | --- | --- |
| AQC-BASE-001 | `packages/assistant-quality-control/**` | Kontroler, kontrakty QA, ograniczony stan i koszt, testy; brak własności rozmów lub zastępczego E1 |
| AQC-BASE-002 | `.github/workflows/assistant-quality-repair.yml` | Źródło kontroli i izolowanego wykonania; rzeczywiste sekrety, SERVICE i promocja dopiero po własnym dopuszczeniu |

Rejestracja dopuszcza wyłącznie ARCHITECTURE. SG2 zachowuje runtime, historię i produktowe dane QA; CIC własną politykę w prywatnym repozytorium. Ich zmiany wymagają osobnych rejestracji właściwych profili. Wcześniejsze wiersze routingu, metadane epoki i zasoby pozostają bez zmian. Źródłowe dopuszczenie staje się skuteczne po kontrolowanym przyjęciu na main; do tego momentu nie tworzy się pakietu lub workflow.

## Granice wykonania

Zlecono etap 1, nie etap 2. Rejestracja źródeł nie ustanawia dostępu SERVICE do prywatnej historii, nie tworzy grantów E1 ani uprawnień administracyjnych. Nowe zasoby owner-only tworzy właściciel. Dokładna instalacja w produktowym magazynie SG2 i koszty pozamodelowe wymagają właściwego dopuszczenia; nie używa się bazy PMOS lub laboratoryjnej do transkryptów.

Przyjęto wybór istniejącego klucza OpenAI bez ujawniania lub kopiowania jego wartości. Żadne wywołanie modelu nie zostało wykonane. Wspólne 50 USD, do 5 USD na incydent, i 14 dni liczone od pierwszego płatnego odbioru pozostają bez zmian. Nie uruchamia się wydatków przed przygotowaniem egzekwowalnej kontroli kosztu i całości C1–C3.

Etap 1 pozostaje W_TOKU i wymaga rzeczywistej pętli naprawy, niezależnej weryfikacji, Development i recovery. Samo G1, kod, CI lub publikacja planu nie są jego odbiorem.
