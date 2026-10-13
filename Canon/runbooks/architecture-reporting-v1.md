# Raportowanie ARCHITECTURE w PMOS i PHR

Zwykła praca architektury używa profilu ARCHITECTURE, workspace SG-dev Architecture oraz Development. Jeden kod PMOS obsługuje wszystkie profile. Architecture ma własną bazę architecture_pmos w billowing-credit-07394675, ograniczoną rolę architecture_pmos_runtime, prywatną usługę Render srv-db78d82j9qps73bej0c0, lokalny port3203 oraz własne pending/context/lock i klon PHR.

Profil/tytuł widoku i karty pochodzi z Canon oraz konfiguracji procesu. Nieznany projekt, obca baza, niewłaściwa ograniczona rola lub sprzeczne środowisko nie mogą nadać prawidłowej etykiety. Kontrola konfiguracji nie zastępuje rzeczywistego odczytu runtime; odbiór sprawdza bazę, rolę i własne rekordy. Root Event Ledger jest aktywnym widokiem; historyczny Sidebar nie steruje jego oznaczeniami.

1. Przed mutacją użyj repozytoryjnego AGENTS.md, właściwych aktywnych dokumentów, dokładnych ścieżek i pełnego preflightu. Task scope wybierz z kanonicznych governance/architecture/implementation/audit/product/documentation.
2. Zarejestruj task input2.0 przez pmos:begin z rzeczywistym hostConversationId. PMOS zwraca unikalny conversationId zależny od projectKey/taskId. Nie twórz go ręcznie i nie używaj identyfikatora innego zadania.
3. Po faktach przygotuj kanoniczny execution handoff i wykonaj pmos:save z własnej przestrzeni. PMOS i PHR są wymagane; Memoros jest disabled tylko dlatego, że tak stanowi ten profil. SG2/CIC pozostają Memorosrequired; SRM pozostaje disabled.
4. Sukces potwierdź niezależnie: completed, CLOSEOUT_COMPLETE, save/context/handoff SUCCEEDED, archivePASS, trailPRESENT, pending/lockclear oraz PHRPUBLISHED/IDEMPOTENT z commitem obecnym w zdalnym main. Disabled nie oznacza DELIVERED.

PHR pozostaje profitia/project-history-repository. Publication ID ARCHITECTURE:taskId i własny klon zapobiegają mieszaniu nazw i lokalnych operacji Git; kolizja wspólnego remote jest obsługiwana przez kanoniczny retry. Nie używaj jednego klonu jako katalogu roboczego kilku pisarzy.

Praca platformy i przyjęcie przez aplikację to odrębne zadania w odrębnych bazach. Referencja zawiera projectKey, taskId, repository, PR i sourceSha; opis i link zapisuje się w findings/context, bez obcego promptExecutionId jako lokalnej relacji. Przykład: producent ARCHITECTURE-E0-A-06-CONTRACT-PRODUCER-20261013, consumer SG2-E0-A-06-CONTRACT-INTEGRATION-20261013 lub SRM-E0-A-06-CONTRACT-INTEGRATION-20261013, z ich PR/SHA. Brak przyjęcia w aplikacji nie jest ukrywany statusem sukcesu samego producenta.

Prywatny PMOS nie ma publicznego URL. Lokalny UI można uruchomić z własnym chronionym env na port3203; pozostaje tym samym kodem i bazą. Nie otwieraj publicznego dostępu lub nie dodawaj credentiali innych aplikacji na potrzeby raportowania. CIC zachowuje swój tor i zasoby; E0-A nie tworzy go ponownie. Porządek raportowania nie implementuje tenantów produktu.
