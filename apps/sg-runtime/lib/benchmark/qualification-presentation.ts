import { assessPciEligibility, type BenchmarkSemanticProfile } from './qualification'

const meanings = {
  pl: {PRICE_LEVEL:'Cena jednostkowa', PRICE_INDEX:'Indeks cenowy', QUANTITY:'Ilość / wolumen / zapas', RATE:'Stopa / procent', OTHER:'Inna wielkość ekonomiczna', UNDETERMINED:'Znaczenie nieustalone'},
  en: {PRICE_LEVEL:'Unit price', PRICE_INDEX:'Price index', QUANTITY:'Quantity / volume / stock', RATE:'Rate / percentage', OTHER:'Other economic measure', UNDETERMINED:'Meaning undetermined'},
}
const reasons = {
  pl: {UNIT_PRICE:'Kontekst ceny i jednostka pieniężna na jednostkę produktu lub instrumentu.', PRICE_INDEX:'Kontekst indeksu cenowego i jednostka indeksowa; to nie cena nominalna.', PHYSICAL_QUANTITY:'Metadane opisują wielkość fizyczną, np. zapasy lub produkcję, nie cenę.', RELATIVE_RATE:'Jednostka procentowa i kontekst stopy lub zmiany.', EXCHANGE_RATE:'Kurs między walutami, nie cena produktu.', NON_PRICE_INDEX:'Indeks dotyczy wielkości innej niż ceny.', MONETARY_AGGREGATE:'Wartość pieniężna agregatu, nie cena jednostkowa.', CONFLICTING_METADATA:'Metadane są sprzeczne. Sprawdź opis i jednostkę w źródle.', INSUFFICIENT_METADATA:'Brak wystarczających metadanych. Sprawdź opis i jednostkę w źródle przed deklaracją rodzaju danych.'},
  en: {UNIT_PRICE:'Price context and a monetary unit per product or instrument unit.', PRICE_INDEX:'Price-index context and index unit; this is not a nominal price.', PHYSICAL_QUANTITY:'Metadata describe a physical quantity, such as inventory or production, not a price.', RELATIVE_RATE:'Percentage unit and rate or change context.', EXCHANGE_RATE:'An exchange rate between currencies, not a product price.', NON_PRICE_INDEX:'The index measures something other than prices.', MONETARY_AGGREGATE:'A monetary aggregate, not a unit price.', CONFLICTING_METADATA:'Metadata conflict. Check the source description and unit.', INSUFFICIENT_METADATA:'Insufficient metadata. Check the source description and unit before declaring the data type.'},
}
export function presentQualification(profile: BenchmarkSemanticProfile, locale:'pl'|'en', model?:'PCI', valueKind?:''|'PRICE_LEVEL'|'PRICE_INDEX') {
  const eligibility = model ? assessPciEligibility(profile, valueKind) : null
  const status = eligibility?.status
  const label = status ? (locale === 'pl' ? {SUITABLE:'PCI: odpowiedni semantycznie', UNSUITABLE:'PCI: nieodpowiedni semantycznie', VERIFY:'PCI: wymaga weryfikacji', NOT_EVALUATED:'PCI: nieoceniony'} : {SUITABLE:'PCI: semantically suitable', UNSUITABLE:'PCI: semantically unsuitable', VERIFY:'PCI: requires verification', NOT_EVALUATED:'PCI: not evaluated'})[status] : null
  const reason = eligibility?.reason === 'VARIANT_MISMATCH'
    ? (locale === 'pl' ? 'Deklaracja rodzaju danych nie odpowiada metadanym. Wybierz ' : 'The declared data type conflicts with the metadata. Select ') + meanings[locale][profile.classification] + '.'
    : reasons[locale][profile.reason]
  const action = status === 'UNSUITABLE' && eligibility?.reason !== 'VARIANT_MISMATCH'
    ? (locale === 'pl' ? ' Do PCI wybierz benchmark ceny lub indeksu cenowego.' : ' For PCI, choose a price or price-index benchmark.') : ''
  return {classification:meanings[locale][profile.classification], eligibility:label, reason:reason + action, status,
    readinessNote:locale === 'pl' ? 'Dostępność historii i okresów sprawdzamy osobno w PCI.' : 'History and period availability are checked separately in PCI.'}
}
