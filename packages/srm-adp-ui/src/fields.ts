import type {AdpFieldDefinition} from './types';
export const FIELD_DEFINITIONS: readonly AdpFieldDefinition[] = [
  {
    "id": "name",
    "label": "Pełna nazwa firmy",
    "tab": "company",
    "group": "Dane firmy",
    "note": 1
  },
  {
    "id": "nip",
    "label": "NIP (PL)",
    "tab": "company",
    "group": "Dane firmy"
  },
  {
    "id": "street",
    "label": "Ulica, numer domu",
    "tab": "company",
    "group": "Dane firmy",
    "note": 1
  },
  {
    "id": "postal",
    "label": "Kod pocztowy, miejscowość",
    "tab": "company",
    "group": "Dane firmy",
    "note": 1
  },
  {
    "id": "country",
    "label": "kraj",
    "tab": "company",
    "group": "Dane firmy",
    "note": 1
  },
  {
    "id": "email",
    "label": "Informacje ogólne o adresie e-mail",
    "tab": "company",
    "group": "Dane firmy",
    "note": 1,
    "type": "email"
  },
  {
    "id": "phone",
    "label": "Telefon",
    "tab": "company",
    "group": "Dane firmy",
    "note": 1,
    "type": "tel"
  },
  {
    "id": "website",
    "label": "Strona internetowa",
    "tab": "company",
    "group": "Dane firmy"
  },
  {
    "id": "contact",
    "label": "Osoba do kontaktu",
    "tab": "company",
    "group": "Kontakt i reprezentacja",
    "note": 1,
    "help": "(uprawniony do reprezentowania)"
  },
  {
    "id": "contact-phone",
    "label": "Osoba do kontaktu Telefon",
    "tab": "company",
    "group": "Kontakt i reprezentacja",
    "note": 1,
    "type": "tel"
  },
  {
    "id": "contact-email",
    "label": "Osoba do kontaktu E-mail",
    "tab": "company",
    "group": "Kontakt i reprezentacja",
    "note": 1,
    "type": "email"
  },
  {
    "id": "commercial-director",
    "label": "Dyrektor zarządzający ds. handlowych",
    "tab": "company",
    "group": "Kontakt i reprezentacja",
    "note": 1
  },
  {
    "id": "legal-director",
    "label": "Dyrektor zarządzający ds. prawa gospodarczego",
    "tab": "company",
    "group": "Kontakt i reprezentacja",
    "note": 1
  },
  {
    "id": "register",
    "label": "Numer rejestru handlowego/rejestru firm",
    "tab": "registers",
    "group": "Rejestry",
    "note": 1
  },
  {
    "id": "duns",
    "label": "Numer D-U-N-S",
    "tab": "registers",
    "group": "Rejestry",
    "note": 1
  },
  {
    "id": "vat-at-de",
    "label": "Numer identyfikacyjny VAT (AT/DE)",
    "tab": "registers",
    "group": "Identyfikatory krajowe",
    "note": 1
  },
  {
    "id": "tax-de",
    "label": "Numer podatkowy (DE)",
    "tab": "registers",
    "group": "Identyfikatory krajowe",
    "note": 1
  },
  {
    "id": "ddv",
    "label": "ID st. Za DDV (SI)",
    "tab": "registers",
    "group": "Identyfikatory krajowe"
  },
  {
    "id": "employer",
    "label": "Numer pracodawcy (AT)",
    "tab": "registers",
    "group": "Identyfikatory krajowe",
    "note": 2
  },
  {
    "id": "hu",
    "label": "Adcoszam (HU)",
    "tab": "registers",
    "group": "Identyfikatory krajowe"
  },
  {
    "id": "ch",
    "label": "Numer VAT (CH)",
    "tab": "registers",
    "group": "Identyfikatory krajowe",
    "note": 1
  },
  {
    "id": "ro",
    "label": "C.I.F. (RO)",
    "tab": "registers",
    "group": "Identyfikatory krajowe"
  },
  {
    "id": "cz",
    "label": "IC (CZ)",
    "tab": "registers",
    "group": "Identyfikatory krajowe"
  },
  {
    "id": "rs",
    "label": "PIB (RS, ME)",
    "tab": "registers",
    "group": "Identyfikatory krajowe"
  },
  {
    "id": "dic",
    "label": "DIC (CZ, SK)",
    "tab": "registers",
    "group": "Identyfikatory krajowe"
  },
  {
    "id": "oib",
    "label": "OIB (HR)",
    "tab": "registers",
    "group": "Identyfikatory krajowe"
  },
  {
    "id": "ico",
    "label": "ICO (SK)",
    "tab": "registers",
    "group": "Identyfikatory krajowe"
  },
  {
    "id": "bg",
    "label": "VAT N/EIK (BG)",
    "tab": "registers",
    "group": "Identyfikatory krajowe"
  },
  {
    "id": "icdph",
    "label": "IC DPH (SK)",
    "tab": "registers",
    "group": "Identyfikatory krajowe"
  },
  {
    "id": "iban",
    "label": "IBAN",
    "tab": "payments",
    "group": "Rachunek bankowy",
    "note": 1
  },
  {
    "id": "bic",
    "label": "BIC",
    "tab": "payments",
    "group": "Rachunek bankowy"
  },
  {
    "id": "bank",
    "label": "Instytut",
    "tab": "payments",
    "group": "Rachunek bankowy"
  },
  {
    "id": "holder",
    "label": "Właściciel konta",
    "tab": "payments",
    "group": "Rachunek bankowy",
    "note": 1
  },
  {
    "id": "terms",
    "label": "warunki płatności",
    "tab": "payments",
    "group": "Rozliczenia",
    "note": 1,
    "multiline": true
  },
  {
    "id": "industry",
    "label": "Branża",
    "tab": "activity",
    "group": "Dane działalności",
    "note": 1
  },
  {
    "id": "scope",
    "label": "Zakres usług/produktów",
    "tab": "activity",
    "group": "Dane działalności",
    "note": 1,
    "multiline": true
  },
  {
    "id": "regions",
    "label": "Regiony działalności",
    "tab": "activity",
    "group": "Dane działalności",
    "note": 1,
    "multiline": true
  },
  {
    "id": "permission",
    "label": "Posiadamy zezwolenie na prowadzenie działalności gospodarczej w zakresie",
    "tab": "activity",
    "group": "Dane działalności",
    "note": 1,
    "multiline": true
  },
  {
    "id": "date",
    "label": "Data",
    "tab": "declarations",
    "group": "Potwierdzenie danych",
    "type": "date"
  },
  {
    "id": "position",
    "label": "Stanowisko",
    "tab": "declarations",
    "group": "Potwierdzenie danych"
  },
  {
    "id": "signatory",
    "label": "nazwa",
    "tab": "declarations",
    "group": "Potwierdzenie danych"
  },
  {
    "id": "signature",
    "label": "Podpis",
    "tab": "declarations",
    "group": "Potwierdzenie danych",
    "help": "Do podpisania przez dostawcę/podwykonawcę/usługodawcę/partnera biznesowego/partnera konsorcjum wewnętrznego (ARGE)"
  },
  {
    "id": "internal",
    "label": "Sprawdzone wewnętrznie",
    "tab": "declarations",
    "group": "Kontrola wewnętrzna",
    "multiline": true
  }
] as const;
export const FORM_SECTIONS = [
  {
    "id": "company",
    "label": "Firma i kontakt",
    "title": "Dane firmy i osoby do kontaktu",
    "description": "Dane identyfikacyjne, adresowe i osoby reprezentujące firmę."
  },
  {
    "id": "registers",
    "label": "Rejestry i podatki",
    "title": "Rejestry i identyfikatory podatkowe",
    "description": "Wszystkie pola krajowe z arkusza klienta. Żadne pole nie jest ukrywane po wyborze kraju."
  },
  {
    "id": "payments",
    "label": "Płatności",
    "title": "Rachunek bankowy i warunki płatności",
    "description": "Dane rachunku oraz warunki rozliczeń z partnerem."
  },
  {
    "id": "activity",
    "label": "Działalność",
    "title": "Profil działalności",
    "description": "Zakres oferty, regiony i posiadane zezwolenia."
  },
  {
    "id": "declarations",
    "label": "Oświadczenia i podpis",
    "title": "Oświadczenia i podpis",
    "description": "Treść oświadczeń zachowana z dokumentu klienta."
  }
] as const;
export const PARTNER_ROLES = ["Dostawca","Podwykonawca/usługodawca","Partner biznesowy","Partner konsorcjum"] as const;
