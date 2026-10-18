# SG2 — przyjęcie źródła prywatnych faz, 18.10.2026

Status: SOURCE CANDIDATE / EXACT CONTROLLED CI REQUIRED. Zadanie
SG2-E1-PRIVATE-CONTINUATION-SOURCE-COMPATIBILITY-20261018, SG2/Development/local,
workspace SG-dev; authority profitia/SG-dev/main, baza06d5356a1b082f71c209e88f2b2df1057337330b.
Własne PMOS, wymagany MEMOROS/PHR. Całe E0/E1 pozostaje IN_PROGRESS.

Osobny producent ARCHITECTURE-E1-PRIVATE-REQUEST-CONTINUATION-20261018,
PR494/source08e2c187c78f6a582cf9b7aa715458824cae71ba, dostarcza platform1.15,
candidate9 i host1.7. Wykonane lokalnie745kontroli wspólnego kontraktu/laboratorium,
w tym21nowych kontroli PostgreSQL, publiczne typy i build PASS. Nie stanowi to
ponownego testu SG2 ani dowodu wdrożenia aplikacji.

Odbiorca aktualizuje wyłącznie własne piny lokalnego pakietu w Runtime i dashboardzie,
bieżące przyjęcie kontraktu/hosta, jawny 20plikowy zbiór hashy oraz natywny test
importu rzeczywistego źródła. Dawne zapisy external-call i external-request
pozostają oznaczone jako historyczne, z zachowaniem ich wersji i SHA.
Nie zmienia się nazw, wersji i sum kontrolnych trzech prywatnych pakietów CI,
uprawnień lub sposobu obsługi poświadczenia. Obowiązuje dotychczasowy kontroler
trusted-main, wewnętrzna gałąź sg2 i oddzielenie fazy instalacji od wykonania kodu.

SG2 nie przyjmuje przez samo źródło nowych faz Supplier Intelligence, endpointu,
logowania, praw produktu, schematu SQL011 ani migracji. Istniejące operacje,
komponenty, frameworki i cykl wydań pozostają do własnej regresji. Wymagane są
rzeczywiste Runtime/API/SQL/identity/revocation/audit, typecheck/build oraz osobne
regresje/build i produkcyjna odmowa HTTP dashboardu dla dokładnego kandydata/main.
Closeout podaje wyłącznie faktycznie uzyskane dowody.

Osobna integracja domenowa SRM ma własny taskId i odbiór. Zmiana producenta
nie jest jej odbiorem; złożony kandydat musi odpowiadać sumie zarejestrowanych
zakresów i zachować niezmienione bajty źródła producenta oraz SRM.
Nie czytano ponownie tokenu Render ani nie instalowano lokalnie prywatnych pakietów.
Nie wykonywano zmian chmury, kont, danych, ról/grantów, sekretów, flag, kosztów
lub deploymentu. Przygotowany katalog i bootstrap pozostają zachowane.
Właściciel autoryzował późniejsze Development dopiero po pełnych kryteriach E1;
ta publikacja go nie wykonuje. Brak zakresu Staging/Production/E2-E4.
