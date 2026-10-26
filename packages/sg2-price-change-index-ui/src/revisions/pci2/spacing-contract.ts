/** SRM spacing canon v1.2. Single executable source for library specimens AND the supplier application. */
export const spacingVersion = '1.3 · 15.10.2026';
export const spacingScale = [
 ['SRM-S00','zero',0,'Reset i brak odstępu'],
 ['SRM-S01','micro',.125,'Korekta optyczna; nie odstęp między kontrolkami'],
 ['SRM-S02','tight',.25,'Ikona i drobna metadana'],
 ['SRM-S03','compact',.5,'Etykieta → pole, powiązane kontrolki'],
 ['SRM-S04','small',.75,'Zwarta karta, pole, grupa akcji'],
 ['SRM-S05','base',1,'Podstawowe wnętrze karty i odstęp pól'],
 ['SRM-S06','comfortable',1.25,'Wnętrze kart na szerszym ekranie'],
 ['SRM-S07','medium',1.5,'Grupy i siatki kart'],
 ['SRM-S08','large',2,'Odstęp sekcji na małym ekranie'],
 ['SRM-S09','wide',2.5,'Odstęp dużych bloków'],
 ['SRM-S10','section',3,'Odstęp sekcji i maks. gutter strony'],
 ['SRM-S11','hero',4,'Duże sekcje wprowadzające'],
 ['SRM-S12','display',6,'Wyjątkowa kompozycja hero; nigdy formularz']
].map(([id,name,value,usage])=>({id:String(id),name:String(name),value:Number(value),usage:String(usage),css:`--srm-space-${name}`}));
export const spacingRules = [
{"id": "SRM-SP19", "name": "Pionowe zakresy czasu", "components": "SRM-C86", "value": "Szerokość 2,25 rem identyczna jak kontrolka ustawień; odstęp pod nią 0,5 rem. Wiersz 2 rem, gap 0,25 rem. Wycentrowany tekst; padding i obrys 0. Prawa krawędź pokrywa się z prawą krawędzią ramy.", "behavior": "Pozycja związana z obszarem wykresu, podąża za dolną krawędzią górnego panelu. Zmiana szerokości lewego panelu nie przesuwa osi zakresów. Skróty pozostają poza obszarem danych w prawym marginesie.", "detail": "Kontrolki HTML, bez rozciągania razem z SVG. Sam tekst bez powierzchni. Obszar trafienia pełny wiersz; focus-visible przez podkreślenie."},
{"id": "SRM-SP18", "name": "Boczny panel wykresu", "components": "SRM-C84–85", "value": "Szerokość 6 rem: dwie kolumny po 2,25 rem, gap 0,375 rem, padding 0,5 rem, bez obrysu. Cień wyłącznie po prawej: rozmycie 1 rem, rozszerzenie 0,125 rem, Deep Ocean 6%, przesunięcie X/Y = 0; bez cienia na górnej, lewej i dolnej krawędzi oraz przy uchwycie. Promień panelu 0 rem. Zewnętrzny odstęp od krawędzi wykresu 0 rem; lewa krawędź pokrywa się z ramą, pełna wysokość obszaru pod górnym panelem; styk bez granicy, szczeliny i cienia, ze wspólnym tłem. Bez pinezki i bez zarezerwowanej przestrzeni na nią. Uchwyt 2,25 × 2,25 rem; odstęp okręgu od prawej krawędzi panelu 0 rem, bez łącznika; koło z ikoną 2,25 rem, padding 0 rem; koło styka się z krawędziami uchwytu. Wstążka i koło bez obrysu; półokrągłe zakończenie o promieniu 1,125 rem, bez strzałki; położenie 0 rem od góry: wstążka dosunięta do górnej krawędzi panelu, zarówno po rozwinięciu, jak i po schowaniu.", "behavior": "Jedna stała szerokość karty. Panel pobiera miejsce z kolumny wykresu. Wysokość obliczana z pełnej szerokości przed podziałem; górny panel nadal odbiera wysokość.", "detail": "Żadnych stałych pikselowych szerokości. Wąskie etykiety osi czasu zmniejszają gęstość, nie font. Widoczność paneli jest niezależna; brak przypinania. Legenda ma rezerwę na zawijanie, aby nie przesuwać suwaka."},

{"id": "SRM-SP17", "name": "Panel sterowania nad wykresem", "components": "SRM-C81–82", "value": "Wnętrze 1 rem; trzy wiersze po minimum 2,25 rem, gap między nimi 0,5 rem; bez pinezki i bez rezerwy miejsca na nią. Promień panelu 0 rem. Panel bez obrysu; cień tylko pod dolną krawędzią, rozmycie 1 rem, rozszerzenie 0,125 rem, Deep Ocean 6%, przesunięcie X/Y = 0. Wspólny miękki cień obu paneli; przycięty do właściwej krawędzi. Ochronny obszar renderowania 1,5 rem nie dodaje miejsca w układzie. Góra, lewa i prawa strona bez cienia. Cień zachowany przy włączonych Prognozach oraz Sprawdzalności, niezależny od ich stanu. Wspólne tło panelu i gradientu, szczelina 0 rem. Uchwyt zachowuje styk bez cienia. Margines zewnętrzny 0 rem: pełna szerokość oraz styk z górną i lewą krawędzią ramy wykresu. Uchwyt 2,25 × 2,25 rem; odstęp okręgu od dolnej krawędzi panelu 0 rem, bez łącznika; koło z ikoną 2,25 rem, padding 0 rem; koło styka się z krawędziami uchwytu. Wstążka i koło bez obrysu; półokrągłe zakończenie o promieniu 1,125 rem. Bez strzałki. Na styku z panelem narożniki 0 rem, bez granicy i cienia; wspólne tło.", "behavior": "Jeden stały budżet wysokości: panel zajmuje część miejsca wykresu; jego grafika zmniejsza wysokość dokładnie o wysuniętą część. Oś czasu, suwak i dół karty pozostają w tym samym miejscu. Pierwszy wiersz zawiera Prognozy i Sprawdzalność. Dwa następne pozostają puste; przy skrajnie małej szerokości pierwszy wiersz może zwiększyć wysokość dla czytelności.", "detail": "Wysokość panelu naturalna, mierzona także w trakcie animacji. Wysokość grafiki przed rozwinięciem wynika z szerokości 316/812 + 8 rem, minimum 32 rem. Rozwinięcie odejmuje wysokość panelu od grafiki; teksty i kontrolki nie są skalowane. Wstążka przy prawym dolnym narożniku panelu, także po schowaniu. Etykiety są wewnątrz pola rysowania, bez zewnętrznych pustych pasów. Wszystkie odstępy w rem; ruch respektuje reduced motion."},

{"id": "SRM-SP16", "name": "Menu, Dock i wstążka", "components": "SRM-C64–70", "value": "Panel 17 rem / padding 1,25 rem. Dock max 62 rem; ikony 1,5 rem w polu 3 rem. Wstążka 2,75 × 5 rem, koło 1,875 rem; poziomo wymiary odwrócone.", "behavior": "Wysokość w obrębie okna; wstążka styka się z panelem. Cztery stałe krawędzie. Pionowa lista przewijana, profil na dole.", "detail": "Wąski ekran: panel ograniczony do viewport minus wstążka. Pionowe przypięcie rezerwuje miejsce tylko powyżej 55 rem. Poziomo rezerwa wysokości Docka. Na małej szerokości profil jako koło z dostępnym imieniem."},
 {id:'SRM-SP15',name:'Pole ochronne etykiet radaru',components:'SRM-C16 · SRM-C17 · SRM-C18',value:'Minimum 1,5 wysokości fontu (24 jednostki SVG) od obwiedni wycinka przy skali 120%',behavior:'SRM-SB07 · Ruch bez kolizji: nazwa, wartość i zmiana pozostają poza polem radaru podczas intro, hover i fokusu.',detail:'Wspólne pozycje z radarLabelLayout. Rozszerzony viewBox -112 -92 908 660 mieści cały tekst w powiększeniu. Geometria skaluje się razem z SVG, nie jest sztywnym paddingiem strony. Koło ma średnicę większą o 15%; font i punktacja pozostają bez zmian; reduced motion zachowuje ten sam zapas.'},
 {id:'SRM-SP01',name:'Rama strony',components:'SRM-C52 · SRM-C53 · Logowanie PORR · Enter Page',value:'Boki: clamp(1rem, 4vw, 3rem); treść: max 90rem; margin-inline: auto',behavior:'SRM-SB01 · Płynny gutter. Jedna rama odpowiada za boki strony. Zagnieżdżone sekcje nie dodają kolejnego guttera.',detail:'Górny i dolny odstęp treści: clamp(1.5rem, 4vw, 3rem). Szerokość 100%, box-sizing: border-box. Formularz logowania max 32rem, bez stałej szerokości.'},
 {id:'SRM-SP02',name:'Rytm treści',components:'SRM-C42 · SRM-C43 · tytuły, opisy, listy',value:'Nazwa → opis: 0.5rem; bloki: 1rem; sekcje: clamp(2rem, 4vw, 3rem)',behavior:'SRM-SB02 · Jeden właściciel odstępu. Kontener zarządza rytmem przez gap; dzieci mają margin: 0.',detail:'Listy: padding-inline-start 1.5rem; odstęp pozycji 0.5rem. Nie sumujemy dolnego marginesu jednego elementu z górnym następnego.'},
 {id:'SRM-SP03',name:'Siatka i grupa',components:'Karty, toolbar, porównanie, zestaw wykresów',value:'Siatka: clamp(1rem, 2vw, 1.5rem); grupa akcji: 0.5rem',behavior:'SRM-SB03 · Układ według miejsca. Grid auto-fit/minmax(min(100%, 18rem), 1fr); flex-wrap dla akcji.',detail:'min-inline-size: 0 na dzieciach i minmax(0, 1fr) w siatce pionowej. Długie niepodzielne słowo może się złamać. Radar i asystent mogą przejść do jednej kolumny. Liczba kolumn wynika z szerokości dostępnej dla treści.'},
 {id:'SRM-SP04',name:'Wnętrze karty',components:'SRM-C13 · SRM-C14 · SRM-C47 · SRM-C51',value:'Padding: clamp(1rem, 2vw, 1.5rem); gęsty wariant: 0.75rem',behavior:'SRM-SB02 · Wnętrze ma jednego właściciela. Nagłówek → treść: 1rem; opis → następny blok: 0.75rem.',detail:'Karta rośnie z treścią. Wariant gęsty służy szeregom wskaźników i kartom przeglądowym; nie zmniejszamy fontu, by zmieścić tekst.'},
 {id:'SRM-SP05',name:'Przycisk, ikona i kapsuła',components:'SRM-C01–05 · SRM-C08–10 · SRM-C46',value:'Akcja: 0.5rem × 0.875rem; kapsuła: 0.375rem × 0.75rem; gap: 0.5rem',behavior:'SRM-SB04 · Kontrolka rośnie z tekstem. min-block-size zamiast sztywnej wysokości; normalne zawijanie długich etykiet.',detail:'Domyślny cel akcji 2.75rem; wariant gęsty min 2rem. Ikona wykresu może być wizualnie mniejsza; obszar trafienia na dotyku min 2.75rem. Rozmiar celu to osobny kontrakt od paddingu.'},
 {id:'SRM-SP06',name:'Pole i formularz',components:'SRM-C06 · SRM-C07 · SRM-C35 · NIP · logowanie',value:'Pole: 0.75rem × 1rem; etykieta: gap 0.5rem; pola: gap 1rem',behavior:'SRM-SB04 · Pole + przycisk układają się w grid/flex, bez absolutnego osadzania przycisku w polu.',detail:'Wąski formularz układa akcję pod polem. Input: min-width 0 i width 100%. Textarea: min-height 7rem, resize vertical. Select zostawia 2.5rem na strzałkę.'},
 {id:'SRM-SP07',name:'Belka i nawigacja',components:'SRM-C52 · SRM-C53 · zakładki',value:'Belka: 0.75rem w pionie; boki z ramy; grupy: 1rem; zakładka: 0.5rem × 0.75rem',behavior:'SRM-SB03 · Logo, tytuł i akcje są odrębnymi grupami. W razie braku miejsca zawijają się zamiast nachodzić na siebie.',detail:'Nie wymuszamy jednej linii kosztem czytelności na telefonie. Wiersz zakładek może mieć własne przewijanie poziome; nie cała strona.'},
 {id:'SRM-SP08',name:'Sekcja rozwijana',components:'SRM-C49 · Dane szczegółowe · Historia wersji',value:'Nagłówek: 1rem; nagłówek → treść: 1rem; wnętrze: 1rem',behavior:'SRM-SB02 · Tekst i chevron mają gap 0.75rem i wspólną oś. Otwarcie nie dubluje paddingów.',detail:'Chevron nie kurczy się. Długa nazwa zawija się; cała kontrolka zachowuje wystarczający obszar trafienia.'},
 {id:'SRM-SP09',name:'Okno i panel',components:'SRM-C27 · SRM-C12 · historia i wybór własnego zestawu',value:'Odstęp od okna: 1rem; wnętrze: clamp(1rem, 2vw, 1.5rem); toolbar gap 0.5rem',behavior:'SRM-SB05 · Okno wyśrodkowane w viewport, max-height: calc(100dvh - 2rem). Belka zawija akcje.',detail:'Treść nie może być ucięta na niskim ekranie ani po powiększeniu tekstu. W takim przypadku przewija się wnętrze panelu; wykres korzysta z dostępnego miejsca. Długa tabela zachowuje pełny eksport.'},
 {id:'SRM-SP10',name:'Tabela i oś wykresu',components:'SRM-C24–26 · SRM-C48 · SRM-C51',value:'Komórka: 0.75rem × 1rem; gęsta: 0.5rem × 0.75rem; wykres → oś: 0.75rem',behavior:'SRM-SB06 · Szeroka tabela przewija się w swoim kontenerze, a nie razem z całą stroną.',detail:'Kształty SVG i współrzędne słupków nie są tokenami odstępów layoutu. Padding tytułu i belki jest wspólny z kartą. Przerwy wykresu nie służą do zmiany znaczenia danych.'},
 {id:'SRM-SP11',name:'Rozmowa asystenta',components:'SRM-C31–41, C62–63 · awatar · wiadomość · composer',value:'Wnętrze: 1rem; wiadomości: gap 0.75rem; awatar → tekst: 0.75rem',behavior:'SRM-SB03 · Treść ma min-width 0; długie słowa i adresy mogą się łamać. Composer nie zasłania wiadomości.',detail:'Zwinięcie zachowuje zarezerwowaną kolumnę zgodnie z kanonem asystenta. Marginesy nie animują się; ruch wykorzystuje transform.'},
 {id:'SRM-SP12',name:'Stopka i metadane',components:'SRM-C14 · SRM-C15 · poziom ważności · historia',value:'Padding-block: 0.5rem; gap: 0.5rem; odstęp od treści: 0.75rem',behavior:'SRM-SB04 · Wspólna oś pionowa w zwykłym układzie. Przy bardzo małej szerokości dopuszczalne dwa wiersze.',detail:'Czytelna akcja ma pierwszeństwo przed wymuszoną pojedynczą linią. Nie ukrywamy roku ani wartości, by utrzymać stałą wysokość karty.'},
 {id:'SRM-SP13',name:'Bezpieczny ruch i krawędzie',components:'Hover przycisków · kapsuł · radaru · obwódka fokusu',value:'Zapas grupy: 0.25rem; gap sąsiadów: min 0.5rem; safe-area: env()',behavior:'SRM-SB07 · Hover nie zmienia flow. Stosujemy transform, zachowujemy przestrzeń na obwódkę i skalowanie.',detail:'Zapas radaru 20% wynika z jego geometrii, nie ze stałego paddingu 0.25rem. Na ekranach z wcięciem dodajemy safe-area do guttera; reduced-motion wyłącza ruch, nie odstępy.'},
 {id:'SRM-SP14',name:'Wyjątki pod kontrolą',components:'Reset · auto · ukryte etykiety · SVG · obwódki',value:'0 i auto są poprawne. Cienkie obwódki mogą pozostać w px.',behavior:'SRM-SB08 · Wyjątek ma uzasadnienie i zakres. Ujemny margin nie służy do naprawiania źle ułożonego formularza.',detail:'Technika visually-hidden i matematyczna geometria SVG mogą zachować własne jednostki. Pole ochronne logotypu nadal wymaga osobnego ustalenia w G-11.'}
];
export const spacingBehaviors = [
 ['SRM-SB01','Płynny gutter','Marginesy strony mieszczą się między minimum i maksimum, reagując na viewport.'],
 ['SRM-SB02','Jeden właściciel odstępu','Gap należy do rodzica, padding do powierzchni; bez zdublowanych marginesów.'],
 ['SRM-SB03','Układ według miejsca','Kolumny i grupy akcji zawijają się, kiedy treść nie mieści się w kontenerze.'],
 ['SRM-SB04','Kontrolka rośnie z tekstem','Wysokość minimalna, nie stała. Wiersze tekstu i większy font zwiększają kontrolkę.'],
 ['SRM-SB05','Panel w granicach okna','Panel pozostaje dostępny również przy niskim viewport i większym tekście.'],
 ['SRM-SB06','Lokalne przewijanie danych','Szeroka tabela ma własny kontener przewijania; strona nie rozszerza się.'],
 ['SRM-SB07','Ruch bez kolizji','Transform nie przesuwa sąsiadów; fokus i hover mają zapas miejsca.'],
 ['SRM-SB08','Jawny wyjątek','Odstęp spoza skali wymaga nazwy, uzasadnienia i przykładu użycia.']
].map(([id,name,description])=>({id,name,description}));
export const spacingCSS = `.pci-surface {
${spacingScale.map(s=>`  ${s.css}: calc(${s.value}rem * var(--srm-spacing-multiplier, 1));`).join('\n')}
  --srm-page-gutter: clamp(var(--srm-space-base), 4vw, var(--srm-space-section));
  --srm-section-gap: clamp(var(--srm-space-large), 4vw, var(--srm-space-section));
  --srm-grid-gap: clamp(var(--srm-space-base), 2vw, var(--srm-space-medium));
  --srm-card-pad: clamp(var(--srm-space-base), 2vw, var(--srm-space-medium));
  --srm-button-block: var(--srm-space-compact);
  --srm-button-inline: calc(.875rem * var(--srm-spacing-multiplier, 1));
  --srm-field-block: var(--srm-space-small);
  --srm-field-inline: var(--srm-space-base);
  --srm-page-block: clamp(var(--srm-space-medium), 4vw, var(--srm-space-section));
  --srm-page-max: 90rem;
  --srm-card-dense: var(--srm-space-small);
  --srm-actions-gap: var(--srm-space-compact);
  --srm-content-gap: var(--srm-space-base);
  --srm-label-gap: var(--srm-space-compact);
  --srm-pill-block: calc(.375rem * var(--srm-spacing-multiplier, 1));
  --srm-pill-inline: var(--srm-space-small);
  --srm-header-block: var(--srm-space-small);
  --srm-accordion-pad: var(--srm-space-base);
  --srm-dialog-edge: var(--srm-space-base);
  --srm-dialog-pad: var(--srm-card-pad);
  --srm-cell-block: var(--srm-space-small);
  --srm-cell-inline: var(--srm-space-base);
  --srm-cell-dense-block: var(--srm-space-compact);
  --srm-cell-dense-inline: var(--srm-space-small);
  --srm-chat-pad: var(--srm-space-base);
  --srm-message-gap: var(--srm-space-small);
  --srm-motion-clearance: var(--srm-space-tight);
  --srm-plot-axis-gutter: 3.875rem;
  --srm-plot-axis-gutter-compact: 1.9375rem;
}
.pci-surface { font-size: 100%; }
*, *::before, *::after { box-sizing: border-box; }
.srm-page { overflow-wrap: anywhere; width: 100%; max-width: var(--srm-page-max); margin-inline: auto; padding: var(--srm-page-block) var(--srm-page-gutter); }
.srm-stack { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--srm-space-base); }
.srm-stack > * { margin: 0; min-width: 0; }
.srm-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: var(--srm-grid-gap); }
.srm-grid > * { min-width: 0; }
.srm-card { padding: var(--srm-card-pad); }
.srm-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--srm-space-compact); }
.srm-action { padding: var(--srm-button-block) var(--srm-button-inline); min-height: 2.75rem; height: auto; white-space: normal; }
.srm-field { display: grid; gap: var(--srm-space-compact); min-width: 0; }
.srm-field input, .srm-field textarea { width: 100%; min-width: 0; padding: var(--srm-field-block) var(--srm-field-inline); }
.srm-form { display: flex; flex-wrap: wrap; gap: var(--srm-space-small); align-items: end; }
.srm-form .srm-field { flex: 1 1 14rem; }
.srm-form .srm-action { flex: 1 1 9rem; }
.srm-table-scroll { overflow-x: auto; max-width: 100%; }
@supports (padding: max(0rem)) {
  .srm-page { padding-inline-start: max(var(--srm-page-gutter), env(safe-area-inset-left)); padding-inline-end: max(var(--srm-page-gutter), env(safe-area-inset-right)); }
}`;

/** Inspectable mapping from named UI components to the shared spacing contract. */
export const spacingBindings = [
{"rule": "SRM-SP19", "name": "Pionowe zakresy czasu", "ids": ["SRM-C86"], "target": "charts"},
{"rule": "SRM-SP18", "name": "Boczny panel wykresu", "ids": ["SRM-C84", "SRM-C85"], "target": "charts"},

{"rule": "SRM-SP17", "name": "Wysuwany panel sterowania wykresem", "ids": ["SRM-C81", "SRM-C82"], "target": "charts"},

 {rule:'SRM-SP15',name:'Pole ochronne etykiet w skali120%',ids:['SRM-C16','SRM-C17','SRM-C18'],target:'supplier'},
 {rule:'SRM-SP01',name:'Rama strony i identyfikacja dostawcy',ids:['SRM-C52','SRM-C53'],target:'supplier'},
 {rule:'SRM-SP02',name:'Tytuły i rytm sekcji',ids:['SRM-C42','SRM-C54'],target:'supplier'},
 {rule:'SRM-SP03',name:'Siatka radaru, asystenta i kart',ids:['SRM-C43'],target:'supplier'},
 {rule:'SRM-SP04',name:'Wnętrza kart i panel radaru',ids:['SRM-C13','SRM-C20','SRM-C47','SRM-C51'],target:'financial-details'},
 {rule:'SRM-SP05',name:'Przyciski, menu i kapsuły',ids:['SRM-C01','SRM-C02','SRM-C03','SRM-C04','SRM-C05','SRM-C08','SRM-C09','SRM-C10','SRM-C11','SRM-C28','SRM-C29','SRM-C30','SRM-C46','SRM-C55'],target:'financial-details'},
 {rule:'SRM-SP06',name:'Pola, wybór okresu i formularze',ids:['SRM-C06','SRM-C07','SRM-C35','SRM-C50'],target:'supplier'},
 {rule:'SRM-SP07',name:'Belka i zakładki',ids:['SRM-C52','SRM-C08'],target:'supplier'},
 {rule:'SRM-SP08',name:'Rozwijane Dane szczegółowe',ids:['SRM-C49'],target:'financial-details'},
 {rule:'SRM-SP09',name:'Okna historii i własnego zestawu',ids:['SRM-C12','SRM-C27'],target:'financial-details'},
 {rule:'SRM-SP10',name:'Tabele i obudowa wykresów',ids:['SRM-C21','SRM-C22','SRM-C23','SRM-C24','SRM-C25','SRM-C26','SRM-C48','SRM-C51'],target:'financial-details'},
 {rule:'SRM-SP11',name:'SpendGuru i odpięte okno czatu',ids:['SRM-C31','SRM-C32','SRM-C33','SRM-C34','SRM-C35','SRM-C36','SRM-C37','SRM-C38','SRM-C39','SRM-C40','SRM-C41','SRM-C62','SRM-C63'],target:'supplier'},
 {rule:'SRM-SP12',name:'Stopki i oznaczenia ważności',ids:['SRM-C14','SRM-C15'],target:'financial-details'},
 {rule:'SRM-SP13',name:'Zapas ruchu; geometria radaru zachowana',ids:['SRM-C16','SRM-C17','SRM-C18','SRM-C19'],target:'supplier'},
 {rule:'SRM-SP14',name:'Zasoby graficzne — pole ochronne G-11 osobno',ids:['SRM-C44','SRM-C45'],target:'supplier'}
];
export function spacingRulesForComponent(id:string) {
 return spacingBindings.filter(b=>b.ids.includes(id)).map(b=>b.rule).join(' ');
}

/** SRM-SP15 / C16–C18: SVG-space clearance, proportionally responsive with the chart.
 * Reserve at least 24 units (1.5 label em) between text and the 120% sector envelope.
 * The circle is 15% larger; the viewBox width and label font stay fixed. Scoring is unchanged.
 */
export const radarLabelLayout = {
  minClearance: 24,
  circleScale: 1.15,
  emphasisScale: 1.2,
  viewBox: "-112 -92 908 660",
  labels: [
    { x: 350, y: -56, anchor: "middle" },
    { x: 588, y: 128, anchor: "start" },
    { x: 588, y: 310, anchor: "start" },
    { x: 350, y: 498, anchor: "middle" },
    { x: 112, y: 302, anchor: "end" },
    { x: 112, y: 120, anchor: "end" },
  ],
} as const;


