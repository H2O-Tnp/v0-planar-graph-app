"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { GraphNode, GraphEdge } from "@/lib/graph-types"
import GraphNodeComponent from "@/components/graph-node"
import AddChildModal from "@/components/add-child-modal"
import { autoArrangeNodes, countEdgeCrossings } from "@/lib/graph-layout"

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
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const [modalParentId, setModalParentId] = useState<string | null>(null)
  const [svgSize, setSvgSize] = useState({ width: 1280, height: 720 })
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  // Track whether a move happened (to distinguish tap vs drag on touch)
  const didMoveRef = useRef(false)

  // Resize observer
  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        setSvgSize({ width: e.contentRect.width, height: e.contentRect.height })
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const getSVGPoint = useCallback(
    (e: MouseEvent | TouchEvent): { x: number; y: number } => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const rect = svg.getBoundingClientRect()
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
      // Subtract panOffset because the SVG is translated by panOffset
      return {
        x: clientX - rect.left - panOffset.x,
        y: clientY - rect.top - panOffset.y,
      }
    },
    [panOffset]
  )

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent, nodeId: string) => {
      e.stopPropagation()
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const clientX =
        "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
      const clientY =
        "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
      // Account for panOffset when computing drag offset
      dragOffset.current = {
        x: clientX - rect.left - panOffset.x - node.x,
        y: clientY - rect.top - panOffset.y - node.y,
      }
      didMoveRef.current = false
      setDraggingId(nodeId)
    },
    [nodes, panOffset]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!draggingId) return
      didMoveRef.current = true
      if ("touches" in e) e.preventDefault()
      const pt = getSVGPoint(e)
      const NODE_RADIUS = 45 // nodes are 90x90, radius is 45
      onNodesChange(
        nodes.map((n) =>
          n.id === draggingId
            ? {
                ...n,
                x: Math.max(NODE_RADIUS, Math.min(svgSize.width - NODE_RADIUS, pt.x - dragOffset.current.x)),
                y: Math.max(NODE_RADIUS, Math.min(svgSize.height - NODE_RADIUS, pt.y - dragOffset.current.y)),
              }
            : n
        )
      )
    },
    [draggingId, getSVGPoint, nodes, onNodesChange, svgSize]
  )

  const handleMouseUp = useCallback(() => {
    setDraggingId(null)
  }, [])

  const handleNodeClick = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      // Suppress click if the user dragged the node
      if (didMoveRef.current) {
        didMoveRef.current = false
        return
      }
      if (draggingId) return
      setSelectedNodeId(nodeId)
      setModalParentId(nodeId)
    },
    [draggingId]
  )

  // --- Canvas pan handlers (mouse + touch) ---
  const getClientXY = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if ("touches" in e) {
      const t = (e as TouchEvent).touches[0] ?? (e as TouchEvent).changedTouches[0]
      return { clientX: t.clientX, clientY: t.clientY }
    }
    return { clientX: (e as MouseEvent).clientX, clientY: (e as MouseEvent).clientY }
  }

  const handleCanvasPointerDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
      // Only pan if touching the background (svg or rect/line, not a node)
      const target = e.target as Element
      const tagName = target.tagName.toLowerCase()
      if (tagName !== "svg" && tagName !== "line" && tagName !== "rect") return
      const { clientX, clientY } = getClientXY(e as unknown as MouseEvent)
      setIsPanning(true)
      didMoveRef.current = false
      panStartRef.current = {
        x: clientX - panOffset.x,
        y: clientY - panOffset.y,
      }
    },
    [panOffset]
  )

  const handleCanvasPointerMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isPanning) return
      const { clientX, clientY } = getClientXY(e)
      didMoveRef.current = true
      setPanOffset({
        x: clientX - panStartRef.current.x,
        y: clientY - panStartRef.current.y,
      })
    },
    [isPanning]
  )

  const handleCanvasPointerUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Global move/up listeners for both node drag and canvas pan
  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      handleMouseMove(e)
      handleCanvasPointerMove(e)
    }
    const onUp = () => {
      handleMouseUp()
      handleCanvasPointerUp()
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    window.addEventListener("touchmove", onMove, { passive: false })
    window.addEventListener("touchend", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("touchend", onUp)
    }
  }, [handleMouseMove, handleMouseUp, handleCanvasPointerMove, handleCanvasPointerUp])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // Don't fire if we were panning/dragging
      if (didMoveRef.current) return

      // If clicking on empty canvas with no nodes, add a root node
      if (nodes.length === 0) {
        const rect = svgRef.current?.getBoundingClientRect()
        if (rect) {
          const x = e.clientX - rect.left - panOffset.x
          const y = e.clientY - rect.top - panOffset.y
          const NODE_RADIUS = 45
          const newNode: GraphNode = {
            id: Date.now().toString(),
            nickname: "Root",
            state: "ABO",
            x: Math.max(NODE_RADIUS, Math.min(svgSize.width - NODE_RADIUS, x)),
            y: Math.max(NODE_RADIUS, Math.min(svgSize.height - NODE_RADIUS, y)),
          }
          onNodesChange([newNode])
          return
        }
      }
      setSelectedNodeId(null)
      setModalParentId(null)
    },
    [nodes.length, svgSize, onNodesChange, panOffset]
  )

  const handleAddChild = useCallback(
    (parentId: string, nickname: string, state: "ABO" | "PP") => {
      const parent = nodes.find((n) => n.id === parentId)
      if (!parent) return

      // Find angle that minimizes overlap with existing children
      const connectedEdges = edges.filter(
        (e) => e.source === parentId || e.target === parentId
      )
      const connectedNodes = connectedEdges.map((e) =>
        e.source === parentId
          ? nodes.find((n) => n.id === e.target)
          : nodes.find((n) => n.id === e.source)
      ).filter(Boolean) as GraphNode[]

      let bestAngle = 0
      let maxMinDist = 0

      // Try 12 angles and pick the one with most distance from existing children
      for (let i = 0; i < 12; i++) {
        const testAngle = (i / 12) * Math.PI * 2
        let minDist = Infinity

        for (const cn of connectedNodes) {
          const existingAngle = Math.atan2(cn.y - parent.y, cn.x - parent.x)
          const angleDiff = Math.abs(testAngle - existingAngle)
          const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff)
          minDist = Math.min(minDist, normalizedDiff)
        }

        if (minDist > maxMinDist) {
          maxMinDist = minDist
          bestAngle = testAngle
        }
      }

      const dist = 140
      const newNode: GraphNode = {
        id: Date.now().toString(),
        nickname,
        state,
        x: Math.max(60, Math.min(svgSize.width - 60, parent.x + Math.cos(bestAngle) * dist)),
        y: Math.max(30, Math.min(svgSize.height - 30, parent.y + Math.sin(bestAngle) * dist)),
      }
      const newEdge: GraphEdge = { source: parentId, target: newNode.id }
      onNodesChange([...nodes, newNode])
      onEdgesChange([...edges, newEdge])
      setModalParentId(null)
      setSelectedNodeId(null)
    },
    [nodes, edges, onNodesChange, onEdgesChange, svgSize]
  )

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      // Remove node and all connected edges
      const newNodes = nodes.filter((n) => n.id !== nodeId)
      const newEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId)
      onNodesChange(newNodes)
      onEdgesChange(newEdges)
      setModalParentId(null)
      setSelectedNodeId(null)
    },
    [nodes, edges, onNodesChange, onEdgesChange]
  )

  const handleAutoArrange = useCallback(() => {
    if (nodes.length < 2) return
    const arranged = autoArrangeNodes(nodes, edges, svgSize.width, svgSize.height, 150)
    onNodesChange(arranged)
  }, [nodes, edges, svgSize, onNodesChange])

  // Calculate crossing count for display
  const crossingCount = countEdgeCrossings(nodes, edges)

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Auto-arrange button */}
      {nodes.length >= 2 && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-3">
          {crossingCount > 0 && (
            <span
              className="font-mono text-xs"
              style={{ color: "oklch(0.65 0.2 25)" }}
            >
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
        </div>
      )}

      <svg
        ref={svgRef}
        width={svgSize.width}
        height={svgSize.height}
        className="absolute inset-0 w-full h-full"
        onMouseDown={handleCanvasPointerDown}
        onTouchStart={handleCanvasPointerDown}
        onClick={handleCanvasClick}
        style={{
          cursor: isPanning ? "grabbing" : draggingId ? "grabbing" : "grab",
          transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          transformOrigin: "0 0",
          touchAction: "none",
        }}
      >
        {/* Edge lines */}
        {edges.map((edge) => {
          const source = nodes.find((n) => n.id === edge.source)
          const target = nodes.find((n) => n.id === edge.target)
          if (!source || !target) return null
          return (
            <line
              key={`${edge.source}-${edge.target}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="oklch(0.84 0.22 142)"
              strokeWidth={1.5}
              strokeOpacity={0.4}
            />
          )
        })}

        {/* Nodes via foreignObject for rich HTML */}
        {nodes.map((node) => (
          <foreignObject
            key={node.id}
            x={node.x - 45}
            y={node.y - 45}
            width={90}
            height={90}
            style={{ overflow: "visible" }}
          >
            <GraphNodeComponent
              node={node}
              isSelected={selectedNodeId === node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onClick={(e) => handleNodeClick(node.id, e)}
              isDragging={draggingId === node.id}
            />
          </foreignObject>
        ))}
      </svg>

      {/* Empty state hint */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p
            className="font-sans text-sm"
            style={{ color: "oklch(0.45 0 0)" }}
          >
            Click anywhere to create your first node
          </p>
        </div>
      )}

      {/* Add child modal */}
      {modalParentId && (
        <AddChildModal
          parentNode={nodes.find((n) => n.id === modalParentId)!}
          onAdd={(nickname, state) => handleAddChild(modalParentId, nickname, state)}
          onDelete={handleDeleteNode}
          onClose={() => setModalParentId(null)}
          svgSize={svgSize}
        />
      )}
    </div>
  )
}
