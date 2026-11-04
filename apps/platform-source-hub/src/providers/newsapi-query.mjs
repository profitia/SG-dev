/** Optional business vocabulary expansion, explicitly text search rather than native categories. */
export const BUSINESS_EVENT_TERMS = Object.freeze({
  contracts: ['kontrakt', 'zamówienie', 'contract', 'order'],
  investments: ['inwestycja', 'investment'],
  mergers: ['fuzja', 'przejęcie', 'merger', 'acquisition'],
  financialResults: ['wyniki finansowe', 'financial results', 'earnings'],
  restructuring: ['restrukturyzacja', 'upadłość', 'restructuring', 'bankruptcy'],
  ownership: ['akcjonariusz', 'zmiana właściciela', 'shareholder'],
  leadership: ['zarząd', 'prezes', 'CEO', 'board'],
  supplierRisks: ['ryzyko dostawcy', 'supplier risk'],
  innovation: ['nowy produkt', 'nowa technologia', 'new product', 'new technology'],
});

/** @param {{ subject: string, eventTypes: (keyof typeof BUSINESS_EVENT_TERMS)[] }} input */
export function businessTerms({ subject, eventTypes }) {
  if (typeof subject !== 'string' || !subject.trim() || !Array.isArray(eventTypes) || !eventTypes.length || eventTypes.some(t => !Object.hasOwn(BUSINESS_EVENT_TERMS, t))) throw new Error('INVALID_BUSINESS_TERMS');
  return { phrases: [subject], any: [...new Set(eventTypes.flatMap(t => BUSINESS_EVENT_TERMS[t]))] };
}

/** @param {import('../../../../packages/platform-source-hub-contracts/index.js').Terms} terms */
export function compileTerms(terms) {
  if (!terms || typeof terms !== 'object' || Array.isArray(terms) || Object.keys(terms).some(k => !['all', 'any', 'phrases', 'excluded'].includes(k))) throw new Error('INVALID_TERMS');
  const literal = (s) => {
    if (typeof s !== 'string' || !s.trim() || /["\\\x00-\x1f]/.test(s) || s.length > 300) throw new Error('INVALID_TERM');
    return '"' + s.trim() + '"';
  };
  for (const list of Object.values(terms)) if (!Array.isArray(list) || list.length > 30) throw new Error('INVALID_TERMS');
  const required = [...(terms.all ?? []), ...(terms.phrases ?? [])].map(literal);
  if (terms.any?.length) required.push('(' + terms.any.map(literal).join(' OR ') + ')');
  const excluded = (terms.excluded ?? []).map(s => 'NOT ' + literal(s));
  if (!required.length && !excluded.length) throw new Error('EMPTY_TERMS');
  return [...required, ...excluded].join(' AND ');
}
