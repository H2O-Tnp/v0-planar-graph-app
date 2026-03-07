"use client"

import type { GraphNode } from "@/lib/graph-types"

interface GraphNodeProps {
  node: GraphNode
  isSelected: boolean
  isDragging: boolean
  onMouseDown: (e: React.MouseEvent | React.TouchEvent) => void
  onClick: (e: React.MouseEvent) => void
}

const NODE_SIZE = 90

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
        onClick(e)
      }}
      className="relative select-none"
      style={{
        cursor: isDragging ? "grabbing" : "grab",
        width: NODE_SIZE,
        height: NODE_SIZE,
      }}
    >
      {/* PP blinking dashed border layer */}
      {isPP && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none animate-blink-border"
          style={{
            border: "8px dashed oklch(0.84 0.22 142)",
            boxSizing: "border-box",
          }}
        />
      )}

      {/* ABO solid bold border */}
      {isABO && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: "3px solid oklch(0.84 0.22 142)",
            boxShadow: isSelected
              ? "0 0 18px 4px oklch(0.84 0.22 142 / 0.6)"
              : "0 0 10px 2px oklch(0.84 0.22 142 / 0.35)",
            boxSizing: "border-box",
          }}
        />
      )}

      {/* Selected ring for PP */}
      {isSelected && isPP && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: "0 0 16px 4px oklch(0.84 0.22 142 / 0.4)",
            boxSizing: "border-box",
          }}
        />
      )}

      {/* Node body */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center rounded-full"
        style={{
          background: "oklch(0.13 0 0)",
          boxShadow:
            "0 4px 24px 0 rgba(0,0,0,0.7), 0 1.5px 6px 0 rgba(0,0,0,0.5)",
        }}
      >
        <span
          className="font-sans text-xs font-semibold leading-tight text-center truncate px-2"
          style={{ color: "oklch(0.95 0 0)", maxWidth: NODE_SIZE - 16 }}
        >
          {node.nickname}
        </span>
        <span
          className="font-mono text-[10px] mt-0.5"
          style={{ color: "oklch(0.84 0.22 142)", letterSpacing: "0.08em" }}
        >
          {node.state}
        </span>
      </div>
    </div>
  )
}
