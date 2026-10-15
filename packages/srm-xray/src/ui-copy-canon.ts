/** SRM-TXT01 — global editorial contract for current and future SRM UI copy.
 * Apply to authored direct address, including future assistant messages.
 * Preserve supplier names, quoted source documents and user-authored messages.
 * Do not use CSS text-transform or rewrite external/user text at runtime.
 */
export const uiCopyCanon = Object.freeze({
  id: 'SRM-TXT01',
  name: 'Zwroty do użytkownika wielką literą',
  rule: 'Zaimki osobowe i dzierżawcze odnoszące się bezpośrednio do użytkownika zapisujemy wielką literą w każdym miejscu zdania.',
  forms: 'Ty, Ci, Cię, Ciebie, Tobie, Tobą; Twój, Twoja, Twoje, Twoi, Twoją, Twojego, Twojej, Twojemu, Twoim, Twoimi, Twoich.',
  plural: 'Jeżeli zwracamy się do grupy użytkowników: Wy, Wam, Was, Wami, Wasz, Wasza, Wasze i pozostałe formy odmiany.',
  scope: 'Cała aplikacja: logowanie, ekran wejściowy, karta dostawcy, czat, nagłówki, etykiety, podpowiedzi, formularze, błędy, puste stany, powiadomienia i nazwy dostępne dla czytników ekranu.',
  future: 'Reguła obowiązuje wszystkie nowe oraz edytowane teksty, także przyszłe wypowiedzi asystenta AI. Kontrola zapisu jest częścią przeglądu każdego komponentu i każdej wiadomości.',
  boundary: 'Reguła dotyczy zwrotów do odbiorcy. Nie zmienia cytatów źródłowych, danych dostawcy ani wiadomości wpisanych przez użytkownika. Wyrazy „się”, „sobie” i „swój” zachowują zwykłą pisownię, jeśli nie rozpoczynają zdania.',
  examples: ['Cześć! Jestem SpendGuru, Twój doradca.', 'Cześć! Jestem SpendGuru, Twoja doradczyni.', 'Przygotowaliśmy dla Ciebie informacje o Twoich dostawcach.', 'Pomożemy Ci znaleźć dane ważne dla Twojej firmy.']
});
export const spendGuruCopy = Object.freeze({
  greeting: Object.freeze({ male: 'Cześć! Jestem SpendGuru, Twój doradca', anna: 'Cześć! Jestem SpendGuru, Twoja doradczyni' })
});
