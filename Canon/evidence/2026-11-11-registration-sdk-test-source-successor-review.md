# Etap I — precyzyjny następca weryfikacji źródeł testowych

Status: PROPOSAL / AWAITING_EXPLICIT_OWNER_APPROVAL. To jest wyłącznie dokument propozycji. Nie zmienia ani nie uruchamia walidatorów, nie publikuje zmienionego PR983 i nie oznacza zakończenia Etapu I.

## Decyzja do zatwierdzenia

Zatwierdzić dokładnie opisany następca rekordu 25fea141baf42c154f64a256d40808d548562c010e3f2fd3143657f24b15295c oraz cztery wersje plików wskazane poniżej w dotychczasowym zamkniętym zakresie 59 ścieżek. Pozwolić na opisane dodatkowe powiązanie w testowym helperze, jego testy regresji oraz odpowiadające mu, ograniczone dopuszczenie zaufanego kontrolera CI. Zachować poprzednie rekordy i manifesty. Wspólne przyjęcie źródeł pozostaje warunkowe: dopiero po wszystkich wymaganych testach dokładnego finalnego kandydata.

Zestaw nadal ma 59 ścieżek: Architecture28, SG2 17, SRM14. Względem zatwierdzenia PR1003 55 pozycji pozostaje identycznych; cztery mają dokładne nowe bloby. Dwie zmiany są już w opublikowanych wejściach właścicieli, dwie poniżej są wyłącznie zamrożoną propozycją tekstową. Nie rozszerzamy katalogu plików.

## Co jest już zakończone

Zgoda PR1003 została wykonana w PR1008, przyjętym jako c0137236147c9bd2695c9c47d263248c5f58fb35. Przeszły:249 testów governance, kontrolowany43022409161 z1499/1499 testami i typecheck/build, publiczny43022374956 attempt2 i wynikowy main43024255257. PMOS ARCH-REGISTRATION-SDK-CI-59-APPROVAL-20261111 ma niezależnie odczytany status completed, jeden ConversationArtifact i brak oczekującego zapisu. Kanoniczny PHR2c3794f0a8f5de32af4b257cb0c5f8084d1fa358 potwierdza CLOSEOUT_COMPLETE, save/context/publication SUCCEEDED, integrity/archive PASS i execution trail PRESENT.

[Wykonana polityka](https://github.com/profitia/SG-dev/pull/1008), [kanoniczny closeout](https://github.com/profitia/project-history-repository/blob/2c3794f0a8f5de32af4b257cb0c5f8084d1fa358/history/2026/11/11/2026-11-11-13-22-17Z__architecture-arch-registration-sdk-ci-59-approval-20261111/closeout-evidence.json).

## Ustalona przyczyna sześciu błędów

Pełny kontrolowany przebieg43025779989 dla PR983/71c8aeea0971ec137bcb88b9c46a73867f250687 zaliczył1368 z1374 przypadków pierwszej grupy SG2. Sześć błędów porównuje ten sam plik current-fresh-report/test/current-fresh-report.test.mjs: rzeczywisty SHA-256 e7e6ca84000cf68b4624ae3a8b5a33c992b9dd68cdc2163e7c19a66bcea42f5f ze starym b7ac968308a304f156e7985e8bbb6b35f60904e0fec8d198f7cf612ba234fe54. Selektor SG2 uwzględniał aktualne sourceDigests, pomijając już zweryfikowane compatibilityTestSourceDigests.

W istniejącym zadaniu SG2 powstała jedna linia dołączająca drugi, jawnie zweryfikowany słownik hashów. PR987/9df41b364fabe880043ffe83fb3247bb9cb8a62e zawiera tę poprawkę; aktualizacja pojedynczego hasha odbiorcy w rekordzie producenta jest w PR989/a4cf95745da680a0ef72d5f8ba980ab32551fc79. Nowy hash rekordu to25fea141baf42c154f64a256d40808d548562c010e3f2fd3143657f24b15295c. Niezmieniony helper prawidłowo odrzuca go, ponieważ jest przypięty do wcześniejszego020b9db676804688ce1758865084d2af02c42af169ede00c265432422e4d993e.

Automatyczna kontrola odrzuciła wykonanie rozszerzenia helpera o nowy hash, wymagając odrębnej, wyraźnej zgody właściciela na ten successor i zakres. Odrzucone działanie nie zostało wykonane ani zastąpione obejściem. Ta propozycja zawiera inertny tekst i wyliczone hashe; nie uruchamia zmodyfikowanego walidatora.

## Dokładny zakres źródeł

Wszystkie155 plików produkcyjnego SDK porównano ponownie z c373be45a5bf52c93034f5a1b6878e531c81b2ca; są identyczne. Pozostają48 fingerprintów i3 fingerprinty paczek opcjonalnych, Root candidate.16 / digest58a5d94ba89b8bcc781affa3a9964d5f1d9f3ee11a152cddc7bc9ac098de2acf, opcjonalny candidate.21 i previousSourceSha b2fccbb8b9132a63c2c39507a1ebc838cf6228e1. Oba wcześniejsze operation-integration.json, prawa, role, pakiety i flagi aktywacji zachowują swoje wartości.

| Ścieżka | Blob zatwierdzony w PR1003 | Dokładny blob następcy | Stan |
|---|---|---|---|
| apps/sg-runtime/tests/private-host.integration.test.mjs | 19cb9afe8792b44ebf2822bf61692827bac49404 | 5269cf475e341ee4a9e72d54ba9dcae4e3d13d45 | opublikowane wejście właściciela |
| packages/platform-contracts/test/organisation-sdk-compatibility.json | 33ffdc98f29e6157136b898e704d75fc629a77db | a6f28d6b1928aea0839448526df6d4e0afb908e4 | opublikowane wejście właściciela |
| packages/platform-contracts/test/organisation-sdk-compatibility.mjs | 6a791a82346ba08e0b7bc8dcacd8fb7737555df1 | f309cb4ba8e6db083c84efc40bd2f3e5c0b3a9c5 | proponowane bajty, jeszcze niewprowadzone |
| packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs | 7cc4c3e2b9eefc8bdd1c5ccee426fbb2c49b2c1c | 18aba285817c06615d54932fa079b8eb24d3c4d7 | proponowane bajty, jeszcze niewprowadzone |

Przygotowany, nieopublikowany parent do odtworzenia: b0eab24456b34a5691b83a05e0604d5080f83e1e. Nie zawiera on dwóch proponowanych poniżej zmian helpera/testów. Finalny commit powstanie dopiero po zgodzie; nie przypisujemy projekcji fikcyjnego source SHA. Przed chronionym CI każdy finalny blob i pełny zestaw muszą być dokładnie zgodne z poniższą projekcją. Zmiana opisowego SHA po dozwolonym złożeniu nie dopuszcza żadnego dodatkowego lub odmiennego bloba.

## Proponowane dwie zmiany helpera — tekst niewykonany

Zachowujemy pole sha256 z020 bez zmiany. Dodajemy tylko literalny25fea w zamrożonej liście następcy. Każdy z tych rekordów nadal musi przejść pełną weryfikację fizycznego producenta, obu odbiorców, plików testowych i niezmiennych poprzedników, zanim udostępniony zostanie widok historyczny.

Przed:
```js
sha256:'020b9db676804688ce1758865084d2af02c42af169ede00c265432422e4d993e'
```
Po:
```js
sha256:'020b9db676804688ce1758865084d2af02c42af169ede00c265432422e4d993e',successorSha256s:Object.freeze(['25fea141baf42c154f64a256d40808d548562c010e3f2fd3143657f24b15295c'])
```

Przed:
```js
assert.equal(hash(recordBytes),entry.sha256,'exact organisation SDK source acceptance')
```
Po:
```js
assert([entry.sha256,...(entry.successorSha256s??[])].includes(hash(recordBytes)),'exact organisation SDK source acceptance')
```


## Proponowane testy — tekst niewykonany

Poniższy fragment ma zostać dopisany do istniejącego pliku testów dopiero po zgodzie. Sprawdza zachowanie dokładnego wcześniejszego rekordu i odrzucanie podmienionych bajtów testowych oraz sfałszowanego rekordu; nie usuwa żadnej obecnej asercji.

```js

import {createHash} from 'node:crypto'
test('the pinned compatibility-test successor preserves the exact prior SDK record and physical receiver graph',()=>{
 const doc=current('Canon/evidence/2026-11-11-registration-sdk-ci-complete-review.md').toString(),marker=doc.indexOf('<!-- registration-sdk-fixture -->'),match=/\x60\x60\x60json\n([\s\S]*?)\x60\x60\x60/.exec(doc.slice(marker))
 assert(marker>=0&&match);const bytes=Buffer.from(match[1]),old=JSON.parse(bytes),digest=b=>createHash('sha256').update(b).digest('hex')
 assert.equal(digest(bytes),'020b9db676804688ce1758865084d2af02c42af169ede00c265432422e4d993e')
 const name='apps/sg-runtime/tests/private-host.integration.test.mjs',next="currentSdkRecord.sourceDigests?.['packages/platform-contracts/'+file]??currentSdkRecord.compatibilityTestSourceDigests?.['packages/platform-contracts/'+file]??digest",previous="currentSdkRecord.sourceDigests?.['packages/platform-contracts/'+file]??digest",source=current(name).toString()
 // Reverse only the declared one-line edit, requiring the frozen predecessor
 // SHA before exposing reconstructed bytes to the original verifier.
 assert.equal(source.split(next).length,2)
 const restored=Buffer.from(source.replace(next,previous));assert.equal(digest(restored),old.consumerSourceDigests.SG2[name])
 const previousView=p=>p===sourcePath?bytes:p===name?restored:current(p)
 for(const projectKey of ['SG2','SRM']){
  const result=sdkContinuationPredecessor(receipt(projectKey),previousView,historical,{projectKey})
  assert.deepEqual(result.record,old)
  assert.deepEqual(result.prior,JSON.parse(historical(old.previousSourceSha,pathFor(projectKey))))
 }
})
test('current compatibility-test bytes are verified and an unknown forged hash record never opens the predecessor',()=>{
 const record=acceptedSdkSource(),name='packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs',digest=b=>createHash('sha256').update(b).digest('hex')
 assert.equal(record.compatibilityTestSourceDigests[name],digest(current(name)))
 const changedBytes=Buffer.concat([current(name),Buffer.from('\nUNREVIEWED')]),changed=p=>p===name?changedBytes:current(p)
 assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),changed,historical),/current compatibility test/)
 const forged=structuredClone(record);forged.compatibilityTestSourceDigests[name]=digest(changedBytes)
 const forgedView=p=>p===sourcePath?Buffer.from(JSON.stringify(forged)+'\n'):changed(p)
 assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),forgedView,historical),/exact organisation SDK source acceptance/)
})
```

## Ograniczona poprawka zaufanego kontrolera po zgodzie

Zachować dosłownie manifesty41,48 i dotychczasowy59/6894754702e205691a42c4b32b678169d36d341cf00845d6e2eed54c19e1ec65 oraz rekord020. Dodać wyłącznie kolejny manifest59 z poniższą projekcją i digest25fea powiązany z tym samym rzeczywistym predecessorem b2fccbb8b9132a63c2c39507a1ebc838cf6228e1. Wybór między manifestami59 ma używać pełnej zgodności ścieżek/blobów/statusów, nie samej liczby plików. Zachować wcześniejsze41/48 record-piny i ich predecessory, wszystkie reguły Platform Knowledge oraz niezależne recurring119/123 z PR1006/1009.

Implementacja polityki ma pozostać w ograniczonych czterech plikach: scripts/governance/controlled-package-ci.mjs, scripts/governance/controlled-package-ci.test.mjs, Canon/runbooks/shared-development-contract-integration-v1.md i ten dokument (status/fixture po zgodzie). Testy kontrolera mają odrzucać zmieniony, brakujący/dodatkowy/zdublowany plik, inne bloby, tryby/symlinki, fałszywy rekord, zmianę Root, odbiorcy, repo/autora/gałęzi i bariery credentials.

Pozostają dokładne prywatne piny, main-only Environment, tylko read:packages, instalacja ignore-scripts, usunięcie credentials przed testami, bez importowania JavaScript kandydata w fazie proweniencji. Nie powstaje ogólne dopuszczenie katalogów, dowolnych rekordów, credentiali lub aplikacji.

## Wyniki i wymagane dalsze dowody

W Codespace odtworzono oryginalny plik testów i dokładnie6/6 tych samych niezaliczonych asercji, używając wyłącznie publicznych zależności z lockfile i lokalnego SDK. Pierwsza próba po złożeniu poprawki odbiorcy/rekordu została zatrzymana przed testami przez prawidłowy pin020 vs25fea. Zmieniony helper i proponowane testy nie były uruchamiane po odmowie automatycznej kontroli. Nie deklarujemy jeszcze ich sukcesu.

PR983/71c8aeea ma udane pełne SRM CI43025693359, w tym model/przeglądarkę logowania, oraz Identity43025693018, Newsfeed43025693069, Source Hub43025693309, Maps43025693117, KRS43025693171 i Economic Calendar43025693165. Wcześniejsze realne testy organizacji na PostgreSQL16.15 zaliczyły16/16. Te wyniki nie zastępują pełnego sprawdzenia nowego finalnego kandydata.

Po zgodzie: odtworzyć dokładne dwa proponowane pliki, sprawdzić wszystkie59 blobów i155 źródeł; uruchomić6 ujawnionych przypadków, pełny plik private-host na izolowanym PostgreSQL16, testy zachowania starego/nowego rekordu i negatywne; przyjąć ograniczoną politykę przez właściwą sg2/* ścieżkę runbooka po pełnym CI; opublikować zwykłym fast-forward PR983 wyłącznie z dokładnymi wpisami; wymagać pełnego chronionego i publicznego CI, types/build, aktualnych bramek oraz dowodu wynikowego main przed wspólnym przyjęciem. Żaden niezaliczony przypadek nie jest pomijany.

## Granice

To decyzja źródłowa i testowa. Nie instaluje SQL w produkcie, nie tworzy rzeczywistego OrgID, nie przyznaje pakietu PORR, nie wysyła zaproszeń, nie wykonuje płatnych wywołań i nie uruchamia wdrożenia. Native API/UI/startup, zaproszenia/outbox, lookup, Package/E1, domena/sesja i realny odbiór Development pozostają aktywnym Etapem I.

Podstawa osobnego dopuszczenia: [runbook integracji](../runbooks/shared-development-contract-integration-v1.md), sekcja Stage I SDK CI — owner-approved complete59 successor, wymaga zachowania „every exact59 entry unchanged”. Obecna propozycja zmienia cztery dokładnie opisane wersje, zatem poprzednia zgoda nie jest przenoszona na te inne bloby. Dokument przygotowuje ARCH-REGISTRATION-SDK-TEST-SOURCE-REVIEW-20261111; taski źródłowe i biznesowe pozostają otwarte.

## Zamrożona projekcja 59 wpisów

Entry-map SHA-256: 4e32bcb2ec3deaee75ab495761e60b90a848ab27954b33fdae3f975c1154939c

Record SHA-256: 25fea141baf42c154f64a256d40808d548562c010e3f2fd3143657f24b15295c

```json
{
  "status": "PROPOSAL_NOT_ACTIVE",
  "prNumber": 983,
  "branch": "architecture/registration-bootstrap-stage-i-20261111",
  "authorityBaseSha": "1abc68e248334fbdf03d1741561158fde020a27b",
  "preparedSourceSha": "b0eab24456b34a5691b83a05e0604d5080f83e1e",
  "implementationSourceSha": null,
  "entryMapSha256": "4e32bcb2ec3deaee75ab495761e60b90a848ab27954b33fdae3f975c1154939c",
  "recordSha256": "25fea141baf42c154f64a256d40808d548562c010e3f2fd3143657f24b15295c",
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
    "apps/sg-runtime/tests/assistant-ecr-integrity.mjs": {
      "sha": "ec0e23a87827d130e41210ca3cf0bbc29786efd5",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-ecr-integrity.test.mjs": {
      "sha": "8d2e68fa62b1295d35fbe74b9bdef6e9ab920582",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs": {
      "sha": "751ed6551ab43dd832e232136608a919837d779b",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-m1-integrity.mjs": {
      "sha": "9f28f13a7da11d6def28a91a1440d22ea793b59c",
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
    "apps/sg-runtime/tests/assistant-m2-source-view.mjs": {
      "sha": "a526345d7c153113ea629f3c16ec5c35c41567cb",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-send-arrow-integrity.mjs": {
      "sha": "b19f2eea8f16ddb07d67dc0cbf4a97c15ea51181",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/assistant-send-arrow-integrity.test.mjs": {
      "sha": "4189be2d1998d14cfd5f25d74093595b6581b7fa",
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
      "sha": "77a86e00786e8efd17d92fecbeb82aa0a56fec94",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/organisation-sdk-history.test.mjs": {
      "sha": "62b7b2aa205062d4f9598aa619ec3b2df8aff459",
      "status": "added",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/pci-smart-integrity.test.mjs": {
      "sha": "b08edf93ef8026ca982a6ce2a2c4d0ca1425f505",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SG2",
      "owner": "SG Runtime",
      "surfaceId": "SG2-BASE-001"
    },
    "apps/sg-runtime/tests/private-host.integration.test.mjs": {
      "sha": "5269cf475e341ee4a9e72d54ba9dcae4e3d13d45",
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
    "apps/srm/app/login/porr-account.tsx": {
      "sha": "f17f19b531cac97f09e87568123f2f71e1114416",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
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
      "sha": "76e92f7822da73f8a74ac0feb10604b5b0789876",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/native-execution-adoption.test.mjs": {
      "sha": "ccbe63d9197e0be179cdfa9b512d80ca03c0de60",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/operation-context.test.mjs": {
      "sha": "1f2857013f176fe740e79539ca6c676cc0afab03",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/porr-account-ui.test.mjs": {
      "sha": "353de6a9e489103b2bea6e02c4bf7639ce624b63",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/private-host.integration.test.mjs": {
      "sha": "6156c9ab32f32ce116df6f58689f2b9a1b7ef878",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/request-quota-adoption.test.mjs": {
      "sha": "85b91a57e72633eee79aceb1a73bece0d1139d74",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/source-hub-sdk-compatibility.mjs": {
      "sha": "efedf34427ba2529e599d1568de31312df63bbda",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/supplier-location-admission.integration.test.mjs": {
      "sha": "555d0af768e006ca1c3e5788629cf749203dc7b5",
      "status": "modified",
      "mode": "100644",
      "projectKey": "SRM",
      "owner": "SRM Runtime",
      "surfaceId": "SG2-BASE-016"
    },
    "apps/srm/scripts/xray-performance-adoption.test.mjs": {
      "sha": "0eea6287d1bb24e84eff8688c0bfa4a5e16bda4a",
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
      "sha": "a6f28d6b1928aea0839448526df6d4e0afb908e4",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.mjs": {
      "sha": "f309cb4ba8e6db083c84efc40bd2f3e5c0b3a9c5",
      "status": "added",
      "mode": "100644",
      "projectKey": "ARCHITECTURE",
      "owner": "Architecture Platform",
      "surfaceId": "ARCH-BASE-001"
    },
    "packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs": {
      "sha": "18aba285817c06615d54932fa079b8eb24d3c4d7",
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

Statyczna kontrola składni tekstu obu proponowanych plików: PASS (parser TypeScript5.9.3, bez importowania lub wykonywania propozycji). Nie jest to test runtime ani dopuszczenie rekordu.
