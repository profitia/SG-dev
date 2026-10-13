# E0-A-06 — kontrolowana integracja i CI odbiorców

13 października 2026. Zakres: przygotowanie równoległego Development, nie wdrożenie tenancy produktu. Publikacje opisane poniżej są rzeczywiste; finalny wynik nowego workflow i closeout CI są odbierane po jego publikacji.

## Producent i odbiorcy

Producent ARCHITECTURE: task ARCHITECTURE-E0-A-06-CONTRACT-PRODUCER-20261013, PR280, mergead17af99c171d077b10b1101adb50f3301099f5d. Jedna implementacja neutralnego kontraktu Development1.0.0 i techniczny harness. Digest implementacji/deklaracji: 7de5e2d709afad621f7f331069f99a71da7e3ad732f178b9742c58f56d55da56. PHR048a76477253cd8442a065c0e5852fa7426ad4a0: PUBLISHED i remote ancestry PASS.

SG2: task SG2-E0-A-06-CONTRACT-INTEGRATION-20261013, PR281, merge51e1bbba23eb9b51438219f60befb8ec4991e0cf. Own apps/sg-runtime/development-integration.json i test:platform-contract; ten sam jawnie przyjęty version/digest, właściwy workspace/profile/sourceSurface. Own PMOS record completed/CLOSEOUT_COMPLETE, MemorosDELIVERED, PHRdab946ee5308733899f53b157aa6d0ae39286a6d PUBLISHED, remote ancestry PASS.

SRM: task SRM-E0-A-06-CONTRACT-INTEGRATION-20261013, PR282, merge9c168acedb926076dde8d9f7817059d9ca38aeeb. Own apps/srm/development-integration.json i komenda testowa; ten sam version/digest. Exact PR headb79ad30b4ac32423dcd840fbfa6435ea309ec51d Governance38462406249 i SRM CI38462406139 SUCCESS; main Governance38462853645 i SRM CI38462853650 SUCCESS. Standard SRM CI obejmował typecheck, tests, promotion guards i build; Staging jobs SKIPPED. Jego closeout jest operacją odbioru własnego SRM, a wynik będzie potwierdzony niezależnie.

Każda integracja ma osobny projekt, PMOS, taskId i referencję do producenta, bez przepisywania obcych rekordów między bazami. Weryfikacja GitHub Contents:14producer paths i4paths każdego odbiorcy byte-identical z opublikowanymi SHA. Unit:3contract/2lab/2SG2/2SRM; validators23, SG2existingbuild-contract1, SRMtypecheck i standardCI: PASS. Techniczne zapisy w laboratorium będą dopiero próbą08.

## Niespójność scope i przyczyna

[Dowód poprawki](2026-10-13-e0-a-06-registration-scope-guard.md): PR283, mergec7273c01f4c59bd715d040dcbbf47385b686c94e, 56/56 lifecycle/PHR tests, oba typechecki i productionPMOSbuildPASS. Zastosowano istniejący canonicalset przed nowym INSERT. Trzy stare rejestracje zachowały surowe platform/integration; finalne artefakty jawnie klasyfikują rzeczywistą pracę jako architecture/implementation. Nie dodano nowego enumu/aliasu ani nie przepisano historii. Guard task completed/CLOSEOUT_COMPLETE; PHR4313a891e8669e1b2001059ea66ec9996a448c6b PUBLISHED i remote ancestry PASS.

## CI i odrębne wydania

Nowy workflow Platform contract integration testuje jednego producenta i obu rzeczywistych odbiorców na każdej zmianie zadeklarowanych powierzchni. Świadomie testuje kontrakt Development; nie udaje pełnego biznesowego E2E. Kontrole porównują version/digest i właściwy profil oraz odrzucają obce konteksty. GitHub artifacts pokazują faktyczny checkout SHA i osobno head SHA PR, bez sekretów i danych klientów.

Merge narzędzi nie wdraża produktu. SG2/SRM mają własne istniejące manual deployment policies; Architecture PMOS osobny private service i manual exactSHA. W tym06 nie wykonano product deploymentu lub migracji, nie zmieniono funkcji, auth, zależności biznesowych albo danych. Samo zachowanie autoDeployoff nie dowodzi całej przyszłej release architecture; istniejące reguły wydawania pozostają kanoniczne. Staging/Production i domeny są poza zakresem.

Pełny etap06 zostaje odebrany po SUCCESS nowego workflow na PR/main oraz kanonicznym closeout CI. W07 następuje uzupełnienie oznaczeń i raportowania ARCHITECTURE, w08 rzeczywista próba równoległych zadań/publikacji.
