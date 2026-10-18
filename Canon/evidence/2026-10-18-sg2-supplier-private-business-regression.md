# SG2 — regresja przy prywatnym zapisie SRM, 18.10.2026

Status: SOURCE VALIDATION CANDIDATE; wymagane dowody exact candidate/main CI.
SG2-E1-SUPPLIER-PRIVATE-BUSINESS-REGRESSION-20261018, SG2/Development/local,
workspace SG-dev, profitia/SG-dev/main. Własny PMOS, wymagane MEMOROS i PHR.
Pełne E0/E1 pozostaje IN_PROGRESS.

## Zakres i pochodzenie

SRM-E1-SUPPLIER-PRIVATE-BUSINESS-20261018, PR497,
source77f88de8525a7f3f078f2bb3a34ce9c0dcf6d268, przyjmuje istniejące biznesowe
writery SRM w autoryzowanych prywatnych fazach. Referencja jest między profilami;
nie przenosi rekordów, lokalnych identyfikatorów ani historii PMOS.

Osobna gałąź SG2 zawiera dokładne źródło SRM oraz tylko ten własny dowód. Porównanie
Git z przyjętym main3b1bce8cb25c09d4939c1b5145a06ab03d831e82 potwierdziło brak
zmian w apps/sg-runtime, apps/dashboard-preview, packages/platform-contracts
i packages/srm-xray. To kontrola regresji obu aplikacji na wspólnym kandydacie,
bez dopisywania pozornej integracji SRM do SpendGuru.

## Wymagany odbiór CI

Dokładny combined SHA musi przejść istniejący kontroler zaufanego main dla SG2,
rzeczywiste natywne API/SQL, typecheck i build, regresję/build dashboardu
i produkcyjne HTTP refusal. Artefakt z rzeczywistego workflow_dispatch jest
weryfikowany przez kanoniczny assertProof, a publiczny job sprawdza exact SHA.
Następnie wymagany jest rzeczywisty push-main CI i trzy niezależnie odczytane
artefakty Runtime, dashboardu i SRM. Dawnego zielonego SHA nie nazywa się nową walidacją.

Dotychczasowy kontroler, main-only Environment, zakres instalowanych pakietów,
wersje i checksums pozostają bez zmian. Nie pobiera się ponownie NPM_TOKEN
z Render ani nie uruchamia kodu kandydata z poświadczeniem pakietów.
Brak oczekiwanego dowodu jest odmową, a nie powodem osłabienia bramki.

## Granice

Nowy prywatny zapis biznesowy należy do SRM. SG2 zachowuje własne operacje,
aktorów, bazy i cykl wydania. Ta walidacja nie oznacza uruchomienia endpointu
dostawców w SpendGuru ani ponownego bootstrapu kont/organizacji.
Nie zmieniono źródeł wspólnych pakietów, Reacta, frameworków, chmurowych danych,
ról, grantów, sekretów, konfiguracji, kosztów i wdrożeń produktu.

Końcowy własny PMOS/PHR zapisze faktyczne CI, source SHA i rezultat po ich
potwierdzeniu. Runtime fixture nie jest rzeczywistą sesją użytkownika.
Kontynuacja E1 i późniejsze autoryzowane Development pozostają odrębnymi odbiorami;
ten dokument nie deklaruje gotowości Staging/Production lub E2–E4.
