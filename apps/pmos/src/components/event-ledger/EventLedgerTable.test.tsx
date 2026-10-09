import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCanonicalConversationView } from './EventLedgerTable'

test('SRM exported completion display remains byte-identical to the legacy view', () => {
  const rawJson = { metadata: { project: 'SRM', taskId: 'SRM-TEST' }, task: {}, analysis: {}, findings: {}, decisions: {}, actions: {}, result: {}, completionEvidence: { closeoutState: 'CLOSEOUT_COMPLETE', pmosSaveStatus: 'SUCCEEDED' } }
  const selected = { sourceTable: 'conversation_artifacts', record: {}, rawJson, linkedConversation: null } as const
  const expected = '# PMOS Flight Record - SRM-TEST\n\n> **Project:** SRM\n\n---\n\n## Completion Evidence\n\n- closeoutState: CLOSEOUT_COMPLETE\n- pmosSaveStatus: SUCCEEDED\n\n---'
  assert.equal(buildCanonicalConversationView(selected), expected)
  assert.equal(buildCanonicalConversationView({ ...selected, sourceTable: 'prompt_executions', linkedConversation: { record: {}, rawJson } }), expected)
})

test('SG2 export is snapshot provenance and never claims latest lifecycle state', () => {
  for (const project of ['SpendGuru 2.0', 'SpendGuru 2.0 - PCOS Runtime']) {
    const selected = { sourceTable: 'conversation_artifacts', record: {}, linkedConversation: null, rawJson: { metadata: { project, taskId: 'SG2-TEST' }, completionEvidence: { closeoutState: 'PMOS_SAVE_SUCCEEDED' } } } as const
    const text = buildCanonicalConversationView(selected)!
    assert.match(text, /Immutable snapshot completion evidence/)
    assert.match(text, /Point-in-time snapshot only/); assert.match(text, /requires verified append-only lifecycle evidence/)
    assert.doesNotMatch(text, /CLOSEOUT_COMPLETE/)
  }
})
