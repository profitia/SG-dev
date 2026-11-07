# Wspólny dostęp komponentów SpendGuru — kontrakt 1.0.0

Każdy prawidłowo zarejestrowany komponent korzysta z tego samego klienta i sześciu API. Nie dopisywać nazw modułów do kodu Hub, nie kopiować adapterów i nie przekazywać kluczy providerów konsumentom. Nowe użycie tej samej wersji kontraktu wymaga zwykłej rejestracji tożsamości i aktualnego uprawnienia, bez kolejnego wyjątku architektonicznego. [Reguła kanoniczna](../../../Canon/v1.1-platform-source-hub-universal-first-party-consumer-access.md).

## Konfiguracja serwerowa konsumenta

Import: `@profitia/platform-source-hub-contracts/client` (pakiet 1.1.0) i peer `@profitia/platform-current-e1-authority` 1.1.0; root SDK pozostaje 1.33.0. Klient wymaga pól `environment`, `componentId`, `consumerApplicationId`, `receiverApplicationId`, `sourceOrigin`, `targetOrigin`, `keyId`, `privateKey`. W Development target to `https://source-hub-development.onrender.com`, receiver `profitia-source-hub-development`. Component/app/role/sourceOrigin i klucz muszą odpowiadać aktywnemu E1. Dla raportu należy użyć rzeczywistego komponentu Procurement Insights i jego aplikacji hostującej, nigdy identyfikatora Newsfeed. Headless worker może mieć przyjęte `urn:profitia:service:...`, bez fikcyjnego publicznego serwera.

Klucz prywatny Ed25519 pozostaje wyłącznie w magazynie sekretów danego komponentu. Hub nie wymaga zmiennej ani sekretu per konsument; Identity czyta aktualny rejestr publicznych kluczy. Klucz należy generować dopiero przy bezpiecznym docelowym zapisie; jego publiczne SPKI PEM można przekazać ownerowi Identity.

```js
import {createFirstPartySourceHubClient} from '@profitia/platform-source-hub-contracts/client';
// configuration pochodzi z bezpiecznej konfiguracji tego komponentu.
const hub = createFirstPartySourceHubClient(configuration);
const data = await hub.acquire({
  command: {contractVersion:'1.0.0',provider:'brave',family:'news-discovery',
    operation:'search',criteria:{text:reportCriteria.searchExpression}},
  execution: {kind:'SERVICE',organisationId:job.organisationId,grantId:job.e1GrantId},
  idempotencyKey:job.acquisitionId,
  signal:job.signal
});
// Procurement Insights: przekazać data.items wraz z metadata/provenance do
// własnego procesu selekcji ReportEvidenceBundle. Hub nie generuje raportu.
```

`job` i `reportCriteria` są autorytatywnym kontekstem prawdziwego zadania raportowego, nie danymi dowolnie przesłanymi przez przeglądarkę. SERVICE działa na aktualnym SQL005 read_grant, nie wymaga Clerk. HUMAN przesyła `execution:{kind:'HUMAN',organisationId}` i `request` z rzeczywistym bearer session token; nie przesyła `userId`, `expectedUserId` ani grantu SERVICE. Tożsamość człowieka i membership ustala E1. Klient nie ponawia upstream ani żądań Hub automatycznie.

## Semantyka i błędy

Body HTTP: `{context:execution,request:command}`, POST `/v1/acquire`; transport `x-profitia-source-consumer` podpisuje całe żądanie. Odpowiedź pozostaje Hub 1.0.0. Wszystkie filtry i ograniczenia providerów pozostają w przyjętym katalogu. Brave snippets nie są pełnymi artykułami, TE External Forecasts nie są prognozą Forecast Core. Markets nie uzyskuje dopuszczenia przez sam wybór rodziny External Forecasts.

403 oznacza brak aktualnego uprawnienia/klucza/licencji, 409 konflikt/pending/utracony przez retencję wynik; przy retencji 0 ten sam idempotency key nie uruchamia kolejnego pobrania. Nie obchodzić błędu przez zmianę klucza i automatyczny retry. 503 oznacza niedostępne lub niewłaściwe powiązanie, bez fallbacku ALLOW. Dostawca zachowuje własne limity. 60 sekund ważności podpisu, timeout i maksymalny rozmiar odpowiedzi chronią żądanie, nie ograniczają liczby wywołań UNMETERED.

## Kompatybilność

Dotychczasowy klient Newsfeed i jego własny model danych pozostają kompatybilne. Trójka `NEWSFEED_PUBLIC_ORIGIN`, `SOURCE_HUB_PEER_KEY_ID`, `SOURCE_HUB_PEER_KEY_B64` jest wyłącznie kompletną, opcjonalną grupą starego protokołu. Nie ustawiać jej dla Procurement Insights ani przyszłych modułów. Niepełna grupa jest odrzucana. Nowy protokół nie wymaga tej trójki w Hub.

Instalacja i konfiguracja istniejących usług: [jedna instrukcja właścicielska](../../../Canon/runbooks/source-hub-first-party-development-v1.md). Testy w tym PR są offline, nie są dowodem zainstalowania migracji ani nowego LIVE.
