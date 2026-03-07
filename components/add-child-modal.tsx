"use client"

import { useState, useEffect, useRef } from "react"
import type { GraphNode } from "@/lib/graph-types"

interface AddChildModalProps {
  parentNode: GraphNode
  onAdd: (nickname: string, state: "ABO" | "PP") => void
  onDelete: (nodeId: string) => void
  onClose: () => void
  svgSize: { width: number; height: number }
}

export default function AddChildModal({
  parentNode,
  onAdd,
  onDelete,
  onClose,
  svgSize,
}: AddChildModalProps) {
  const [nickname, setNickname] = useState("")
  const [state, setState] = useState<"ABO" | "PP">("ABO")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Position modal near parent node but keep in viewport
  const MODAL_W = 260
  const MODAL_H = 260
  const GAP = 20

  let left = parentNode.x + GAP
  let top = parentNode.y - MODAL_H / 2

  if (left + MODAL_W > svgSize.width - 8) {
    left = parentNode.x - MODAL_W - GAP
  }
  if (left < 8) left = 8
  if (top < 8) top = 8
  if (top + MODAL_H > svgSize.height - 8) top = svgSize.height - MODAL_H - 8

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = nickname.trim()
    if (!trimmed) return
    onAdd(trimmed, state)
  }

  const handleDelete = () => {
    onDelete(parentNode.id)
    onClose()
  }

  return (
    <>
      {/* Invisible backdrop */}
      <div
        className="absolute inset-0 z-10"
        onClick={onClose}
        style={{ background: "transparent" }}
      />
      {/* Modal */}
      <div
        className="absolute z-20 rounded-xl p-4 flex flex-col gap-3"
        style={{
          left,
          top,
          width: MODAL_W,
          background: "oklch(0.15 0 0)",
          border: "1px solid oklch(0.84 0.22 142 / 0.4)",
          boxShadow: "0 8px 40px 0 rgba(0,0,0,0.8), 0 0 20px 2px oklch(0.84 0.22 142 / 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="font-sans text-xs font-semibold tracking-widest uppercase"
          style={{ color: "oklch(0.84 0.22 142)" }}
        >
          {parentNode.nickname}
        </p>

        {!showDeleteConfirm ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* Nickname input */}
            <input
              ref={inputRef}
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Add child nickname..."
              maxLength={24}
              className="w-full rounded-lg px-3 py-2 font-sans text-sm outline-none"
              style={{
                background: "oklch(0.1 0 0)",
                border: "1px solid oklch(0.28 0 0)",
                color: "oklch(0.95 0 0)",
                caretColor: "oklch(0.84 0.22 142)",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "oklch(0.84 0.22 142 / 0.6)"
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "oklch(0.28 0 0)"
              }}
            />

            {/* State selector */}
            <div className="flex gap-2">
              {(["ABO", "PP"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setState(s)}
                  className="flex-1 rounded-lg py-1.5 font-mono text-xs font-semibold tracking-wider transition-all"
                  style={
                    state === s
                      ? {
                          background: "oklch(0.84 0.22 142 / 0.15)",
                          border: "1.5px solid oklch(0.84 0.22 142)",
                          color: "oklch(0.84 0.22 142)",
                        }
                      : {
                          background: "oklch(0.1 0 0)",
                          border: "1px solid oklch(0.28 0 0)",
                          color: "oklch(0.55 0 0)",
                        }
                  }
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Add button */}
            <button
              type="submit"
              disabled={!nickname.trim()}
              className="w-full rounded-lg py-2 font-sans text-xs font-semibold transition-all disabled:opacity-40"
              style={{
                background: "oklch(0.84 0.22 142 / 0.18)",
                border: "1.5px solid oklch(0.84 0.22 142)",
                color: "oklch(0.84 0.22 142)",
              }}
            >
              Add Child Node
            </button>

            {/* Divider */}
            <div
              className="w-full h-px"
              style={{ background: "oklch(0.25 0 0)" }}
            />

            {/* Delete button */}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full rounded-lg py-2 font-sans text-xs transition-all"
              style={{
                background: "oklch(0.12 0 0)",
                border: "1px solid oklch(0.35 0.15 25)",
                color: "oklch(0.65 0.2 25)",
              }}
            >
              Delete This Node
            </button>

            {/* Cancel */}
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg py-1.5 font-sans text-xs transition-all"
              style={{
                background: "transparent",
                color: "oklch(0.45 0 0)",
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <p
              className="font-sans text-sm"
              style={{ color: "oklch(0.75 0 0)" }}
            >
              Delete <strong style={{ color: "oklch(0.95 0 0)" }}>{parentNode.nickname}</strong>?
              This will also remove all connected edges.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg py-2 font-sans text-xs transition-all"
                style={{
                  background: "oklch(0.1 0 0)",
                  border: "1px solid oklch(0.28 0 0)",
                  color: "oklch(0.55 0 0)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded-lg py-2 font-sans text-xs font-semibold transition-all"
                style={{
                  background: "oklch(0.5 0.2 25 / 0.2)",
                  border: "1.5px solid oklch(0.6 0.2 25)",
                  color: "oklch(0.7 0.2 25)",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
