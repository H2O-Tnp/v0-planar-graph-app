import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"
import { z } from "zod"

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

// 1. Define the validation schema to perfectly match GraphData
const GraphSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      nickname: z.string(),
      state: z.enum(["ABO", "PP"]),
      x: z.number(),
      y: z.number(),
    })
  ),
  edges: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
    })
  ),
})

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

    // 2. Validate the incoming payload securely
    const parsed = GraphSchema.safeParse(body)

    // 3. Reject invalid data immediately
    if (!parsed.success) {
      console.warn("Validation failed for incoming graph data:", parsed.error.issues)
      return NextResponse.json(
        { ok: false, error: "Invalid data structure provided." },
        { status: 400 }
      )
    }

    // 4. Safely save only the validated data
    await redis.set(GRAPH_KEY, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Redis POST error:", error)
    return NextResponse.json({ ok: false, error: "Failed to save" }, { status: 500 })
  }
}