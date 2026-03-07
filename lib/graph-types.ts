export interface GraphNode {
  id: string
  nickname: string
  state: "ABO" | "PP"
  x: number
  y: number
}

export interface GraphEdge {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
