"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { GraphData, GraphNode, GraphEdge } from "@/lib/graph-types"
import GraphCanvas from "@/components/graph-canvas"

export default function HomePage() {
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load on mount
  useEffect(() => {
    fetch("/api/graph")
      .then((r) => r.json())
      .then((data: GraphData) => setGraphData(data))
      .catch(() =>
        setGraphData({
          nodes: [],
          edges: [],
        })
      )
  }, [])

  // Auto-save with debounce after changes
  const save = useCallback((data: GraphData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        await fetch("/api/graph", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
      } finally {
        setSaving(false)
      }
    }, 800)
  }, [])

  const handleNodesChange = useCallback(
    (nodes: GraphNode[]) => {
      setGraphData((prev) => {
        if (!prev) return prev
        const next = { ...prev, nodes }
        save(next)
        return next
      })
    },
    [save]
  )

  const handleEdgesChange = useCallback(
    (edges: GraphEdge[]) => {
      setGraphData((prev) => {
        if (!prev) return prev
        const next = { ...prev, edges }
        save(next)
        return next
      })
    },
    [save]
  )

  return (
    <main
      className="relative w-screen h-screen overflow-hidden"
      style={{ background: "oklch(0.06 0 0)" }}
    >
      {/* Header bar */}
      <header
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-5 py-3"
        style={{
          background: "oklch(0.09 0 0 / 0.85)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid oklch(0.22 0 0)",
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-sm font-bold tracking-widest uppercase"
            style={{ color: "oklch(0.84 0.22 142)" }}
          >
            Node Graph
          </span>
          <span
            className="font-sans text-xs hidden sm:block"
            style={{ color: "oklch(0.45 0 0)" }}
          >
            Click node to add child
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm"
                style={{
                  border: "2.5px solid oklch(0.84 0.22 142)",
                }}
              />
              <span className="font-mono text-xs" style={{ color: "oklch(0.55 0 0)" }}>
                ABO
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm animate-blink-border"
                style={{
                  border: "1.5px dashed oklch(0.84 0.22 142)",
                }}
              />
              <span className="font-mono text-xs" style={{ color: "oklch(0.55 0 0)" }}>
                PP
              </span>
            </div>
          </div>
          {/* Save status */}
          <span
            className="font-mono text-xs transition-opacity"
            style={{
              color: "oklch(0.84 0.22 142)",
              opacity: saving ? 1 : 0,
            }}
          >
            Saving...
          </span>
        </div>
      </header>

      {/* Graph area */}
      <div className="absolute inset-0 pt-[49px]">
        {graphData ? (
          <GraphCanvas
            nodes={graphData.nodes}
            edges={graphData.edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <span
              className="font-mono text-sm animate-pulse"
              style={{ color: "oklch(0.84 0.22 142)" }}
            >
              Loading...
            </span>
          </div>
        )}
      </div>
    </main>
  )
}
