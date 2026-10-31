# Przyjęcie pełnego X-Ray przez AppShell

SG2 montuje publiczny `FullXRayWorkflow` SRM 0.4.0. To ten sam kod raportu i arkusz stylów, którego używa samodzielny SRM. Host dostarcza bieżące poświadczenie, stały chroniony gateway, routing powrotny, adapter istniejącego Maps runtime i pojedynczy portal asystenta. Nie ma kopii silnika finansowego, dostępu do bazy SRM ani drugiego panelu asystenta.

Nowe porty prezentacyjne obejmują istniejące eksporty XLSX/PDF, wyszukiwanie po nazwie, WWW, lokalizacje i uprawnione odsłonięcie PESEL. Pierwotne pięć operacji i ich kontrakt pozostają bez zmian. Nowe żądania są podpisywane przez istniejący peer SDK; oryginalny Request trafia do natywnego handlera SRM, zachowując aktualne HUMAN/E1/RLS i kontrolę ujawnienia. Wygaśnięcie poświadczenia podczas odpowiedzi wymaga ponownego potwierdzenia konta.

Pełna macierz 73 identyfikatorów znajduje się w `apps/srm/docs/full-ui-parity-20261031.md`. Przyjęcie wersji wskazuje dokładny commit producenta, PR oraz digest całego pakietu w dodatku `fullUiParityAdoption` obu istniejących receipts. Historia receipts pozostaje niezmieniona.

**SOURCE CANDIDATE / LIVE NOT VERIFIED.** Lokalny build SG2 korzysta z odizolowanych, zweryfikowanych kopii istniejących prywatnych zależności. Czyste `npm ci` SG2 nie jest jeszcze potwierdzone. Trusted-main kontroler wymaga właścicielskiego dopuszczenia istniejących pakietów `@profitia/maps-embed` i `@profitia/maps-contracts`; lokalny precheck zamyka bramkę kodami `PRIVATE_MANIFEST_PIN_MISMATCH` / `PRIVATE_PACKAGE_ALIAS_REJECTED`. Nie zmieniono tej polityki.

Wydanie wymaga również dopisania domeny SG2 do istniejącego `MAPS_ALLOWED_HOST_ORIGINS`, zakończenia aktywnych pomiarów FRESH, dokładnego CI i właściwych warunków release/retained LKG. Nie wykonano deploymentu, migracji ani zmian Staging, Production lub pilotów. Rzeczywisty marker NETTO i parytet dwóch zalogowanych usług Development pozostają do odbioru.

Końcowe lokalne sprawdzenia: build SG2 PASS; 27 testów przyjęcia X-Ray PASS; 13 testów powłoki/asystenta PASS. Szeroka regresja: 952 PASS oraz 15 testów integracyjnych zatrzymanych przez brak adresu izolowanej bazy PostgreSQL. Te 15 testów wymaga kontrolowanego CI i nie zostało uznane za zaliczone. Wcześniejsze receipts nie zostały przepisane — historyczne testy wiążą wcześniejsze bajty dla zastąpionych plików, a nowe przyjęcie niezależnie sprawdza komplet aktualnych bajtów i odrzuca manipulacje.
