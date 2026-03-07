"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { GraphNode, GraphEdge } from "@/lib/graph-types"
import GraphNodeComponent from "@/components/graph-node"
import AddChildModal from "@/components/add-child-modal"

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

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    window.addEventListener("touchmove", handleMouseMove, { passive: false })
    window.addEventListener("touchend", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("touchmove", handleMouseMove)
      window.removeEventListener("touchend", handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const handleNodeClick = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (draggingId) return
      setSelectedNodeId(nodeId)
      setModalParentId(nodeId)
    },
    [draggingId]
  )

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // If clicking on empty canvas with no nodes, add a root node
      if (nodes.length === 0) {
        const rect = svgRef.current?.getBoundingClientRect()
        if (rect) {
          const x = e.clientX - rect.left
          const y = e.clientY - rect.top
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
    [nodes.length, svgSize, onNodesChange]
  )

  const handleAddChild = useCallback(
    (parentId: string, nickname: string, state: "ABO" | "PP") => {
      const parent = nodes.find((n) => n.id === parentId)
      if (!parent) return
      const angle = Math.random() * Math.PI * 2
      const dist = 160
      const newNode: GraphNode = {
        id: Date.now().toString(),
        nickname,
        state,
        x: Math.max(60, Math.min(svgSize.width - 60, parent.x + Math.cos(angle) * dist)),
        y: Math.max(30, Math.min(svgSize.height - 30, parent.y + Math.sin(angle) * dist)),
      }
      const newEdge: GraphEdge = { source: parentId, target: newNode.id }
      onNodesChange([...nodes, newNode])
      onEdgesChange([...edges, newEdge])
      setModalParentId(null)
      setSelectedNodeId(null)
    },
    [nodes, edges, onNodesChange, onEdgesChange, svgSize]
  )

  return (
    <div className="relative w-full h-full overflow-hidden">
      <svg
        ref={svgRef}
        width={svgSize.width}
        height={svgSize.height}
        className="absolute inset-0 w-full h-full"
        onClick={handleCanvasClick}
        style={{ cursor: draggingId ? "grabbing" : "default" }}
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
          onClose={() => setModalParentId(null)}
          nodes={nodes}
          svgSize={svgSize}
        />
      )}
    </div>
  )
}
