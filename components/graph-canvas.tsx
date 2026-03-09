"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { GraphNode, GraphEdge } from "@/lib/graph-types"
import GraphNodeComponent from "@/components/graph-node"
import AddChildModal from "@/components/add-child-modal"
import { autoArrangeNodes, countEdgeCrossings } from "@/lib/graph-layout"

const NODE_RADIUS = 45
const MIN_ZOOM = 0.2
const MAX_ZOOM = 3

interface GraphCanvasProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodesChange: (nodes: GraphNode[]) => void
  onEdgesChange: (edges: GraphEdge[]) => void
}

export default function GraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({ width: 375, height: 600 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const [modalParentId, setModalParentId] = useState<string | null>(null)

  // Unified Pointer Event State
  const activePointers = useRef<Map<number, PointerEvent>>(new Map())
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const didMoveRef = useRef(false)
  const lastPinchDist = useRef<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        setViewportSize({ width: e.contentRect.width, height: e.contentRect.height })
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const didFit = useRef(false)
  useEffect(() => {
    if (nodes.length === 0) { didFit.current = false; return }
    if (didFit.current) return
    didFit.current = true
    fitNodesToView(nodes, viewportSize.width, viewportSize.height)
  }, [nodes.length, viewportSize.width, viewportSize.height])

  const fitNodesToView = useCallback(
    (nodeList: GraphNode[], vw: number, vh: number) => {
      if (nodeList.length === 0) return
      const xs = nodeList.map((n) => n.x)
      const ys = nodeList.map((n) => n.y)
      const minX = Math.min(...xs) - NODE_RADIUS
      const maxX = Math.max(...xs) + NODE_RADIUS
      const minY = Math.min(...ys) - NODE_RADIUS
      const maxY = Math.max(...ys) + NODE_RADIUS
      const contentW = maxX - minX || 1
      const contentH = maxY - minY || 1
      const padding = 60
      const newZoom = Math.min(
        (vw - padding * 2) / contentW,
        (vh - padding * 2) / contentH,
        1
      )
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom))
      // Center the content in the viewport after scaling
      const scaledContentW = contentW * clampedZoom
      const scaledContentH = contentH * clampedZoom
      const newPanX = (vw - scaledContentW) / 2 - minX * clampedZoom
      const newPanY = (vh - scaledContentH) / 2 - minY * clampedZoom
      setPan({ x: newPanX, y: newPanY })
      setZoom(clampedZoom)
    },
    []
  )

  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - pan.x) / zoom,
      y: (sy - pan.y) / zoom,
    }),
    [pan, zoom]
  )

  // ── Node dragging (Pointer) ──
  const handleNodePointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      e.stopPropagation()
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const worldPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
      dragOffset.current = { x: worldPos.x - node.x, y: worldPos.y - node.y }
      didMoveRef.current = false
      setDraggingId(nodeId)
    },
    [nodes, screenToWorld]
  )

  const handleNodeClick = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (didMoveRef.current) { didMoveRef.current = false; return }
      if (draggingId) return
      setSelectedNodeId(nodeId)
      setModalParentId(nodeId)
    },
    [draggingId]
  )

  // ── Canvas panning (Pointer) ──
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const target = e.target as Element
      const tagName = target.tagName.toLowerCase()
      if (tagName !== "svg" && tagName !== "line" && tagName !== "g" && tagName !== "rect") return

      activePointers.current.set(e.pointerId, e.nativeEvent)
      if (activePointers.current.size === 2) return // Handled in move as zoom

      setIsPanning(true)
      didMoveRef.current = false
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    },
    [pan]
  )

  // ── Global Pointer Event Listeners ──
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (activePointers.current.has(e.pointerId)) {
        activePointers.current.set(e.pointerId, e)
      }

      // Handle Node Dragging
      if (draggingId) {
        didMoveRef.current = true
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)

        onNodesChange(
          nodes.map((n) =>
            n.id === draggingId
              ? { ...n, x: world.x - dragOffset.current.x, y: world.y - dragOffset.current.y }
              : n
          )
        )
        return
      }

      // Handle Pinch to Zoom
      if (activePointers.current.size === 2) {
        const pts = Array.from(activePointers.current.values())
        const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY)
        if (lastPinchDist.current !== null) {
          const delta = dist / lastPinchDist.current
          setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * delta)))
        }
        lastPinchDist.current = dist
        return
      }

      // Handle Panning
      if (isPanning) {
        didMoveRef.current = true
        setPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y })
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      activePointers.current.delete(e.pointerId)
      if (activePointers.current.size < 2) {
        lastPinchDist.current = null
      }
      if (activePointers.current.size === 0) {
        setIsPanning(false)
        setDraggingId(null)
      }
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)

    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)
    }
  }, [draggingId, isPanning, nodes, onNodesChange, screenToWorld])

  // ── Canvas click (deselect / create first node) ──
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (didMoveRef.current) return
      if (nodes.length === 0) {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
          onNodesChange([{ id: Date.now().toString(), nickname: "Root", state: "ABO", x: world.x, y: world.y }])
          return
        }
      }
      setSelectedNodeId(null)
      setModalParentId(null)
    },
    [nodes.length, onNodesChange, screenToWorld]
  )

  // ── Add / Edit / Delete ──
  const handleAddChild = useCallback(
    (parentId: string, nickname: string, state: "ABO" | "PP") => {
      const parent = nodes.find((n) => n.id === parentId)
      if (!parent) return

      const connectedEdges = edges.filter((e) => e.source === parentId || e.target === parentId)
      const connectedNodes = connectedEdges
        .map((e) => nodes.find((n) => n.id === (e.source === parentId ? e.target : e.source)))
        .filter(Boolean) as GraphNode[]

      let bestAngle = 0
      let maxMinDist = 0
      for (let i = 0; i < 12; i++) {
        const testAngle = (i / 12) * Math.PI * 2
        let minDist = Infinity
        for (const cn of connectedNodes) {
          const existingAngle = Math.atan2(cn.y - parent.y, cn.x - parent.x)
          const diff = Math.abs(testAngle - existingAngle)
          minDist = Math.min(minDist, Math.min(diff, Math.PI * 2 - diff))
        }
        if (minDist > maxMinDist) { maxMinDist = minDist; bestAngle = testAngle }
      }

      const dist = 150
      const newNode: GraphNode = {
        id: Date.now().toString(),
        nickname,
        state,
        x: parent.x + Math.cos(bestAngle) * dist,
        y: parent.y + Math.sin(bestAngle) * dist,
      }
      onNodesChange([...nodes, newNode])
      onEdgesChange([...edges, { source: parentId, target: newNode.id }])
      setModalParentId(null)
      setSelectedNodeId(null)
    },
    [nodes, edges, onNodesChange, onEdgesChange]
  )

  const handleEditNode = useCallback(
    (nodeId: string, nickname: string, state: "ABO" | "PP") => {
      onNodesChange(nodes.map(n => n.id === nodeId ? { ...n, nickname, state } : n))
      setModalParentId(null)
      setSelectedNodeId(null)
    },
    [nodes, onNodesChange]
  )

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      onNodesChange(nodes.filter((n) => n.id !== nodeId))
      onEdgesChange(edges.filter((e) => e.source !== nodeId && e.target !== nodeId))
      setModalParentId(null)
      setSelectedNodeId(null)
    },
    [nodes, edges, onNodesChange, onEdgesChange]
  )

  const handleAutoArrange = useCallback(() => {
    if (nodes.length < 2) return
    const arranged = autoArrangeNodes(nodes, edges, 2000, 2000, 150)
    onNodesChange(arranged)
    didFit.current = false
    setTimeout(() => fitNodesToView(arranged, viewportSize.width, viewportSize.height), 0)
  }, [nodes, edges, onNodesChange, fitNodesToView, viewportSize])

  const crossingCount = countEdgeCrossings(nodes, edges)

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      {/* Toolbar */}
      {nodes.length >= 2 && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-3">
          {crossingCount > 0 && (
            <span className="font-mono text-xs" style={{ color: "oklch(0.65 0.2 25)" }}>
              {crossingCount} crossing{crossingCount > 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={handleAutoArrange}
            className="rounded-lg px-3 py-1.5 font-sans text-xs font-medium transition-all hover:opacity-80"
            style={{
              background: "oklch(0.15 0 0)",
              border: "1px solid oklch(0.84 0.22 142 / 0.5)",
              color: "oklch(0.84 0.22 142)",
            }}
          >
            Auto Arrange
          </button>
          <button
            onClick={() => fitNodesToView(nodes, viewportSize.width, viewportSize.height)}
            className="rounded-lg px-3 py-1.5 font-sans text-xs font-medium transition-all hover:opacity-80"
            style={{
              background: "oklch(0.15 0 0)",
              border: "1px solid oklch(0.84 0.22 142 / 0.5)",
              color: "oklch(0.84 0.22 142)",
            }}
          >
            Fit
          </button>
        </div>
      )}

      {/* Full-screen SVG */}
      <svg
        width={viewportSize.width}
        height={viewportSize.height}
        className="absolute inset-0"
        onPointerDown={handleCanvasPointerDown}
        onClick={handleCanvasClick}
        style={{
          cursor: isPanning ? "grabbing" : draggingId ? "grabbing" : "grab",
          touchAction: "none",
        }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {edges.map((edge) => {
            const source = nodes.find((n) => n.id === edge.source)
            const target = nodes.find((n) => n.id === edge.target)
            if (!source || !target) return null
            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={source.x} y1={source.y}
                x2={target.x} y2={target.y}
                stroke="oklch(0.84 0.22 142)"
                strokeWidth={1.5 / zoom}
                strokeOpacity={0.4}
              />
            )
          })}

          {nodes.map((node) => (
            <foreignObject
              key={node.id}
              x={node.x - NODE_RADIUS}
              y={node.y - NODE_RADIUS}
              width={NODE_RADIUS * 2}
              height={NODE_RADIUS * 2}
              style={{ overflow: "visible" }}
            >
              <GraphNodeComponent
                node={node}
                isSelected={selectedNodeId === node.id}
                onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                onClick={(e) => handleNodeClick(node.id, e)}
                isDragging={draggingId === node.id}
              />
            </foreignObject>
          ))}
        </g>
      </svg>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="font-sans text-sm" style={{ color: "oklch(0.45 0 0)" }}>
            Tap anywhere to create your first node
          </p>
        </div>
      )}

      {/* Node action modal */}
      {modalParentId && (
        <AddChildModal
          parentNode={nodes.find((n) => n.id === modalParentId)!}
          onAdd={(nickname, state) => handleAddChild(modalParentId, nickname, state)}
          onEdit={(nickname, state) => handleEditNode(modalParentId, nickname, state)}
          onDelete={handleDeleteNode}
          onClose={() => setModalParentId(null)}
          svgSize={viewportSize}
          pan={pan}
          zoom={zoom}
        />
      )}
    </div>
  )
}
