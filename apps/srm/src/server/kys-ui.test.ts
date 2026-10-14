import assert from "node:assert/strict";
import test from "node:test";
import { formatKysRetrievedAt, kysRegistryRows, kysListRows, type VerclyKysData } from "@profitia/srm-xray";

test("acquisition timestamp uses Warsaw time including seconds and rejects unzoned or absent timestamps", () => {
  assert.equal(formatKysRetrievedAt("2026-10-14T10:23:45Z"), "14.10.2026, 12:23:45");
  assert.equal(formatKysRetrievedAt("2026-01-14T10:23:45Z"), "14.01.2026, 11:23:45");
  assert.equal(formatKysRetrievedAt("2026-10-14T12:23:45+02:00"), "14.10.2026, 12:23:45");
  for (const timestamp of [undefined, null, "", "invalid", "2026-10-14", "2026-10-14T10:23:45"]) {
    assert.equal(formatKysRetrievedAt(timestamp), null);
  }
});

test("shared registry rows distinguish missing evidence from explicit negative results", () => {
  const data: VerclyKysData = { correlationId: "test", reportId: "test", isComplete: true, queriedRegisters: [], stateAsOf: null,
    registryChecks: { krzListed: false, vatActive: true, euVat: null } };
  assert.deepEqual(kysRegistryRows(data).slice(0, 4), [
    ["Krajowy Rejestr Zadłużonych", "Nie"], ["Podatnik VAT czynny", "Tak"],
    ["Podatnik VAT UE", "nie ustalono"], ["Status działalności", "nie ustalono"],
  ]);
  assert.equal(kysRegistryRows(data)[6][1], "nie ustalono");
});

test("sanctions rows preserve source matches, unknown results and official list labels", () => {
  const data: VerclyKysData = { correlationId: "test", reportId: "test", isComplete: true, queriedRegisters: [], stateAsOf: null,
    screenedLists: [
      {name: "pl_mswia_sanctions", type: "SANCTIONS", matched: true},
      {name: "pl_knf_warnings", type: "WARNING", matched: false},
      {name: "NEW_LIST", type: "WARNING", matched: null as unknown as boolean},
    ] };
  const before = JSON.stringify(data);
  assert.deepEqual(kysListRows(data), [
    {label: "Lista osób i podmiotów objętych sankcjami (MSWiA)", result: "Tak", matched: true},
    {label: "Lista ostrzeżeń publicznych (KNF)", result: "Nie", matched: false},
    {label: "NEW LIST", result: "nie ustalono", matched: null as unknown as boolean},
  ]);
  assert.equal(JSON.stringify(data), before);
});
