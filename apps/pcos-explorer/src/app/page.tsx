export const dynamic = "force-dynamic";

import { EXPLORER_IS_MOCK_PREVIEW, EXPLORER_ORG_ID } from "@/lib/org";
import { StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ConfidenceBar } from "@/components/ui/confidence-bar";
import { EmptyState, Divider } from "@/components/ui/misc";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  Network,
  BrainCircuit,
  Zap,
  FileSearch,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

interface DashboardData {
  envStates: Array<{
    id: string;
    environment: string;
    cognitionMaturityScore: number | null;
    isPromotionReady: boolean;
    lastHydrationAt: Date | null;
    topologyVersion: string | null;
  }>;
  latestRun: {
    id: string;
    status: string;
    stage: string;
    environment: string;
    recordsProcessed: number;
    currentPhase: string | null;
    completedAt: Date | null;
  } | null;
  ontologyCount: number;
  memoryCount: number;
  intelligenceCount: number;
  retrievalCount: number;
  embeddingCount: number;
  latestValidation: {
    status: string;
    isPromotionReady: boolean;
    maturityScore: {
      overallScore: number;
      maturityClass: string;
    } | null;
    promotionEvaluation: {
      readinessScore: number;
      blockers: unknown;
    } | null;
  } | null;
  previewWarning: string | null;
}

function isConnectionRefusedError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ECONNREFUSED"
  );
}

async function getDashboardData(): Promise<DashboardData> {
  if (EXPLORER_IS_MOCK_PREVIEW) {
    return {
      envStates: [],
      latestRun: null,
      ontologyCount: 0,
      memoryCount: 0,
      intelligenceCount: 0,
      retrievalCount: 0,
      embeddingCount: 0,
      latestValidation: null,
      previewWarning:
        "Mock preview mode is active. Root overview is intentionally running without Prisma-backed cognition queries so only the safe preview shell and dataset routes are exposed.",
    };
  }

  const orgId = EXPLORER_ORG_ID;
  const { prisma } = await import("@/lib/prisma");

  try {
    const [
      envStates,
      latestRun,
      ontologyCount,
      memoryCount,
      intelligenceCount,
      retrievalCount,
      embeddingCount,
      latestValidation,
    ] = await Promise.all([
      prisma.cognitionEnvironmentState.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { environment: "asc" },
      }),
      prisma.hydrationRun.findFirst({
        where: { orgId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.hydrationOntologyNode.count({
        where: { orgId, deletedAt: null },
      }),
      prisma.hydrationCognitionMemory.count({
        where: { orgId, deletedAt: null },
      }),
      prisma.hydrationIntelligenceUnit.count({
        where: { orgId, deletedAt: null },
      }),
      prisma.hydrationRetrievalDocument.count({
        where: { orgId, deletedAt: null },
      }),
      prisma.hydrationEmbeddingRecord.count({
        where: { orgId, deletedAt: null },
      }),
      prisma.cognitionValidationRun.findFirst({
        where: { orgId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { maturityScore: true, promotionEvaluation: true },
      }),
    ]);

    return {
      envStates,
      latestRun,
      ontologyCount,
      memoryCount,
      intelligenceCount,
      retrievalCount,
      embeddingCount,
      latestValidation,
      previewWarning: null,
    };
  } catch (error) {
    if (!isConnectionRefusedError(error)) {
      throw error;
    }

    return {
      envStates: [],
      latestRun: null,
      ontologyCount: 0,
      memoryCount: 0,
      intelligenceCount: 0,
      retrievalCount: 0,
      embeddingCount: 0,
      latestValidation: null,
      previewWarning:
        "Read-only Prisma source is unavailable in this local session. Explorer dataset routes remain available, but the root cognition overview is showing a preview fallback instead of live PostgreSQL-backed counts.",
    };
  }
}

const DOMAIN_CARDS = [
  { label: "Ontology Nodes", key: "ontologyCount", href: "/ontology", icon: Network, color: "text-blue-400" },
  { label: "Cognition Memory", key: "memoryCount", href: "/memory", icon: BrainCircuit, color: "text-purple-400" },
  { label: "Intelligence Units", key: "intelligenceCount", href: "/intelligence", icon: Zap, color: "text-amber-400" },
  { label: "Retrieval Documents", key: "retrievalCount", href: "/retrieval", icon: FileSearch, color: "text-green-400" },
  { label: "Embedding Records", key: "embeddingCount", href: "/embeddings", icon: Sparkles, color: "text-pink-400" },
] as const;

function EnvStateCard({ state }: { state: { environment: string; cognitionMaturityScore: number | null; isPromotionReady: boolean; lastHydrationAt: Date | null; topologyVersion: string | null } }) {
  const isReady = state.isPromotionReady;
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="flex items-center justify-between">
        <Badge variant={state.environment === "PROD" ? "success" : state.environment === "SANDBOX" ? "warning" : "default"}>
          {state.environment}
        </Badge>
        {isReady ? (
          <CheckCircle2 size={14} className="text-[hsl(142_71%_55%)]" />
        ) : (
          <Clock size={14} className="text-[hsl(var(--muted-foreground))]" />
        )}
      </div>
      <div className="mt-3">
        {state.cognitionMaturityScore != null ? (
          <>
            <p className="text-2xl font-semibold tabular-nums text-[hsl(var(--foreground))]">
              {Math.round(state.cognitionMaturityScore)}
              <span className="ml-1 text-sm font-normal text-[hsl(var(--muted-foreground))]">/100</span>
            </p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Maturity Score</p>
          </>
        ) : (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No score yet</p>
        )}
      </div>
      {state.lastHydrationAt && (
        <p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">
          Last hydration {formatDistanceToNow(state.lastHydrationAt, { addSuffix: true })}
        </p>
      )}
      {state.topologyVersion && (
        <p className="mt-0.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
          v{state.topologyVersion}
        </p>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  const counts: Record<string, number> = {
    ontologyCount: data.ontologyCount,
    memoryCount: data.memoryCount,
    intelligenceCount: data.intelligenceCount,
    retrievalCount: data.retrievalCount,
    embeddingCount: data.embeddingCount,
  };

  const totalArtifacts =
    data.ontologyCount +
    data.memoryCount +
    data.intelligenceCount +
    data.retrievalCount +
    data.embeddingCount;

  return (
    <div className="min-h-full">
      <PageHeader
        title="Cognition Overview"
        description="Operational state of the PCOS cognition substrate — what cognition did the system generate?"
      />

      <div className="p-6 space-y-6">
        {data.previewWarning && (
          <section>
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <h2 className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Local preview mode
              </h2>
              <p className="mt-2 text-sm text-[hsl(var(--foreground))]">{data.previewWarning}</p>
            </div>
          </section>
        )}

        {/* Environment States */}
        {data.envStates.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Environment States
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {data.envStates.map((s) => (
                <EnvStateCard key={s.id} state={s} />
              ))}
            </div>
          </section>
        )}

        {/* Cognition Artifact Counts */}
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Cognition Substrate · {totalArtifacts.toLocaleString()} total artifacts
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {DOMAIN_CARDS.map(({ label, key, href, icon: Icon, color }) => (
              <Link key={key} href={href} className="group block">
                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-colors group-hover:border-[hsl(var(--primary))] group-hover:bg-[hsl(var(--accent))]">
                  <Icon size={16} className={color} />
                  <p className="mt-2 text-xl font-semibold tabular-nums text-[hsl(var(--foreground))]">
                    {counts[key].toLocaleString()}
                  </p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{label}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Latest Hydration Run */}
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Latest Hydration Run
            </h2>
            {data.latestRun ? (
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border))]">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                    {data.latestRun.id}
                  </span>
                  <StatusBadge status={data.latestRun.status} />
                </div>
                <div className="grid grid-cols-2 gap-0 divide-x divide-[hsl(var(--border))]">
                  <div className="px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Stage</p>
                    <p className="mt-0.5 font-mono text-[11px] text-[hsl(var(--foreground))]">
                      {data.latestRun.stage}
                    </p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Environment</p>
                    <p className="mt-0.5 font-mono text-[11px] text-[hsl(var(--foreground))]">
                      {data.latestRun.environment}
                    </p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Records</p>
                    <p className="mt-0.5 font-mono text-[11px] text-[hsl(var(--foreground))]">
                      {data.latestRun.recordsProcessed.toLocaleString()}
                    </p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Phase</p>
                    <p className="mt-0.5 font-mono text-[11px] text-[hsl(var(--foreground))]">
                      {data.latestRun.currentPhase ?? "—"}
                    </p>
                  </div>
                </div>
                {data.latestRun.completedAt && (
                  <div className="px-4 py-2">
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      Completed {formatDistanceToNow(data.latestRun.completedAt, { addSuffix: true })}
                    </p>
                  </div>
                )}
                <div className="px-4 py-2">
                  <Link
                    href="/hydration"
                    className="text-[11px] text-[hsl(var(--primary))] hover:underline"
                  >
                    View all runs →
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyState title="No hydration runs found" description="Run the PCOS-H3 pipeline to generate cognition." />
            )}
          </section>

          {/* Latest Validation */}
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Latest Validation
            </h2>
            {data.latestValidation ? (
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border))]">
                <div className="flex items-center justify-between px-4 py-3">
                  <StatusBadge status={data.latestValidation.status} />
                  {data.latestValidation.isPromotionReady ? (
                    <div className="flex items-center gap-1 text-[hsl(142_71%_55%)]">
                      <CheckCircle2 size={12} />
                      <span className="text-[11px]">Promotion Ready</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                      <XCircle size={12} />
                      <span className="text-[11px]">Not Ready</span>
                    </div>
                  )}
                </div>
                {data.latestValidation.maturityScore && (
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                        Maturity Score
                      </p>
                      <span className="font-mono text-sm font-medium text-[hsl(var(--foreground))]">
                        {Math.round(data.latestValidation.maturityScore.overallScore)}/100
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
                      <div
                        className="h-full rounded-full bg-[hsl(var(--primary))]"
                        style={{
                          width: `${data.latestValidation.maturityScore.overallScore}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                      {data.latestValidation.maturityScore.maturityClass}
                    </p>
                  </div>
                )}
                {data.latestValidation.promotionEvaluation && (
                  <div className="px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                      Readiness
                    </p>
                    <ConfidenceBar score={data.latestValidation.promotionEvaluation.readinessScore} />
                    {(data.latestValidation.promotionEvaluation.blockers as string[]).length > 0 && (
                      <p className="mt-1 text-[10px] text-[hsl(0_84%_65%)]">
                        {(data.latestValidation.promotionEvaluation.blockers as string[]).length} blocker(s)
                      </p>
                    )}
                  </div>
                )}
                <div className="px-4 py-2">
                  <Link
                    href="/validation"
                    className="text-[11px] text-[hsl(var(--primary))] hover:underline"
                  >
                    View validation details →
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyState title="No validation runs found" description="Run the PCOS-H4 pipeline to validate cognition." />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
