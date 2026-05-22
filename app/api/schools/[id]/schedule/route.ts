import { NextRequest, NextResponse } from "next/server";
import { Client } from "@upstash/qstash";
import { redis } from "@/lib/redis";

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

function getBaseUrl() {
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL}`
    : "http://localhost:3000";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [scheduleId, interval] = await Promise.all([
    redis.get<string>(`schedule:${id}`),
    redis.get<number>(`schedule:${id}:interval`),
  ]);
  return NextResponse.json({ active: !!scheduleId, scheduleId, interval: interval ?? 120 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { action, intervalMinutes } = await req.json();
  const baseUrl = getBaseUrl();

  if (action === "start") {
    const existing = await redis.get<string>(`schedule:${id}`);
    if (existing) {
      try { await qstash.schedules.delete(existing); } catch {}
    }

    const cron = intervalMinutes >= 60
      ? `0 */${Math.round(intervalMinutes / 60)} * * *`
      : `*/${intervalMinutes} * * *`;

    const schedule = await qstash.schedules.create({
      destination: `${baseUrl}/api/schools/${id}/auto-send`,
      cron,
      headers: { "x-school-id": id },
    });

    await redis.set(`schedule:${id}`, schedule.scheduleId);
    await redis.set(`schedule:${id}:interval`, intervalMinutes);

    return NextResponse.json({ active: true, scheduleId: schedule.scheduleId, cron });
  }

  if (action === "stop") {
    const scheduleId = await redis.get<string>(`schedule:${id}`);
    if (scheduleId) {
      try { await qstash.schedules.delete(scheduleId); } catch {}
      await redis.del(`schedule:${id}`);
      await redis.del(`schedule:${id}:interval`);
    }
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
