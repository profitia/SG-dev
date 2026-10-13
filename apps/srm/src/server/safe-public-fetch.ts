import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import ipaddr from "ipaddr.js";

export type PublicPage = { url: string; body: Buffer; contentType: string };
export type PublicFetch = (url: string, options?: { signal?: AbortSignal; maxBytes?: number }) => Promise<PublicPage>;
type Address = { address: string; family: number };
type Resolver = (hostname: string) => Promise<Address[]>;

export function isPublicAddress(address: string): boolean {
  try { return ipaddr.process(address).range() === "unicast"; } catch { return false; }
}
export function publicUrl(value: string): URL {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
    url.port || !url.hostname.includes(".") || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(url.hostname)) {
    throw new Error("UNSAFE_WEBSITE_URL");
  }
  url.hash = "";
  return url;
}

/** All answers must be public. The chosen address is pinned to the socket lookup. */
export async function resolvePublicUrl(value: string, resolver: Resolver = host => lookup(host, { all: true, verbatim: true })) {
  const url = publicUrl(value);
  const addresses = await resolver(url.hostname.replace(/^\[|\]$/g, ""));
  if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) throw new Error("UNSAFE_WEBSITE_ADDRESS");
  return { url, address: addresses[0] };
}

async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let onAbort: () => void = () => {};
  try { return await Promise.race([promise, new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error("WEBSITE_TIMEOUT")); signal.addEventListener("abort", onAbort, { once: true });
  })]); } finally { signal.removeEventListener("abort", onAbort); }
}

export const safePublicFetch: PublicFetch = async (value, options = {}) => {
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000);
  const maxBytes = Math.min(options.maxBytes ?? 1_500_000, 2_000_000);
  let next = value;
  for (let redirects = 0; redirects <= 4; redirects++) {
    const { url, address } = await abortable(resolvePublicUrl(next), signal);
    const pinnedLookup: LookupFunction = (_host, opts, callback) => {
      if (opts?.all) callback(null, [address]);
      else callback(null, address.address, address.family);
    };
    const response = await new Promise<{ redirect?: string; page?: PublicPage }>((resolve, reject) => {
      const req = (url.protocol === "https:" ? https : http).get(url, {
        signal, lookup: pinnedLookup, agent: false,
        headers: { "User-Agent": "SpendGuru-SRM/1.0 (supplier website verification)",
          Accept: "text/html,application/xhtml+xml,image/*;q=0.8", "Accept-Encoding": "identity" },
      }, res => {
        if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          resolve({ redirect: new URL(res.headers.location, url).href }); res.destroy(); return;
        }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300 ||
          (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity") ||
          Number(res.headers["content-length"] ?? 0) > maxBytes) {
          res.destroy(); reject(new Error("WEBSITE_RESPONSE_UNAVAILABLE")); return;
        }
        const chunks: Buffer[] = []; let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) { req.destroy(new Error("WEBSITE_TOO_LARGE")); return; }
          chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () => resolve({ page: { url: url.href, body: Buffer.concat(chunks), contentType: String(res.headers["content-type"] ?? "") } }));
      });
      req.on("error", reject);
    });
    if (response.page) return response.page;
    next = response.redirect!;
  }
  throw new Error("WEBSITE_REDIRECT_LIMIT");
};
