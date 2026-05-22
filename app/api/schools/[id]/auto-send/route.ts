import { NextRequest, NextResponse } from "next/server";
import {
  getTotalBatches,
  getBatch,
  setBatch,
  getMailTemplate,
  getTodaySent,
  incrementTodaySent,
  redis,
} from "@/lib/redis";
import { sendMail } from "@/lib/outlook";
import { sendGmail } from "@/lib/google";
import { getSchool } from "@/lib/redis";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const template = await getMailTemplate(id);
  if (!template) {
    return NextResponse.json({ skipped: true, reason: "No template" });
  }

  const todaySent = await getTodaySent(id);
  if (todaySent >= 9000) {
    return NextResponse.json({ skipped: true, reason: "Daily limit" });
  }

  const total = await getTotalBatches(id);
  let nextN: number | null = null;
  for (let i = 1; i <= total; i++) {
    const b = await getBatch(id, i);
    if (b && b.status === "pending") { nextN = i; break; }
  }

  if (!nextN) {
    return NextResponse.json({ skipped: true, reason: "All sent" });
  }

  const batch = await getBatch(id, nextN);
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 500 });

  const start = Date.now();
  const school = await getSchool(id);
  const result = school?.provider === "google"
    ? await sendGmail(id, template.subject, template.body, batch.emails)
    : await sendMail(id, template.subject, template.body, batch.emails);
  const duration = Date.now() - start;

  const log = {
    batchId: nextN,
    count: batch.count,
    status: result.success ? "sent" as const : "failed" as const,
    timestamp: new Date().toISOString(),
    error: result.error,
    duration,
  };
  await redis.lpush(`logs:${id}`, log);
  await redis.ltrim(`logs:${id}`, 0, 499);

  if (result.success) {
    await setBatch(id, nextN, { ...batch, status: "sent", sentAt: new Date().toISOString() });
    await incrementTodaySent(id, batch.count);
    return NextResponse.json({ ok: true, batch: nextN, count: batch.count });
  }

  await setBatch(id, nextN, { ...batch, status: "failed", error: result.error });
  return NextResponse.json({ error: result.error }, { status: 500 });
}
