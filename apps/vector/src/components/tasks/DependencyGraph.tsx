"use client"

import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, Node, Edge, MarkerType, BackgroundVariant } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useMemo } from "react"
import { TaskType } from "@/types"

const TYPE_COLOR: Record<TaskType, string> = {
  BLOCKER: "#ef4444",
  TASK: "#64748b",
  BUG: "#f97316",
  IDEA: "#8b5cf6",
  DECISION: "#0ea5e9",
  NOTE: "#94a3b8",
  REFACTOR: "#84cc16",
}

const STATUS_OPACITY: Record<string, number> = {
  DONE: 0.45,
  ARCHIVED: 0.3,
  ACTIVE: 1,
  PLANNED: 0.8,
  BLOCKED: 1,
  REVIEW: 0.9,
}

interface DepTask {
  id: string
  title: string
  type: TaskType
  status: string
  priority: string
  projectId: string
  updatedAt: Date
  createdAt: Date
  etapId: string | null
  subetapId: string | null
  project?: { name: string; slug: string } | null
}

interface Dependency {
  id: string
  blockingTask: DepTask
  blockedTask: DepTask
}

interface DependencyGraphProps {
  dependencies: Dependency[]
}

function getLayoutPositions(nodes: string[], edges: { source: string; target: string }[]) {
  // Simple dagre-like layered layout without the library
  // Build adjacency and find root nodes (no incoming edges)
  const inDegree: Record<string, number> = {}
  nodes.forEach((n) => (inDegree[n] = 0))
  edges.forEach((e) => {
    inDegree[e.target] = (inDegree[e.target] ?? 0) + 1
  })

  const layers: string[][] = []
  const placed = new Set<string>()

  // BFS layer assignment
  let currentLayer = nodes.filter((n) => inDegree[n] === 0)
  while (currentLayer.length > 0) {
    layers.push(currentLayer)
    currentLayer.forEach((n) => placed.add(n))
    const nextLayer: string[] = []
    currentLayer.forEach((n) => {
      edges
        .filter((e) => e.source === n)
        .forEach((e) => {
          if (!placed.has(e.target)) {
            nextLayer.push(e.target)
          }
        })
    })
    currentLayer = [...new Set(nextLayer)].filter((n) => !placed.has(n))
  }

  // Place any remaining nodes not reached (cycles / islands)
  const remaining = nodes.filter((n) => !placed.has(n))
  if (remaining.length > 0) layers.push(remaining)

  const positions: Record<string, { x: number; y: number }> = {}
  const NODE_W = 220
  const NODE_H = 80
  const H_GAP = 60
  const V_GAP = 100

  layers.forEach((layer, li) => {
    const layerW = layer.length * NODE_W + (layer.length - 1) * H_GAP
    layer.forEach((id, i) => {
      positions[id] = {
        x: i * (NODE_W + H_GAP) - layerW / 2 + 400,
        y: li * (NODE_H + V_GAP) + 60,
      }
    })
  })

  return positions
}

export function DependencyGraph({ dependencies }: DependencyGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    // Collect unique task nodes
    const taskMap = new Map<string, DepTask>()
    dependencies.forEach((dep) => {
      taskMap.set(dep.blockingTask.id, dep.blockingTask)
      taskMap.set(dep.blockedTask.id, dep.blockedTask)
    })

    const edgeDefs = dependencies.map((dep) => ({
      source: dep.blockingTask.id,
      target: dep.blockedTask.id,
    }))

    const positions = getLayoutPositions([...taskMap.keys()], edgeDefs)

    const nodes: Node[] = [...taskMap.values()].map((task) => ({
      id: task.id,
      position: positions[task.id] ?? { x: 0, y: 0 },
      data: { task },
      type: "taskNode",
      style: {
        opacity: STATUS_OPACITY[task.status] ?? 1,
      },
    }))

    const edges: Edge[] = dependencies.map((dep) => ({
      id: dep.id,
      source: dep.blockingTask.id,
      target: dep.blockedTask.id,
      animated: dep.blockedTask.status === "BLOCKED",
      style: {
        stroke:
          dep.blockedTask.status === "BLOCKED"
            ? "#ef4444"
            : "hsl(var(--border))",
        strokeWidth: dep.blockedTask.status === "BLOCKED" ? 2 : 1.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color:
          dep.blockedTask.status === "BLOCKED"
            ? "#ef4444"
            : "hsl(var(--border))",
      },
      label: dep.blockedTask.status === "BLOCKED" ? "blocks" : undefined,
      labelStyle: { fontSize: 10, fill: "#ef4444" },
      labelBgStyle: { fill: "transparent" },
    }))

    return { nodes, edges }
  }, [dependencies])

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const nodeTypes = useMemo(
    () => ({
      taskNode: TaskNode,
    }),
    []
  )

  if (dependencies.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[hsl(var(--border)/0.4)]">
        <p className="text-sm text-[hsl(var(--muted-foreground)/0.5)]">
          No dependencies defined yet
        </p>
      </div>
    )
  }

  return (
    <div className="h-[70vh] rounded-lg border border-[hsl(var(--border)/0.5)] overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{ type: "smoothstep" }}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--border)/0.3)" />
        <Controls className="[&>button]:bg-[hsl(var(--card))] [&>button]:border-[hsl(var(--border))] [&>button]:text-[hsl(var(--foreground))]" />
        <MiniMap
          nodeColor={(n) => TYPE_COLOR[(n.data as { task: DepTask }).task.type as TaskType] ?? "#64748b"}
          maskColor="hsl(var(--background)/0.8)"
          style={{ background: "hsl(var(--card))" }}
        />
      </ReactFlow>
    </div>
  )
}

function TaskNode({ data }: { data: { task: DepTask } }) {
  const { task } = data
  const typeColor = TYPE_COLOR[task.type] ?? "#64748b"

  return (
    <div
      style={{
        borderColor: typeColor + "60",
        borderLeftColor: typeColor,
        borderLeftWidth: 3,
      }}
      className="w-[220px] rounded-md border bg-[hsl(var(--card))] px-3 py-2 shadow-md"
    >
      <div className="flex items-start justify-between gap-1.5 mb-1">
        <span
          className="text-[9px] uppercase tracking-widest font-semibold"
          style={{ color: typeColor }}
        >
          {task.type}
        </span>
        <span className="text-[9px] text-[hsl(var(--muted-foreground)/0.6)] shrink-0">
          {task.status}
        </span>
      </div>
      <p className="text-xs text-[hsl(var(--foreground))] leading-snug line-clamp-2">
        {task.title}
      </p>
      {task.project && (
        <p className="text-[9px] text-[hsl(var(--muted-foreground)/0.5)] mt-1.5">
          {task.project.name}
        </p>
      )}
    </div>
  )
}
