import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export async function GET() {
  let redisOk = false;
  let qstashOk = false;
  let redisKeys: number | null = null;

  try {
    await redis.ping();
    redisOk = true;
    redisKeys = await redis.dbsize();
  } catch {}

  try {
    const r = await fetch("https://qstash.upstash.io/v2/schedules", {
      headers: { Authorization: `Bearer ${process.env.QSTASH_TOKEN}` },
    });
    qstashOk = r.ok;
  } catch {}

  return NextResponse.json({ redis: redisOk, qstash: qstashOk, redisKeys });
}
