import { load } from "cheerio";
import sharp from "sharp";
import type { SupplierWebIdentityData } from "@profitia/srm-xray";
import { publicUrl, safePublicFetch, type PublicFetch, type PublicPage } from "./safe-public-fetch";

export type WebSubject = { nip: string; krs: string | null; name: string; registryWebsite: string | null };
export type Discovery = Omit<SupplierWebIdentityData, "checkedAt">;

export function normalizedWebsite(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || value.length > 2000) return null;
  try { return publicUrl(/^[a-z]+:/i.test(value.trim()) ? value.trim() : "https://" + value.trim()).href; } catch { return null; }
}
const fold = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L").toLowerCase();
function brandWords(name: string): string[] {
  return fold(name).replace(/spolka z ograniczona odpowiedzialnoscia|spolka akcyjna|spolka komandytowa|spolka jawna|sp\.? z o\.?o\.?|s\.?a\.?$/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(word => word.length > 2);
}
/** Candidates are a bounded hint only; none is returned without legal identity evidence. */
export function candidateWebsites(subject: WebSubject): string[] {
  const words = brandWords(subject.name).slice(0, 3);
  const brand = words.find(word => !["polska", "poland", "firma", "przedsiebiorstwo"].includes(word));
  const labels = brand ? [brand, words.join(""), words.join("-")] : [];
  return [...new Set([subject.registryWebsite, ...labels.flatMap(label => [`https://${label}.pl/`, `https://${label}.com/`])])]
    .map(normalizedWebsite).filter((url): url is string => !!url).slice(0, 6);
}
function labeledIdentifier(text: string, label: string, value: string): boolean {
  const digits = value.split("").join("[\\s.\\-]*");
  return new RegExp("\\b" + label + "(?:\\s*(?:nr|numer|:))?[\\s:.-]*" + digits + "(?![\\s.-]*\\d)", "i").test(text);
}
export function matchesWebsiteIdentity(html: string, subject: WebSubject): boolean {
  const $ = load(html); $("script,style,noscript,template").remove();
  const text = $.root().text().replace(/\u00a0/g, " ").replace(/\s+/g, " ");
  const brand = brandWords(subject.name).filter(word => !["polska", "poland"].includes(word))[0];
  return !!brand && fold(text).includes(brand) &&
    (labeledIdentifier(text, "NIP", subject.nip) || (!!subject.krs && labeledIdentifier(text, "KRS", subject.krs)));
}
function htmlPage(page: PublicPage): boolean { return /(?:text\/html|application\/xhtml\+xml)/i.test(page.contentType); }

function sameSiteLinks(page: PublicPage): string[] {
  const $ = load(page.body.toString("utf8")); const urls: string[] = [];
  $("a[href]").each((_, node) => {
    const a = $(node), hint = (a.attr("href") ?? "") + " " + a.text();
    if (!/contact|kontakt|legal|impressum|o.firmie|o.nas|privacy|prywatnos/i.test(hint)) return;
    try { const url = publicUrl(new URL(a.attr("href")!, page.url).href);
      if (url.origin === new URL(page.url).origin && !/\.(pdf|docx?|zip)$/i.test(url.pathname)) urls.push(url.href);
    } catch {}
  });
  return [...new Set(urls)].slice(0, 3);
}
export function logoCandidates(page: PublicPage): (string | Buffer)[] {
  const $ = load(page.body.toString("utf8")); const result: (string | Buffer)[] = [];
  function add(value: unknown) {
    if (typeof value !== "string" || !value.trim() || value.startsWith("data:")) return;
    try { result.push(publicUrl(new URL(value, page.url).href).href); } catch {}
  }
  $("script[type='application/ld+json']").slice(0, 10).each((_, node) => {
    try {
      const walk = (entry: unknown, depth = 0): void => {
        if (!entry || typeof entry !== "object" || depth > 5) return;
        if (Array.isArray(entry)) { entry.slice(0, 20).forEach(item => walk(item, depth + 1)); return; }
        const obj = entry as Record<string, unknown>;
        if (/Organization|Corporation|LocalBusiness/.test(String(obj["@type"]))) {
          const logo = obj.logo; add(typeof logo === "object" && logo ? (logo as Record<string, unknown>).url : logo);
        }
        if (obj["@graph"]) walk(obj["@graph"], depth + 1);
      };
      walk(JSON.parse($(node).text()));
    } catch {}
  });
  $("header img, [role='banner'] img, a[class*='logo'] img, img[class*='logo']").each((_, node) => {
    const img = $(node);
    if (/logo/i.test([img.attr("alt"), img.attr("class"), img.attr("src"), img.parent().attr("class")].join(" "))) add(img.attr("src") ?? img.attr("data-src"));
  });
  $("header svg, [role='banner'] svg, a[class*='logo'] svg").slice(0, 2).each((_, node) => { result.push(Buffer.from($.html(node))); });
  $("link[rel]").each((_, node) => { if (/apple-touch-icon/i.test($(node).attr("rel") ?? "")) add($(node).attr("href")); });
  $("link[rel]").each((_, node) => { if (/^(?:shortcut )?icon$/i.test($(node).attr("rel") ?? "")) add($(node).attr("href")); });
  return [...new Set(result)].slice(0, 8);
}
export async function rasterLogo(input: Buffer): Promise<string> {
  if (input.length > 2_000_000) throw new Error("LOGO_TOO_LARGE");
  const text = input.toString("utf8");
  if (/<svg\b/i.test(text) && (/<!DOCTYPE|<!ENTITY|<script|<foreignObject|<image|<use|<style|<animate|<set\b|\bon\w+\s*=|url\s*\(|(?:href|src)\s*=/i.test(text))) {
    throw new Error("UNSAFE_SVG");
  }
  const image = sharp(input, { limitInputPixels: 4_000_000, animated: false }).timeout({ seconds: 2 });
  const meta = await image.metadata();
  if (!["png", "jpeg", "webp", "gif", "svg", "avif"].includes(meta.format ?? "") ||
    !meta.width || !meta.height || meta.width < 16 || meta.height < 16) throw new Error("UNSUPPORTED_LOGO");
  const png = await image.resize(256, 128, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  if (png.length > 150_000) throw new Error("LOGO_TOO_LARGE");
  return "data:image/png;base64," + png.toString("base64");
}

/** No search-engine scraping, paid calls, cookies or browser execution. */
export async function discoverWebsite(subject: WebSubject, fetcher: PublicFetch = safePublicFetch): Promise<Discovery> {
  const signal = AbortSignal.timeout(35_000);
  let requests = 0, networkFailure = false;
  const fetchPage: PublicFetch = async (url, options = {}) => {
    if (++requests > 18) throw new Error("DISCOVERY_BUDGET");
    signal.throwIfAborted();
    return fetcher(url, { ...options, signal });
  };
  for (const candidate of candidateWebsites(subject)) {
    if (signal.aborted || requests >= 14) break;
    let page: PublicPage;
    try { page = await fetchPage(candidate); if (!htmlPage(page)) continue; } catch { networkFailure = true; continue; }
    let evidence: string | null = null;
    if (matchesWebsiteIdentity(page.body.toString("utf8"), subject)) evidence = page.url;
    for (const link of evidence ? [] : sameSiteLinks(page)) {
      try { const linked = await fetchPage(link);
        // Cross-site redirects from legal links cannot verify the original domain.
        if (new URL(linked.url).origin === new URL(page.url).origin && htmlPage(linked) &&
          matchesWebsiteIdentity(linked.body.toString("utf8"), subject)) { evidence = linked.url; break; }
      } catch {}
    }
    // Even a registry hint is checked: registered URLs can expire or change owners.
    if (!evidence) continue;
    let logoDataUrl: string | null = null, logoSourceUrl: string | null = null;
    for (const asset of logoCandidates(page)) {
      try {
        const image = typeof asset === "string" ? await fetchPage(asset, { maxBytes: 2_000_000 }) : null;
        logoDataUrl = await rasterLogo(image?.body ?? asset as Buffer);
        logoSourceUrl = image?.url ?? page.url; break;
      } catch {}
    }
    return { status: "FOUND", websiteUrl: page.url, logoDataUrl, logoSourceUrl,
      evidenceUrl: evidence, method: candidate === subject.registryWebsite ? "REGISTRY_AND_WEBSITE" : "WEBSITE_IDENTITY" };
  }
  return { status: networkFailure || signal.aborted ? "UNAVAILABLE" : "NOT_FOUND", websiteUrl: null,
    logoDataUrl: null, logoSourceUrl: null, evidenceUrl: null, method: null };
}
