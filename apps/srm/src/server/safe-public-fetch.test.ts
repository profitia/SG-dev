import assert from "node:assert/strict";
import test from "node:test";
import { isPublicAddress, publicUrl, resolvePublicUrl } from "./safe-public-fetch";

test("rejects private, link-local, loopback, documentation and mapped addresses", () => {
  for (const address of ["127.0.0.1", "10.2.3.4", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "192.0.2.1", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "ff02::1"]) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});
test("rejects non-web schemes, credentials and ports", () => {
  for (const url of ["file:///etc/passwd", "ftp://example.com/", "https://user:pass@example.com/", "https://example.com:8080/", "http://localhost/", "https://a.internal/"]) assert.throws(() => publicUrl(url));
});
test("pins a verified public DNS answer; rejects mixed public/private answers", async () => {
  const result = await resolvePublicUrl("https://example.com/", async () => [{ address: "8.8.8.8", family: 4 }]);
  assert.deepEqual(result.address, { address: "8.8.8.8", family: 4 });
  await assert.rejects(resolvePublicUrl("https://example.com/", async () => [{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }]), /UNSAFE/);
  await assert.rejects(resolvePublicUrl("https://example.com/", async () => []), /UNSAFE/);
  await assert.rejects(resolvePublicUrl("http://2130706433/", async host => [{ address: host, family: 4 }]), /UNSAFE/);
});
