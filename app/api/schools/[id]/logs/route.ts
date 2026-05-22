import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export interface SendLog {
  batchId: number;
  count: number;
  status: "sent" | "failed";
  timestamp: string;
  error?: string;
  duration?: number;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const logs = (await redis.lrange<SendLog>(`logs:${id}`, 0, 99)) ?? [];
  return NextResponse.json(logs);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const log: SendLog = await req.json();
  await redis.lpush(`logs:${id}`, log);
  await redis.ltrim(`logs:${id}`, 0, 499);
  return NextResponse.json({ ok: true });
}
