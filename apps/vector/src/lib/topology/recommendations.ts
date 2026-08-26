// VECTOR Topology Engine — Recommendations + Orchestrator
// Generates topology-aware strategic recommendations and runs the full analysis

import type {
  TopologyInput,
  TopologyAnalysis,
  TopologyRecommendation,
  TopologyNode,
  TopologyEdge,
  Bottleneck,
  CriticalPath,
  TopologySignal,
} from "./types"
import { buildTopologyGraph } from "./graph"
import { generateTopologySignals } from "./signals"

const MAX_RECOMMENDATIONS = 5

export function generateTopologyRecommendations(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  bottlenecks: Bottleneck[],
  criticalPaths: CriticalPath[],
  signals: TopologySignal[],
  input: TopologyInput
): TopologyRecommendation[] {
  const recommendations: TopologyRecommendation[] = []

  // ── R1. Critical bottleneck — stabilizuj lub izoluj ──────────────────────
  const criticalBottlenecks = bottlenecks.filter((b) => b.dependentCount >= 4)
  criticalBottlenecks.forEach((b) => {
    if (recommendations.length >= MAX_RECOMMENDATIONS) return
    recommendations.push({
      priority: "high",
      title: `Stabilizuj ${b.projectName} — ${b.dependentCount} projektów zależy od tego zasobu`,
      reasoning: `${b.projectName} ma ${b.dependentCount} bezpośrednich dependentów (${b.dependencyTypes.join(", ")}). Każdy przestój propaguje się do wielu projektów. Priorytetem jest upewnienie się, że ten zasób jest stabilny, dobrze przetestowany i nie ma aktywnych blokerów.`,
    })
  })

  // ── R2. Cascade risk — shared blocker na bottlenecku ─────────────────────
  const cascadeSignals = signals.filter((s) => s.type === "cascade_risk" && s.level === "critical")
  cascadeSignals.forEach((s) => {
    if (recommendations.length >= MAX_RECOMMENDATIONS) return
    const affected = (s.projectIds ?? [])
      .map((id) => input.projects.find((p) => p.id === id)?.name ?? id)
      .join(", ")
    recommendations.push({
      priority: "high",
      title: `Usuń blokadę na krytycznym węźle topologii`,
      reasoning: `${affected} pełni rolę bottlenecku i jednocześnie jest objęty shared blockerem. Zablokowanie tego węzła propaguje się kaskadowo. Rozwiąż blokadę jako priorytet strategiczny.`,
    })
  })

  // ── R3. Critical path — ścieżka zależności wymaga ochrony ────────────────
  if (criticalPaths.length > 0 && recommendations.length < MAX_RECOMMENDATIONS) {
    const path = criticalPaths[0]
    recommendations.push({
      priority: "high",
      title: `Chroń krytyczną ścieżkę: ${path.projectNames.join(" → ")}`,
      reasoning: `Ta ścieżka zależności ${path.projectNames.length} projektów jest oznaczona jako krytyczna lub wysoka. Opóźnienie w którymkolwiek z tych projektów bezpośrednio blokuje kolejne ogniwa.`,
    })
  }

  // ── R4. Bottleneck average — ogólna rekomendacja przy wielu bottleneckach ─
  if (bottlenecks.length >= 2 && recommendations.length < MAX_RECOMMENDATIONS) {
    recommendations.push({
      priority: "medium",
      title: `Zdywersyfikuj zależności — ${bottlenecks.length} bottlenecków w topologii`,
      reasoning: `Masz ${bottlenecks.length} projektów, od których zależy wielu innych. To koncentracja ryzyka. Rozważ wyodrębnienie wspólnych usług lub zastąpienie bezpośrednich dependencji kontraktem API.`,
    })
  }

  // ── R5. Isolated active projects — czy są poza mapą z premedytacją? ───────
  const isolatedSignals = signals.filter((s) => s.type === "isolated")
  if (isolatedSignals.length >= 2 && recommendations.length < MAX_RECOMMENDATIONS) {
    recommendations.push({
      priority: "medium",
      title: `${isolatedSignals.length} aktywnych projektów poza topologią — zmapuj zależności`,
      reasoning: `Projekty bez zadeklarowanych zależności mogą być faktycznie izolowane lub po prostu niezmapowane. Uzupełnienie topologii daje pełniejszy obraz ryzyka i pozwala lepiej zarządzać priorytetami.`,
    })
  }

  // ── R6. Deep chain — rozważ uproszczenie architektury ────────────────────
  const maxLayer = Math.max(...nodes.map((n) => n.layer), 0)
  if (maxLayer >= 3 && recommendations.length < MAX_RECOMMENDATIONS) {
    recommendations.push({
      priority: "medium",
      title: `Rozważ spłaszczenie łańcucha zależności (głębokość ${maxLayer})`,
      reasoning: `Łańcuch o głębokości ${maxLayer} oznacza, że problem w warstwie 0 propaguje się przez ${maxLayer} poziomów. Dla każdego poziomu ponad 2 warto zastanowić się, czy zależność jest konieczna.`,
    })
  }

  return recommendations.slice(0, MAX_RECOMMENDATIONS)
}

// ---- Master orchestrator ----------------------------------------------------

export function runTopologyAnalysis(input: TopologyInput): TopologyAnalysis {
  const { nodes, edges, bottlenecks, criticalPaths, isolatedProjectIds } =
    buildTopologyGraph(input)

  const signals = generateTopologySignals(nodes, edges, bottlenecks, input)

  const recommendations = generateTopologyRecommendations(
    nodes,
    edges,
    bottlenecks,
    criticalPaths,
    signals,
    input
  )

  return {
    nodes,
    edges,
    bottlenecks,
    criticalPaths,
    isolatedProjectIds,
    domains: input.domains,
    sharedBlockers: input.sharedBlockers,
    signals,
    recommendations,
    generatedAt: new Date(),
  }
}
