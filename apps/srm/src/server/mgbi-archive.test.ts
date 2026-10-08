import assert from "node:assert/strict";
import test from "node:test";
import { fetchMgbiPages, saveMgbiArchive } from "./mgbi-archive";

test("collects every page without removing unmapped fields or personal data", async () => {
  const urls: string[] = [];
  const source = [
    { id: "rdf-1", content: { extracted_fields: { "RZiS.OtherValue": "123", "Person.PESEL": "12345678901" } } },
    { id: "rdf-2", content: { standardized_fields: { bs: { a_ta_cfy: 456 } }, note: "unmapped" } },
  ];
  const result = await fetchMgbiPages(new URL("https://api.mgbi.pl/v1/models/pl-krs-rdf-record/records?identifiers.pl_nip=1234567890"),
    { Authorization: "test" }, new AbortController().signal, async (url) => {
      const request = new URL(String(url));
      urls.push(request.toString());
      const index = Number(request.searchParams.get("page")) - 1;
      assert.equal(request.searchParams.get("per_page"), "100");
      return Response.json({ count: 2, pages: 2, results: [source[index]] });
    });
  assert.equal(result.errorCode, null);
  assert.equal(urls.length, 2);
  assert.deepEqual(result.records, source);
  assert.equal(JSON.stringify(result.pages).includes("12345678901"), true);
  assert.equal(JSON.stringify(result.pages).includes("unmapped"), true);
});

test("does not accept a missing page as a complete MGBI response", async () => {
  const result = await fetchMgbiPages(new URL("https://api.mgbi.pl/records"), {}, new AbortController().signal,
    async (url) => Number(new URL(String(url)).searchParams.get("page")) === 1
      ? Response.json({ count: 2, pages: 2, results: [{ id: "first" }] })
      : new Response("unavailable", { status: 503 }));
  assert.equal(result.errorCode, "HTTP_503");
  assert.deepEqual(result.pages, []);
  await assert.rejects(saveMgbiArchive("00000000-0000-4000-8000-000000000001", "bad", "pl-krs-rdf-record",
    [{ results: [] }], 0, new Date().toISOString(), "00000000-0000-4000-8000-000000000002"), /NIP/);
});
