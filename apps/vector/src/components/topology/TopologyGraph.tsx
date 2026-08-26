"use client"

import { useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  BackgroundVariant,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { TopologyNode, TopologyEdge, Bottleneck } from "@/lib/topology/types"

// ── Color maps ────────────────────────────────────────────────────────────────

const DEP_TYPE_COLOR: Record<string, string> = {
  runtime: "#3b82f6",       // blue
  orchestration: "#f59e0b", // amber
  ui: "#06b6d4",            // cyan
  infra: "#6b7280",         // gray
  cognition: "#8b5cf6",     // violet
  ai: "#a855f7",            // purple
  localization: "#10b981",  // emerald
  deployment: "#ef4444",    // red
}

const CRITICALITY_WIDTH: Record<string, number> = {
  LOW: 1,
  MEDIUM: 1.5,
  HIGH: 2,
  CRITICAL: 2.5,
}

// ── Layout algorithm ----------------------------------------------------------

const NODE_W = 220
const NODE_H = 80
const H_GAP = 60
const V_GAP = 120

function computePositions(
  topoNodes: TopologyNode[]
): Record<string, { x: number; y: number }> {
  // Group by layer
  const byLayer = new Map<number, TopologyNode[]>()
  topoNodes.forEach((n) => {
    if (!byLayer.has(n.layer)) byLayer.set(n.layer, [])
    byLayer.get(n.layer)!.push(n)
  })

  const maxLayer = Math.max(...[...byLayer.keys()], 0)
  const maxLayerWidth = Math.max(...[...byLayer.values()].map((l) => l.length), 1)
  const canvasWidth = maxLayerWidth * (NODE_W + H_GAP)

  const positions: Record<string, { x: number; y: number }> = {}
  byLayer.forEach((layerNodes, layer) => {
    const layerTotalWidth = layerNodes.length * NODE_W + (layerNodes.length - 1) * H_GAP
    const startX = (canvasWidth - layerTotalWidth) / 2

    layerNodes.forEach((node, i) => {
      positions[node.projectId] = {
        x: startX + i * (NODE_W + H_GAP),
        y: layer * (NODE_H + V_GAP) + 40,
      }
    })
  })

  return positions
}

// ── Custom node renderer ──────────────────────────────────────────────────────

function TopologyNodeComponent({ data }: { data: { node: TopologyNode } }) {
  const n = data.node
  const borderColor = n.isBottleneck ? "#f59e0b" : "hsl(var(--border))"
  const borderLeft = n.isBottleneck ? "4px solid #f59e0b" : "1px solid hsl(var(--border))"

  return (
    <div
      style={{
        width: NODE_W,
        height: NODE_H,
        background: "hsl(var(--card))",
        borderRadius: 8,
        border: "1px solid hsl(var(--border))",
        borderLeft,
        padding: "10px 14px",
        boxShadow: n.isBottleneck
          ? "0 0 0 1px rgba(245,158,11,0.2), 0 2px 8px rgba(0,0,0,0.3)"
          : "0 2px 8px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "hsl(var(--foreground))",
          lineHeight: 1.3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {n.projectName}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
        {n.isBottleneck && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#f59e0b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            BOTTLENECK
          </span>
        )}
        {n.domainNames.slice(0, 2).map((dn) => (
          <span
            key={dn}
            style={{
              fontSize: 9,
              color: "hsl(var(--muted-foreground))",
              background: "hsl(var(--muted))",
              borderRadius: 4,
              padding: "1px 5px",
            }}
          >
            {dn}
          </span>
        ))}
        {n.inDegree > 0 && (
          <span style={{ fontSize: 9, color: "hsl(var(--muted-foreground))", marginLeft: "auto" }}>
            ↑{n.inDegree}
          </span>
        )}
      </div>
    </div>
  )
}

const nodeTypes = {
  topologyNode: TopologyNodeComponent,
}

// ── Main component ────────────────────────────────────────────────────────────

interface TopologyGraphProps {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
  bottlenecks: Bottleneck[]
}

export function TopologyGraph({ nodes: topoNodes, edges: topoEdges }: TopologyGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (topoNodes.length === 0) return { nodes: [], edges: [] }

    const positions = computePositions(topoNodes)

    const nodes: Node[] = topoNodes.map((n) => ({
      id: n.projectId,
      position: positions[n.projectId] ?? { x: 0, y: 0 },
      data: { node: n },
      type: "topologyNode",
    }))

    const edges: Edge[] = topoEdges.map((e) => {
      const color = DEP_TYPE_COLOR[e.dependencyType] ?? "hsl(var(--border))"
      const isCritical = e.criticality === "CRITICAL"
      return {
        id: e.id,
        source: e.sourceProjectId,
        target: e.targetProjectId,
        animated: isCritical,
        style: {
          stroke: color,
          strokeWidth: CRITICALITY_WIDTH[e.criticality] ?? 1.5,
          strokeOpacity: 0.8,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
          width: 14,
          height: 14,
        },
        label: e.dependencyType,
        labelStyle: { fontSize: 9, fill: color, fontWeight: 600 },
        labelBgStyle: { fill: "hsl(var(--background))", fillOpacity: 0.85 },
        labelBgPadding: [3, 5] as [number, number],
        labelBgBorderRadius: 3,
      }
    })

    return { nodes, edges }
  }, [topoNodes, topoEdges])

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  if (topoNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Brak projektów do wyświetlenia
      </div>
    )
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.3}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="hsl(var(--border))"
      />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
