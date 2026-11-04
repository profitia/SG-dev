// Provider documentation snapshot: 2026-11-03. Evidence is recorded separately.
export const CATEGORIES = Object.freeze(['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology']);
// "ud" is the provider's documented token, not a claim that it is ISO-639-1 Urdu.
export const LANGUAGES = Object.freeze(['ar', 'de', 'en', 'es', 'fr', 'he', 'it', 'nl', 'no', 'pt', 'ru', 'sv', 'ud', 'zh']);
export const SOURCE_COUNTRIES = Object.freeze('ae ar at au be bg br ca ch cn co cu cz de eg fr gb gr hk hu id ie il in it jp kr lt lv ma mx my ng nl no nz ph pl pt ro rs ru sa se sg si sk th tr tw ua us ve za'.split(' '));
export const HEADLINE_COUNTRIES = Object.freeze(['us']);

export function getCapabilities() {
  return {
    provider: 'newsapi', documentedAt: '2026-11-03', evidence: 'documentation; see docs/newsapi-live-evidence.json for actual probes',
    articles: { text: true, advancedText: true, terms: true, fields: ['headline', 'summary', 'body'], publisherIds: { maximum: 20 }, domains: true, excludedDomains: true, language: [...LANGUAGES], publishedAfter: true, publishedBefore: true, order: ['newest', 'relevance', 'publisherPopularity'], pageSize: { min: 1, max: 100, default: 100 }, defaultOrder: 'newest', maxQueryCharacters: 500 },
    headlines: { text: true, advancedText: false, category: [...CATEGORIES], editionCountry: [...HEADLINE_COUNTRIES], publisherIds: {maximumInAdapter:20,providerMaximum:'not stated in current endpoint reference'}, pageSize: { min: 1, max: 100, default: 20 }, constraints: ['publisherIds excludes editionCountry and category', 'provider-defined order; no requested sorting'] },
    publishers: { category: [...CATEGORIES], language: [...LANGUAGES], publisherCountry: [...SOURCE_COUNTRIES], catalogueScope: 'top-headlines subset, not the Everything publisher universe' },
    unsupported: { eventLocation: ['country', 'region', 'city', 'coordinates'], articleLanguageMetadata: true, articleCategoryMetadata: true, nativeBusinessEventTypes: true },
    limits: { history: 'account-plan dependent', delay: 'account-plan dependent', retrievableResults: 'account-plan dependent; totalAvailable is not an entitlement', fullArticleContent: false },
  };
}
