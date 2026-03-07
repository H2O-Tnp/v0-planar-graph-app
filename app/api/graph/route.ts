import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DATA_FILE = path.join(process.cwd(), "data", "graph.json")

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

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
  ensureDataDir()
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_GRAPH, null, 2), "utf-8")
    }
    const raw = fs.readFileSync(DATA_FILE, "utf-8")
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json(DEFAULT_GRAPH)
  }
}

export async function POST(req: Request) {
  ensureDataDir()
  const body = await req.json()
  fs.writeFileSync(DATA_FILE, JSON.stringify(body, null, 2), "utf-8")
  return NextResponse.json({ ok: true })
}
