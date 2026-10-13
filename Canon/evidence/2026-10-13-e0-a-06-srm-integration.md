# E0-A-06 — przyjęcie kontraktu przez SRM

Data: 13 października 2026. Profil zadania: SRM, własny checkout i PMOS. TaskId: SRM-E0-A-06-CONTRACT-INTEGRATION-20261013.

Producent: ARCHITECTURE / ARCHITECTURE-E0-A-06-CONTRACT-PRODUCER-20261013, PR280, source ad17af99c171d077b10b1101adb50f3301099f5d. Kontrakt Development1.0.0, digest 7de5e2d709afad621f7f331069f99a71da7e3ad732f178b9742c58f56d55da56. Przyjęcie zapisano w apps/srm/development-integration.json. To referencja do obcego zadania, a nie lokalna relacja rekordu z innej bazy.

Integracja jest komendą weryfikacji Development: npm run test:platform-contract. Sprawdza właściwy profil, surface, workspace, wersję i digest oraz odrzucenie obcego projektu i Production. Nie zmienia wykonania funkcji produktu, nie dodaje auth/tenancy, nie zmienia zależności, migracji, danych lub deploymentu. Source SHA aplikacji na Render pozostaje jej poprzednią zaakceptowaną wersją.

Testy kontraktu wykonuje się bez połączeń baz i providerów. Wspólny workflow odbiorców jest następnym zadaniem E0-A-06 po obu integracjach. Powiązanie wersji i digestu w monorepo nie zastępuje testów i osobnego świadomego wydania produktu.
