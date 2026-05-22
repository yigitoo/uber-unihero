import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export interface SchoolSettings {
  batchSize: number;
  dailyLimit: number;
  delayBetweenBatches: number;
  autoSend: boolean;
  autoSendTime: string;
  maxBatchesPerRun: number;
}

const DEFAULTS: SchoolSettings = {
  batchSize: 100,
  dailyLimit: 9000,
  delayBetweenBatches: 10,
  autoSend: false,
  autoSendTime: "09:00",
  maxBatchesPerRun: 30,
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const settings = await redis.get<SchoolSettings>(`settings:${id}`);
  return NextResponse.json(settings ?? DEFAULTS);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const current = (await redis.get<SchoolSettings>(`settings:${id}`)) ?? DEFAULTS;
  const updated = { ...current, ...body };
  await redis.set(`settings:${id}`, updated);
  return NextResponse.json(updated);
}
