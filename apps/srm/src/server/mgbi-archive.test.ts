import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from 'node:crypto';
import { captureFinitePayload } from '@profitia/platform-payload-capture';
import { fetchMgbiPages,readPreparedMgbiPages,saveMgbiArchive,takePersistedMgbiArchive } from "./mgbi-archive";

test('only complete reader-owned pages reuse an immutable archive representation and exact finite shape',async()=>{
  const text='{"count":1,"results":[{"id":"synthetic","content":{"__proto__":{"x":1},"toJSON":"ordinary data","value":-0,"unicode":"Łódź\\n"}}]}';
  const response=await fetchMgbiPages(new URL('https://api.mgbi.pl/records'),{},new AbortController().signal,async()=>new Response(text));
  assert.equal(response.errorCode,null);
  const data=readPreparedMgbiPages(response.pages,1)!;
  assert(data);assert(Object.isFrozen(data));assert(Object.isFrozen(data.pages));assert(Object.isFrozen(response.records));
  assert.throws(()=>{(response.records[0] as {id:string}).id='changed'},TypeError);
  const expected=JSON.stringify({pages:[JSON.parse(text)]});
  assert.equal(data.payload,expected);assert.equal(data.byteLength,Buffer.byteLength(expected));
  assert.equal(data.digest,createHash('sha256').update(expected).digest('hex'));
  const reference=captureFinitePayload(data.pages);
  assert.equal(data.depth,reference.depth);assert.equal(data.nodeCount,reference.nodeCount);
  assert.equal(readPreparedMgbiPages(response.pages,1),data);
  assert.equal(readPreparedMgbiPages(response.pages,2),undefined);
  assert.equal(readPreparedMgbiPages(Object.freeze([...response.pages]) as unknown[],1),undefined);
  assert.equal(readPreparedMgbiPages(JSON.parse(JSON.stringify(response.pages)),1),undefined);
});

test('reader refuses non-finite parsed numbers and excessive depth instead of minting reusable pages',async()=>{
  for(const text of ['{"count":1,"results":[{"value":1e999}]}',
    '{"count":1,"results":['+'['.repeat(129)+'0'+']'.repeat(129)+']}']){
    const result=await fetchMgbiPages(new URL('https://api.mgbi.pl/records'),{},new AbortController().signal,async()=>new Response(text));
    assert.equal(result.errorCode,'INVALID_JSON');assert.equal(readPreparedMgbiPages(result.pages,0),undefined);
  }
});

test('serialized or fabricated archive rows cannot mint a once-only writer receipt',()=>{
 const forged={organization_id:'11111111-1111-4111-8111-111111111111',nip:'5213390341',model:'pl-krs-rdf-record' as const,
  payload_text:'{}',payload_jsonb_sha256:'a'.repeat(64),record_count:0,pages_match:true};
 assert.equal(takePersistedMgbiArchive(forged,{query:async()=>({rows:[]})} as never,[]),undefined);
});

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
