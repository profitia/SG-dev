# Etap I — ograniczona poprawka weryfikacji SDK

Status: PROPOZYCJA DO ZATWIERDZENIA. Ten PR zmienia wyłącznie dokument; nie edytuje i nie aktywuje kontrolera CI.

PR #988 został zatwierdzony i po komplecie kontroli przyjęty do main jako fa81114d35281693604833f1b7639b3c3b829ce6. Próba przyjęcia właściwego pakietu ujawniła nieobsłużoną warstwę potwierdzenia nowej wersji SDK oraz starsze kontrole historii i routingu. Pakiet aplikacyjny nadal nie jest przyjęty ani wdrożony.

## Decyzja potrzebna do dalszej pracy

Zgoda na przygotowanie, przetestowanie i przyjęcie niezbędnej poprawki zaufanego kontrolera CI dla poniższego zamkniętego pakietu 48 plików. Kontroler musi rozpoznać już zweryfikowaną nową sumę kontrolną domyślnego Root16 i zachować wszystkie wcześniejsze potwierdzenia. Wykonanie oraz połączenie źródeł pozostają warunkowe: wszystkie wymagane kontrole muszą przejść dla konkretnego końcowego SHA.

Automatyczna kontrola zgód odrzuciła wcześniejszą próbę edycji kontrolera, testów, runbooka i dowodu. Uzasadnienie: poprzednia zgoda dotyczyła dokładnie PR #988, a nowe pliki i obsługa pochodzenia SDK wymagają odrębnej decyzji właściciela. Odrzucone polecenie nie zostało wykonane. Kontroler pozostał niezmieniony; nie zastosowano obejścia.

## Co pozostaje zamrożone

- Wszystkie 155 produkcyjnych plików SDK i wszystkie 48 fingerprintów są identyczne z pierwotnie zatwierdzonym producentem c373be45a5bf52c93034f5a1b6878e531c81b2ca.
- Wersja platformy 1.34.0, domyślna implementacja Root16 oraz opcjonalna Root21 pozostają bez zmian.
- Żadne historyczne pole potwierdzenia nie jest przepisywane. Nowy widok historii jest weryfikowany przed przejściem do wcześniejszego.
- Nie zmieniają się uprawnienia, role, prywatne pakiety i ich piny, zakres credentiali, środowisko, limity ani zasady Source/E1.
- Nie ma instalacji SQL, wysyłki maili, wywołań płatnych dostawców ani wdrożenia aplikacji.

## Konkretne zmiany kontrolera do przygotowania po akceptacji

1. Zachować niezmieniony pierwotny 41-plikowy zapis przeglądu jako historyczny; dodać dokładny zapis poniższych 48 ścieżek, blobów, statusów, trybów i rzeczywistych właścicieli.
2. Rozpoznać ramkę sdkSourceContinuations wyłącznie dla organisation-bootstrap-v1 i właściwych zadań SG2/SRM. Wymagać jednej ramki, dokładnych kluczy, Development i identycznych poprzedników z f8f6340ab1ac862a584352f86988dde199172b37.
3. Zweryfikować przypięty plik packages/platform-contracts/test/organisation-sdk-compatibility.json: SHA256 a0ebdd9af086aba27d025aa821b2c22d43551e997dfa0642c0c59aac11cc4ac5, wszystkie produkcyjne oraz pomocnicze hashe i potwierdzenia obu odbiorców. Odczytywać wyłącznie zwykłe pliki wewnątrz repozytorium i nie importować kodu kandydata.
4. Zachować kontrakt profitia.operation-context / 1.0.0 / 1.0.0-candidate.16, lecz dla tej zweryfikowanej warstwy wybrać aktualny operationSourceDigest 58a5d94ba89b8bcc781affa3a9964d5f1d9f3ee11a152cddc7bc9ac098de2acf. Wartość musi być niezależnie zgodna z hashem fizycznych źródeł obliczanym przez zaufany kontroler.
5. Weryfikować całość przed odczytaniem tokena pakietów. Zachować read:packages, main-only Environment, ignore-scripts i usunięcie credentiali przed wykonaniem kandydata.
6. Dodać przypadki odmowy dla zmiany źródeł, rekordu SDK, ramki, poprzednika, właściciela, trybu, dodatkowej ścieżki, braku odbiorcy i próby deklaracji aktywacji. Zachować istniejące testy i dowody historii.
7. Dopiero po komplecie wymaganych testów przyjąć poprawkę CI, następnie zweryfikować i wspólnie przyjąć źródła z zachowaniem oddzielnych wkładów właścicieli. Zmieniony zakres wymaga ponownego przeglądu; nie otwierać ogólnych wzorców ścieżek.

## Już wykonane sprawdzenia

- SDK i Newsfeed: 11/11.
- Wcześniej nieudane przypadki historii SRM: 23/23.
- Routing SourceHub: 7/7, w tym odmowa zmienionych bajtów, innego SHA i zatwierdzonego w Git trybu wykonywalnego.
- Produkcyjne źródła, fingerprinty SDK, opcjonalne pakiety i zachowane strażniki porównano z poprzednim zapisem: identyczne.
- Nowy kontroler nie został jeszcze zmieniony ani przetestowany — właśnie ta edycja jest zablokowana do decyzji właściciela.

## Dokładny lokalny pakiet

Niepublikowana lokalna kompozycja: 84d1122f5f40294821ee40775e7774a967968f4f. Tree: bde4dc12274077ad8e088cdefe715e728c914759. Base: fa81114d35281693604833f1b7639b3c3b829ce6.

Wkłady do przeglądu: Architecture PR #989, SG2 PR #987, SRM PR #986. Oryginalny transport PR #983 pozostaje na poprzednim, nieprzyjętym kandydacie.

```json
{
  "prNumber": 983,
  "branch": "architecture/registration-bootstrap-stage-i-20261111",
  "sourceSha": "84d1122f5f40294821ee40775e7774a967968f4f",
  "baseSha": "fa81114d35281693604833f1b7639b3c3b829ce6",
  "treeSha": "bde4dc12274077ad8e088cdefe715e728c914759",
  "inputs": [
    {
      "projectKey": "ARCHITECTURE",
      "taskId": "ARCH-REGISTRATION-ORGANISATION-STAGE-I-20261110",
      "prNumber": 989,
      "sourceSha": "9ae4a3e7d309a9eb55fa9ff237494ff2dc02506f"
    },
    {
      "projectKey": "SG2",
      "taskId": "SG2-REGISTRATION-ORGANISATION-HANDOFF-STAGE-I-20261110",
      "prNumber": 987,
      "sourceSha": "dfaa4bb2053ae9b4856edabb9c40478d0b5b66c9"
    },
    {
      "projectKey": "SRM",
      "taskId": "SRM-REGISTRATION-BOOTSTRAP-SDK-ADOPTION-20261111",
      "prNumber": 986,
      "sourceSha": "c9b06b32dd64f5b75d67b81ea4a85a19d541c472"
    }
  ],
  "entries": {
    "apps/architecture-lab/test/sdk-compatibility.test.mjs": {
      "sha": "184536c22980b5c40df41ce65362caa4130de63c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-002"
    },
    "apps/identity-runtime/src/organisation-onboarding.ts": {
      "sha": "98169978b157e0676f513f1b7ce11bac5c0a84d3",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/identity-runtime/test/organisation-onboarding.test.mjs": {
      "sha": "f04a4b27f7b39d7031839afb877fe6f5e836ff83",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "IDENTITY-BASE-001"
    },
    "apps/newsfeed-runtime/test/runtime.test.mjs": {
      "sha": "36209e9d8c055fbbf695ba546634a25b1e161259",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "NEWSFEED-BASE-001"
    },
    "apps/platform-source-hub/scripts/ci-routing.mjs": {
      "sha": "54142248b9b8096ed3d3b22e582478d019c505a6",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/platform-source-hub/test/ci-routing.test.mjs": {
      "sha": "f7b9d7bebae5d87c7aeb8e669077f6c7547d90f4",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "SOURCE-HUB-BASE-001"
    },
    "apps/sg-runtime/operation-integration.json": {
      "sha": "bd3b3d6169ef575c2a79ae9c80ee529014f41632",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-m2-integrity.mjs": {
      "sha": "55d2d9f8cc17adb3dcb7c5a2dfb0495b2b4c8de0",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": {
      "sha": "5f2c3194cadc617806f2a097e75cbdaebdef21a5",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": {
      "sha": "6836893a46e189aade7a422b4eca912dc9cbc9b1",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/operation-context.test.mjs": {
      "sha": "f77c83fa347330a710d53079fe8f3f12a0ba8d6c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/private-host.integration.test.mjs": {
      "sha": "e2c3e0ae81a713425b104139f036783e81f5aa1e",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": {
      "sha": "6e53641ad436dbd95568a49c26f7176616c8c686",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/xray-platform-compatibility.test.mjs": {
      "sha": "e2a7d72bc910352bab449ff4cf2e651e015af96b",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/srm/operation-integration.json": {
      "sha": "7d399125fbb50f8b4f0b00db2662c05b1096995f",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs": {
      "sha": "ce2340a7ab9c700795715281aa9ee922d8daedfa",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/native-execution-adoption.test.mjs": {
      "sha": "2f79f558f44efa3b94cbbec919bc774044b8a73b",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/operation-context.test.mjs": {
      "sha": "b152578e6931f9fa1582b0ced87d93606143130b",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/private-host.integration.test.mjs": {
      "sha": "a9544af37bb7b32b5a36105d40beb4769f1da489",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/request-quota-adoption.test.mjs": {
      "sha": "da960d8679088a1a108f23f445a997bc5b5ea788",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs": {
      "sha": "0f951336afbdd7820344ef82325f81aa0ac0a9b2",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": {
      "sha": "731a3a0d130ea41c3af85509130a0df9911c0df2",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/xray-performance-adoption.test.mjs": {
      "sha": "071102735bd9d3322c5d096c05d1513c3772e5d6",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/src/server/peer-read-boundary.test.ts": {
      "sha": "84a815444776c192eec80211190ff0dea189d26c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/src/server/root-atomic-claim-adoption.test.ts": {
      "sha": "d272026e1d3554700eeb87a3096343f0cc34dd23",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/src/server/supplier-location-geocoding-runtime.test.ts": {
      "sha": "0cb4a302f931fdbdb93cb3cb34c1e9dcf9d0fca7",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs": {
      "sha": "f412f1607a4fca31cb1bbb583d45e7dc0828854c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/migrations/profile/007-organisation-onboarding.sql": {
      "sha": "a0239d930b8da5333e5589a1734bacb54d67191c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/migrations/profile/008-organisation-create.sql": {
      "sha": "5571f58c2ee30e3a0f1a33204ba8af4c53c29660",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/package.json": {
      "sha": "c2b5ab6d8a117c351fa0e03b3878eeec83f5c9f7",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": {
      "sha": "cd02bb919957e9da7cebb4c40fbe9a3ff4940fbe",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/operation-context.d.mts": {
      "sha": "b00220f767db22897bb3ec65233bb39fba715e4e",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/operation-context.mjs": {
      "sha": "d018c17a251abbf698c87a29aded91f93a4e493c",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-bootstrap.d.mts": {
      "sha": "ffcacec4080ca608ab00e3aff0b7371f23f08a55",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-bootstrap.mjs": {
      "sha": "008ef066c74bd72a2a546f15f4cc1694db9ef297",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-invitations.d.mts": {
      "sha": "674a1e3d7841bad6194a176ecccd70622bae012b",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-invitations.mjs": {
      "sha": "280935c68a5d1c8194669f8894b87324c2ed6843",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-profile.d.mts": {
      "sha": "a8e933f8f4946ad9459baab93110976be88e97ef",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/src/organisation-profile.mjs": {
      "sha": "be2730964c8af8b32f8c8f2baf45aa26fe807949",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-bootstrap-postgres.test.mjs": {
      "sha": "28e82cc2af6d32f6a7e396c48ad081323680b140",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-bootstrap.test.mjs": {
      "sha": "ea30c87f19cfb0bc064cd922c23a0b0dde354c99",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-invitations.test.mjs": {
      "sha": "64fcb4270f376573c132040eb8fd66642240ecdc",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-onboarding-postgres.test.mjs": {
      "sha": "203ee38cf32c28327eecd1093100bef54db3a84d",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-profile.test.mjs": {
      "sha": "a6ed612325ad049dded4a4fbfdc00b254bc147e1",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.json": {
      "sha": "5ac1ea073a88c4b734ae644fd4c61cb10d6e89dd",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.mjs": {
      "sha": "4b2487e09a4f2747613a30ae8d4fe2f2a97f67e0",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs": {
      "sha": "5368aff3e2355bb509e2e99cc26e2601e735187b",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/private-operation-host.test.mjs": {
      "sha": "b96001f516411487bf6e1ca07aa21cb0a007cc5d",
      "status": "modified",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    }
  }
}
```

PMOS: ARCH-REGISTRATION-SDK-CI-RECONCILIATION-20261111. Główne zadania Etapu I oraz ARCH-REGISTRATION-SDK-ADMISSION-20261111 pozostają aktywne. Ukończenie przygotowania tego dokumentu nie oznacza ukończenia Etapu I.
