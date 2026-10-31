"use client";
import React from 'react';
/** MagicPath library 460628347660177408, revision 461359638781255680 (SP15 circle scale and radar label clearance).
 * Definitions -> shared components and tokens -> application. Never reverse this dependency.
 * Register a new definition in the design library before adding an application primitive.
 */
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

// Chat definitions from MagicPath revision 461384673386459136; menu definitions are excluded.
// MAP-01 definitions accepted in MagicPath revision 464039002702499840.
export const uiCanon = {
  "SRM-C103": { name: "Google Maps · ikona lokalizacji dostawcy", behaviors: ["SRM-B66"], fonts: [], numbers: [] },
  "SRM-C104": { name: "Okno lokalizacji dostawcy", behaviors: ["SRM-B66", "SRM-B67"], fonts: ["SRM-T32"], numbers: [] },
  "SRM-C105": { name: "Stany mapy dostawcy", behaviors: ["SRM-B67"], fonts: ["SRM-T32"], numbers: [] },
  "SRM-C62": { name: "Przychodząca chmurka wiadomości", behaviors: ["SRM-B41", "SRM-B43"], fonts: ["SRM-T05"], numbers: [] },
  "SRM-C63": { name: "Wskaźnik pisania", behaviors: ["SRM-B42"], fonts: ["SRM-T05"], numbers: [] },
  "SRM-C61": { name: "Stan dostępności raportu", behaviors: ["SRM-B40"], fonts: ["SRM-T03", "SRM-T05"], numbers: [] },
  "SRM-C01": {
    "name": "Przycisk główny",
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
    ]
  },
  "SRM-C02": {
    "name": "Przycisk drugorzędny",
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
    ]
  },
  "SRM-C03": {
    "name": "Odnośnik historii",
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
    ]
  },
  "SRM-C04": {
    "name": "Przycisk ikonowy",
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
    ]
  },
  "SRM-C05": {
    "name": "Menu kontekstowe",
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
    ]
  },
  "SRM-C06": {
    "name": "Pole tekstowe",
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
    ]
  },
  "SRM-C07": {
    "name": "Lista wyboru",
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
    ]
  },
  "SRM-C08": {
    "name": "Zakładka obszaru",
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
    ]
  },
  "SRM-C09": {
    "name": "Kapsuła roku",
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
    ]
  },
  "SRM-C10": {
    "name": "Wybór wskaźnika",
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
    ]
  },
  "SRM-C11": {
    "name": "Wybór kategorii",
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
    ]
  },
  "SRM-C12": {
    "name": "Kreator własnego zestawu",
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
    ]
  },
  "SRM-C13": {
    "name": "Karta wskaźnika",
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
    ]
  },
  "SRM-C14": {
    "name": "Stopka wskaźnika",
    "behaviors": [
      "SRM-B15",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T02"
    ],
    "numbers": [
      "SRM-N02"
    ]
  },
  "SRM-C15": {
    "name": "Znacznik ważności",
    "behaviors": [
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T02"
    ],
    "numbers": [
      "SRM-N01"
    ]
  },
  "SRM-C16": {
    "name": "Radar sektorowy",
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
    ]
  },
  "SRM-C17": {
    "name": "Sektor radaru",
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
    ]
  },
  "SRM-C18": {
    "name": "Etykieta sektora",
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
    ]
  },
  "SRM-C19": {
    "name": "Łuk odniesienia",
    "behaviors": [
      "SRM-B16",
      "SRM-B35"
    ],
    "fonts": [],
    "numbers": [
      "SRM-N01"
    ]
  },
  "SRM-C20": {
    "name": "Sterowanie radarem",
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
    ]
  },
  "SRM-C21": {
    "name": "Wykres historii",
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
    ]
  },
  "SRM-C22": {
    "name": "Słupek historii",
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
    ]
  },
  "SRM-C23": {
    "name": "Oś lat",
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
    ]
  },
  "SRM-C24": {
    "name": "Dokładna wartość w dymku",
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
    ]
  },
  "SRM-C25": {
    "name": "Tabela historii",
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
    ]
  },
  "SRM-C26": {
    "name": "Belka roku",
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
    ]
  },
  "SRM-C27": {
    "name": "Okno historii",
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
    ]
  },
  "SRM-C28": {
    "name": "Przełącznik historii",
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
    ]
  },
  "SRM-C29": {
    "name": "Przycisk kopiowania",
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
    ]
  },
  "SRM-C30": {
    "name": "Komunikat kopiowania",
    "behaviors": [
      "SRM-B22"
    ],
    "fonts": [
      "SRM-T20"
    ],
    "numbers": [
      "SRM-N01"
    ]
  },
  "SRM-C31": {
    "name": "Okno SpendGuru",
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
    ]
  },
  "SRM-C32": {
    "name": "Belka SpendGuru",
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
    ]
  },
  "SRM-C33": {
    "name": "Awatar SpendGuru",
    "behaviors": [
      "SRM-B23",
      "SRM-B25",
      "SRM-B35"
    ],
    "fonts": [],
    "numbers": [
      "SRM-N01"
    ]
  },
  "SRM-C34": {
    "name": "Podsumowanie dostawcy",
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
    ]
  },
  "SRM-C35": {
    "name": "Pole wiadomości",
    "behaviors": [
      "SRM-B11",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T15"
    ],
    "numbers": [
      "SRM-N01"
    ]
  },
  "SRM-C36": {
    "name": "Wstążka asystenta",
    "behaviors": [
      "SRM-B24",
      "SRM-B25",
      "SRM-B30",
      "SRM-B35"
    ],
    "fonts": [],
    "numbers": [
      "SRM-N01"
    ]
  },
  "SRM-C37": {
    "name": "Kontrolka zwijania",
    "behaviors": [
      "SRM-B04",
      "SRM-B24",
      "SRM-B30",
      "SRM-B35"
    ],
    "fonts": [],
    "numbers": [
      "SRM-N01"
    ]
  },
  "SRM-C38": {
    "name": "Kontrolka odpięcia",
    "behaviors": [
      "SRM-B04",
      "SRM-B26",
      "SRM-B35"
    ],
    "fonts": [],
    "numbers": [
      "SRM-N01"
    ]
  },
  "SRM-C39": {
    "name": "Menu awatara",
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
    ]
  },
  "SRM-C40": {
    "name": "Historia bieżącej rozmowy",
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
    ]
  },
  "SRM-C41": {
    "name": "Kontekst asystenta",
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
    ]
  },
  "SRM-C42": {
    "name": "Nagłówek sekcji",
    "behaviors": [
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T21"
    ],
    "numbers": [
      "SRM-N01"
    ]
  },
  "SRM-C43": {
    "name": "Układ Supplier Finance Scanner",
    "behaviors": [
      "SRM-B30",
      "SRM-B35"
    ],
    "fonts": [],
    "numbers": [
      "SRM-N01"
    ]
  },
  "SRM-C44": {
    "name": "Logotyp marki",
    "behaviors": [
      "SRM-B33",
      "SRM-B35"
    ],
    "fonts": [],
    "numbers": [
      "SRM-N01"
    ]
  },
  "SRM-C45": {
    "name": "Favicon aplikacji",
    "behaviors": [
      "SRM-B34"
    ],
    "fonts": [],
    "numbers": []
  },
  "SRM-C46": {
    "name": "Kafel dodawania wykresu",
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
    "numbers": []
  },
  "SRM-C47": {
    "name": "Karta wykresu sprawozdania",
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
    ]
  },
  "SRM-C48": {
    "name": "Tabela sprawozdania",
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
    ]
  },
  "SRM-C49": {
    "name": "Sekcja rozwijana danych",
    "behaviors": [
      "SRM-B37",
      "SRM-B10",
      "SRM-B35"
    ],
    "fonts": [
      "SRM-T01",
      "SRM-T09"
    ],
    "numbers": []
  },
  "SRM-C50": {
    "name": "Wybór pozycji do wykresu",
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
    ]
  },
  "SRM-C51": {
    "name": "Wykres przeglądowy",
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
    ]
  },
  "SRM-C52": {
    "name": "Belka aplikacji",
    "behaviors": [
      "SRM-B01"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": []
  },
  "SRM-C53": {
    "name": "Tożsamość dostawcy",
    "behaviors": [
      "SRM-B01"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": []
  },
  "SRM-C54": {
    "name": "Komunikat kontekstowy",
    "behaviors": [
      "SRM-B01"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": []
  },
  "SRM-C55": {
    "name": "Odnośnik tekstowy",
    "behaviors": [
      "SRM-B01"
    ],
    "fonts": [
      "SRM-T01"
    ],
    "numbers": []
  },
  "SRM-C56": { name: "Raport KYS z zakładkami", behaviors: ["SRM-B13"], fonts: ["SRM-T03", "SRM-T27", "SRM-T28"], numbers: ["SRM-N15"] },
  "SRM-C57": { name: "Tabela i dane rejestrowe KYS", behaviors: [], fonts: ["SRM-T27", "SRM-T28"], numbers: ["SRM-N01"] },
  "SRM-C58": { name: "PESEL · maska i kontrolka", behaviors: ["SRM-B39"], fonts: ["SRM-T27"], numbers: [] },
  "SRM-C60": { name: "Zamknięcie okna", behaviors: ["SRM-B04", "SRM-B10", "SRM-B11", "SRM-B35"], fonts: [], numbers: [] },
  "SRM-C59": { name: "Przełącznik widoczności PESEL", behaviors: ["SRM-B39", "SRM-B04", "SRM-B11"], fonts: [], numbers: [] }
} as const;
export type CanonId = keyof typeof uiCanon;
type CanonProps = { canonId: CanonId; usage: string };
export function canonAttributes(id: CanonId, usage: string) {
  if (!Object.hasOwn(uiCanon,id) || !usage.trim()) throw new Error('Unregistered SRM UI component or usage');
  return { 'data-library-component': id, 'data-canon-usage': usage, 'data-canon-source': 'srm-ui-v1' };
}
// forwardRef supports both the standalone React 19 host and React 18 consumers.
export const CanonButton=React.forwardRef<HTMLButtonElement,React.ComponentPropsWithoutRef<'button'>&CanonProps>(function CanonButton({canonId,usage,...props},ref){return <button {...props} ref={ref} {...canonAttributes(canonId,usage)}/>});
export const CanonInput=React.forwardRef<HTMLInputElement,React.ComponentPropsWithoutRef<'input'>&CanonProps>(function CanonInput({canonId,usage,...props},ref){return <input {...props} ref={ref} {...canonAttributes(canonId,usage)}/>});
export const CanonSelect=React.forwardRef<HTMLSelectElement,React.ComponentPropsWithoutRef<'select'>&CanonProps>(function CanonSelect({canonId,usage,...props},ref){return <select {...props} ref={ref} {...canonAttributes(canonId,usage)}/>});
export const CanonTextarea=React.forwardRef<HTMLTextAreaElement,React.ComponentPropsWithoutRef<'textarea'>&CanonProps>(function CanonTextarea({canonId,usage,...props},ref){return <textarea {...props} ref={ref} {...canonAttributes(canonId,usage)}/>});
export const CanonSummary=React.forwardRef<HTMLElement,React.ComponentPropsWithoutRef<'summary'>&CanonProps>(function CanonSummary({canonId,usage,...props},ref){return <summary {...props} ref={ref} {...canonAttributes(canonId,usage)}/>});
export const CanonLink=React.forwardRef<HTMLAnchorElement,React.ComponentPropsWithoutRef<'a'>&CanonProps>(function CanonLink({canonId,usage,...props},ref){return <a {...props} ref={ref} {...canonAttributes(canonId,usage)}/>});
type CanonElementComponent=<T extends keyof React.JSX.IntrinsicElements>(props:{as:T}&CanonProps&Omit<React.ComponentPropsWithRef<T>,'as'|'canonId'|'usage'>)=>React.ReactElement;
export const CanonElement=React.forwardRef<Element,{as:keyof React.JSX.IntrinsicElements}&CanonProps&React.HTMLAttributes<Element>>(function CanonElement({as,canonId,usage,...props},ref){
 return React.createElement(as,{...props,ref,...canonAttributes(canonId,usage)});
}) as CanonElementComponent;
export const CanonCloseButton=React.forwardRef<HTMLButtonElement,React.ComponentPropsWithoutRef<'button'>&{canonId?:'SRM-C60';usage:string}>(function CanonCloseButton({canonId='SRM-C60',usage,className='',...props},ref){
 return <CanonButton {...props} ref={ref} canonId={canonId} usage={usage} type="button" className={'srm-close-window '+className} aria-label={props['aria-label']??'Zamknij'} title={props.title??'Zamknij'}>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
 </CanonButton>;
});
