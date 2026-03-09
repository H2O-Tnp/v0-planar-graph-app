"use client"

import { useState, useEffect, useRef } from "react"
import type { GraphNode } from "@/lib/graph-types"

interface AddChildModalProps {
  parentNode: GraphNode
  onAdd: (nickname: string, state: "ABO" | "PP") => void
  onEdit: (nickname: string, state: "ABO" | "PP") => void
  onDelete: (nodeId: string) => void
  onClose: () => void
  svgSize: { width: number; height: number }
  pan: { x: number; y: number }
  zoom: number
}

export default function AddChildModal({
  parentNode,
  onAdd,
  onEdit,
  onDelete,
  onClose,
  svgSize,
  pan,
  zoom,
}: AddChildModalProps) {
  const [mode, setMode] = useState<"add" | "edit">("add")
  const [nickname, setNickname] = useState("")
  const [state, setState] = useState<"ABO" | "PP">("ABO")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [mode])

  useEffect(() => {
    if (mode === "edit") {
      setNickname(parentNode.nickname)
      setState(parentNode.state)
    } else {
      setNickname("")
      setState("ABO")
    }
  }, [mode, parentNode])

  // Map world (canvas) coordinates to screen coordinates
  const screenX = parentNode.x * zoom + pan.x
  const screenY = parentNode.y * zoom + pan.y

  // Position modal near parent node but keep in viewport
  const MODAL_W = 260
  const MODAL_H = mode === "edit" ? 220 : 280
  const GAP = 25 * zoom

  let left = screenX + GAP
  let top = screenY - MODAL_H / 2

  if (left + MODAL_W > svgSize.width - 8) {
    left = screenX - MODAL_W - GAP
  }
  if (left < 8) left = 8
  if (top < 8) top = 8
  if (top + MODAL_H > svgSize.height - 8) top = svgSize.height - MODAL_H - 8

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = nickname.trim()
    if (!trimmed) return

    if (mode === "add") onAdd(trimmed, state)
    else onEdit(trimmed, state)
  }

  return (
    <>
      <div
        className="absolute inset-0 z-10"
        onClick={onClose}
        style={{ background: "transparent" }}
      />

      <div
        className="absolute z-20 rounded-xl p-4 flex flex-col gap-3 transition-all duration-150"
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
        <div className="flex items-center gap-2 border-b border-opacity-30 pb-2 mb-1" style={{ borderColor: "oklch(0.84 0.22 142)" }}>
          <button
            type="button"
            onClick={() => setMode("add")}
            className={`font-sans text-xs font-semibold px-2 py-1 rounded transition-colors ${mode === "add" ? "bg-opacity-20" : "opacity-50 hover:opacity-100"}`}
            style={mode === "add" ? { background: "oklch(0.84 0.22 142 / 0.2)", color: "oklch(0.84 0.22 142)" } : { color: "oklch(0.84 0.22 142)" }}
          >
            Add Child
          </button>
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={`font-sans text-xs font-semibold px-2 py-1 rounded transition-colors ${mode === "edit" ? "bg-opacity-20" : "opacity-50 hover:opacity-100"}`}
            style={mode === "edit" ? { background: "oklch(0.84 0.22 142 / 0.2)", color: "oklch(0.84 0.22 142)" } : { color: "oklch(0.84 0.22 142)" }}
          >
            Edit Node
          </button>
        </div>

        {!showDeleteConfirm ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              ref={inputRef}
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={mode === "add" ? "Add child nickname..." : "Edit nickname..."}
              maxLength={24}
              className="w-full rounded-lg px-3 py-2 font-sans text-sm outline-none"
              style={{
                background: "oklch(0.1 0 0)",
                border: "1px solid oklch(0.28 0 0)",
                color: "oklch(0.95 0 0)",
                caretColor: "oklch(0.84 0.22 142)",
              }}
              onFocus={(e) => { e.target.style.borderColor = "oklch(0.84 0.22 142 / 0.6)" }}
              onBlur={(e) => { e.target.style.borderColor = "oklch(0.28 0 0)" }}
            />

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

            <button
              type="submit"
              disabled={!nickname.trim()}
              className="w-full rounded-lg py-2 font-sans text-xs font-semibold transition-all disabled:opacity-40 mt-1"
              style={{
                background: "oklch(0.84 0.22 142 / 0.18)",
                border: "1.5px solid oklch(0.84 0.22 142)",
                color: "oklch(0.84 0.22 142)",
              }}
            >
              {mode === "add" ? "Add Child Node" : "Save Changes"}
            </button>

            {/* Only show delete option on Edit tab to reduce visual clutter during quick adds */}
            {mode === "edit" && (
              <>
                <div className="w-full h-px" style={{ background: "oklch(0.25 0 0)" }} />
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full rounded-lg py-2 font-sans text-xs transition-all hover:bg-opacity-80"
                  style={{
                    background: "oklch(0.12 0 0)",
                    border: "1px solid oklch(0.35 0.15 25)",
                    color: "oklch(0.65 0.2 25)",
                  }}
                >
                  Delete This Node
                </button>
              </>
            )}
          </form>
        ) : (
          <div className="flex flex-col gap-3 py-2">
            <p className="font-sans text-sm" style={{ color: "oklch(0.75 0 0)" }}>
              Delete <strong style={{ color: "oklch(0.95 0 0)" }}>{parentNode.nickname}</strong>?
              This will also remove all connected edges.
            </p>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg py-2 font-sans text-xs transition-all hover:opacity-80"
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
                onClick={() => {
                  onDelete(parentNode.id)
                  onClose()
                }}
                className="flex-1 rounded-lg py-2 font-sans text-xs font-semibold transition-all hover:opacity-80"
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