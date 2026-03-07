import type { GraphNode, GraphEdge } from "./graph-types"

const NODE_RADIUS = 45
const MIN_DISTANCE = NODE_RADIUS * 2.5 // Minimum distance between node centers
const EDGE_REPULSION = 80 // How much nodes repel from edges they're not part of

interface Point {
  x: number
  y: number
}

// Check if two line segments intersect
function segmentsIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): boolean {
  const ccw = (A: Point, B: Point, C: Point) =>
    (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x)

  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  )
}

// Distance from point to line segment
function pointToSegmentDistance(p: Point, v: Point, w: Point): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2
  if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2)
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
  t = Math.max(0, Math.min(1, t))
  const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) }
  return Math.sqrt((p.x - proj.x) ** 2 + (p.y - proj.y) ** 2)
}

// Count edge crossings in the graph
export function countEdgeCrossings(nodes: GraphNode[], edges: GraphEdge[]): number {
  let crossings = 0
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const e1 = edges[i]
      const e2 = edges[j]

      // Skip if edges share a node
      if (
        e1.source === e2.source ||
        e1.source === e2.target ||
        e1.target === e2.source ||
        e1.target === e2.target
      ) {
        continue
      }

      const p1 = nodeMap.get(e1.source)
      const p2 = nodeMap.get(e1.target)
      const p3 = nodeMap.get(e2.source)
      const p4 = nodeMap.get(e2.target)

      if (!p1 || !p2 || !p3 || !p4) continue

      if (segmentsIntersect(p1, p2, p3, p4)) {
        crossings++
      }
    }
  }

  return crossings
}

// Force-directed layout with edge crossing minimization
export function autoArrangeNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  iterations: number = 100
): GraphNode[] {
  if (nodes.length === 0) return nodes

  // Create working copy with velocities
  const nodeMap = new Map<string, { x: number; y: number; vx: number; vy: number }>()
  nodes.forEach((n) => {
    nodeMap.set(n.id, { x: n.x, y: n.y, vx: 0, vy: 0 })
  })

  // Build adjacency set for quick lookup
  const adjacency = new Map<string, Set<string>>()
  nodes.forEach((n) => adjacency.set(n.id, new Set()))
  edges.forEach((e) => {
    adjacency.get(e.source)?.add(e.target)
    adjacency.get(e.target)?.add(e.source)
  })

  const padding = NODE_RADIUS + 20
  const idealEdgeLength = MIN_DISTANCE * 1.5

  for (let iter = 0; iter < iterations; iter++) {
    const temperature = 1 - iter / iterations // Cooling schedule
    const forceMult = temperature * 0.3

    // Reset forces
    nodeMap.forEach((n) => {
      n.vx = 0
      n.vy = 0
    })

    const nodeIds = Array.from(nodeMap.keys())

    // Repulsion between all node pairs
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const n1 = nodeMap.get(nodeIds[i])!
        const n2 = nodeMap.get(nodeIds[j])!

        const dx = n2.x - n1.x
        const dy = n2.y - n1.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1

        if (dist < MIN_DISTANCE * 2) {
          const force = ((MIN_DISTANCE * 2 - dist) / dist) * forceMult * 50
          const fx = dx * force
          const fy = dy * force

          n1.vx -= fx
          n1.vy -= fy
          n2.vx += fx
          n2.vy += fy
        }
      }
    }

    // Attraction along edges (spring force)
    edges.forEach((e) => {
      const n1 = nodeMap.get(e.source)
      const n2 = nodeMap.get(e.target)
      if (!n1 || !n2) return

      const dx = n2.x - n1.x
      const dy = n2.y - n1.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.1

      const force = ((dist - idealEdgeLength) / dist) * forceMult * 20
      const fx = dx * force
      const fy = dy * force

      n1.vx += fx
      n1.vy += fy
      n2.vx -= fx
      n2.vy -= fy
    })

    // Repel nodes from edges they're not connected to (helps planarity)
    edges.forEach((e) => {
      const source = nodeMap.get(e.source)
      const target = nodeMap.get(e.target)
      if (!source || !target) return

      nodeIds.forEach((nid) => {
        if (nid === e.source || nid === e.target) return
        const node = nodeMap.get(nid)!

        const dist = pointToSegmentDistance(node, source, target)
        if (dist < EDGE_REPULSION && dist > 0) {
          // Push node away from edge
          const edgeMidX = (source.x + target.x) / 2
          const edgeMidY = (source.y + target.y) / 2
          const dx = node.x - edgeMidX
          const dy = node.y - edgeMidY
          const len = Math.sqrt(dx * dx + dy * dy) || 0.1

          const force = ((EDGE_REPULSION - dist) / len) * forceMult * 30
          node.vx += (dx / len) * force
          node.vy += (dy / len) * force
        }
      })
    })

    // Apply velocities with boundary constraints
    nodeMap.forEach((n) => {
      n.x += n.vx
      n.y += n.vy

      // Keep within bounds
      n.x = Math.max(padding, Math.min(width - padding, n.x))
      n.y = Math.max(padding, Math.min(height - padding, n.y))
    })
  }

  // Return updated nodes
  return nodes.map((n) => {
    const pos = nodeMap.get(n.id)!
    return { ...n, x: Math.round(pos.x), y: Math.round(pos.y) }
  })
}

// Check if graph has any overlapping nodes
export function hasOverlappingNodes(nodes: GraphNode[]): boolean {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x
      const dy = nodes[j].y - nodes[i].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < MIN_DISTANCE) return true
    }
  }
  return false
}
