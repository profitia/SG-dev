import assert from "node:assert/strict";
import test from "node:test";
import { emptyCard, sampleCard, validateDemoIdentifier } from "./fixture";

test("NIP and KRS are selected explicitly and normalized", () => {
  assert.deepEqual(validateDemoIdentifier("nip", "123-456-78-90"), {
    ok: true, kind: "nip", value: "1234567890",
  });
  assert.deepEqual(validateDemoIdentifier("krs", "0000 012345"), {
    ok: true, kind: "krs", value: "0000012345",
  });
});

test("invalid identifiers cannot show the sample card", () => {
  assert.equal(validateDemoIdentifier("unknown", "1234567890").ok, false);
  assert.equal(validateDemoIdentifier("nip", "123456789").ok, false);
  assert.equal(validateDemoIdentifier("krs", "123456789x").ok, false);
});

test("sample modules are labelled as test doubles and empty state has no data", () => {
  for (const section of [sampleCard.general, sampleCard.financial, sampleCard.kys]) {
    assert.match(section.source.model, /TEST_DOUBLE/);
    assert.match(section.warnings.join(" "), /Dane testowe/);
    assert.equal(section.retrievedAt, null);
  }
  for (const section of [emptyCard.general, emptyCard.financial, emptyCard.kys]) {
    assert.equal(section.status, "NOT_REQUESTED");
    assert.equal(section.data, null);
  }
});
