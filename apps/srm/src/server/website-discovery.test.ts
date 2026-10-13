import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { candidateWebsites, discoverWebsite, matchesWebsiteIdentity, normalizedWebsite, rasterLogo } from "./website-discovery";
import type { PublicPage } from "./safe-public-fetch";

const subject = { nip: "5213390341", krs: "0000258512", name: "Example Polska Spółka z ograniczoną odpowiedzialnością", registryWebsite: null };
const html = (url: string, content: string): PublicPage => ({ url, body: Buffer.from(content), contentType: "text/html; charset=utf-8" });
const legal = "<p>Właścicielem tej strony jest Example Polska. NIP: 521-33-90-341. KRS: 0000258512.</p>";

test("uses website hints only and never maps old registry arrays to current URLs", () => {
  assert.equal(normalizedWebsite("www.example.pl"), "https://www.example.pl/");
  assert.equal(normalizedWebsite([{ value: "https://old.example.pl" }]), null);
  assert.equal(normalizedWebsite("javascript:alert(1)"), null);
  assert.equal(candidateWebsites(subject)[0], "https://example.pl/");
  assert.ok(candidateWebsites(subject).length <= 6);
});
test("requires matching labeled identifier AND brand; ignores scripts, incidental or different IDs", () => {
  assert.ok(matchesWebsiteIdentity(legal, subject));
  assert.ok(matchesWebsiteIdentity("<p>Example Polska KRS 0000258512</p>", subject));
  for (const body of ["Example Polska NIP 1111111111", "Other NIP 5213390341", "Example 5213390341", "Example NIP 52133903410", '<p>Example</p><script>NIP 5213390341</script>']) assert.equal(matchesWebsiteIdentity(body, subject), false, body);
});
test("verifies contact page and rasterizes the actual logo; preserves provenance", async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><rect width="200" height="60" fill="#005A9C"/></svg>';
  const requested: string[] = [];
  const result = await discoverWebsite(subject, async url => {
    requested.push(url);
    if (url === "https://example.pl/") return html(url, '<header><img src="/brand.svg" alt="Logo Example"></header><a href="/kontakt/">Kontakt</a>');
    if (url.endsWith("/kontakt/")) return html(url, legal);
    if (url.endsWith("/brand.svg")) return { url, contentType: "image/svg+xml", body: Buffer.from(svg) };
    throw new Error("missing");
  });
  assert.equal(result.status, "FOUND"); assert.equal(result.websiteUrl, "https://example.pl/");
  assert.equal(result.evidenceUrl, "https://example.pl/kontakt/");
  assert.equal(result.logoSourceUrl, "https://example.pl/brand.svg");
  assert.ok(result.logoDataUrl?.startsWith("data:image/png;base64,"));
  const metadata = await sharp(Buffer.from(result.logoDataUrl!.split(",")[1], "base64")).metadata();
  assert.equal(metadata.width, 200); assert.equal(metadata.height, 60);
  assert.equal(requested.length, 3);
});
test("does not verify a candidate through a contact redirect to a different company site", async () => {
  const result = await discoverWebsite(subject, async url => url.endsWith("/contact")
    ? html("https://directory.example.com/", legal)
    : html(url, '<p>Example</p><a href="/contact">Contact</a>'));
  assert.equal(result.websiteUrl, null); assert.equal(result.status, "NOT_FOUND");
});
test("keeps a verified website when all image sources fail and rejects untrusted SVG", async () => {
  const result = await discoverWebsite(subject, async url => {
    if (url.endsWith(".png")) throw new Error("broken logo");
    return html(url, legal + '<header><img src="/logo.png" alt="logo"></header>');
  });
  assert.equal(result.status, "FOUND"); assert.equal(result.logoDataUrl, null);
  for (const payload of ['<image href="http://169.254.169.254/"/>', '<script>alert(1)</script>', '<foreignObject/>', '<style>@import "https://example.com";</style>']) {
    await assert.rejects(rasterLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">' + payload + '</svg>')), /UNSAFE_SVG/);
  }
});
test("registry URL still needs identity verification after ownership changes", async () => {
  const result = await discoverWebsite({ ...subject, registryWebsite: "https://old-brand.com/" }, async url => html(url, "<p>Domain for sale</p>"));
  assert.equal(result.websiteUrl, null);
});
