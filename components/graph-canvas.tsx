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
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      }
    },
    []
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
      dragOffset.current = {
        x: clientX - rect.left - node.x,
        y: clientY - rect.top - node.y,
      }
      setDraggingId(nodeId)
    },
    [nodes]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!draggingId) return
      const pt = getSVGPoint(e)
      onNodesChange(
        nodes.map((n) =>
          n.id === draggingId
            ? {
                ...n,
                x: Math.max(60, Math.min(svgSize.width - 60, pt.x - dragOffset.current.x)),
                y: Math.max(30, Math.min(svgSize.height - 30, pt.y - dragOffset.current.y)),
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
      if (draggingId) return
      setSelectedNodeId(nodeId)
      setModalParentId(nodeId)
    },
    [draggingId]
  )

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // Only pan if clicking on empty canvas (not on a node)
      const target = e.target as SVGElement
      if (target.tagName !== "svg") return
      
      setIsPanning(true)
      panStartRef.current = {
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y,
      }
    },
    [panOffset]
  )

  const handleCanvasMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPanning) return
      const newPanOffset = {
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      }
      setPanOffset(newPanOffset)
    },
    [isPanning]
  )

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Global mouse/touch listeners for dragging nodes and panning
  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mousemove", handleCanvasMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    window.addEventListener("mouseup", handleCanvasMouseUp)
    window.addEventListener("touchmove", handleMouseMove, { passive: false })
    window.addEventListener("touchend", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mousemove", handleCanvasMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("mouseup", handleCanvasMouseUp)
      window.removeEventListener("touchmove", handleMouseMove)
      window.removeEventListener("touchend", handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp, handleCanvasMouseMove, handleCanvasMouseUp])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // Don't add node if we were panning
      if (isPanning) return
      
      // If clicking on empty canvas with no nodes, add a root node
      if (nodes.length === 0) {
        const rect = svgRef.current?.getBoundingClientRect()
        if (rect) {
          const x = (e.clientX - rect.left - panOffset.x) / 1
          const y = (e.clientY - rect.top - panOffset.y) / 1
          const newNode: GraphNode = {
            id: Date.now().toString(),
            nickname: "Root",
            state: "ABO",
            x: Math.max(60, Math.min(svgSize.width - 60, x)),
            y: Math.max(60, Math.min(svgSize.height - 60, y)),
          }
          onNodesChange([newNode])
          return
        }
      }
      setSelectedNodeId(null)
      setModalParentId(null)
    },
    [nodes.length, svgSize, onNodesChange, isPanning, panOffset]
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
        onMouseDown={handleCanvasMouseDown}
        onClick={handleCanvasClick}
        style={{
          cursor: isPanning ? "grabbing" : draggingId ? "grabbing" : "grab",
          transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          transformOrigin: "0 0",
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
