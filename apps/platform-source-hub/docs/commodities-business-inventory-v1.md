# Biznesowy katalog informacji surowcowych

[Pobierz Excel](commodities-business-inventory-v1.xlsx) · [Pełne dane i mapowanie źródeł](../catalog/commodities-business-inventory-v1.json)

Stan źródła: **6 listopada 2026**, techniczny katalog z commitu `91144599409c3565f309ad9247b9fd2f7ed60422`.

Excel obejmuje pięć arkuszy: Przegląd, EIA, CFTC, commodities.sh oraz Potencjalne zastosowania. Zawiera **209 pozycji biznesowych**: 111 EIA, 35 CFTC i 63 commodities.sh. Są to rodziny miar, instrumenty, warianty raportów i pomocnicze możliwości; liczba pozycji nie jest liczbą niezależnych szeregów czasowych. Filtry pozwalają wybrać kategorię, przydatność i dostępność wartości. Nagłówki i identyfikacja pozostają widoczne podczas przewijania tabel szczegółowych.

Każda pozycja ma polski opis, znaczenie, interpretację, jednostkę lub jawny brak wiedzy, geograficzny zakres, częstotliwość danych, terminy publikacji, historię, źródła i potencjalne zastosowanie. Miary obliczane mają zasadę obliczenia i ograniczenia. Dokładne pola i identyfikatory wariantów można odtworzyć po ID pozycji w towarzyszącym JSON.

Mapowanie pokrywa wszystkie **232 trasy EIA z miarami**, wszystkie pola tych tras, **22 pozycje CFTC** i wszystkie pola 12 zbiorów tabularnych oraz **33 pozycje commodities.sh**. Pozostałe 27 węzłów EIA służy nawigacji. Edycje AEO/IEO i równoległe przekroje tej samej miary są grupowane.

**LIVE metadanych nie oznacza LIVE wartości.** Wykorzystano wyłącznie wcześniejsze dowody: 3 obserwacje EIA, 3 rekordy Legacy Combined CFTC, katalog 30 instrumentów i 6 harmonogramów commodities.sh. Nie pobierano nowych obserwacji. Nazw ani dat sześciu harmonogramów nie odtworzono z hashy; świeża lista najbliższych publikacji wymaga osobnego odczytu kalendarza. Oficjalne dokumentacje uzupełniają znaczenie i cykl publikacji, z odrębnymi odnośnikami.

Płatne operacje commodities.sh i niedostępne krzywe futures są wyraźnie oznaczone. Dane referencyjne cash/miesięczne nie są notowaniami giełdowymi realtime. `PA` jest placeholderem. Siedem serii operacyjnych obejmuje także wykorzystanie i wsad rafinerii. Kategorie TFF dotyczą kontraktów finansowych, nie fizycznej podaży surowców.

Nie uzgadniano na siłę brakujących jednostek. Oznaczono m.in. konflikt jednostki `heat-content` węgla oraz rozbieżność opisu i jednostki `sales` energii elektrycznej. Daty graniczne datasetu nie gwarantują historii każdej serii; przyszłe daty mogą należeć do projekcji. Interpretacja oraz ocena przydatności są wstępną analizą, bez decyzji wdrożeniowej i rekomendacji zakupowych.

Nie zmieniono funkcjonalności, adapterów, API, uprawnień, polityk, baz produktowych ani deploymentów.
