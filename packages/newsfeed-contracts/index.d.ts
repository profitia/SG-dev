export const NEWS_DISCOVERY_CONTRACT_VERSION: '0.1.0';
export type NewsCategory = 'business' | 'entertainment' | 'general' | 'health' | 'science' | 'sports' | 'technology';
export interface Terms { all?: string[]; any?: string[]; phrases?: string[]; excluded?: string[] }
export interface DiscoveryQuery {
  mode: 'articles' | 'headlines';
  /** Optional advanced text expression; provider capability determines grammar support. */
  text?: string;
  terms?: Terms;
  fields?: ('headline' | 'summary' | 'body')[];
  category?: NewsCategory;
  /** Headline edition, NEVER the location of the event. */
  editionCountry?: string;
  /** IDs belong to the selected provider, not to a shared global publisher registry. */
  publisherIds?: string[];
  domains?: string[];
  excludedDomains?: string[];
  language?: string;
  publishedAfter?: string;
  publishedBefore?: string;
  order?: 'newest' | 'relevance' | 'publisherPopularity';
  page?: number;
  pageSize?: number;
  /** Recognized as a criterion; rejected when a provider cannot support it. */
  eventLocation?: { country?: string; region?: string; city?: string; latitude?: number; longitude?: number };
}
export interface PublisherQuery { category?: NewsCategory; language?: string; publisherCountry?: string }
export interface NewsArticle {
  url: string;
  headline: string | null;
  summary: string | null;
  bodyPreview: string | null;
  imageUrl: string | null;
  byline: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  publisher: { id: string | null; name: string | null };
  language: string | null;
  category: NewsCategory | null;
  eventLocation: null;
  provenance: { provider: string; mode: 'articles' | 'headlines'; fullTextAvailable: boolean };
}
export interface NewsPublisher {
  id: string; name: string; description: string | null; url: string;
  category: string | null; language: string | null; publisherCountry: string | null;
}
export interface DiscoveryResult {
  contractVersion: typeof NEWS_DISCOVERY_CONTRACT_VERSION;
  provider: string; status: 'ok' | 'empty'; mode: 'articles' | 'headlines';
  totalAvailable: number; items: NewsArticle[]; page: number; pageSize: number;
  /** Pagination is plan-dependent; this does not promise every counted item is retrievable. */
  moreResultsReported: boolean;
  observedAt: string;
}
export interface PublisherResult {
  contractVersion: typeof NEWS_DISCOVERY_CONTRACT_VERSION;
  provider: string; status: 'ok' | 'empty'; items: NewsPublisher[]; observedAt: string;
}
export interface SearchCapabilities {
  text?: boolean; advancedText?: boolean; terms?: boolean; fields?: string[];
  publisherIds?: boolean | {maximum?: number; maximumInAdapter?: number; providerMaximum?: string};
  domains?: boolean; excludedDomains?: boolean; language?: string[];
  category?: string[]; editionCountry?: string[];
  publishedAfter?: boolean; publishedBefore?: boolean; order?: string[];
  pageSize?: {min:number;max:number;default:number};
  defaultOrder?: string; maxQueryCharacters?: number; constraints?: string[];
}
export interface DiscoveryCapabilities {
  provider: string; documentedAt: string; evidence: string;
  articles: SearchCapabilities; headlines: SearchCapabilities;
  publishers: {category?:string[];language?:string[];publisherCountry?:string[];catalogueScope:string};
  unsupported: Record<string,boolean|string[]>;
  limits: {history:string;delay:string;retrievableResults:string;fullArticleContent:boolean};
}
export interface NewsDiscoveryProvider {
  search(query: DiscoveryQuery): Promise<DiscoveryResult>;
  listPublishers(query?: PublisherQuery): Promise<PublisherResult>;
  getCapabilities(): DiscoveryCapabilities;
}
export interface DiscoveryEvent {
  provider: string; operation: 'articles' | 'headlines' | 'publishers';
  outcome: string; durationMs: number; httpStatus: number | null; count: number | null;
}
