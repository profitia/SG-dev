// One reviewed transport implementation. The default facade preserves legacy
// callers; governed discovery supplies its separately admitted Source per hop.
export {isPublicAddress, publicUrl, resolvePublicUrl, safePublicFetch, createSafePublicFetch,
  type PublicPage, type PublicFetch} from '@profitia/platform-contracts/public-web-transport'
