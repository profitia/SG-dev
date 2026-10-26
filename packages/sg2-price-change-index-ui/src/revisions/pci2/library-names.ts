import { spendGuruCopy } from './ui-copy-canon';
import type {Section} from './library-registry';
export type NamedComponent={id:string;name:string;section:Section;rules:string[];behaviors:string[];fonts:string[];numbers:string[];variants:string;status:string};
export type NamedBehavior={id:string;name:string;kind:string;section:Section;trigger:string;parameters:string;description:string;status:string};
export const namedComponents:NamedComponent[] = [
{"id": "SRM-C92", "name": "Panel prognozy i oceny modelu", "section": "charts", "rules": ["CHT-13", "ACT-08"], "behaviors": [], "fonts": ["SRM-T32"], "numbers": [], "variants": "Trzy kompaktowe pasy: prognoza, sprawdzalność i status. Model, sposób wyznaczania wartości i horyzont są niezależne. Ocena z trzech miar. Ten sam komponent w kanonie i Benchmark Finder. Dane i obliczenia demonstracyjne.", "status": "Kanon"},
{"id": "SRM-C93", "name": "Podręczne objaśnienia prognoz", "section": "charts", "rules": ["CHT-13"], "behaviors": [], "fonts": ["SRM-T32"], "numbers": [], "variants": "Okno na żądanie: Modele, Wartości, Sprawdzalność, Legenda. Model w krótkich akapitach zamiast pełnej tabeli. X, Escape, kliknięcie poza oknem, powrót fokusu. Bez wpływu na wysokość wykresu.", "status": "Kanon"},
{"id": "SRM-C94", "name": "Przygotowywanie prognozy", "section": "charts", "rules": ["CHT-13"], "behaviors": [], "fonts": ["SRM-T32"], "numbers": [], "variants": "Cienki płynny niebieski refleks i spokojnie pulsujący punkt. Stały obszar statusu; opis aktualnego etapu. Nieokreślony postęp bez procentu, reduced motion, aria-live. W prototypie 10-sekundowa demonstracja stanów, bez wywołania modelu.", "status": "Kanon"},
{"id": "SRM-C86", "name": "Pionowy wybór zakresu czasu", "section": "charts", "rules": ["CHT-11", "SRM-SP19"], "behaviors": ["SRM-B61", "SRM-B35"], "fonts": ["SRM-T33"], "numbers": [], "status": "Kanon", "variants": "1M, 3M, 6M, 1Y, 3Y, 5Y, All. Pionowo pod okrągłą kontrolką górnego panelu, wspólna oś środka; wycentrowane etykiety. Sam tekst, bez tła, obrysu i cienia, także na hoverze. Wybrana pozycja 700, pozostałe 400. Domyślnie All. Wybór wiąże się z nawigatorem C74; nie zmienia częstotliwości próbkowania danych. Ręczny zakres może nie mieć aktywnego skrótu. Dostępne nazwy, aria-pressed, klawiatura i podkreślenie focus-visible."},
{"section": "charts", "numbers": [], "fonts": ["SRM-T32"], "status": "Kanon", "id": "SRM-C84", "name": "Boczny panel narzędzi wykresu", "rules": ["CHT-10", "SRM-SP18", "CHT-12"], "behaviors": ["SRM-B60", "SRM-B35"], "variants": "Lewy panel, domyślnie schowany. Pusta przestrzeń na przyszłe narzędzia. Bez widocznych tekstów. Dwie kolumny ikon po 2,25 rem, odstęp 0,375 rem, padding 0,5 rem; całość 6 rem bez obrysu; delikatny cień tylko przy prawym boku, rozmycie 1 rem, zasięg powiększony o 0,125 rem, Deep Ocean 6%, przesunięcie X/Y = 0; góra, lewa strona i dół bez cienia. Paleta, prostokątna powierzchnia bez obrysu i ruch współdzielone z C81. Panel z górnym narożnikiem według CHT-12, bez zewnętrznego marginesu: od lewej krawędzi do pełnej wysokości obszaru pod panelem górnym; styk z C85 bez linii, szczeliny i cienia, ze wspólnym tłem Cloudveil Mist. Wysunięcie zmniejsza szerokość grafiki w tej samej karcie; nie dodaje przewijania poziomego ani nie zmienia wybranego zakresu danych. Jedna wspólna definicja cienia C81/C84. Weryfikacja obejmuje historię, Prognozy, Prognozy ze Sprawdzalnością oraz powrót po wyłączeniu opcji, przy panelach otwartych osobno i jednocześnie. Opcje wykresu nie zmieniają koloru, rozmycia, rozszerzenia, przesunięcia ani widoczności cienia otwartego panelu. Górne narożniki tła wykresu pod kontrolkami są zaokrąglone promieniem równym połowie średnicy okrągłej ikony: 1,125 rem przy średnicy 2,25 rem. Lewy narożnik odpowiada walizce C85, prawy ustawieniom C82. Prostokątne tło uchwytu jest przezroczyste: żaden szary narożnik nie wystaje poza okrąg. Reguła dotyczy wszystkich warstw tła, także gradientu Prognoz i Sprawdzalności, paneli otwartych i zamkniętych oraz hovera."},
{"section": "charts", "numbers": [], "fonts": ["SRM-T32"], "status": "Kanon", "id": "SRM-C85", "name": "Wstążka narzędzi wykresu · lewo–prawo", "rules": ["CHT-10", "SRM-SP18", "CHT-12"], "behaviors": ["SRM-B60", "SRM-B35"], "variants": "Ta sama kontrolka rozwija i chowa. Uchwyt 2,25 × 2,25 rem. Okrąg walizki I27 swoją lewą krawędzią styka się dokładnie z prawą krawędzią panelu. Odstęp 0 rem, bez prostokątnego łącznika. Okrąg ikony 2,25 rem dochodzi dokładnie do krawędzi uchwytu, bez wewnętrznego odstępu. Wstążka i okrąg bez obrysu i własnego cienia; cień wyłącznie na prawym boku panelu, bez cienia wokół uchwytu; widoczna ikona na delikatnym okrągłym tle. Bez strzałki i tekstu. Obrys widoczny tylko przy fokusie klawiatury. Górna krawędź wstążki zawsze wyrównana z górną krawędzią panelu, bez odsunięcia. Na styku narożniki zgodne z CHT-12, brak wewnętrznego obrysu, szczeliny i cienia; tło identyczne jak w panelu, także na hoverze. Przy schowaniu pozostaje przy lewej krawędzi; po wysunięciu jedzie z prawą krawędzią panelu. Fokus, aria-expanded, aria-controls i tooltip. Hover obejmuje wyłącznie okrąg wraz z ikoną: płynne powiększenie o 7% i delikatne przyciemnienie. Prostokąt łączący kontrolkę z panelem zachowuje rozmiar, kolor i pozycję. Punkt skalowania leży na styku z panelem: u góry dla ustawień, po lewej dla narzędzi. Ta sama reguła działa po rozwinięciu i schowaniu, przy historii, Prognozach i Sprawdzalności. Reduced motion wyłącza powiększenie. Górne narożniki tła wykresu pod kontrolkami są zaokrąglone promieniem równym połowie średnicy okrągłej ikony: 1,125 rem przy średnicy 2,25 rem. Lewy narożnik odpowiada walizce C85, prawy ustawieniom C82. Prostokątne tło uchwytu jest przezroczyste: żaden szary narożnik nie wystaje poza okrąg. Reguła dotyczy wszystkich warstw tła, także gradientu Prognoz i Sprawdzalności, paneli otwartych i zamkniętych oraz hovera."},

{"id": "SRM-C81", "name": "Wysuwany panel sterowania wykresem", "section": "charts", "rules": ["CHT-09", "SRM-SP17", "CHT-12"], "behaviors": ["SRM-B58", "SRM-B35"], "fonts": ["SRM-T32"], "numbers": [], "variants": "Panel nad wykresem, schowany domyślnie. Cloudveil Mist, bez obrysu, narożniki 0 rem; delikatny cień zamiast ramki. Cień wyłącznie pod dolną krawędzią rozwiniętego panelu: rozmycie 1 rem, zasięg powiększony o 0,125 rem, Deep Ocean 6%, przesunięcie X/Y = 0. Wspólna miękka definicja cienia dla obu paneli; bez kanciastego gradientu. Górna, lewa i prawa krawędź bez cienia. Widoczny także przy Prognozach i Sprawdzalności, bez zależności od checkboxów. Uchwyt zasłania cień na swoim styku z panelem. Pełna szerokość od lewej do prawej krawędzi ramy wykresu, górna krawędź dosunięta bez marginesu. Wewnętrzny padding pozostaje. Bez widocznego tytułu. Trzy wiersze minimum 2,25 rem, odstępy 0,5 rem. Wariant podstawowy zawiera C76 i C78, wariant rozszerzony C92 obejmuje ustawienia, ocenę i status według CHT-13. Bez pinezki i przypinania; widoczność zmienia wstążka lub Escape. Zachowuje stan opcji po zwinięciu. Dzieli z wykresem stały budżet wysokości. Rozwinięcie płynnie zmniejsza wysokość grafiki, nie przesuwa osi czasu, suwaka ani dołu karty. Dalsze kontrolki można dodawać do tej samej grupy. Jedna wspólna definicja cienia C81/C84. Weryfikacja obejmuje historię, Prognozy, Prognozy ze Sprawdzalnością oraz powrót po wyłączeniu opcji, przy panelach otwartych osobno i jednocześnie. Opcje wykresu nie zmieniają koloru, rozmycia, rozszerzenia, przesunięcia ani widoczności cienia otwartego panelu. Górne narożniki tła wykresu pod kontrolkami są zaokrąglone promieniem równym połowie średnicy okrągłej ikony: 1,125 rem przy średnicy 2,25 rem. Lewy narożnik odpowiada walizce C85, prawy ustawieniom C82. Prostokątne tło uchwytu jest przezroczyste: żaden szary narożnik nie wystaje poza okrąg. Reguła dotyczy wszystkich warstw tła, także gradientu Prognoz i Sprawdzalności, paneli otwartych i zamkniętych oraz hovera.", "status": "Kanon"},
{"id": "SRM-C82", "name": "Wstążka panelu wykresu · góra–dół", "section": "charts", "rules": ["CHT-09", "SRM-SP17", "CHT-12"], "behaviors": ["SRM-B58", "SRM-B35"], "fonts": [], "numbers": [], "variants": "Uchwyt 2,25 × 2,25 rem przy prawej krawędzi. Okrąg ustawień I25 swoją górną krawędzią styka się dokładnie z dolną krawędzią panelu. Odstęp 0 rem, bez prostokątnego łącznika. Okrąg ikony 2,25 rem dochodzi dokładnie do krawędzi uchwytu, bez wewnętrznego odstępu. Wstążka i okrąg bez obrysu i własnego cienia; po rozwinięciu cień wyłącznie pod dolnym bokiem panelu, bez cienia wokół uchwytu; widoczna ikona na delikatnym okrągłym tle. Bez strzałki i tekstu. Obrys widoczny tylko przy fokusie klawiatury. Schowana treść pozostawia tylko wstążkę. Wstążka jedzie z dolną krawędzią panelu. Prosty styk bez poziomej linii, szczeliny i cienia; wspólne tło Cloudveil Mist także na hoverze. Kliknięcie ikony rozwija albo chowa panel; kierunek wynika z jego położenia. Ta sama kontrolka w obu stanach, bez osobnego przycisku Zamknij. aria-expanded i aria-controls. Hover obejmuje wyłącznie okrąg wraz z ikoną: płynne powiększenie o 7% i delikatne przyciemnienie. Prostokąt łączący kontrolkę z panelem zachowuje rozmiar, kolor i pozycję. Punkt skalowania leży na styku z panelem: u góry dla ustawień, po lewej dla narzędzi. Ta sama reguła działa po rozwinięciu i schowaniu, przy historii, Prognozach i Sprawdzalności. Reduced motion wyłącza powiększenie. Górne narożniki tła wykresu pod kontrolkami są zaokrąglone promieniem równym połowie średnicy okrągłej ikony: 1,125 rem przy średnicy 2,25 rem. Lewy narożnik odpowiada walizce C85, prawy ustawieniom C82. Prostokątne tło uchwytu jest przezroczyste: żaden szary narożnik nie wystaje poza okrąg. Reguła dotyczy wszystkich warstw tła, także gradientu Prognoz i Sprawdzalności, paneli otwartych i zamkniętych oraz hovera.", "status": "Kanon"},

{"id": "SRM-C80", "name": "Etykiety wartości przy kursorze", "section": "charts", "rules": ["CHT-08"], "behaviors": ["SRM-B57", "SRM-B51"], "fonts": ["SRM-T31"], "numbers": ["SRM-N19", "SRM-N16", "SRM-N17", "SRM-N18"], "variants": "Otwarty tekst bez boksu, tła i ramki: nazwa benchmarku i wartość. Jedna wspólna data przy szczycie pionowej linii kursora, na stałej wysokości we wszystkich trybach; bez dat przy poszczególnych wartościach. Prognoza: etykieta górnej linii czerwona, centralnej niebieska, dolnej zielona. Nazwa, wartość i jednostka mają kolor swojej linii. Zmiana strony kursora lub położenia nad/pod wykresem nie zmienia przypisania; wspólna data zachowuje kolor kanoniczny. Sprawdzalność: kurs i prognoza historyczna przy punktach, delta w jednostce ceny. Ta sama pionowa oś kursora. Etykiety poza całym obrysem linii, korytarza i wstęgi na szerokości tekstu: górna powyżej, dolna poniżej. Centralna po przeciwnej wolnej stronie, a przy krawędzi poniżej dolnej. Wstęga: wyższa wartość nad, niższa pod obrysem. Automatyczna zmiana strony. Bez linii łączących etykiety z punktami. Jedyną pionową linią pomocniczą w polu wykresu jest kursor; punkty, nazwy i kolory określają relację danych.", "status": "Kanon"},
{"id": "SRM-C79", "name": "Podświetlenie przedziału czasu", "section": "charts", "rules": ["CHT-07"], "behaviors": ["SRM-B56", "SRM-B52"], "fonts": ["SRM-T19"], "numbers": ["SRM-N16", "SRM-N17", "SRM-N18"], "variants": "Subtelny pionowy pas od górnej krawędzi pola aż do osi i środków znaczników czasu, bez dolnej przerwy. Między sąsiednimi datami: niebieski gradient 2–16% krycia, delikatne krawędzie i podświetlony łącznik osi X. W pobliżu konkretnej daty pas słabnie do 40%, a znacznik oraz jego etykieta otrzymują mocniejszy akcent C72/C23. Warstwa pod wykresem, bez przechwytywania kliknięć, zmiany wartości lub wyboru okresu.", "status": "Kanon"},
{"id": "SRM-C77", "name": "Wstęga delty prognozy historycznej", "section": "charts", "rules": ["CHT-06"], "behaviors": ["SRM-B55", "SRM-B53", "SRM-B51"], "fonts": ["SRM-T19"], "numbers": [], "variants": "Beżowa przerywana linia prognozy historycznej i punkty obserwacji; niebieski kurs rzeczywisty. Półprzezroczysta wstęga wyłącznie pomiędzy liniami. Prognoza wyższa: powyżej kursu; niższa: poniżej. Przy przecięciu wstęga zanika do zera, bez wypełnienia do osi X. Wspólne daty, jednostka i skala Y. Bez semantyki czerwony/zielony oraz procentowej oceny trafności. Punkt kursora jest wariantem SRM-C73 i śledzi beżową linię przy tej samej współrzędnej czasu co kurs rzeczywisty.", "status": "Kanon"},
{"id": "SRM-C78", "name": "Sprawdzalność · checkbox", "section": "charts", "rules": ["CHT-06"], "behaviors": ["SRM-B55"], "fonts": ["SRM-T19"], "numbers": [], "variants": "Natywny checkbox obok Prognozy; domyślnie wyłączony. Włączenie otwiera prognozy, jeśli są wyłączone. Wyłączenie sprawdzalności pozostawia prognozę; wyłączenie prognozy zamyka też sprawdzalność. Dostępna etykieta, fokus i klawiatura.", "status": "Kanon"},

{"id": "SRM-C75", "name": "Korytarz prognozy ceny", "section": "charts", "rules": ["CHT-05"], "behaviors": ["SRM-B54", "SRM-B51", "SRM-B52", "SRM-B53"], "fonts": ["SRM-T19"], "numbers": ["SRM-N16", "SRM-N17", "SRM-N18"], "variants": "Jeden niebieski gradient podążający za linią centralną, 18% maksymalnego krycia. Nad centralną linią wygasza się przez 8% do dokładnego koloru powierzchni panelu Cloudveil Mist przy górnej krawędzi wykresu; wspólny neutralny podkład sięga krawędzi panelu także w bocznych marginesach, bez białego pasa; dolny cień rozwiniętego panelu C81 pozostaje widoczny w każdym trybie; cienka górna granica leży wewnątrz tego samego wypełnienia. Poniżej centralnej linii krycie maleje proporcjonalnie do 3,5% przy dolnej granicy. Jedna maska luminancji i jedno malowanie koloru eliminują nakładanie cienia na tło. Górna krawędź pozostaje związana z polem wykresu, także przy zmianie zakresu i animacji. Górna granica czerwona (negative-text #A63830), dolna zielona (success-text #176747); linie 1,25 i pełne krycie. Przerywana, mocniejsza linia centralna pozostaje niebieska. Stałe kolory serii wiążą linie, punkty, legendę oraz etykiety C80 niezależnie od położenia. Kolory rozróżniają granice, nie oceniają ceny. Wszystkie trzy linie startują w ostatniej obserwacji, która pozostaje na środku. Pełny punkt historii i puste przyszłe znaczniki czasu. Wyłącznie wzorzec wizualny.", "status": "Kanon"},
{"id": "SRM-C76", "name": "Prognozy · checkbox", "section": "charts", "rules": ["CHT-05"], "behaviors": ["SRM-B54"], "fonts": ["SRM-T19"], "numbers": [], "variants": "Roboczy natywny checkbox z etykietą Prognozy. Obsługa kliknięcia etykiety, klawiatury i widocznego fokusu. Stan domyślny: wyłączony.", "status": "Kanon"},
{"id": "SRM-C74", "name": "Nawigator zakresu czasu", "section": "charts", "rules": ["CHT-04"], "behaviors": ["SRM-B53"], "fonts": ["SRM-T19"], "numbers": ["SRM-N16", "SRM-N17", "SRM-N18"], "variants": "Dwa uchwyty na miniaturze pełnej historii, jasnoniebieskie okno, daty początku i końca w formacie wybranego interwału, wyśrodkowane bezpośrednio pod odpowiednimi uchwytami. Daty przesuwają się razem z uchwytami, bez opóźnienia i bez wspólnego separatora. Obszar trafienia 2,75 rem, widoczny okrąg o średnicy równej wysokości widocznego paska suwaka (2,25 rem). Pionowa granica zakresu przechodzi dokładnie przez środek okręgu, także podczas hover i fokusu. Reset Pełny zakres przez SRM-C02. Przeciągnięcie środka zaznaczonego okna przesuwa jednocześnie obie granice bez zmiany szerokości; kursor grab/grabbing. Wykres, daty i punkty kursora aktualizują się na bieżąco. Ruch zatrzymuje się na krańcach dostępnych danych. W prognozach zachowuje co najmniej jeden okres po każdej stronie punktu łączenia, który nadal pozostaje centralnie. Obsługa myszy, dotyku i klawiatury: strzałki, Shift, Home/End. Pełny zakres nie przesuwa się.", "status": "Kanon"},
{"id": "SRM-C73", "name": "Kursor krzyżowy z punktem na linii", "section": "charts", "rules": ["CHT-03"], "behaviors": ["SRM-B51", "SRM-B52", "SRM-B53"], "fonts": [], "numbers": [], "variants": "Dwie subtelne przerywane linie Deep Ocean: pionowa i pozioma, 0,0625 rem i 55% krycia. Punkt 0,625 rem z białą obwódką 0,125 rem i delikatną poświatą. Przecięcie linii zawsze na krzywej, z otwartymi etykietami SRM-C80. Wariant Trzy punkty prognozy: centralny punkt pełny oraz górny i dolny punkt z białym wypełnieniem, odpowiednio czerwoną i zieloną obwódką oraz poświatą koloru własnej linii; identyczna średnica 0,625 rem. Wszystkie trzy współdzielą pozycję X kursora. Punkty skrajne śledzą swoje linie, bez dodatkowych poziomych prowadnic. Wariant historycznej delty: drugi punkt 0,625 rem, biały z beżową obwódką, porusza się po linii sprawdzalności przy tej samej dacie co punkt rzeczywistej ceny. Na przecięciu linii punkty łączą się. Stały identyfikator backtest wiąże etykietę SRM-C80.", "status": "Kanon"},
{"id": "SRM-C72", "name": "Oś czasu · dzień, miesiąc, rok", "section": "charts", "rules": ["CHT-02", "HIS-01"], "behaviors": ["SRM-B50", "SRM-B52", "SRM-B53", "SRM-B56"], "fonts": ["SRM-T19"], "numbers": ["SRM-N16", "SRM-N17", "SRM-N18"], "variants": "Punkty SRM-C23 połączone cienką linią, daty wyśrodkowane pod punktami. Dzienny: dd mm rrrr. Miesięczny: mm rrrr. Roczny: rrrr. Odstępy zamiast kropek. Dwa poziomy hover: delikatny łącznik między datami oraz mocny punkt i tło daty przy bezpośrednim najechaniu. Powiązany pas na wykresie: SRM-C79.", "status": "Kanon"},
{"id": "SRM-C71", "name": "Linia ceny historycznej", "section": "charts", "rules": ["CHT-01", "CHT-12"], "behaviors": ["SRM-B49", "SRM-B50", "SRM-B51", "SRM-B52", "SRM-B53"], "fonts": ["SRM-T19"], "numbers": ["SRM-N16", "SRM-N17", "SRM-N18"], "variants": "Jedna subtelna linia Deep Ocean i niebieski gradient do przezroczystości przy dolnej krawędzi. Oś czasu SRM-C72 z punktami SRM-C23: interwał dzienny, miesięczny lub roczny. Kursor C73 z punktem śledzącym krzywą. Bez skali cen; wartości przy kursorze przez SRM-C80. Edytowalny wzorzec, bez rzeczywistych danych. Górne narożniki tła wykresu pod kontrolkami są zaokrąglone promieniem równym połowie średnicy okrągłej ikony: 1,125 rem przy średnicy 2,25 rem. Lewy narożnik odpowiada walizce C85, prawy ustawieniom C82. Prostokątne tło uchwytu jest przezroczyste: żaden szary narożnik nie wystaje poza okrąg. Reguła dotyczy wszystkich warstw tła, także gradientu Prognoz i Sprawdzalności, paneli otwartych i zamkniętych oraz hovera.", "status": "Kanon"},
{"id": "SRM-C69", "name": "Wybór krawędzi menu", "section": "navigation", "rules": ["NAV-01", "SRM-SP16", "SRM-TXT01"], "behaviors": ["SRM-B47", "SRM-B35"], "fonts": ["SRM-T29"], "numbers": [], "variants": "Lewa / prawa / górna / dolna krawędź. Wybór zachowuje przypięcie; bez swobodnego przeciągania.", "status": "Kanon"},
{"id": "SRM-C70", "name": "Ikonowa pozycja Docka", "section": "navigation", "rules": ["NAV-01", "SRM-SP16", "SRM-TXT01"], "behaviors": ["SRM-B48", "SRM-B35"], "fonts": ["SRM-T29"], "numbers": [], "variants": "Zaślepka SRM-I23 w czterech wariantach. Pełna nazwa w tooltipie i aria-label; aktywny stan jasnoniebieski. Tylko poziomy układ.", "status": "Kanon"},
{"id": "SRM-C64", "name": "Menu krawędziowe · Dock", "section": "navigation", "rules": ["NAV-01", "SRM-SP16", "SRM-TXT01"], "behaviors": ["SRM-B44", "SRM-B45", "SRM-B46", "SRM-B47", "SRM-B35"], "fonts": ["SRM-T29", "SRM-T30"], "numbers": [], "variants": "Pionowe: lewa / prawa krawędź, pozycje tekstowe. Poziome: góra / dół, zaślepki ikonowe. Wyłącznie cztery krawędzie w bieżącym oknie.", "status": "Kanon"},
{"id": "SRM-C65", "name": "Wstążka menu · rozwiń / zwiń", "section": "navigation", "rules": ["NAV-01", "SRM-SP16", "SRM-TXT01"], "behaviors": ["SRM-B44", "SRM-B46", "SRM-B48", "SRM-B35"], "fonts": ["SRM-T29"], "numbers": [], "variants": "Ta sama kontrolka w obu stanach: okrągły symbol SRM-I23 i strzałka SRM-I24. Bez widocznego tekstu. Strzałka wskazuje kierunek ruchu, wstążka podąża za panelem. aria-expanded, aria-controls, opis Rozwiń / Zwiń menu.", "status": "Kanon"},
{"id": "SRM-C66", "name": "Przypięcie menu", "section": "navigation", "rules": ["NAV-01", "SRM-SP16", "SRM-TXT01"], "behaviors": ["SRM-B45", "SRM-B35"], "fonts": ["SRM-T29"], "numbers": [], "variants": "Tekst Przypnij / Odepnij; stan wciśnięty w Desert Sandstone, aria-pressed.", "status": "Kanon"},
{"id": "SRM-C67", "name": "Profil użytkownika w menu", "section": "navigation", "rules": ["NAV-01", "SRM-SP16", "SRM-TXT01"], "behaviors": ["SRM-B35"], "fonts": ["SRM-T30"], "numbers": [], "variants": "Ikona SRM-I22 i Adam Kowalski: dół pionowego menu / koniec poziomego Docka. W wąskim Docku pozostaje koło z pełnym imieniem w nazwie dostępnej i podpowiedzi.", "status": "Kanon"},
{"id": "SRM-C68", "name": "Tekstowa pozycja menu", "section": "navigation", "rules": ["NAV-01", "SRM-SP16", "SRM-TXT01"], "behaviors": ["SRM-B44", "SRM-B46", "SRM-B35"], "fonts": ["SRM-T29"], "numbers": [], "variants": "Bez ikony. Aktywny stan jasnoniebieski, tekst granatowy. Nazwy robocze, tylko symulacja wyboru.", "status": "Kanon"},
{"id": "SRM-C62", "name": "Chmurka przychodząca SpendGuru", "section": "assistant", "rules": ["AST-04", "SRM-TXT01"], "behaviors": ["SRM-B41", "SRM-B42", "SRM-B43", "SRM-B35"], "fonts": ["SRM-T14"], "numbers": [], "variants": "Lewostronna wiadomość. Awatar C33: 3,84 rem (64% metryczki 6 rem; dodatkowa redukcja 20%), odstęp 0,75 rem. Wersja męska / Anna. Tło #EFF6FC, obrys #D8E8F5.", "status": "Kanon"},
{"id": "SRM-C63", "name": "Trzy kropki · SpendGuru pisze", "section": "assistant", "rules": ["AST-04"], "behaviors": ["SRM-B41", "SRM-B42"], "fonts": ["SRM-T14"], "numbers": [], "variants": "Trzy kropki 0,375 rem. Pętla 1100 ms, opóźnienia 0 / 120 / 240 ms. Przy ograniczonym ruchu statyczne. Dostępna etykieta „SpendGuru pisze…”.", "status": "Kanon"},
{"id": "SRM-C61", "name": "Stan dostępności raportu", "section": "radar", "rules": ["AVL-01"], "behaviors": ["SRM-B40"], "fonts": ["SRM-T03", "SRM-T05"], "numbers": [], "variants": "MSR/MSSF nieobsługiwane · spółka w likwidacji · spółka wykreślona", "status": "Kanon"},
  {
    "id": "SRM-C01",
    "name": "Przycisk główny",
    "section": "controls",
    "rules": [
      "ACT-01"
    ],
    "behaviors": [
      "SRM-B01",
      "SRM-B10",
      "SRM-B11",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T24"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Domyślny, fokus, disabled; tekst np. Pokaż dane.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C02",
    "name": "Przycisk drugorzędny",
    "section": "controls",
    "rules": [
      "ACT-01"
    ],
    "behaviors": [
      "SRM-B01",
      "SRM-B10",
      "SRM-B11",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Obrys; np. Porównaj, Pobierz aktualny KRS, Pobierz ponownie.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C03",
    "name": "Odnośnik historii",
    "section": "controls",
    "rules": [
      "ACT-02",
      "MET-02"
    ],
    "behaviors": [
      "SRM-B02",
      "SRM-B15",
      "SRM-B11",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01",
      "SRM-T02"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Zobacz historię; w stopce 11 px.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C04",
    "name": "Przycisk ikonowy",
    "section": "controls",
    "rules": [
      "ACT-03"
    ],
    "behaviors": [
      "SRM-B04",
      "SRM-B10",
      "SRM-B11",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Ikona + dostępna nazwa; brak widocznego tekstu.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C05",
    "name": "Menu kontekstowe",
    "section": "controls",
    "rules": [
      "ACT-03"
    ],
    "behaviors": [
      "SRM-B28",
      "SRM-B21",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Otwarte, zamknięte, wybrana opcja.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C06",
    "name": "Pole tekstowe",
    "section": "controls",
    "rules": [
      "ACT-04"
    ],
    "behaviors": [
      "SRM-B05",
      "SRM-B11",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T15"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Puste, wypełnione, fokus, disabled.",
    "status": "Częściowo"
  },
  {
    "id": "SRM-C07",
    "name": "Lista wyboru",
    "section": "controls",
    "rules": [
      "ACT-04",
      "ACT-08"
    ],
    "behaviors": [
      "SRM-B05",
      "SRM-B11",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [
      "SRM-N02"
    ],
    "variants": "Filtrowana lista: pole standardowe lub kompaktowe, dowolna wartość, zaznaczenie, brak wyników i niedostępne opcje.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C08",
    "name": "Zakładka obszaru",
    "section": "selection",
    "rules": [
      "SEL-01"
    ],
    "behaviors": [
      "SRM-B02",
      "SRM-B13",
      "SRM-B11",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Przegląd, Płynność, Zadłużenie, Rentowność, Gotówka, Własne. Raport KYS korzysta z tego samego wyglądu i zachowania zakładek. Przełączanie zachowuje pozycję przewinięcia; klawiatura używa preventScroll.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C09",
    "name": "Kapsuła roku",
    "section": "selection",
    "rules": [
      "SEL-02"
    ],
    "behaviors": [
      "SRM-B03",
      "SRM-B12",
      "SRM-B11",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T22"
    ],
    "numbers": [
      "SRM-N02"
    ],
    "variants": "Dostępna lub wybrana; tylko lata z danymi.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C10",
    "name": "Wybór wskaźnika",
    "section": "selection",
    "rules": [
      "SEL-03"
    ],
    "behaviors": [
      "SRM-B06",
      "SRM-B13",
      "SRM-B14",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T05"
    ],
    "numbers": [
      "SRM-N02"
    ],
    "variants": "Checkbox wskaźnika + własny wybór roku.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C11",
    "name": "Wybór kategorii",
    "section": "selection",
    "rules": [
      "SEL-03"
    ],
    "behaviors": [
      "SRM-B06",
      "SRM-B14",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Checkbox: brak, część lub wszystkie.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C12",
    "name": "Kreator własnego zestawu",
    "section": "selection",
    "rules": [
      "SEL-03"
    ],
    "behaviors": [
      "SRM-B13",
      "SRM-B14",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01",
      "SRM-T05",
      "SRM-T22"
    ],
    "numbers": [
      "SRM-N02"
    ],
    "variants": "Kategorie i pojedyncze wskaźniki; bez trwałego zapisu na koncie.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C13",
    "name": "Karta wskaźnika",
    "section": "cards",
    "rules": [
      "MET-01"
    ],
    "behaviors": [
      "SRM-B15",
      "SRM-B29",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T03",
      "SRM-T04",
      "SRM-T05"
    ],
    "numbers": [
      "SRM-N03",
      "SRM-N07",
      "SRM-N11"
    ],
    "variants": "Wartość, zero lub brak danych.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C14",
    "name": "Stopka wskaźnika",
    "section": "cards",
    "rules": [
      "MET-02"
    ],
    "behaviors": [
      "SRM-B15",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T02"
    ],
    "numbers": [
      "SRM-N02"
    ],
    "variants": "Okres, ważność, historia w jednej linii.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C15",
    "name": "Znacznik ważności",
    "section": "cards",
    "rules": [
      "MET-03"
    ],
    "behaviors": [
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T02"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Pomocniczy: 1 beżowa kropka; istotny: 2 błękitne; kluczowy: 3 granatowe.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C16",
    "name": "Radar sektorowy",
    "section": "radar",
    "rules": [
      "RAD-01",
      "RAD-03"
    ],
    "behaviors": [
      "SRM-B09",
      "SRM-B10",
      "SRM-B16",
      "SRM-B29",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T06",
      "SRM-T07",
      "SRM-T08"
    ],
    "numbers": [
      "SRM-N04",
      "SRM-N05",
      "SRM-N06",
      "SRM-N09",
      "SRM-N11"
    ],
    "variants": "Sześć równych sektorów; podstawowy lub porównawczy.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C17",
    "name": "Sektor radaru",
    "section": "radar",
    "rules": [
      "RAD-01"
    ],
    "behaviors": [
      "SRM-B08",
      "SRM-B15",
      "SRM-B16",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T06",
      "SRM-T07",
      "SRM-T08"
    ],
    "numbers": [
      "SRM-N09",
      "SRM-N11"
    ],
    "variants": "Warstwa tła, wypełnienia i odniesienia.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C18",
    "name": "Etykieta sektora",
    "section": "radar",
    "rules": [
      "RAD-01"
    ],
    "behaviors": [
      "SRM-B08",
      "SRM-B15",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T06",
      "SRM-T07",
      "SRM-T08"
    ],
    "numbers": [
      "SRM-N04",
      "SRM-N05",
      "SRM-N06",
      "SRM-N09",
      "SRM-N11"
    ],
    "variants": "Nazwa, wartość i zmiana: wspólny font1rem/650 i kolor kierunku zmiany. SRM-SP15: min1,5em odstępu od powiększonego wycinka, także przy hover120%; wspólny radarLabelLayout.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C19",
    "name": "Łuk odniesienia",
    "section": "radar",
    "rules": [
      "RAD-02"
    ],
    "behaviors": [
      "SRM-B16",
      "SRM-B35"
    ],
    "fonts": [],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Przerywany łuk; równo, poniżej lub powyżej wypełnienia.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C20",
    "name": "Sterowanie radarem",
    "section": "radar",
    "rules": [
      "RAD-01",
      "RAD-02"
    ],
    "behaviors": [
      "SRM-B12",
      "SRM-B16",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [
      "SRM-N02"
    ],
    "variants": "Okres, odniesienie i porównanie.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C21",
    "name": "Wykres historii",
    "section": "history",
    "rules": [
      "HIS-01"
    ],
    "behaviors": [
      "SRM-B17",
      "SRM-B18",
      "SRM-B29",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T17",
      "SRM-T18",
      "SRM-T19"
    ],
    "numbers": [
      "SRM-N07",
      "SRM-N08",
      "SRM-N11"
    ],
    "variants": "Dane dodatnie, ujemne, zero lub brak.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C22",
    "name": "Słupek historii",
    "section": "history",
    "rules": [
      "HIS-01"
    ],
    "behaviors": [
      "SRM-B07",
      "SRM-B17",
      "SRM-B18",
      "SRM-B29",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T17"
    ],
    "numbers": [
      "SRM-N08",
      "SRM-N11"
    ],
    "variants": "Wartość zawsze nad słupkiem, Inter 0,8125 rem / 650; jednostka 0,5 rem. Bez etykiet wewnątrz wypełnienia. Zero i brak zachowują tylko tło.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C23",
    "name": "Oś lat",
    "section": "history",
    "rules": [
      "HIS-01"
    ],
    "behaviors": [
      "SRM-B17",
      "SRM-B32",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T19"
    ],
    "numbers": [
      "SRM-N02"
    ],
    "variants": "Punkty połączone cienką linią; aktywny okres wyróżniony.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C24",
    "name": "Dokładna wartość w dymku",
    "section": "history",
    "rules": [
      "HIS-01"
    ],
    "behaviors": [
      "SRM-B18",
      "SRM-B29",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T18",
      "SRM-T19"
    ],
    "numbers": [
      "SRM-N03",
      "SRM-N07",
      "SRM-N11"
    ],
    "variants": "Dymek po wskazaniu, fokusie lub dotknięciu słupka; pełna wartość. Bez stałej belki roku i kapsuły Wybrany okres.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C25",
    "name": "Tabela historii",
    "section": "history",
    "rules": [
      "HIS-02"
    ],
    "behaviors": [
      "SRM-B17",
      "SRM-B19",
      "SRM-B29",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T09",
      "SRM-T10",
      "SRM-T11"
    ],
    "numbers": [
      "SRM-N03",
      "SRM-N07",
      "SRM-N11"
    ],
    "variants": "Rok, wartość, jednostka, opcjonalna informacja.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C26",
    "name": "Belka roku",
    "section": "history",
    "rules": [
      "HIS-02"
    ],
    "behaviors": [
      "SRM-B17",
      "SRM-B31",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T11"
    ],
    "numbers": [
      "SRM-N02"
    ],
    "variants": "Pozioma kapsuła w pierwszej kolumnie tabeli.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C27",
    "name": "Okno historii",
    "section": "history",
    "rules": [
      "HIS-03"
    ],
    "behaviors": [
      "SRM-B20",
      "SRM-B21",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T12",
      "SRM-T05"
    ],
    "numbers": [
      "SRM-N02"
    ],
    "variants": "Wykres lub tabela; belka z kontrolkami i Zamknij.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C28",
    "name": "Przełącznik historii",
    "section": "history",
    "rules": [
      "HIS-03"
    ],
    "behaviors": [
      "SRM-B02",
      "SRM-B19",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Wykres ↔ Tabela.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C29",
    "name": "Przycisk kopiowania",
    "section": "history",
    "rules": [
      "HIS-04"
    ],
    "behaviors": [
      "SRM-B01",
      "SRM-B22",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [
      "SRM-N10"
    ],
    "variants": "Sama ikona kopiowania. Tooltip i aria-label Skopiuj do schowka; sukces oznacza ikonę potwierdzenia i komunikat statusu. Wszystkie lata w TSV.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C30",
    "name": "Komunikat kopiowania",
    "section": "history",
    "rules": [
      "HIS-04"
    ],
    "behaviors": [
      "SRM-B22"
    ],
    "fonts": [
      "SRM-T20"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Potwierdzenie lub instrukcja ręcznego kopiowania.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C31",
    "name": "Okno SpendGuru",
    "section": "assistant",
    "rules": [
      "AST-01"
    ],
    "behaviors": [
      "SRM-B24",
      "SRM-B26",
      "SRM-B27",
      "SRM-B30",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T13",
      "SRM-T14",
      "SRM-T15"
    ],
    "numbers": [
      "SRM-N03",
      "SRM-N07",
      "SRM-N11"
    ],
    "variants": "Wbudowane, zwinięte lub odpięte.",
    "status": "Częściowo"
  },
  {
    "id": "SRM-C32",
    "name": "Belka SpendGuru",
    "section": "assistant",
    "rules": [
      "SRM-TXT01",
      "AST-01"
    ],
    "behaviors": [
      "SRM-B23",
      "SRM-B26",
      "SRM-B28",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T13"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Jednoliniowe powitanie; zegar, odpięcie, trzy kropki.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C33",
    "name": "Awatar SpendGuru",
    "section": "assistant",
    "rules": [
      "AST-01",
      "AST-02"
    ],
    "behaviors": [
      "SRM-B23",
      "SRM-B25",
      "SRM-B35"
    ],
    "fonts": [],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Wersja męska lub Anna; okrągły awatar 96 px i wariant wstążki 39 px.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C34",
    "name": "Podsumowanie dostawcy",
    "section": "assistant",
    "rules": [
      "SRM-TXT01",
      "AST-01"
    ],
    "behaviors": [
      "SRM-B27",
      "SRM-B29",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T23",
      "SRM-T14"
    ],
    "numbers": [
      "SRM-N03",
      "SRM-N07",
      "SRM-N11"
    ],
    "variants": "Stały szablon z danymi; bez generowania przez LLM. Treść i lista zmian: wspólny font0,875rem i line-height1,6, także w odpiętym czacie.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C35",
    "name": "Pole wiadomości",
    "section": "assistant",
    "rules": [
      "SRM-TXT01",
      "AST-01"
    ],
    "behaviors": [
      "SRM-B11",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T15"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Wielowierszowy szkic; wysyłanie jeszcze nieaktywne.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C36",
    "name": "Wstążka asystenta",
    "section": "assistant",
    "rules": [
      "AST-02"
    ],
    "behaviors": [
      "SRM-B24",
      "SRM-B25",
      "SRM-B30",
      "SRM-B35"
    ],
    "fonts": [],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Awatar i kontrolka rozwinięcia przy prawej krawędzi.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C37",
    "name": "Kontrolka zwijania",
    "section": "assistant",
    "rules": [
      "AST-02"
    ],
    "behaviors": [
      "SRM-B04",
      "SRM-B24",
      "SRM-B30",
      "SRM-B35"
    ],
    "fonts": [],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Zwiń / rozwiń; dostępna nazwa bez stałego tekstu.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C38",
    "name": "Kontrolka odpięcia",
    "section": "assistant",
    "rules": [
      "AST-03"
    ],
    "behaviors": [
      "SRM-B04",
      "SRM-B26",
      "SRM-B35"
    ],
    "fonts": [],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Odłącz / przyłącz czat.",
    "status": "Częściowo"
  },
  {
    "id": "SRM-C39",
    "name": "Menu awatara",
    "section": "assistant",
    "rules": [
      "AST-01"
    ],
    "behaviors": [
      "SRM-B23",
      "SRM-B28",
      "SRM-B21",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Zamień na Annę / Zamień na wersję męską.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C40",
    "name": "Historia bieżącej rozmowy",
    "section": "assistant",
    "rules": [
      "AST-01"
    ],
    "behaviors": [
      "SRM-B28",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01",
      "SRM-T16"
    ],
    "numbers": [
      "SRM-N02"
    ],
    "variants": "Bieżąca sesja, podsumowanie danych i rok.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C41",
    "name": "Kontekst asystenta",
    "section": "assistant",
    "rules": [
      "AST-03"
    ],
    "behaviors": [
      "SRM-B26",
      "SRM-B27",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T16"
    ],
    "numbers": [
      "SRM-N02"
    ],
    "variants": "Dostawca, radar, wybrane wskaźniki i ich okresy.",
    "status": "Częściowo"
  },
  {
    "id": "SRM-C42",
    "name": "Nagłówek sekcji",
    "section": "foundations",
    "rules": [
      "FND-04"
    ],
    "behaviors": [
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T21"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Tekst; bez dekoracyjnych znaków przy kategoriach wskaźników.",
    "status": "Częściowo"
  },
  {
    "id": "SRM-C43",
    "name": "Układ Supplier Finance Scanner",
    "section": "foundations",
    "rules": [
      "FND-04"
    ],
    "behaviors": [
      "SRM-B30",
      "SRM-B35"
    ],
    "fonts": [],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Radar po lewej, SpendGuru po prawej. Poniżej Dane szczegółowe ze zwijanymi wskaźnikami finansowymi oraz sprawozdaniami.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C44",
    "name": "Logotyp marki",
    "section": "icons",
    "rules": [
      "BRD-01"
    ],
    "behaviors": [
      "SRM-B33",
      "SRM-B35"
    ],
    "fonts": [],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "SpendGuru (SRM-L01), Profitia (SRM-L02) i PORR (SRM-L04); wektory bez własnej czcionki. Stałe proporcje. PORR zachowuje kolory źródłowe.",
    "status": "Częściowo"
  },
  {
    "id": "SRM-C45",
    "name": "Favicon aplikacji",
    "section": "icons",
    "rules": [
      "BRD-02"
    ],
    "behaviors": [
      "SRM-B34"
    ],
    "fonts": [],
    "numbers": [],
    "variants": "SpendGuru SRM-L03. Kwadratowy SVG 512 × 512; demonstracje 16, 32, 48 i 64 px.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C46",
    "name": "Kafel dodawania wykresu",
    "section": "controls",
    "rules": [
      "ACT-05"
    ],
    "behaviors": [
      "SRM-B36",
      "SRM-B10",
      "SRM-B11",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01",
      "SRM-T19"
    ],
    "numbers": [],
    "variants": "Kafel z plusem po prawej stronie wykresów, o tej samej wysokości. Otwiera wybór pozycji.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C47",
    "name": "Karta wykresu sprawozdania",
    "section": "history",
    "rules": [
      "HIS-05",
      "HIS-01",
      "HIS-02",
      "HIS-04"
    ],
    "behaviors": [
      "SRM-B07",
      "SRM-B17",
      "SRM-B18",
      "SRM-B19",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T09",
      "SRM-T10",
      "SRM-T19",
      "SRM-T25"
    ],
    "numbers": [
      "SRM-N02",
      "SRM-N10",
      "SRM-N11",
      "SRM-N12"
    ],
    "variants": "Wariant wcześniejszy (v0.6): karta 420 px z panelem pojedynczego roku i wartości. W widoku głównym zastąpiony przez SRM-C51. Zachowany identyfikator; nie stosować do nowych kart przeglądowych.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C48",
    "name": "Tabela sprawozdania",
    "section": "history",
    "rules": [
      "HIS-06"
    ],
    "behaviors": [
      "SRM-B19",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T09",
      "SRM-T10",
      "SRM-T11"
    ],
    "numbers": [
      "SRM-N02",
      "SRM-N12",
      "SRM-N11"
    ],
    "variants": "Macierz pozycji × lata. Stała nazwa po lewej i akcja wykresu po prawej. Przewijanie lat w poziomie.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C49",
    "name": "Sekcja rozwijana danych",
    "section": "selection",
    "rules": [
      "SEL-04"
    ],
    "behaviors": [
      "SRM-B37",
      "SRM-B10",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01",
      "SRM-T09"
    ],
    "numbers": [],
    "variants": "Zwinięta / rozwinięta. Wskaźniki finansowe wewnątrz Danych szczegółowych, stan kontrolek zachowany.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C50",
    "name": "Wybór pozycji do wykresu",
    "section": "controls",
    "rules": [
      "ACT-05"
    ],
    "behaviors": [
      "SRM-B36",
      "SRM-B10",
      "SRM-B11",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01",
      "SRM-T09",
      "SRM-T19"
    ],
    "numbers": [
      "SRM-N02"
    ],
    "variants": "Wyszukiwanie, grupy Rachunek zysków i strat / Bilans, pojedynczy wybór, brak wyników, już dodane.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C51",
    "name": "Wykres przeglądowy",
    "section": "history",
    "rules": [
      "HIS-07",
      "HIS-01",
      "HIS-02",
      "HIS-04"
    ],
    "behaviors": [
      "SRM-B38",
      "SRM-B07",
      "SRM-B17",
      "SRM-B19",
      "SRM-B20",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T09",
      "SRM-T10",
      "SRM-T19",
      "SRM-T26"
    ],
    "numbers": [
      "SRM-N02",
      "SRM-N10",
      "SRM-N11",
      "SRM-N12"
    ],
    "variants": "Widok główny · karta 300 px. Nazwa i zakres całej serii; bez panelu wybranego roku i wartości. Przełącznik wykres/tabela, kopiowanie w tabeli i powiększenie w jednym wierszu po prawej. Kafel plus tej samej wysokości. Subtelne kontrolki 24–26 px, ikony 12 px; obwódka 0,75 px #DDE6EE, bez cienia.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C52",
    "name": "Nagłówek X-Ray",
    "section": "foundations",
    "rules": [
      "HDR-01"
    ],
    "behaviors": [
      "SRM-B01"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [],
    "variants": "Stałe: wysokość, kolor, SpendGuru i X-Ray | Supplier Intelligence Dashboard. Zmienne: opcjonalny formularz NIP, Wyloguj, etykieta użytkownika / ustawienia. Enter Page używa rdzenia bez dodatków.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C53",
    "name": "Tożsamość dostawcy",
    "section": "cards",
    "rules": [
      "FND-03"
    ],
    "behaviors": [
      "SRM-B01"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [],
    "variants": "Zarejestrowany element obecnej makiety; wariant podstawowy.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C54",
    "name": "Komunikat kontekstowy",
    "section": "controls",
    "rules": [
      "ACT-01"
    ],
    "behaviors": [
      "SRM-B01"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [],
    "variants": "Zarejestrowany element obecnej makiety; wariant podstawowy.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C55",
    "name": "Odnośnik tekstowy",
    "section": "controls",
    "rules": [
      "ACT-01"
    ],
    "behaviors": [
      "SRM-B01"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [],
    "variants": "Zarejestrowany element obecnej makiety; wariant podstawowy.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C56",
    "name": "Raport KYS z zakładkami",
    "section": "selection",
    "rules": [
      "KYS-01",
      "SEL-01"
    ],
    "behaviors": [
      "SRM-B13",
      "SRM-B11",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T21",
      "SRM-T03",
      "SRM-T27",
      "SRM-T28"
    ],
    "numbers": [
      "SRM-N15"
    ],
    "variants": "Pięć zakładek. Podsumowanie i szczegóły korzystają z tych samych wyników rejestrów i list. Data pobrania wyłącznie z downloadedAt; opcjonalna godzina z sekundami. PDF/KRS nad zakładkami.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C57",
    "name": "Tabela i dane rejestrowe KYS",
    "section": "history",
    "rules": [
      "KYS-02"
    ],
    "behaviors": [
      "SRM-B11",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T27",
      "SRM-T28",
      "SRM-T10"
    ],
    "numbers": [
      "SRM-N13"
    ],
    "variants": "Kierownictwo: jeden wiersz na osobę, bez rozwijania. Beneficjenci: rozwijane tylko powiązanie/rejestr, Sankcje i PEP w głównym wierszu. Okres i Sankcje bez łamania; poziomy scroll wewnątrz tabeli.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C58",
    "name": "PESEL · maska i kontrolka",
    "section": "controls",
    "rules": [
      "KYS-03"
    ],
    "behaviors": [
      "SRM-B39"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [
      "SRM-N14"
    ],
    "variants": "Maska 11 kropek i bezramkowe oko C59 przy każdym numerze. Otwarte oko: pokaż ukryty PESEL; zamknięte: ukryj pokazany. Makieta nie zawiera rzeczywistych PESEL-i.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C59",
    "name": "Przełącznik widoczności PESEL",
    "section": "controls",
    "rules": [
      "ACT-06"
    ],
    "behaviors": [
      "SRM-B04",
      "SRM-B11",
      "SRM-B35",
      "SRM-B39"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": [
      "SRM-N01"
    ],
    "variants": "Sama ikona bez obwódki i tła. Przy identyfikatorze, nigdy przy pobieraniu dokumentów. Otwarte oko SRM-I16 ujawnia ukryty PESEL, zamknięte SRM-I17 ukrywa pokazany.",
    "status": "Kanon"
  },
  {
    "id": "SRM-C60",
    "name": "Zamknięcie okna",
    "section": "controls",
    "rules": [
      "ACT-07",
      "HIS-03"
    ],
    "behaviors": [
      "SRM-B04",
      "SRM-B10",
      "SRM-B11",
      "SRM-B35"
    ],
    "fonts": [],
    "numbers": [],
    "variants": "Ikona X bez tekstu. Pole 2,25 rem, ikona 1,125 rem, delikatna obwódka. aria-label i podpowiedź Zamknij. Escape i przywrócenie fokusu bez przewijania.",
    "status": "Kanon"
  }
];
export const namedBehaviors:NamedBehavior[] = [
{"id": "SRM-B61", "name": "Szybki wybór zakresu historii", "kind": "interaction", "section": "charts", "trigger": "Kliknięcie C86 / Enter / Spacja", "parameters": "Hover tekstu 1,025 / 180 ms. Wybór 400 → 700 bez zmiany rozmiaru i pozycji etykiety. Reduced motion bez skalowania.", "description": "Zakres liczony kalendarzowo wstecz od ostatniej obserwacji, z ograniczeniem do dostępnych danych i minimum dwóch obserwacji wymaganych przez nawigator. Bez tworzenia brakujących danych. All przywraca pełną historię i pełny horyzont prognozy. Preset aktualizuje wykres i suwak; przy prognozach zmienia lewy zakres i zachowuje wybrany horyzont prawej części. Kotwica ostatnich danych zawsze w 50% szerokości. Ręczne przesuwanie suwaka usuwa wyróżnienie skrótu; pełny zakres przywraca All. Panele nie resetują wyboru. Dzienny/miesięczny/roczny to osobna częstotliwość obserwacji.", "status": "Kanon"},
{"id": "SRM-B60", "name": "Wysunięcie narzędzi i skalowanie poziome wykresu", "kind": "interaction", "section": "charts", "trigger": "Wstążka C85 / Enter / Spacja", "parameters": "320 ms, cubic-bezier(.22,1,.36,1); szerokość 0 → 6 rem (dwie kolumny ikon i delikatne odstępy). Reduced motion: natychmiast.", "description": "Panel i wykres dzielą stałą szerokość karty. Zmienia się jedynie rozkład miejsca i geometria w osi X. Wysokość grafiki zależy od całej karty, nie od zwężającej się kolumny. Skalowane są współrzędne geometrii, gradienty i położenia osi. Napisy, węzły i znaczniki leżą w osobnej warstwie ekranowej: stały rozmiar w rem, koła o proporcji 1:1; bez rozciągania przez transformację SVG, także w trakcie animacji i po ponownym zamknięciu panelu. Gęste etykiety dat pomijane wizualnie, bez usuwania znaczników lub danych; pełna data na kursorze. Górny i lewy panel mogą być otwarte jednocześnie; niezależne otwieranie i zwijanie, bez resetowania zakresu, prognoz i sprawdzalności. Panel pozostaje otwarty przy pracy na wykresie. Zamyka go własna wstążka lub Escape z fokusem w środku. Brak pinezki i zapisu przypięcia. Ukryte elementy inert.", "status": "Kanon"},

{"id": "SRM-B58", "name": "Wysunięcie panelu nad wykresem", "kind": "interaction", "section": "charts", "trigger": "Wstążka C82", "parameters": "320 ms, cubic-bezier(.22,1,.36,1); wysokość panelu od 0 do naturalnej, odejmowana w każdej klatce od wysokości wykresu; treść translateY -0,75 rem → 0. Reduced motion: natychmiast.", "description": "Domyślnie zamknięty. Rozwinięcie płynnie odbiera grafice dokładnie wysokość panelu, proporcjonalnie ściskając geometrię tylko w pionie; oś czasu, suwak i dół karty pozostają nieruchome; ta sama wstążka przy prawej krawędzi podąża za panelem. Panel pozostaje otwarty przy klikaniu wykresu lub drugiego panelu. Ta sama wstążka lub Escape wewnątrz chowa panel; bez trybu przypięcia. Wskazanie checkboxa nie zamyka panelu. Ukryte kontrolki są inert i poza tabulatorem; Escape oddaje fokus wstążce bez przewijania. Zmiana widoczności nie resetuje opcji ani zakresu wykresu. Bez zasłaniania danych i bez wymuszonego scrolla.", "status": "Kanon"},

{"id": "SRM-B57", "name": "Etykiety podążające za punktami", "kind": "interaction", "section": "charts", "trigger": "Ruch kursora lub strzałki w aktywnym wykresie", "parameters": "Aktualizacja raz na klatkę, bez opóźnienia wartości i położenia. Pojawienie 140 ms; reduced motion bez animacji. Odstęp od osi 1,125 rem; blok 12 rem, ograniczony do 44% pola. Wspólna data bez słowa Data: 0,5 rem od szczytu pola kursora. Pionowa linia wypełnia cały wykres do osi czasu. Brak zewnętrznych pasów nad i pod wykresem. Etykiety omijają również obszar prawej wstążki kontrolnej. Wewnętrzny odstęp od obrysu 0,5 rem; blok wartości 3 rem, ze sprawdzalnością 4 rem; odstęp między etykietami 0,75 rem. Geometria uwzględnia kompaktowe miejsce na tekst wewnątrz pola, bez zmiany wysokości przy hoverze.", "description": "Nazwy są powiązane z benchmarkiem. Wartości demonstracyjne odczytywane z tej samej geometrii co punkty, przed transformacją zoomu; nie zmieniają się dla tej samej pozycji danych po zmianie zakresu. Data wskazuje najbliższą widoczną obserwację w formacie interwału. Etykiety przechodzą na lewo, jeśli po prawej brakuje miejsca. Układ wyklucza cały obrys wykresu spod tekstu, także po zoomie. Górna prognoza powyżej korytarza, dolna poniżej. Centralna po przeciwnej wolnej stronie, przy krawędzi pod dolną etykietą. W historii porównawczej wyższa wartość nad wstęgą, niższa pod nią; po przecięciu krzywych role zamieniają położenie. Etykiety nie mają prowadnic; znaczniki pozostają na rzeczywistych punktach. Rezerwa jest stała, więc hover nie przesuwa osi czasu ani suwaka. Data jest zawsze w jednej stałej górnej strefie przy osi kursora: historia, prognoza, sprawdzalność i dowolna kombinacja checkboxów. Porusza się płynnie tylko w poziomie, synchronicznie z kursorem raz na klatkę; bez osobnej animacji powodującej opóźnienie. Jednolity font i format interwału nie zależą od serii ani checkboxów. Przy prawej krawędzi przechodzi na lewo bez zmiany wysokości. Nie jest powtarzana w etykietach wartości. W sprawdzalności obie wartości śledzą swoje krzywe, a delta oznacza prognoza minus kurs. Nie obliczamy procentowej trafności. Demo nie jest integracją cen i nie tworzy prognozy modelu. Docelowo adapter danych zastąpi ilustracyjne odwzorowanie i zdefiniuje politykę odczytu ticków.", "status": "Kanon"},
{"id": "SRM-B56", "name": "Przedział czasu → znacznik daty", "kind": "interaction", "section": "charts", "trigger": "Poziomy ruch kursora na wykresie lub osi czasu; strzałki kursora", "parameters": "Pas i łącznik: crossfade 180 ms cubic-bezier(.22,.75,.25,1). Znacznik: skala ×1,15 i otoczka 0,3125 rem jak C23. Reduced motion: bez animacji i skalowania.", "description": "Między datami wyróżniony jest rzeczywisty przedział ograniczony dwoma sąsiednimi znacznikami. Pas nie podąża geometrycznie za kursorem: granice zawsze odpowiadają datom, a kolejne przedziały płynnie zmieniają krycie. Mocny akcent daty uruchamia się w wąskiej strefie przy znaczniku (14% szerokości przedziału, maks. 10 jednostek viewBox) albo po bezpośrednim najechaniu na punkt lub tekst daty. Punkt kursora pozostaje na krzywej i nie przeskakuje do znacznika. Obsługa historii, prognozy, sprawdzalności i niezależnego zoomu obu stron. Wyjście, scroll, zmiana interwału/zakresu, resize lub Escape usuwają podświetlenie. Brak trwałego zaznaczenia.", "status": "Kanon"},
{"id": "SRM-B55", "name": "Rozwinięcie historycznej wstęgi delty", "kind": "interaction", "section": "charts", "trigger": "Checkbox Sprawdzalność", "parameters": "520 ms, ease-out cubic, odkrywanie od daty granicznej w lewo. Po rozpoczęciu widoku prognoz czeka na zakończenie centrowania; reduced motion natychmiast.", "description": "Dodatkowa linia pokazuje wcześniejsze prognozy zestawione z rzeczywistym kursem dla tych samych dat. Wstęga wypełnia tylko różnicę prognoza minus obserwacja. Im mniejsza pionowa odległość, tym mniejszy błąd. Środek i przyszła prognoza pozostają bez zmian. Lewy suwak skaluje wspólnie kurs, prognozę historyczną, punkty i wstęgę. Prawy suwak nie zmienia lewej strony. Zmiana interwału zachowuje włączone warstwy. Przebiegi demonstracyjne nie są wynikiem modelu; brak wyliczanej trafności procentowej. Docelowe dane wymagają daty prognozowania, daty docelowej, horyzontu, jednostki, wersji modelu i obserwacji; bez użycia przyszłych danych przy rekonstrukcji prognozy. Brak pary danych oznacza lukę, nie zerową deltę. Po pełnym rozwinięciu wstęgi kursor prowadzi dwa punkty w historii: rzeczywisty i prognozowany. Oba korzystają z rzeczywistych ścieżek SVG oraz wspólnej pozycji X, także po zoomie i zmianie interwału. Wyłączenie warstwy usuwa dodatkowy punkt. Po przejściu na przyszłość pozostają trzy punkty korytarza.", "status": "Kanon"},
{"id": "SRM-B54", "name": "Rozwinięcie korytarza prognozy", "kind": "interaction", "section": "charts", "trigger": "Checkbox Prognozy", "parameters": "520 ms, ease-out cubic, jeden postęp animacji dla geometrii i osi czasu. Reduced motion: zmiana natychmiastowa. Możliwość odwrócenia trwającego przejścia.", "description": "Po włączeniu pełna historia zajmuje lewą połowę, ostatnia ujawniona data trafia na środek, a kolejne pięć demonstracyjnych okresów tworzy prawą połowę. Trzy linie łączą się bez uskoku. Historia i prognoza mają wspólny układ współrzędnych Y. Punkt łączenia pozostaje zawsze dokładnie w 50% szerokości pola wykresu, także podczas przeciągania i po puszczeniu uchwytu. Lewy uchwyt zmienia wyłącznie zakres historii, prawy wyłącznie horyzont prognozy. Obie połowy mają niezależną skalę czasu i wspólną stałą skalę Y. Uchwyty nie przekraczają ostatniej obserwacji; minimum jeden pełny odstęp czasu po każdej stronie. Oś dat, kursor i hover korzystają z tego samego dwuczęściowego odwzorowania. Reset przywraca pełny zakres obu części. Wyłączenie przywraca wcześniejszy zakres historii. Kursor śledzi historię, a w prognozie prowadzi trzy zsynchronizowane punkty po górnej, centralnej i dolnej linii; hover dat korzysta z aktualnego zakresu. Przebieg demonstracyjny nie definiuje modelu, kwantyli, poziomu ufności ani statystycznego maksimum lub minimum; parametry te wymagają osobnego kontraktu danych.", "status": "Kanon"},
{"id": "SRM-B53", "name": "Zmiana szerokości i przesuwanie zakresu czasu", "kind": "interaction", "section": "charts", "trigger": "Przeciąganie uchwytów lub środka zakresu, klawiatura albo przycisk Pełny zakres", "parameters": "Aktualizacja raz na klatkę. Podczas drag ciągłe powiększenie osi X, po puszczeniu dopasowanie do jednostki czasu. Minimum jeden odstęp, czyli dwa znaczniki. Uchwyty nie mogą się krzyżować.", "description": "Data początku jest wyśrodkowana pod lewym uchwytem, a data końca pod prawym. Obie współdzielą współrzędną poziomą ze swoim uchwytem i podążają za nim podczas przeciągania oraz zmiany klawiaturą. Lewy uchwyt zmienia początek, prawy koniec zakresu; rozsunięcie pokazuje szerszą historię. W trybie prognozy SRM-B54 utrzymuje datę łączenia na środku; lewy uchwyt skaluje tylko historię, prawy tylko prognozę, a każdy zachowuje jeden odstęp czasu od daty łączenia. Miniatura stale obejmuje cały zakres. Krzywa jest skalowana poziomo i przycinana do pola wykresu, bez zmiany skali pionowej. Widoczne daty i hover B52 odpowiadają wybranemu fragmentowi, kursor B51 pozostaje na krzywej. Strzałki o jeden okres, Shift o dwa; Home/End do dopuszczalnej granicy. Dotyk ma obszar 2,75 rem. Ruch wynika wyłącznie z działania użytkownika, bez automatycznej animacji i bez przewijania strony. Przeciągnięcie środka zaznaczonego okna przesuwa jednocześnie obie granice bez zmiany szerokości; kursor grab/grabbing. Wykres, daty i punkty kursora aktualizują się na bieżąco. Ruch zatrzymuje się na krańcach dostępnych danych. W prognozach zachowuje co najmniej jeden okres po każdej stronie punktu łączenia, który nadal pozostaje centralnie. Obsługa myszy, dotyku i klawiatury: strzałki, Shift, Home/End. Pełny zakres nie przesuwa się.", "status": "Kanon"},
{"id": "SRM-B52", "name": "Wyróżnienie czasu pod kursorem", "kind": "interaction", "section": "charts", "trigger": "Poziomy ruch kursora na wykresie, strzałki klawiatury lub najechanie na znacznik osi czasu", "parameters": "C23: kropka ×1,15, otoczka 0,3125 rem w blue-soft; data z tłem blue-soft i tekstem Deep Ocean, rozmiar fontu bez zmiany. Przejścia 180–240 ms.", "description": "Dwa poziomy wyróżnienia wg SRM-B56: między datami podświetlenie przedziału, blisko daty mocniejszy punkt i delikatne niebieskie tło etykiety. Znacznik nie jest wybierany w połowie odstępu. Punkt na krzywej pozostaje płynny. Wyjście, scroll, resize, zmiana interwału/zakresu, utrata fokusu lub Escape usuwają efekt. Ten sam wzorzec dla dni, miesięcy i lat. Reduced motion pozostawia akcent bez animacji i skalowania.", "status": "Kanon"},
{"id": "SRM-B51", "name": "Płynne śledzenie linii wykresu", "kind": "interaction", "section": "charts", "trigger": "Wejście i ruch wskaźnika w polu wykresu; fokus klawiatury", "parameters": "Jedno odświeżenie na klatkę requestAnimationFrame, bez opóźnienia pozycji. Pojawienie i wygaszenie 140 ms ease-out.", "description": "Współrzędna pozioma kursora wyznacza punkt na rzeczywistej krzywej SVG; współrzędna pionowa wynika z krzywej. Obie linie przecinają się w punkcie centralnym. W części prognozy trzy punkty śledzą górną, centralną i dolną krzywą w tej samej chwili czasu. Punkt górny i dolny powstają z geometrii faktycznie wyświetlanych granic, także po niezależnym powiększeniu prawej połowy. W historii i dokładnie w punkcie łączenia pozostaje jeden punkt. Stałe kotwice data-chart-anchor: upper, central, lower są powiązane z otwartymi etykietami SRM-C80. Ruch ciągły, bez skoków między datami. Pozioma linia jest ograniczona do pola wykresu, a pionowa dochodzi do wspólnej daty w górnej strefie; punkt zachowuje pełny obrys przy końcach linii. Wyjście, scroll, zmiana rozmiaru lub interwału ukrywają nakładkę. Strzałki w lewo/prawo przesuwają o 2%, Shift o 10%; Escape ukrywa. Dotyk: chwilowy podgląd bez blokowania przewijania. Reduced motion usuwa wygaszanie. Wartości demonstracyjne prezentuje SRM-C80.", "status": "Kanon"},
{"id": "SRM-B50", "name": "Zmiana interwału etykiet czasu", "kind": "layout", "section": "charts", "trigger": "Wybór dzienny / miesięczny / roczny w podglądzie", "parameters": "Stałe położenie punktów. Format ze spacjami i zerami wiodącymi. Tekst 0,6875 rem, jak w osi lat wykresu słupkowego.", "description": "Punkty i łącznik przejmują wzorzec C23. Na wąskim ekranie przewija się poziomo cały wykres z osią; daty nie zawijają się ani nie nakładają. Przełącznik demonstracyjny zmienia przykładowe daty, nie przelicza cen i nie przesuwa strony.", "status": "Kanon"},
{"id": "SRM-B49", "name": "Responsywna linia z wygaszeniem wypełnienia", "kind": "layout", "section": "charts", "trigger": "Wyświetlenie i zmiana szerokości kontenera", "parameters": "Szerokość 100%, wspólny budżet wysokości minimum 32 rem przed otwarciem panelu; pole rysowania od górnej krawędzi do osi czasu, bez zewnętrznych rezerw dla etykiet. Linia 0,125 rem; gradient pionowy 18% → 8% → 0%.", "description": "Krzywa i wypełnienie skalują się wspólnie; grubość linii pozostaje czytelna. Tekst i okrągłe znaczniki nie podlegają nierównomiernemu skalowaniu. Punkt ostatniej obserwacji 0,625 rem, punkty sprawdzalności 0,4375 rem; zawsze szerokość równa wysokości. Napisy Ostatnie dane, Górna, Centralna i Dolna: 0,6875 rem, interlinia 1,4, stałe proporcje liter. Zasada obowiązuje przy obu panelach, zoomie czasu oraz zmianie rozmiaru kontenera. Krzywa pozostaje nieruchoma. Nakładka C73 śledzi wskaźnik według B51. Interwał w demonstratorze zmienia etykiety osi czasu. Kształt jest wyłącznie wzorcem wizualnym.", "status": "Kanon"},
{"id": "SRM-B47", "name": "Dokowanie przy czterech krawędziach", "kind": "interaction", "section": "navigation", "trigger": "Wybór pozycji menu", "parameters": "Wygaszenie 160 ms, zmiana krawędzi, pojawienie 160 ms. Zachowany wybór pozycji i przypięcie.", "description": "Lewa i prawa: tekstowe menu pionowe. Góra i dół: poziome ikony. Bez dowolnych współrzędnych i osobnego okna. Reduced motion: natychmiast.", "status": "Kanon"},
{"id": "SRM-B48", "name": "Subtelny hover symbolu menu", "kind": "animation", "section": "motion", "trigger": "Hover wstążki / pozycji Docka", "parameters": "Wstążka: symbol 1,07; Dock: ikona z polem 1,08. 220 ms cubic-bezier(.22,1,.36,1).", "description": "Bez zmiany układu. Fokus widoczny obrysem. Na dotyku brak efektu zależnego od hover. Reduced motion usuwa skalowanie.", "status": "Kanon"},
{"id": "SRM-B44", "name": "Płynne wysuwanie menu", "kind": "animation", "section": "motion", "trigger": "Kliknięcie wstążki / Enter / Spacja", "parameters": "360 ms; cubic-bezier(.22,1,.36,1); ruch w osi X lub Y względem wybranej krawędzi.", "description": "Panel i wstążka przesuwają się razem. Ten sam przełącznik otwiera i zamyka. Reduced motion usuwa animację.", "status": "Kanon"},
{"id": "SRM-B45", "name": "Przypięcie menu w oknie", "kind": "interaction", "section": "navigation", "trigger": "Przypnij / Odepnij", "parameters": "Pionowo 17 rem rezerwowane powyżej 55 rem. Poziomo odstęp odpowiada wysokości Docka. Stan lokalny makiety.", "description": "Przypięty panel pozostaje po kliknięciu poza nim i wyborze pozycji. Odepnij pozostawia go otwartym. Zwijanie wstążką także odpina. Pozycja pozostaje zapamiętana do następnego otwarcia.", "status": "Kanon"},
{"id": "SRM-B46", "name": "Menu pod kontrolą użytkownika", "kind": "interaction", "section": "navigation", "trigger": "Wstążka / kliknięcie poza panelem / Escape", "parameters": "Poza panelem i Escape zamykają nieprzypięte menu. Wstążka zamyka zawsze. Fokus wraca bez scrolla.", "description": "Ukryte elementy są inert. Wstążka zawsze pozostaje dostępna. Lista przewija się pomiędzy belką a profilem. Hover nie otwiera menu samoczynnie.", "status": "Kanon"},
{"id": "SRM-B41", "name": "Sekwencja powitania", "kind": "interaction", "section": "assistant", "trigger": "Pierwsze pokazanie raportu danego dostawcy", "parameters": "650 ms po widoczności czatu → pisanie 1800 ms → powitanie.", "description": "Jedna przygotowana wiadomość po metryczce i analizie. Zmiana roku, awatara, zwinięcie lub odpięcie nie powtarzają sekwencji. Reset po zmianie dostawcy; w bibliotece przycisk odtwarzania. Bez połączenia z AI.", "status": "Kanon"},
{"id": "SRM-B42", "name": "Wejście chmurki", "kind": "animation", "section": "motion", "trigger": "Pojawienie się powitania / wskaźnika pisania", "parameters": "420 ms / 260 ms; translateY 0,625 rem → 0; skala 0,98 → 1; opacity 0 → 1; cubic-bezier(.22,1,.36,1).", "description": "Płynne wejście z lewego dolnego kierunku; trzy kropki ustępują całej wiadomości. Reduced motion wyłącza ruch oraz puls kropek, bez utraty treści.", "status": "Kanon"},
{"id": "SRM-B43", "name": "Przewijanie rozmowy pod kontrolą", "kind": "interaction", "section": "assistant", "trigger": "Nowa wiadomość w czacie", "parameters": "Przewijany wyłącznie transcript. Bez zmiany scrolla strony i fokusu. Margines 1 rem.", "description": "Automatycznie odsłania wiadomość, dopóki użytkownik nie wróci do wcześniejszej treści. Wtedy pojawia się „Nowa wiadomość”. Długi tekst na małym ekranie odsłania od początku. Ograniczony ruch: przewinięcie bez animacji.", "status": "Kanon"},
{"id": "SRM-B40", "name": "Blokada niedostępnego raportu", "kind": "interaction", "section": "radar", "trigger": "Potwierdzony status rejestrowy lub standard sprawozdania", "parameters": "Blur 0,35 rem; neutralne tło bez danych; inert i aria-hidden; czytelny komunikat ponad warstwą. Bez animacji wejścia.", "description": "Wykreślenie > likwidacja > MSR. Dla likwidacji i wykreślenia brak danych szczegółowych i KYS. MSR pozostawia rejestr i KYS. Ten sam komunikat w asystencie, również odpiętym. Zmiana dostawcy zeruje kontekst.", "status": "Kanon"},
  {
    "id": "SRM-B01",
    "name": "Powiększenie przycisku",
    "kind": "motion",
    "section": "controls",
    "trigger": "Hover / fokus",
    "parameters": "1,03 · 220 ms",
    "description": "Skala płynna bez przesunięcia sąsiadów. Disabled bez ruchu.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B02",
    "name": "Powiększenie tekstu",
    "kind": "motion",
    "section": "controls",
    "trigger": "Hover / fokus",
    "parameters": "1,025 · 220 ms",
    "description": "Delikatne powiększenie tekstowej akcji lub zakładki.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B03",
    "name": "Powiększenie kapsuły",
    "kind": "motion",
    "section": "selection",
    "trigger": "Hover / fokus",
    "parameters": "1,06 · 220 ms",
    "description": "Akcent pojedynczej kapsuły roku.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B04",
    "name": "Powiększenie ikony",
    "kind": "motion",
    "section": "assistant",
    "trigger": "Hover / fokus",
    "parameters": "1,07 · 220 ms",
    "description": "Akcent kontrolki ikonowej.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B05",
    "name": "Powiększenie pola",
    "kind": "motion",
    "section": "controls",
    "trigger": "Hover / fokus",
    "parameters": "1,015 · 220 ms",
    "description": "Subtelny akcent pola lub selektora.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B06",
    "name": "Powiększenie wiersza",
    "kind": "motion",
    "section": "selection",
    "trigger": "Hover",
    "parameters": "1,008 · 220 ms",
    "description": "Szeroki wiersz rośnie od lewej strony.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B07",
    "name": "Powiększenie słupka",
    "kind": "motion",
    "section": "history",
    "trigger": "Hover / fokus",
    "parameters": "1,045 · 240 ms",
    "description": "Skalowanie warstwy graficznej; obszar trafienia pozostaje stabilny.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B08",
    "name": "Powiększenie sektora",
    "kind": "motion",
    "section": "radar",
    "trigger": "Hover / fokus",
    "parameters": "1,20 · 200 ms",
    "description": "Wycinek i cała etykieta z wartościami rosną jednocześnie.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B09",
    "name": "Wachlarz startowy",
    "kind": "motion",
    "section": "radar",
    "trigger": "Wczytanie + wejście w widok",
    "parameters": "6 kroków co 480 ms · aktywność 280 ms",
    "description": "Od wyniku netto zgodnie z ruchem wskazówek zegara. Interakcja przerywa sekwencję.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B10",
    "name": "Ograniczony ruch",
    "kind": "accessibility",
    "section": "motion",
    "trigger": "Preferencja systemowa",
    "parameters": "prefers-reduced-motion",
    "description": "Wyłącza skalowanie, puls i sekwencje, zachowując dostęp do funkcji.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B11",
    "name": "Widoczny fokus",
    "kind": "accessibility",
    "section": "motion",
    "trigger": "Klawiatura",
    "parameters": "Light #66B2FF",
    "description": "Widoczna obwódka aktywnej kontrolki. Wymiary zależą od danego komponentu.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B12",
    "name": "Pojedynczy rok",
    "kind": "selection",
    "section": "selection",
    "trigger": "Wybór kapsuły",
    "parameters": "1 rok w danym zestawie",
    "description": "Pokazuje tylko dostępne lata i utrzymuje jeden wybór.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B13",
    "name": "Niezależne okresy",
    "kind": "selection",
    "section": "selection",
    "trigger": "Zmiana zakładki / wskaźnika",
    "parameters": "Osobny rok na obszar lub wskaźnik",
    "description": "Rok wybrany w jednym obszarze nie zmienia pozostałych.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B14",
    "name": "Wybór grupowy",
    "kind": "selection",
    "section": "selection",
    "trigger": "Checkbox kategorii",
    "parameters": "brak / część / wszystkie",
    "description": "Można zaznaczyć całą kategorię lub pojedyncze wskaźniki.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B15",
    "name": "Otwarcie historii",
    "kind": "navigation",
    "section": "history",
    "trigger": "Klik / Enter / Spacja",
    "parameters": "Ten sam wskaźnik i okres",
    "description": "Otwiera wspólne okno z historią danych wybranego elementu.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B16",
    "name": "Porównanie radialne",
    "kind": "data",
    "section": "radar",
    "trigger": "Włączenie porównania",
    "parameters": "Wypełnienie + przerywany łuk",
    "description": "Łuk oznacza odniesienie; wypełnienie wartość porównywanego okresu.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B17",
    "name": "Chronologia odcieni",
    "kind": "appearance",
    "section": "history",
    "trigger": "Render danych",
    "parameters": "32% → 100% udziału Deep Ocean",
    "description": "Odcień ciemnieje z chronologią. Nie oznacza oceny finansowej.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B18",
    "name": "Odczyt interaktywny",
    "kind": "data",
    "section": "history",
    "trigger": "Hover / fokus / klik",
    "parameters": "Pełna wartość i rok",
    "description": "Wskazanie roku aktualizuje panel odczytu bez zmiany danych.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B19",
    "name": "Zmiana wykres–tabela",
    "kind": "navigation",
    "section": "history",
    "trigger": "Przełącznik widoku",
    "parameters": "Wspólne dane",
    "description": "Widok się zmienia, zestaw lat i wartości pozostaje ten sam.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B20",
    "name": "Okno w centrum",
    "kind": "layout",
    "section": "history",
    "trigger": "Otwarcie / rozmiar okna",
    "parameters": "Środek widocznego obszaru",
    "description": "Wykres dopasowuje wysokość do okna. Kontrolki znajdują się w belce.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B21",
    "name": "Powrót fokusu",
    "kind": "accessibility",
    "section": "history",
    "trigger": "Zamknięcie / Escape",
    "parameters": "Powrót do wyzwalacza",
    "description": "Zamknięcie okna lub menu oddaje fokus kontrolce, która je otworzyła.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B22",
    "name": "Kopia do arkusza",
    "kind": "data",
    "section": "history",
    "trigger": "Skopiuj do schowka",
    "parameters": "TSV · wszystkie lata",
    "description": "A rok, B wartość, C jednostka, D informacja. Sukces lub ręczny fallback.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B23",
    "name": "Zmiana awatara",
    "kind": "selection",
    "section": "assistant",
    "trigger": "Menu z trzema kropkami",
    "parameters": "Mężczyzna ↔ Anna",
    "description": "Zmienia personę i nagłówek; zachowuje szkic i kontekst.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B24",
    "name": "Wstążka boczna",
    "kind": "motion",
    "section": "assistant",
    "trigger": "Zwiń / rozwiń",
    "parameters": "280 ms schowanie · 320 ms wysunięcie",
    "description": "Widget przesuwa się do prawej krawędzi. Wstążka pozwala go przywrócić.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B25",
    "name": "Puls powitalny",
    "kind": "motion",
    "section": "assistant",
    "trigger": "Po zakończeniu wsunięcia / wysunięcia",
    "parameters": "1,091 · 680 ms × 2",
    "description": "Pulsuje widoczny awatar. Nie uruchamia się bez końca.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B26",
    "name": "Odpięcie z kontekstem",
    "kind": "window",
    "section": "assistant",
    "trigger": "Kontrolka odpięcia",
    "parameters": "Wspólny właściciel stanu",
    "description": "Osobne okno dzieli personę, szkic i kontekst. Prototyp; trwałość sesji do ustalenia.",
    "status": "Częściowo"
  },
  {
    "id": "SRM-B27",
    "name": "Podsumowanie z danych",
    "kind": "data",
    "section": "assistant",
    "trigger": "Zmiana dostawcy / roku",
    "parameters": "Stały szablon bez LLM",
    "description": "Nazwa, rok, przychody, wynik netto, płynność, marża i zobowiązania.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B28",
    "name": "Menu z powrotem",
    "kind": "navigation",
    "section": "assistant",
    "trigger": "Trzy kropki / Escape / poza menu",
    "parameters": "Otwórz → wybierz → wróć",
    "description": "Po wyborze lub zamknięciu fokus wraca do kontrolki menu.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B29",
    "name": "Rozróżnienie braku i zera",
    "kind": "data",
    "section": "history",
    "trigger": "Render wartości",
    "parameters": "0 ≠ brak danych",
    "description": "Brak wartości ma opis i puste pole w eksporcie. Zaraportowane zero pozostaje zerem.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B30",
    "name": "Pusta kolumna po zwinięciu",
    "kind": "layout",
    "section": "assistant",
    "trigger": "Schowanie widgetu",
    "parameters": "Zachowana szerokość kolumny",
    "description": "Radar nie rozciąga się na miejsce asystenta; pozostaje wolna przestrzeń.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B31",
    "name": "Akcent belki roku",
    "kind": "motion",
    "section": "history",
    "trigger": "Hover wiersza tabeli",
    "parameters": "1,035 · 220 ms",
    "description": "Pozioma belka roku lekko się powiększa.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B32",
    "name": "Akcent znacznika roku",
    "kind": "motion",
    "section": "history",
    "trigger": "Hover słupka",
    "parameters": "1,15 · 240 ms",
    "description": "Powiększa punkt na osi roku. Wybrany okres ma dodatkową obwódkę.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B33",
    "name": "Kolor kontekstowy logotypu",
    "kind": "appearance",
    "section": "icons",
    "trigger": "Wybór kontekstu lub koloru znaku",
    "parameters": "Jeden kolor · bez animacji i deformacji",
    "description": "SpendGuru zmienia kolor wszystkich ścieżek przy zachowaniu geometrii. Profitia domyślnie używa oryginalnych barw; wariant monochromatyczny jest oddzielnym podglądem do uzgodnienia. PORR zachowuje oba kolory źródłowe i nie podlega przełączaniu palety.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B34",
    "name": "Statyczny znak karty",
    "kind": "appearance",
    "section": "icons",
    "trigger": "Wyświetlenie znaku karty przeglądarki",
    "parameters": "Proporcje 1:1 · brak animacji",
    "description": "Zachowuje biały dysk, niebieski znak i obwódkę. Znak nie pulsuje i nie koduje kondycji dostawcy ani statusu asystenta. Zmiana koloru dotyczy jednocześnie znaku i obwódki; alternatywne kolory są podglądem.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B35",
    "name": "Nawigacja biblioteka–makieta",
    "kind": "navigation",
    "section": "naming",
    "trigger": "Miejsca użycia / Ctrl + klik / tryb wskazywania",
    "parameters": "Definicja ↔ konkretne miejsce użycia",
    "description": "Lista miejsc prowadzi do właściwej zakładki lub okna makiety i wyróżnia element. Ctrl + klik otwiera jego definicję bez wykonania zwykłej akcji. Zwykłe kliknięcie zachowuje funkcję. Odnośniki otwierają interaktywne podglądy MagicPath w nowej karcie; nie synchronizują wyglądu.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B36",
    "name": "Wybór i dodanie wykresu",
    "kind": "interaction",
    "section": "controls",
    "trigger": "Kliknięcie kafla Dodaj wykres",
    "parameters": "Plus: skala 1,07 / 220 ms · tekst 1,025 / 220 ms · bez przesunięcia siatki",
    "description": "Otwiera okno z pozycjami raportu, filtrowaniem i jednym wyborem. Dodanie umieszcza kartę przed kaflem plus. Pozycje już widoczne są nieaktywne. Anuluj i Escape nic nie dodają. Fokus wraca do kafla. Ustawienie makiety trwa do odświeżenia.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B37",
    "name": "Rozwijanie obszaru danych",
    "kind": "interaction",
    "section": "selection",
    "trigger": "Kliknięcie nagłówka / Enter / Spacja",
    "parameters": "Niezależne sekcje · obrót chevronu 180° / 220 ms",
    "description": "Każdy obszar rozwija się niezależnie. Zwijanie nie resetuje zakładek, lat ani własnego zestawu. Odnośnik z biblioteki rozwija sekcję zawierającą wskazany komponent. Ograniczony ruch wyłącza animacje.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B38",
    "name": "Przegląd serii bez wyboru roku",
    "kind": "interaction",
    "section": "history",
    "trigger": "Otwarcie karty w widoku głównym; wskazanie, fokus lub dotknięcie słupka.",
    "parameters": "300 px wysokości karty; brak domyślnie wybranego roku; tooltip poza układem; Escape zamyka odczyt.",
    "description": "Cała seria bez stałego panelu pojedynczej wartości. Wskazanie / fokus pokazuje rok i pełną wartość w dymku; kliknięcie lub dotknięcie przypina odczyt. Przełącznik w belce działa niezależnie dla każdej karty. Powiększenie otwiera pełny widok historii z panelem odczytu.",
    "status": "Kanon"
  },
  {
    "id": "SRM-B39",
    "name": "Pokaż / ukryj PESEL",
    "kind": "interaction",
    "section": "controls",
    "trigger": "Kliknięcie / Enter / Spacja",
    "parameters": "Ikona 18 px; obszar 2,25 rem, dotyk 2,75 rem; hover 1,07 / 220 ms. Bez obwódki; fokus widoczny.",
    "description": "Ikona opisuje akcję: otwarte oko — pokaż ukryty PESEL; zamknięte — ukryj pokazany. Dostępna nazwa opisuje akcję Pokaż/Ukryj. Zmiana dotyczy pojedynczego numeru. Brak wartości pozostawia maskę i podaje komunikat. Nie zmienia uprawnień ani nie pobiera danych. W bibliotece demonstrator PRZYKŁAD, w makiecie bez rzeczywistych PESEL-i.",
    "status": "Kanon"
  }
];
export const fontRoles = [
{"id": "SRM-T33", "name": "Skróty zakresu czasu", "size": 13, "weight": 400, "lineHeight": "1.5", "color": "#003366", "sample": "1M  3M  6M  1Y  3Y  5Y  All", "notes": "C86: 0,8125 rem, grubość 400; aktywna pozycja 700. Wyśrodkowanie na wspólnej osi, bez ramki, tła, cienia lub zmiany wielkości. Fokus klawiatury podkreśla tekst. Rozmiar w rem, niezależny od skalowania SVG.", "family": "Inter, Arial, sans-serif"},
{"id": "SRM-T32", "name": "Tekst panelu sterowania wykresem", "size": 13, "weight": 400, "lineHeight": "1.5", "color": "#003366", "sample": "Prognozy", "notes": "Etykiety opcji: 0,8125 rem / 400. Bez widocznego tytułu i tekstu przy pinezce. Pierwszy wiersz: Prognozy i Sprawdzalność. Dwa kolejne wiersze pozostają puste. Wszystkie rozmiary względne, interlinia 1,5. Wstążka ma sam symbol i opis dostępności.", "family": "Inter, Arial, sans-serif"},

{"id": "SRM-T31", "name": "Lekka etykieta notowania", "size": 18, "weight": 400, "lineHeight": "1.2", "color": "#003366", "sample": "9 874,32 PLN/t", "notes": "Wartość: 1,125 rem / 400. Nazwa: 0,75 rem / 400. Wspólna data u góry: 0,8125 rem / 400, interlinia 1,4, tabular nums; bez nagłówka Data. Identyczna czcionka dla historii, wstęgi i prognoz. Jednostka i metadane: 0,6875 rem / 400. Tabular nums, delikatna biała poświata tekstu zamiast powierzchni karty. Backtest: ciemny piaskowy #7B613A. Bez bold.", "family": "Inter, Arial, sans-serif"},
{"id": "SRM-T29", "name": "Tekst menu i Docka", "size": 14, "weight": 500, "lineHeight": "1.5", "color": "#E1ECF5", "sample": "Dostawcy", "notes": "Pozycje pionowe 0,875 rem / 500; aktywne 600. Przypnij 0,75 rem. Tytuł pionowy 1,5 rem, poziomy 0,875 rem. Wstążka bez tekstu; opis dostępny i tooltip.", "family": "Inter, Arial, sans-serif"},
{"id": "SRM-T30", "name": "Profil menu bocznego", "size": 14, "weight": 600, "lineHeight": "1.4", "color": "#F8F9FA", "sample": "Adam Kowalski", "notes": "0,875 rem. Etykieta Twoje konto: 0,6875 rem / 400 / #B5CDE2. Długie nazwisko zawija się; nigdy nie znika.", "family": "Inter, Arial, sans-serif"},
  {
    "id": "SRM-T01",
    "name": "Akcja",
    "size": 12,
    "weight": 500,
    "lineHeight": "1.5",
    "color": "#005A9C",
    "sample": "Pokaż dane",
    "notes": "Przyciski, linki, zakładki. Kontekst stopki: 11 px; wąski widok może redukować rozmiar.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T02",
    "name": "Metadane stopki",
    "size": 11,
    "weight": 400,
    "lineHeight": "24px",
    "color": "#526A82",
    "sample": "Sprawozdanie 2025",
    "notes": "Stopka karty: wspólna linia i pionowy środek. Węższe warianty 9–10 px pozostają do audytu.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T03",
    "name": "Nazwa wskaźnika",
    "size": 14,
    "weight": 600,
    "lineHeight": "1.4",
    "color": "#003366",
    "sample": "Płynność bieżąca",
    "notes": "Na wąskim ekranie 13 px. Tytuł bez ikon i etykiet.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T04",
    "name": "Wartość karty",
    "size": 22,
    "weight": 550,
    "lineHeight": "1.5",
    "color": "#003366",
    "sample": "1,6×",
    "notes": "Cyfry tabelaryczne. Brak danych: 13 px, kolor stonowany.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T05",
    "name": "Definicja i znaczenie",
    "size": 11,
    "weight": 400,
    "lineHeight": "1.7",
    "color": "#526A82",
    "sample": "Relacja aktywów do zobowiązań.",
    "notes": "Wyróżnienie „Dla kupca”: 600 i #294D70. Wąski wariant 10 px.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T06",
    "name": "Nazwa sektora",
    "size": 16,
    "weight": 650,
    "lineHeight": "22px",
    "color": "#294D70",
    "sample": "Przychody",
    "notes": "SRM-C18: nazwa, kwota i zmiana mają wspólny font 1rem/650. Całość zielona przy korzystnej zmianie, czerwona przy niekorzystnej; spadek kosztów i zadłużenia jest korzystny. SVG skaluje się proporcjonalnie.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T07",
    "name": "Wartość sektora",
    "size": 16,
    "weight": 650,
    "lineHeight": "22px",
    "color": "#003366",
    "sample": "142,00 mln zł",
    "notes": "SRM-C18: nazwa, kwota i zmiana mają wspólny font 1rem/650. Całość zielona przy korzystnej zmianie, czerwona przy niekorzystnej; spadek kosztów i zadłużenia jest korzystny. SVG skaluje się proporcjonalnie.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T08",
    "name": "Punktacja i zmiana sektora",
    "size": 16,
    "weight": 650,
    "lineHeight": "22px",
    "color": "#176747",
    "sample": "90 pkt",
    "notes": "SRM-C18: nazwa, kwota i zmiana mają wspólny font 1rem/650. Całość zielona przy korzystnej zmianie, czerwona przy niekorzystnej; spadek kosztów i zadłużenia jest korzystny. SVG skaluje się proporcjonalnie.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T09",
    "name": "Wartość tabeli",
    "size": 14,
    "weight": 550,
    "lineHeight": "1.5",
    "color": "#003366",
    "sample": "142 000 000,00",
    "notes": "Do prawej, cyfry tabelaryczne. Na wąskim ekranie i w karcie przeglądowej SRM-C51: 12 px.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T10",
    "name": "Nagłówek tabeli",
    "size": 11,
    "weight": 500,
    "lineHeight": "1.5",
    "color": "#526A82",
    "sample": "Wartość",
    "notes": "Kolumna liczb do prawej; rok i jednostka do lewej.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T11",
    "name": "Rok w belce",
    "size": 12,
    "weight": 600,
    "lineHeight": "1",
    "color": "#003366",
    "sample": "2025",
    "notes": "Na ciemnym tle biały tekst. Wyrównanie do środka.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T12",
    "name": "Tytuł okna historii",
    "size": 21,
    "weight": 550,
    "lineHeight": "1.2",
    "color": "#003366",
    "sample": "Przychody",
    "notes": "Wąski widok 18 px. Litery −0,5 px.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T13",
    "name": "Powitanie SpendGuru",
    "size": 14,
    "weight": 650,
    "lineHeight": "1.4",
    "color": "#FFFFFF",
    "sample": spendGuruCopy.greeting.male,
    "notes": "Jedna linia. Adaptacja: clamp(8px, 2.85cqw, 14px); minimalny tekst do audytu.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T14",
    "name": "Wypowiedź SpendGuru",
    "size": 14,
    "weight": 400,
    "lineHeight": "1.6",
    "color": "#294D70",
    "sample": "Przychody wynoszą 142 000 000,00 PLN.",
    "notes": "0,875 rem / 1,6. Ten sam font dla analizy, bulletów i chmurek, również w odpiętym oknie. Wartości wyróżnione wagą 650.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T15",
    "name": "Wiadomość użytkownika",
    "size": 12,
    "weight": 400,
    "lineHeight": "1.6",
    "color": "#003366",
    "sample": "O co chcesz zapytać?",
    "notes": "Etykieta pola: 12 px / 600. Wielowierszowy szkic.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T16",
    "name": "Kontekst asystenta",
    "size": 10,
    "weight": 400,
    "lineHeight": "1.55",
    "color": "#526A82",
    "sample": "Radar 2025 · Płynność",
    "notes": "Opis kontekstu: 8 px. Nagłówki pogrubione.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T17",
    "name": "Wartość na słupku",
    "size": 13,
    "weight": 650,
    "lineHeight": "1.1",
    "color": "#003366",
    "sample": "142",
    "notes": "Jednostka w osobnym wierszu 8 px / 500. Kontrast tekstu zależy od tła.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T18",
    "name": "Odczyt historii",
    "size": 21,
    "weight": 700,
    "lineHeight": "1.25",
    "color": "#003366",
    "sample": "142 000 000,00 zł",
    "notes": "W oknie historii; na małym ekranie 18 px. Podgląd w sekcji: 21 px.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T19",
    "name": "Etykieta roku",
    "size": 11,
    "weight": 400,
    "lineHeight": "16px",
    "color": "#526A82",
    "sample": "2025",
    "notes": "Wybrany rok 700 i granat; jedynie cztery cyfry roku.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T20",
    "name": "Komunikat operacji",
    "size": 11,
    "weight": 400,
    "lineHeight": "1.5",
    "color": "#005A9C",
    "sample": "Skopiowano wszystkie lata.",
    "notes": "Status kopiowania; komunikat dostępny także dla czytnika ekranu.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T21",
    "name": "Nagłówek wzorca",
    "size": 15,
    "weight": 550,
    "lineHeight": "1.5",
    "color": "#003366",
    "sample": "Karta wskaźnika",
    "notes": "W bibliotece 15 px, wąski wariant 14 px. Globalna skala tytułów aplikacji pozostaje otwarta.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T22",
    "name": "Kapsuła roku",
    "size": 11,
    "weight": 400,
    "lineHeight": "1.5",
    "color": "#003366",
    "sample": "2025",
    "notes": "Wybrana kapsuła: biały tekst na #005A9C. Wąski wariant 10 px.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T23",
    "name": "Tożsamość dostawcy",
    "size": 14,
    "weight": 600,
    "lineHeight": "1.45",
    "color": "#003366",
    "sample": "Dostawca przykładowy Sp. z o.o.",
    "notes": "Nad nazwą 8 px / 600, pod nazwą rok 10,5 px. Wąski wariant nazwy 12 px.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T24",
    "name": "Akcja na pełnym tle",
    "size": 12,
    "weight": 500,
    "lineHeight": "1.5",
    "color": "#FFFFFF",
    "sample": "Pokaż dane",
    "notes": "Przycisk główny na tle #005A9C. Warianty na jasnym tle korzystają z SRM-T01.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T25",
    "name": "Odczyt wykresu kompaktowego",
    "size": 17,
    "weight": 600,
    "lineHeight": "1.25",
    "color": "#003366",
    "sample": "542 456,79 tys. zł",
    "notes": "SRM-C47: pełna wartość w panelu odczytu. Nagłówek karty 14 px / 600, lata 9 px; na słupkach kompaktowych bez powtarzania cyfr, szczegóły po wskazaniu.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T26",
    "name": "Etykiety wykresu przeglądowego",
    "size": 14,
    "weight": 600,
    "lineHeight": "1.35",
    "color": "#003366",
    "sample": "Wynik finansowy netto",
    "notes": "SRM-C51: nazwa 14 px / 600, maks. 2 wiersze; zakres i jednostka 10 px / 400; lata 9 px / 400; dymek 10 px (rok 400, wartość 600). Cyfry tabelaryczne. Bez stałego panelu odczytu.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T27",
    "name": "Treść raportu KYS",
    "size": 13,
    "weight": 400,
    "lineHeight": "1.55",
    "color": "#294D70",
    "sample": "Podatnik VAT czynny: Tak",
    "notes": "Wspólny tekst wartości, opisów i wierszy KYS. Rozmiar w widoku wyrażony w rem. Bez zmniejszania fragmentów small.",
    "family": "Inter, Arial, sans-serif"
  },
  {
    "id": "SRM-T28",
    "name": "Etykieta raportu KYS",
    "size": 13,
    "weight": 600,
    "lineHeight": "1.55",
    "color": "#003366",
    "sample": "Beneficjenci · PEP",
    "notes": "Jednakowe etykiety we wszystkich boksach KYS. Tytuły boksów: SRM-T03, odstęp pod tytułem: 1,25 rem.",
    "family": "Inter, Arial, sans-serif"
  }
];
export const numberFormats = [
{"id": "SRM-N19", "name": "Wartość notowania przy kursorze", "sample": "9 874,32 PLN/t", "rule": "pl-PL: niełamliwa spacja tysięcy, przecinek i dwie cyfry dziesiętne w demonstratorze. Jednostka jawna, bez zgadywania. Delta ma znak +/− i tę samą jednostkę co kurs. Precyzja produkcyjna wynika z benchmarku; brak wartości nigdy nie staje się zerem."},
{"id": "SRM-N16", "name": "Czas wykresu · dzień", "sample": "01 10 2026", "rule": "dd mm rrrr. Dzień i miesiąc dwucyfrowe, rok czterocyfrowy. Pojedyncze spacje, bez kropek i ukośników. Etykieta bez zawijania. Data kalendarzowa bez konwersji strefy czasowej."},
{"id": "SRM-N17", "name": "Czas wykresu · miesiąc", "sample": "01 2026", "rule": "mm rrrr. Miesiąc dwucyfrowy i czterocyfrowy rok rozdzielone spacją. Bez dnia. Etykieta bez zawijania."},
{"id": "SRM-N18", "name": "Czas wykresu · rok", "sample": "2026", "rule": "rrrr. Tylko cztery cyfry roku, bez miesiąca, dnia i separatora tysięcy."},
  {
    "id": "SRM-N01",
    "name": "Bez liczby",
    "sample": "—",
    "rule": "Tekst lub grafika bez własnego formatu liczbowego."
  },
  {
    "id": "SRM-N02",
    "name": "Rok sprawozdania",
    "sample": "2025",
    "rule": "YYYY; bez miesiąca, dnia i separatora tysięcy."
  },
  {
    "id": "SRM-N03",
    "name": "Kwota pełna",
    "sample": "142 000 000,00 PLN",
    "rule": "PLN: 2 miejsca po przecinku, polski separator dziesiętny, odstępy tysięcy. Na wykresie „zł”; w tabeli jednostka w osobnej kolumnie."
  },
  {
    "id": "SRM-N04",
    "name": "Kwota skrócona radaru",
    "sample": "142,00 mln zł",
    "rule": "Mld/mln: 2 miejsca; tys.: 1; kwota poniżej 1000: 0 miejsc. Nie zmienia przechowywanej wartości."
  },
  {
    "id": "SRM-N05",
    "name": "Iloraz radaru",
    "sample": "1,6×",
    "rule": "Jedno miejsce po przecinku i znak ×. Pełna historia: do 6 miejsc."
  },
  {
    "id": "SRM-N06",
    "name": "Procent radaru",
    "sample": "10,0%",
    "rule": "Jedno miejsce; dla bezwzględnej wartości mniejszej niż 1: dwa miejsca. Pełna historia: do 6 miejsc."
  },
  {
    "id": "SRM-N07",
    "name": "Liczba w historii",
    "sample": "1,6 / 10 / 42",
    "rule": "PLN: dokładnie 2 miejsca. Pozostałe wartości: od 0 do 6 miejsc, bez zbędnych zer. Jednostka w nagłówku/kolumnie lub obok wartości."
  },
  {
    "id": "SRM-N08",
    "name": "Wartość słupka",
    "sample": "142 · mln zł",
    "rule": "Kwota skrócona, do 2 miejsc; tysiące do 1. Wartość i jednostka rozdzielone. Pełna liczba w dymku i tabeli."
  },
  {
    "id": "SRM-N09",
    "name": "Punkty radaru",
    "sample": "90 pkt",
    "rule": "Liczba całkowita na etykiecie. Punktacja ilustracyjna nie definiuje progów finansowych."
  },
  {
    "id": "SRM-N10",
    "name": "Dane do arkusza",
    "sample": "2025\t142000000,00\tPLN",
    "rule": "TSV. Bez separatorów tysięcy i jednostki w polu liczby. Oryginalna precyzja, jeśli dostępna."
  },
  {
    "id": "SRM-N11",
    "name": "Brak danych i zero",
    "sample": "Brak danych / 0",
    "rule": "Brak to osobny stan. Nie zastępuj go zerem. Minus przy wartościach ujemnych pozostaje widoczny."
  },
  {
    "id": "SRM-N12",
    "name": "Kwota sprawozdania w tysiącach",
    "rule": "Zachowana jednostka raportu: tys. zł. Dwie cyfry po przecinku, separator tysięcy i cyfry tabelaryczne. Oś może użyć mln zł; odczyt i eksport zachowują tys. zł. Brak danych ≠ 0.",
    "sample": "2 045 878,34 tys. zł",
    "notes": "Zachowana jednostka raportu. Tabele: 2 miejsca po przecinku, tabular-nums i wyrównanie do prawej. Oś może użyć mln zł, dymek i eksport nadal podają tys. zł. Zero pozostaje 0,00; brak danych nie jest zerem."
  },
  {
    "id": "SRM-N13",
    "name": "Identyfikatory i daty rejestrowe",
    "sample": "0000258512 · 2006-05-29",
    "rule": "Identyfikatory traktuj jako tekst: zachowaj zera wiodące, brak separatorów tysięcy. Daty i jednostki pozostają zgodne z raportem. Cyfry tabelaryczne."
  },
  {
    "id": "SRM-N14",
    "name": "Maska identyfikatora osoby",
    "sample": "•••••••••••",
    "rule": "Stałe 11 kropek; czytnik: PESEL ukryty. Bezramkowe otwarte oko przy każdym ukrytym numerze. Makieta nie zawiera prawdziwych numerów; rozwinięcie beneficjenta nie ujawnia PESEL."
  },
  {"id":"SRM-N15","name":"Data pobrania raportu","sample":"DD.MM.RRRR, GG:MM:SS","rule":"Znacznik downloadedAt z zakończonego pobrania przez użytkownika; wyświetlany w Europe/Warsaw, z sekundami. Brak wartości nie jest zastępowany datą raportu, datą renderowania ani bieżącą godziną."}

];
export const namingPolicy = {
  "version": "1.0",
  "prefixes": {
    "SRM-C": "komponent",
    "SRM-B": "zachowanie lub efekt",
    "SRM-T": "rola tekstu",
    "SRM-N": "format liczby", "SRM-I": "ikona", "SRM-A": "awatar", "SRM-L": "logotyp"
  },
  "rules": [
    "Identyfikator pozostaje stały przy zmianie opisu lub wyglądu.",
    "Zmiana nazwy wymaga zachowania poprzedniej jako aliasu.",
    "Istotnie inny komponent lub zachowanie otrzymuje nowy identyfikator.",
    "Zmiana parametrów zwiększa wersję kontraktu; starej wersji nie nadpisujemy jako równoważnej.",
    "Tekst na przycisku, nazwa dostawcy i konkretna wartość są treścią, a nie nazwą komponentu.",
    "Dla każdego nowego elementu zapisujemy nazwę, ID, zachowania, style tekstu, format liczb i status."
  ]
};


