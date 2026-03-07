"use client"

import type { GraphNode } from "@/lib/graph-types"

interface GraphNodeProps {
  node: GraphNode
  isSelected: boolean
  isDragging: boolean
  onMouseDown: (e: React.MouseEvent | React.TouchEvent) => void
  onClick: () => void
}

export default function GraphNodeComponent({
  node,
  isSelected,
  isDragging,
  onMouseDown,
  onClick,
}: GraphNodeProps) {
  const isABO = node.state === "ABO"
  const isPP = node.state === "PP"

  return (
    <div
      onMouseDown={onMouseDown}
      onTouchStart={onMouseDown}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="relative select-none"
      style={{
        cursor: isDragging ? "grabbing" : "grab",
        width: 120,
        height: 56,
      }}
    >
      {/* PP blinking dashed border layer */}
      {isPP && (
        <div
          className="animate-blink-border absolute inset-0 rounded-xl pointer-events-none"
          style={{
            border: "1.5px dashed oklch(0.84 0.22 142)",
            borderRadius: 12,
            boxSizing: "border-box",
          }}
        />
      )}

      {/* ABO solid bold border */}
      {isABO && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            border: "3px solid oklch(0.84 0.22 142)",
            borderRadius: 12,
            boxShadow: isSelected
              ? "0 0 18px 4px oklch(0.84 0.22 142 / 0.6)"
              : "0 0 10px 2px oklch(0.84 0.22 142 / 0.35)",
            boxSizing: "border-box",
          }}
        />
      )}

      {/* Selected ring */}
      {isSelected && !isABO && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            border: "2px solid oklch(0.84 0.22 142 / 0.5)",
            borderRadius: 12,
            boxShadow: "0 0 16px 4px oklch(0.84 0.22 142 / 0.4)",
            boxSizing: "border-box",
          }}
        />
      )}

      {/* Node body */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center rounded-xl"
        style={{
          background: "oklch(0.13 0 0)",
          boxShadow:
            "0 4px 24px 0 rgba(0,0,0,0.7), 0 1.5px 6px 0 rgba(0,0,0,0.5)",
          borderRadius: 12,
        }}
      >
        <span
          className="font-sans text-sm font-semibold leading-tight text-center truncate px-2"
          style={{ color: "oklch(0.95 0 0)", maxWidth: 108 }}
        >
          {node.nickname}
        </span>
        <span
          className="font-mono text-xs mt-0.5"
          style={{ color: "oklch(0.84 0.22 142)", letterSpacing: "0.08em" }}
        >
          {node.state}
        </span>
      </div>
    </div>
  )
}
