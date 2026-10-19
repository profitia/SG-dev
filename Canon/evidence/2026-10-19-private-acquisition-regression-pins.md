# E1 — dwa porównania bieżącej wersji w regresjach wspólnych

TARGET_ENVIRONMENT=development, profil ARCHITECTURE. Osobne zadanie ARCHITECTURE-E1-PRIVATE-ACQUISITION-REGRESSION-PINS-20261019; rejestracja architecture_pmos `cmvfsq9yx0000jyjetl8bge4f`.

Przyrost producenta private-acquisition zmienia aktualnie emitowaną implementację z candidate.14 na candidate.15. Dwa istniejące testy nadal porównywały bieżący host i bieżący audyt do candidate.14. Zmieniono wyłącznie te porównania w service-read.test.mjs i request-continuation-postgres.test.mjs. Niezmienne rekordy, digesty historycznych SQL i oczekiwane zachowanie pozostały zachowane.

Pełne ponowienie testów platform-contracts i architecture-lab na izolowanym PostgreSQL16:1038/1038, bez pominięć i błędów; build poprawny. Kontrole aktualnego dostępu, service/user, transakcji, audytu, odmów i rollbacku pozostały aktywne. Wcześniejsza bramka wersji lock odbiorcy SG2 nadal oczekuje odrębnej integracji; nie została osłabiona. Ta korekta nie zmienia kodu produktu, grantów, instalacji baz ani wdrożeń i nie jest odbiorem całego E1.
