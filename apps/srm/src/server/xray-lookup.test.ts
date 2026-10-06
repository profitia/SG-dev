import assert from "node:assert/strict";
import test from "node:test";
import { validateKysRequest } from "./xray-lookup";

const base = { name: "XTB SPÓŁKA AKCYJNA", phone: "+48222019550" };

test("accepts KRS and a checksum-valid NIP without WWW", () => {
  assert.deepEqual(validateKysRequest({ ...base, kind: "krs", identifier: "0000217580" }).identifier, { type: "KRS", value: "0000217580" });
  assert.deepEqual(validateKysRequest({ ...base, kind: "nip", identifier: "527-244-39-55" }).identifier, { type: "NIP", value: "5272443955" });
});

test("rejects invalid NIP and incomplete FULL provider hints before any lookup", () => {
  assert.throws(() => validateKysRequest({ ...base, kind: "nip", identifier: "5272443956" }), /kontrolna/);
  assert.throws(() => validateKysRequest({ ...base, kind: "krs", identifier: "0000217580", website: "http://xtb.com" }), /HTTPS/);
  assert.throws(() => validateKysRequest({ ...base, kind: "krs", identifier: "0000217580", phone: "" }), /wymaga/);
});
