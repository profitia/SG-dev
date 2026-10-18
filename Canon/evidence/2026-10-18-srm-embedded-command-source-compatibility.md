# SRM — jawna kompatybilność z platform-contracts1.12, 18.10.2026

Status: SOURCE_COMPATIBILITY_CANDIDATE / LOCAL_VALIDATION_PASS / NOT_DEPLOYED. Zadanie `SRM-E1-EMBEDDED-COMMAND-SOURCE-COMPATIBILITY-20261018`, profil SRM, workspace SG-dev Codespaces SRM, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority main: `d63605dbb6dcc1105150dd0e3a59d6c7b6342b99`. Osobny begin w srm_pmos, MEMOROS wyłączony zgodnie z profilem. Własny closeout i PHR wymagają jeszcze rzeczywistego odbioru kodu.

Przyjęty producent ARCHITECTURE: `ARCHITECTURE-E1-EMBEDDED-COMMAND-CHANNEL-20261018`, source `a0e6bbee0ce44e2d3472183ef67749f3ef8f4e45`, PR481, pakiet1.12.0. Checkpoint SRM: `de3d45a25e7ae0a6b4e9687d172595b91ab4f09e`. Zmieniono wyłącznie własny lock, jawny zapis przyjęcia, istniejący test kompatybilności oraz ten dowód. Nowy manifest przypina rzeczywiste bajty wspólnego rdzenia, obu wrapperów i deklaracji typów. Historyczne hasze odczytu1.9 pozostają zachowane i wyraźnie opisane jako historyczne.

SRM nie wdraża przez tę zmianę osadzania UI, kanału poleceń, forecast.request, job.execute, nowego prawa ani nowej operacji produktu. Zachowuje swoje istniejące chronione przepływy raportu, eksportu i wspólnego podsumowania. Rzeczywisty test dwóch portów nadal wymaga aktualnego zezwolenia hosta, zamkniętych pól wejściowych i odmawia po odebraniu dostępu. Odczyt zachowuje dokładny kontrakt READ1.0.

| Weryfikacja lokalna | Wynik |
| --- | --- |
| Natywne API, pg i zwykłe role |69/69 PASS, bez pominięć |
| Regresje produktu, migracja finansów i izolacja cache/danych |490/490 PASS, bez pominięć |
| Promocja, uprawnienia i odzyskiwanie |311/311 PASS, bez pominięć |
| Pełna kontrola typów |PASS |
| Rzeczywisty build Next16/React19 |PASS |

Testy użyły nowych lokalnych klastrów i syntetycznych danych. Testy produktu zachowały własne tworzenie bazy srm_app, niezależnie od bazy natywnych testów. SDK1.11 zachowano w lokalnej kopii odzyskiwania; nowa kopia1.12 odpowiada rzeczywistemu producentowi. Nie instalowano zależności z prywatnym poświadczeniem.

Pierwsza próba natywnego zestawu prawidłowo odmówiła starego hasza monolitycznego wrappera. Po zachowaniu checkpointu rozszerzono zakres z trzech do czterech ścieżek i ponowiono pełną bramkę. Dotychczasowy test otrzymał jawne przyjęcie pięciu aktualnych plików zamiast pominięcia kontroli. Pierwotnej rejestracji i żądania PMOS nie powtórzono. Build sam dopisał jedną linię do generowanego next-env.d.ts poza przyjętym zakresem; zachowano jego wynik w kopii i odtworzono wyłącznie potwierdzoną własną linię. Bramka czystego stanu następnie przeszła ponownie.

Dowody lokalne: `/private/tmp/e1-embedded-command-srm-native2-native-20261018.log` i `/private/tmp/e1-embedded-command-srm-product-{product,promotion,types,build}-20261018.log`. Dokładne CI kandydata i main, osobne referencje producenta oraz SG2 i publikacja ciągłości stanowią dalsze wymagane dowody. Nie deklaruje się indywidualnego merge bez odczytu rzeczywistego statusu PR.

Nie zmieniono żywych baz, ról, grantów, schematów, sekretów, konfiguracji ani wdrożeń Development/Staging. Test promocji nie jest wykonanym deploymentem, kontrolowane odpowiedzi SDK nie są rzeczywistym OTP, a lokalny build nie jest odbiorem biznesowym. Pełny program E0/E1 i kontrolowane wydania pozostają IN_PROGRESS.
