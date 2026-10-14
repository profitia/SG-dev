# SRM — aktywacja historycznego radaru

Task: `SRM-RADAR-HISTORY-20261014`. Target: Development. Repo authority: `profitia/SG-dev/main`.

Zatwierdzono: normalizacja względem najlepszej własnej historii, stała skala dla porównywanych lat, kierunek zmiany, potwierdzona podstawa kosztów i automatyczny wybór ostatniego roku + poprzedniego. Brak AI i benchmarku innych firm.

## Źródła i wynik kontroli

Zapisane dokumenty Unilever NIP 5213390341 w Development zawierają porównawczy RZiS z pozycjami A/B/C/F/L oraz bilans. Dokument za 2025 (złożony 2026-07-15) potwierdza bieżące 2025 i porównawcze 2024. Kwoty kosztów odpowiadają B i mają potwierdzony znak.

Kwalifikowany zbiór według reguły XML_SOURCE_BASIS_V1: **2017, 2020, 2021, 2024, 2025**. Pozostałe wybrane okresy 2018/2019/2022/2023 pochodzą z dokumentów z konfliktem IAS/UoR i nie budują normalizacji. Nie maskujemy tego konfliktu zmianą flagi standardu. Źródłowe wartości pozostają dostępne.

Dla 2025 względem 2024: przychody −185206136,58 PLN (−8,301171%), wynik netto +353713767,74 PLN (+187,404950%), płynność +1,149254, marża +21,426516 pp, koszty/przychody −0,451626 pp, zobowiązania/aktywa −12,373042 pp. Koszty/przychody 2025 = 90,717034%, 2024 = 91,168660%.

Przychody2025 mają 0 punktów jako minimum kwalifikowanej historii, nie jako brak danych. Oba okresy płynności mają 100 punktów przez nasycenie przy 2,0, ale różnica wartości pozostaje widoczna.

## Granice

Nie potwierdza się pełnej porównywalności ekonomicznej po zmianach działalności ani braku zdarzeń jednorazowych. To pozycja raportowanych wartości, nie ocena wypłacalności. Korekty wymagające ustalenia relacji zastąpienia, nieobsługiwane warianty XML i niepewne źródła pozostają niedostępne. Benchmark klienta nie jest aktywowany.

Weryfikacja końcowa i identyfikatory publikacji zostaną zapisane w PMOS/PHR po testach i wdrożeniu; ten dokument nie jest samodzielnym potwierdzeniem LIVE.
