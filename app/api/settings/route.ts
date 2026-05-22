import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export async function GET() {
  const settings = await redis.get("global:settings");
  return NextResponse.json(settings ?? {
    defaultBatchSize: 100,
    defaultDailyLimit: 9000,
    defaultDelay: 10,
    defaultMaxBatchesPerRun: 30,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  await redis.set("global:settings", body);
  return NextResponse.json(body);
}
