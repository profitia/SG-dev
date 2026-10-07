import assert from "node:assert/strict";
import { test } from "node:test";
import type { SectionEnvelope, VerclyKysData } from "@profitia/srm-xray";
import { issuePeselToken, toPublicKysSection, verifyPeselToken } from "./pesel-reveal";

const secret = "a-private-test-secret-with-at-least-32-characters";
const snapshotId = "507839c1-d08f-44be-8edf-8b1ec6709245";
const reference = { snapshotId, list: "beneficialOwners" as const, index: 0 };

test("PESEL reveal token is signed, scoped, expires and rejects tampering", () => {
  const now = Date.now();
  const token = issuePeselToken(secret, reference, now + 60_000);
  assert.deepEqual(verifyPeselToken(secret, token, now), reference);
  assert.equal(verifyPeselToken(secret, token, now + 60_001), null);
  assert.equal(verifyPeselToken(secret, token.slice(0, -1) + "x", now), null);
  assert.equal(verifyPeselToken("different-secret-of-sufficient-length-123", token, now), null);
});

test("public KYS response contains reveal references but no plaintext PESEL", () => {
  const section: SectionEnvelope<VerclyKysData> = {
    status: "SUCCESS", source: { provider: "VERCLY", model: "KYS_NIP", recordId: "report" },
    retrievedAt: new Date().toISOString(), effectiveAt: null, warnings: [],
    data: { correlationId: null, reportId: "report", isComplete: true, queriedRegisters: [], stateAsOf: null,
      relatedPersons: [{ fullName: "Example", pesel: "12345678901", birthDate: null, positions: [], citizenship: [], foundIn: [], sanctionsMatch: false, pepMatch: false }],
      beneficialOwners: [{ fullName: "Other", pesel: "10987654321", birthDate: null, positions: [], citizenship: [], foundIn: [], sanctionsMatch: false, pepMatch: false }],
    },
  };
  const result = toPublicKysSection(section, snapshotId, secret);
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes("12345678901"));
  assert.ok(!serialized.includes("10987654321"));
  assert.equal(result.data?.relatedPersons?.[0]?.pesel, null);
  assert.equal(result.data?.beneficialOwners?.[0]?.pesel, null);
  assert.deepEqual(verifyPeselToken(secret, result.data?.beneficialOwners?.[0]?.peselRevealToken), reference);
});
