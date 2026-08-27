import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { buildCanonicalConversationReadModel } from '@/lib/pmos/flight-record-read'
import { CopyArtifactButton } from './copy-artifact-button'
import { getConversationByIdWithFallback } from '@/lib/conversations-read'

export const dynamic = 'force-dynamic'

const IMPORTANCE_COLORS: Record<string, string> = {
  foundational: 'text-accent bg-accent/10 border-accent/20',
  high: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  low: 'text-text-tertiary bg-bg-surface border-bg-border',
}

const TYPE_COLORS: Record<string, string> = {
  architecture: 'text-purple-400',
  implementation: 'text-blue-400',
  debugging: 'text-red-400',
  philosophy: 'text-emerald-400',
  runtime_analysis: 'text-cyan-400',
  orchestration: 'text-orange-400',
  ux: 'text-pink-400',
  continuity: 'text-yellow-400',
  governance: 'text-indigo-400',
  infrastructure: 'text-teal-400',
}

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const artifact = await getConversationByIdWithFallback(params.id)

  if (!artifact) notFound()

  const conversationRows = await db.$queryRaw<Array<{ flightRecordJson: unknown }>>`
    SELECT flight_record_json AS "flightRecordJson"
    FROM conversation_artifacts
    WHERE id = ${params.id}
    LIMIT 1
  `

  const derivedArtifacts = await db.$queryRaw<DerivedArtifactRecord[]>`
    SELECT
      id,
      artifact_kind AS "artifactKind",
      artifact_nature AS "artifactNature",
      version,
      status,
      task_id AS "taskId",
      conversation_id AS "conversationId",
      payload,
      copy_ready_text AS "copyReadyText",
      source_refs AS "sourceRefs",
      created_at AS "createdAt"
    FROM artifacts
    WHERE conversation_id = ${artifact.conversationId}
      AND artifact_nature = 'DERIVED'
    ORDER BY created_at DESC
  `

  const canonical = buildCanonicalConversationReadModel(conversationRows[0]?.flightRecordJson)
  const conversationType = canonical.metadata.conversationType ?? artifact.conversationType ?? 'unknown'
  const importanceLevel = canonical.metadata.importanceLevel ?? artifact.importanceLevel ?? 'medium'
  const etap = canonical.metadata.etap ?? artifact.etap
  const subetap = canonical.metadata.subetap ?? artifact.subetap
  const displayTimestamp = canonical.metadata.timestamp ?? artifact.timestamp.toISOString()
  const displayTaskId = canonical.metadata.taskId ?? artifact.taskId

  const hasLinks =
    artifact.linkedDecisions.length > 0 ||
    artifact.linkedWarnings.length > 0 ||
    artifact.linkedNodes.length > 0 ||
    artifact.linkedLogs.length > 0 ||
    artifact.linkedPrinciples.length > 0 ||
    artifact.linkedPrompts.length > 0

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-base/95 backdrop-blur border-b border-bg-border px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/conversations" className="text-text-tertiary hover:text-text-secondary transition-colors flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded border ${IMPORTANCE_COLORS[importanceLevel] ?? IMPORTANCE_COLORS.medium}`}>
                  {importanceLevel}
                </span>
                <span className={`text-xs font-medium ${TYPE_COLORS[conversationType] ?? 'text-text-secondary'}`}>
                  {conversationType.replace('_', ' ')}
                </span>
                {etap && (
                  <span className="text-xs text-text-tertiary font-mono">{etap}{subetap ? ` / ${subetap}` : ''}</span>
                )}
                <span className="text-text-muted text-xs">#{artifact.chronologyOrder}</span>
              </div>
              <p className="text-text-secondary text-xs mt-0.5">
                {new Date(displayTimestamp).toLocaleString('pl-PL', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>
          {displayTaskId && (
            <span className="text-xs font-mono text-text-tertiary border border-bg-border rounded px-2 py-0.5">
              {displayTaskId}
            </span>
          )}
        </div>
      </div>

      <div className="px-8 py-6 max-w-4xl space-y-6">
        {!canonical.available ? (
          <section className="bg-orange-950/20 border border-orange-700/40 rounded-lg p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-orange-300 mb-2">Canonical Record Unavailable</p>
            <p className="text-orange-200 text-sm leading-relaxed">
              This conversation cannot be rendered because `flightRecordJson` is missing or invalid.
            </p>
          </section>
        ) : (
          <>
            <section className="bg-bg-surface border border-bg-border rounded-lg p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Task</p>
              <p className="text-text-primary text-sm leading-relaxed">{canonical.task.originalTaskRequest}</p>
            </section>

            <section className="bg-bg-surface border border-bg-border rounded-lg p-5 space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Reasoning Summary</p>
                <p className="text-text-primary text-sm leading-relaxed">{canonical.analysis.reasoningSummary}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Execution Summary</p>
                <div className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap break-words">
                  {canonical.analysis.executionSummary}
                </div>
              </div>
            </section>

            {(artifact.domains.length > 0 || artifact.tags.length > 0) && (
              <section className="flex flex-wrap gap-3">
                {artifact.domains.map((d) => (
                  <span key={d} className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                    {d}
                  </span>
                ))}
                {artifact.tags.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-bg-surface text-text-secondary border border-bg-border">
                    #{t}
                  </span>
                ))}
              </section>
            )}

            <section className="bg-bg-surface border border-bg-border rounded-lg p-5 space-y-4">
              <ListSection title="Findings" items={canonical.findings.findings} emptyLabel="No findings recorded." />
              <ListSection title="Blockers" items={canonical.findings.blockers} emptyLabel="No blockers recorded." />
              <ListSection title="Residual Risks" items={canonical.findings.residualRisks} emptyLabel="No residual risks recorded." />
            </section>

            <section className="bg-bg-surface border border-bg-border rounded-lg p-5">
              <ListSection title="Decisions" items={canonical.decisions.decisions} emptyLabel="No decisions recorded." />
            </section>

            <section className="bg-bg-surface border border-bg-border rounded-lg p-5 space-y-4">
              <ListSection title="Recommendations" items={canonical.actions.recommendations} emptyLabel="No recommendations recorded." />
              <ListSection title="Validations Executed" items={canonical.actions.validationsExecuted} emptyLabel="No validations recorded." />
              <ListSection title="Validations Not Executed" items={canonical.actions.validationsNotExecuted} emptyLabel="None." />
              <ListSection title="Artifacts Created" items={canonical.actions.artifactsCreated} emptyLabel="No artifacts recorded." />
              <ListSection title="Artifacts Modified" items={canonical.actions.artifactsModified} emptyLabel="No artifacts recorded." />
            </section>

            <section className="bg-bg-surface border border-bg-border rounded-lg p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Result</p>
              <p className="text-text-primary text-sm leading-relaxed">{canonical.result.finalStatus}</p>
            </section>

            <section className="bg-bg-surface border border-bg-border rounded-lg p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-3">Completion Evidence</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <EvidencePill label="closeoutState" value={canonical.completionEvidence.closeoutState} />
                <EvidencePill label="pmosSaveStatus" value={canonical.completionEvidence.pmosSaveStatus} />
                <EvidencePill label="vectorRebuildStatus" value={canonical.completionEvidence.vectorRebuildStatus} />
                <EvidencePill label="archiveCompletenessStatus" value={canonical.completionEvidence.archiveCompletenessStatus} />
                <EvidencePill label="executionTrailStatus" value={canonical.completionEvidence.executionTrailStatus} />
              </div>
            </section>

            <section className="bg-bg-surface border border-bg-border rounded-lg p-5 space-y-4">
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Derived Artifacts</p>
              {derivedArtifacts.length > 0 ? (
                <div className="space-y-4">
                  {derivedArtifacts.map((derivedArtifact) => {
                    const sourceRefs = Array.isArray(derivedArtifact.sourceRefs) ? derivedArtifact.sourceRefs : []
                    const handoffPayload = derivedArtifact.artifactKind === 'HANDOFF' ? asHandoffPayload(derivedArtifact.payload) : null
                    const handoffCopyText = handoffPayload?.bridgePayloadText ?? derivedArtifact.copyReadyText

                    return (
                      <div key={derivedArtifact.id} className="rounded-lg border border-bg-border bg-bg-elevated p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-sm text-text-primary">{derivedArtifact.artifactKind}</p>
                            <p className="text-xs text-text-tertiary mt-1">
                              {derivedArtifact.version} · {derivedArtifact.status} · {new Date(derivedArtifact.createdAt).toLocaleString('pl-PL')}
                            </p>
                          </div>
                          {handoffCopyText ? <CopyArtifactButton text={handoffCopyText} /> : null}
                        </div>

                        {handoffPayload ? (
                          <>
                            <div className="rounded border border-bg-border bg-bg-base p-3 space-y-1 text-sm">
                              <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">GPT Handoff</p>
                              <p className="text-text-primary">Status: {derivedArtifact.status}</p>
                              <p className="text-text-primary">Persistence: POSTGRESQL</p>
                              <p className="text-text-primary break-all">Artifact ID: {derivedArtifact.id}</p>
                              <p className="text-text-primary break-all">Conversation ID: {derivedArtifact.conversationId}</p>
                              <p className="text-text-primary">Task ID: {derivedArtifact.taskId}</p>
                              <p className="text-text-primary">Artifact Nature: {derivedArtifact.artifactNature}</p>
                              <p className="text-text-primary">Artifact Kind: {derivedArtifact.artifactKind}</p>
                              <p className="text-text-primary">Created At: {new Date(derivedArtifact.createdAt).toLocaleString('pl-PL')}</p>
                            </div>

                            <div className="space-y-3">
                              <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Handoff Summary</p>
                              <SummarySection title="Original Objective" items={[handoffPayload.originalObjective]} emptyLabel="None recorded." />
                              <SummarySection title="CURRENT STATE" items={handoffPayload.currentState} emptyLabel="None recorded." />
                              <SummarySection title="Completed Work" items={handoffPayload.completedWork} emptyLabel="None recorded." />
                              <SummarySection title="Not Completed" items={handoffPayload.notCompleted} emptyLabel="None recorded." />
                              <SummarySection title="Key Findings" items={handoffPayload.keyFindings} emptyLabel="None recorded." />
                              <SummarySection title="Decisions" items={handoffPayload.decisions} emptyLabel="None recorded." />
                              <SummarySection title="Blockers" items={handoffPayload.blockers} emptyLabel="None recorded." />
                              <SummarySection title="Residual Risks" items={handoffPayload.residualRisks} emptyLabel="None recorded." />
                              <SummarySection title="Open Questions" items={handoffPayload.openQuestions} emptyLabel="None recorded." />
                              <SummarySection title="Outstanding Topics" items={handoffPayload.outstandingTopics} emptyLabel="None recorded." />
                            </div>

                            <div>
                              <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">GPT Bridge Payload</p>
                              <pre className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap break-words rounded border border-bg-border bg-bg-base p-3 overflow-x-auto">
                                {handoffPayload.bridgePayloadText}
                              </pre>
                            </div>
                          </>
                        ) : null}

                        {sourceRefs.length > 0 ? (
                          <div>
                            <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Source Refs</p>
                            <ul className="space-y-1.5 text-sm text-text-secondary leading-relaxed">
                              {sourceRefs.map((sourceRef, index) => {
                                const kind = typeof sourceRef === 'object' && sourceRef !== null && 'sourceArtifactKind' in sourceRef
                                  ? String(sourceRef.sourceArtifactKind)
                                  : 'UNKNOWN'
                                const ref = typeof sourceRef === 'object' && sourceRef !== null && 'sourceArtifactRef' in sourceRef
                                  ? String(sourceRef.sourceArtifactRef)
                                  : 'UNKNOWN'

                                return (
                                  <li key={`${derivedArtifact.id}-${index}`} className="flex gap-2">
                                    <span className="text-text-muted">-</span>
                                    <span>{kind}: {ref}</span>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        ) : null}

                        {!handoffPayload && derivedArtifact.copyReadyText ? (
                          <div>
                            <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Copy Ready Text</p>
                            <pre className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap break-words rounded border border-bg-border bg-bg-base p-3 overflow-x-auto">
                              {derivedArtifact.copyReadyText}
                            </pre>
                          </div>
                        ) : (
                          <p className="text-sm text-text-tertiary">No copy-ready payload recorded.</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary">No derived artifacts recorded.</p>
              )}
            </section>
          </>
        )}

        {/* Linked Entities */}
        {hasLinks && (
          <section>
            <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-3">Linked Entities</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {artifact.linkedDecisions.map(({ decision }) => (
                <Link key={decision.id} href={`/decisions/${decision.id}`} className="flex items-start gap-2 p-3 rounded-lg bg-bg-surface border border-bg-border hover:border-bg-hover transition-colors group">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500/70 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">ADR-{String(decision.number).padStart(3, '0')}</p>
                    <p className="text-xs text-text-primary group-hover:text-accent transition-colors truncate">{decision.title}</p>
                  </div>
                </Link>
              ))}
              {artifact.linkedWarnings.map(({ warning }) => (
                <Link key={warning.id} href={`/warnings/${warning.id}`} className="flex items-start gap-2 p-3 rounded-lg bg-bg-surface border border-bg-border hover:border-bg-hover transition-colors group">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${warning.severity === 'critical' ? 'bg-red-500' : warning.severity === 'high' ? 'bg-orange-400' : 'bg-yellow-500'}`} />
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Warning · {warning.severity}</p>
                    <p className="text-xs text-text-primary group-hover:text-accent transition-colors truncate">{warning.title}</p>
                  </div>
                </Link>
              ))}
              {artifact.linkedNodes.map(({ node }) => (
                <Link key={node.id} href={`/roadmap`} className="flex items-start gap-2 p-3 rounded-lg bg-bg-surface border border-bg-border hover:border-bg-hover transition-colors group">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400/70 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Roadmap · {node.status}</p>
                    <p className="text-xs text-text-primary group-hover:text-accent transition-colors truncate">{node.title}</p>
                  </div>
                </Link>
              ))}
              {artifact.linkedPrinciples.map(({ principle }) => (
                <Link key={principle.id} href={`/principles`} className="flex items-start gap-2 p-3 rounded-lg bg-bg-surface border border-bg-border hover:border-bg-hover transition-colors group">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Principle</p>
                    <p className="text-xs text-text-primary group-hover:text-accent transition-colors truncate">{principle.title}</p>
                  </div>
                </Link>
              ))}
              {artifact.linkedLogs.map(({ log }) => (
                <Link key={log.id} href={`/logs`} className="flex items-start gap-2 p-3 rounded-lg bg-bg-surface border border-bg-border hover:border-bg-hover transition-colors group">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/70 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Execution Log</p>
                    <p className="text-xs text-text-primary group-hover:text-accent transition-colors truncate">{log.title}</p>
                  </div>
                </Link>
              ))}
              {artifact.linkedPrompts.map(({ promptExecution }) => (
                <Link key={promptExecution.id} href={`/prompts`} className="flex items-start gap-2 p-3 rounded-lg bg-bg-surface border border-bg-border hover:border-bg-hover transition-colors group">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent/70 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Prompt · {promptExecution.status}</p>
                    <p className="text-xs text-text-primary group-hover:text-accent transition-colors truncate">{promptExecution.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Conversation ID */}
        <section className="pb-8">
          <p className="text-xs text-text-muted font-mono">{artifact.conversationId}</p>
        </section>
      </div>
    </div>
  )
}

type DerivedArtifactRecord = {
  id: string
  artifactKind: string
  artifactNature: string
  version: string
  status: string
  taskId: string | null
  conversationId: string
  payload: unknown
  copyReadyText: string | null
  sourceRefs: unknown
  createdAt: Date
}

type HandoffPayloadView = {
  originalObjective: string
  currentState: string[]
  completedWork: string[]
  notCompleted: string[]
  keyFindings: string[]
  decisions: string[]
  blockers: string[]
  residualRisks: string[]
  openQuestions: string[]
  outstandingTopics: string[]
  bridgePayloadText: string
}

function asHandoffPayload(value: unknown): HandoffPayloadView | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const record = value as Record<string, unknown>
  const asString = (input: unknown): string => typeof input === 'string' ? input : ''
  const asStringArray = (input: unknown): string[] => Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string') : []

  return {
    originalObjective: asString(record.originalObjective),
    currentState: asStringArray(record.currentState),
    completedWork: asStringArray(record.completedWork),
    notCompleted: asStringArray(record.notCompleted),
    keyFindings: asStringArray(record.keyFindings),
    decisions: asStringArray(record.decisions),
    blockers: asStringArray(record.blockers),
    residualRisks: asStringArray(record.residualRisks),
    openQuestions: asStringArray(record.openQuestions),
    outstandingTopics: asStringArray(record.outstandingTopics),
    bridgePayloadText: asString(record.bridgePayloadText),
  }
}

function SummarySection({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">{title}</p>
      {items.length > 0 ? (
        <ul className="space-y-1.5 text-sm text-text-secondary leading-relaxed">
          {items.map((item) => (
            <li key={`${title}-${item}`} className="flex gap-2">
              <span className="text-text-muted">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-tertiary">{emptyLabel}</p>
      )}
    </div>
  )
}

function ListSection({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">{title}</p>
      {items.length > 0 ? (
        <ul className="space-y-1.5 text-sm text-text-secondary leading-relaxed">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-text-muted">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-tertiary">{emptyLabel}</p>
      )}
    </div>
  )
}

function EvidencePill({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded border border-bg-border bg-bg-elevated px-3 py-2">
      <p className="text-text-muted font-mono mb-1">{label}</p>
      <p className="text-text-primary">{value ?? 'UNKNOWN'}</p>
    </div>
  )
}
