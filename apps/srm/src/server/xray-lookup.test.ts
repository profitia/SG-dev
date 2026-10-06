import assert from "node:assert/strict";
import test from "node:test";
import { validateXrayRequest } from "./xray-lookup";

const base = { name: "XTB SPÓŁKA AKCYJNA", phone: "+48222019550" };

test("accepts KRS and a checksum-valid NIP without WWW", () => {
  assert.deepEqual(validateXrayRequest({ ...base, kind: "krs", identifier: "0000217580" }).identifier, { type: "KRS", value: "0000217580" });
  assert.deepEqual(validateXrayRequest({ ...base, kind: "nip", identifier: "527-244-39-55" }).identifier, { type: "NIP", value: "5272443955" });
});

test("allows identifier-only MGBI lookup and rejects invalid optional hints", () => {
  assert.deepEqual(validateXrayRequest({ kind: "krs", identifier: "0000217580" }), {
    identifier: { type: "KRS", value: "0000217580" }, name: "", phone: "",
  });
  assert.throws(() => validateXrayRequest({ ...base, kind: "nip", identifier: "5272443956" }), /kontrolna/);
  assert.throws(() => validateXrayRequest({ ...base, kind: "krs", identifier: "0000217580", website: "http://xtb.com" }), /HTTPS/);
  assert.throws(() => validateXrayRequest({ ...base, kind: "krs", identifier: "0000217580", phone: "bad" }), /telefon/);
});
