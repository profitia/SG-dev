import type {DiscoveryQuery, NewsDiscoveryProvider, DiscoveryResult, PublisherQuery} from '../../../packages/newsfeed-contracts/index.js';
import {createNewsApiProvider} from '../src/newsapi.mjs';
// Compile-only downstream contract fixture. This never sends requests.
const query: DiscoveryQuery = {mode:'articles',terms:{phrases:['Budimex']},publishedAfter:'2026-11-01',order:'newest'};
const publishers: PublisherQuery = {publisherCountry:'pl',category:'business'};
const factory: (key:string) => NewsDiscoveryProvider = key => createNewsApiProvider({apiKey:key,targetEnvironment:'development'});
const consume = async (provider:NewsDiscoveryProvider):Promise<DiscoveryResult> => {
  await provider.listPublishers(publishers);
  return provider.search(query);
};
void factory; void consume;
// @ts-expect-error NewsAPI-specific fields must not become consumer contract parameters.
const providerSpecific: DiscoveryQuery = {mode:'articles',q:'Budimex'};
// @ts-expect-error Returned publisher identity never asserts the event location.
const location: string = (null as unknown as DiscoveryResult).items[0].eventLocation;
void providerSpecific; void location;
