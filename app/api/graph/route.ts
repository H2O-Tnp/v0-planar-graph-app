import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const GRAPH_KEY = "graph-data"

const DEFAULT_GRAPH = {
  nodes: [
    { id: "1", nickname: "Alice", state: "ABO", x: 400, y: 300 },
    { id: "2", nickname: "Bob", state: "PP", x: 650, y: 180 },
    { id: "3", nickname: "Carol", state: "ABO", x: 650, y: 420 },
  ],
  edges: [
    { source: "1", target: "2" },
    { source: "1", target: "3" },
  ],
}

export async function GET() {
  try {
    const data = await redis.get(GRAPH_KEY)
    if (!data) {
      await redis.set(GRAPH_KEY, DEFAULT_GRAPH)
      return NextResponse.json(DEFAULT_GRAPH)
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error("Redis GET error:", error)
    return NextResponse.json(DEFAULT_GRAPH)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    await redis.set(GRAPH_KEY, body)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Redis POST error:", error)
    return NextResponse.json({ ok: false, error: "Failed to save" }, { status: 500 })
  }
}
