# TE Markets — minimalna propozycja producenta dla pilota v0.5

Status: **PROPOSAL / OFFLINE_VERIFIED — NOT LIVE, ACTIVATION NOT AUTHORISED**.
Owner: Architecture Platform / Source Hub; transport i wspólna adopcja SDK zachowują swoich ownerów. Zadanie producenta `ARCH-SOURCE-HUB-TE-MARKETS-20261106`, powiązany konsument `SG2-OIL-ASPHALT-V05-EXTENDED-TE-20261106`.

## Wspólny kontrakt, jeden istniejący adapter

Pakiet Hub contracts 1.3.0 proponuje addytywną obsługę istniejącej rodziny `market-observations`; wire 1.0.0 i dotychczasowe rodziny nie zmieniają semantyki. To nie jest API Forecast Core ani przyjęcie instrumentu przez Market Data. Żaden adapter nie jest dodawany do Procurement Insights.

Pierwsze dopuszczone pobranie biznesowe może jednocześnie znaleźć **rzeczywiste symbole API** z pola `Symbol` i dostarczyć bieżące dane:

```json
{"contractVersion":"1.0.0","provider":"trading-economics","family":"market-observations","operation":"search","criteria":{"mode":"snapshot","instrumentUrls":["https://tradingeconomics.com/commodity/bitumen","https://tradingeconomics.com/commodity/brent-crude-oil","https://tradingeconomics.com/commodity/crude-oil"],"limit":10}}
```

Natywny endpoint to `/markets/commodities`. `instrumentUrls`, ewentualne `symbols` i `limit` są filtrowaniem lokalnym w zwróconym podzbiorze. Brak trafienia nie potwierdza nieistnienia instrumentu ani pełności planu. W tym zadaniu nie odczytano tych symboli z rzeczywistego API. Nie przyjmować symbolu przez podobieństwo URL lub znaną nazwę tickera.

Po otrzymaniu symbolu, dla każdego uprawnionego szeregu można wykonać:

```json
{"contractVersion":"1.0.0","provider":"trading-economics","family":"market-observations","operation":"search","criteria":{"mode":"historical","symbols":["SYMBOL_Z_ODPOWIEDZI_API:COM"],"from":"2026-10-30","to":"2026-11-06","limit":100}}
```

Symbol w przykładzie jest opisem miejsca na wartość, nie potwierdzonym ID. Ścieżka `/markets/historical/{symbols}` i `d1`/`d2` są natywne. Adapter odmawia dla niespodziewanego symbolu albo rekordu spoza żądanych dat. Zachowuje OHLC i `Last`/`Close`/`Value` wraz z odpowiednim `quoteBasis`; data dzienna jest oznaczona `DAY`, nie jako dokładna godzina sesji. Brak jednostki, waluty, typu CFD/futures/spot, expiry lub rollover jest NULL/UNKNOWN. `Type=commodity` nie stanowi rozpoznania rodzaju kontraktu. Konsument może porównać szeregi dopiero po właściwym powiązaniu jednostek, czasu i instrumentu. Nie traktować notowania Bitumen jako oferty zakupu asfaltu w Polsce.

Prognozy rynkowe są już obsługiwane przez istniejące `external-forecasts` / `forecastType=markets` / `marketCategory=commodity`, z lokalnym filtrem `symbols`. **Pozostają OFF**. Daty Forecast1–4 pozostają horyzontami TE, nie prognozą siedmiodniową ani Forecast Core. Nie wprowadza się nowej implementacji prognoz.

## Osobny opcjonalny kontrakt transportu

Dotychczasowy `API_PATH` celowo nie dopuszcza `:`. Nie zmieniono jego gramatyki, SQL028 ani digestu. Propozycja SDK 1.34.0 dodaje osobny `MARKET_SYMBOL` / `profitia.external-market-symbol/1.0.0`, z obowiązkowym digestem SQL029 i descriptor-em właścicielskim. Akceptuje tylko kanoniczne symbole `TICKER:TYPE`, do dziesięciu bez duplikatów, w trzech dokładnych szablonach GET `/markets/historical/`, `/markets/symbol/`, `/markets/forecasts/symbol/`; bez body, redirectów, kodowanych separatorów, wildcardów i dowolnego prefiksu. Hub używa obecnie wyłącznie szablonu historycznego i stałej ścieżki snapshotu. Nie przenosi credentiali w query.

SDK1.34 wymaga prawidłowej wspólnej adopcji i wersjonowanych dowodów konsumentów SG2/SRM. Proponowana optional E1 1.2.1 zmienia tylko deklarację zgodności peer; logika E1 i migracje centralne pozostają bez zmian. Wersje w propozycji i zielone testy offline nie dowodzą przyjęcia przez konsumentów. Nie przepisywać historycznych fingerprintów w celu obejścia kontroli.

## Dokładne zależności aktywacji — jeszcze niewykonane

1. Potwierdzenie obecnej licencji **oddzielnie** dla Markets snapshot, historical oraz market forecasts i zamierzonego prywatnego użycia SPENDGURU. Dostępny e-mail Standard/API nie rozstrzyga tych trzech zakresów. Nie kupować rozszerzenia i nie testować entitlement płatnym requestem.
2. Formalne przyjęcie producenta/SDK oraz wymagane przyjęcia SG2/SRM, ich aktualnych digestów, testów i CI. Brakującą zgodę na zmiany kontrolera CI należy uzyskać na dokładnym przygotowanym kandydacie; wcześniejsze wyjątki nie obejmują tej propozycji.
3. Przyjęta, zabezpieczona instalacja SQL029 w **istniejącej bazie Source Hub Development** jako istniejący `profitia_ingestion_owner`, a następnie produktowa006 jako istniejący owner/migrator. Żadnego globalnego restore, central E1 SQL, nowych ról ani zasobów. SQL029 nie przepisuje sześciu istniejących polityk i nie nadaje grantów.006 rejestruje rodzinę producenta, bez licencji/grantów.
4. Nowe właściwie zatwierdzone Source admission, native transport i licencja dla `source-hub.trading-economics.market-observations` / `api.trading-economics.market-observations`. `sourceDefinition('trading-economics','market-observations')` jest dokładnym źródłem ścieżek. Osobny rzeczywisty SERVICE `knowledge.read/market` na tę rodzinę dla uprawnionego zadania raportu, z bieżącym E1 i skończonym expiry. Nie nadawać uprawnień przez tożsamość Newsfeed.
5. Tylko jeśli licencja obejmuje prognozy rynkowe: osobna decyzja dotycząca istniejącego `allow_market_forecasts` i zgodnego native admission. Do tego czasu wartość false i działające sześć rodzin/polityk pozostają bez zmian. Nie poszerzać istniejącej niezmiennej polityki przez UPDATE.
6. Osobno dopuszczony, exact-SHA rollout wyłącznie istniejącego Hub, po porównaniu kolejki innych deploymentów, gotowości i aktualnej konfiguracji. Nie ma zgody na zmianę Render lub deployment w tym zadaniu producenta.
7. Pierwsze autoryzowane pobranie raportowe dostarcza danych i dowodu przepływu. Nie dodawać płatnego smoke, retry ani wywołań TE Calendar. Providerowe limity pozostają wiążące; nie zmieniamy sześciu UNMETERED ani retencji0.

Po wymaganym przyjęciu/zgodzie polecenie istniejącego migratora (direct URL z chronionego środowiska, nigdy z czatu lub argumentu):

```sh
SOURCE_HUB_ENVIRONMENT=development SOURCE_HUB_INSTALL_FIRST_PARTY=true SOURCE_HUB_INSTALL_MARKET_OBSERVATIONS=true npm --prefix apps/platform-source-hub run db:migrate
```

Nie ustawiać opcji instalacji UNMETERED ani Calendar. Nowa rodzina jest opcjonalna i nie jest dodawana do obowiązkowego zestawu sześciu kontroli readiness. Posiadanie nowego kodu bez nowych dopuszczeń nie ma wyłączyć istniejącego Hub ani dać dostępu do nowej rodziny.

## Źródła techniczne

- [TE snapshot / commodities](https://docs.tradingeconomics.com/markets/snapshot/)
- [TE history i zakres dat](https://docs.tradingeconomics.com/markets/historical/)
- [TE symbole](https://docs.tradingeconomics.com/markets/symbols/)
- [TE Market Forecasts](https://docs.tradingeconomics.com/forecasts/markets/)

To dokumentacja możliwości endpointów, nie dowód entitlement ani wyniki LIVE.
