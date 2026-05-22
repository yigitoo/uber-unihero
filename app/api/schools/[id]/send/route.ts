import { NextRequest, NextResponse } from "next/server";
import {
  getTotalBatches,
  getBatch,
  setBatch,
  getMailTemplate,
  setMailTemplate,
  incrementTodaySent,
  getTodaySent,
  redis,
} from "@/lib/redis";
import { sendMail } from "@/lib/outlook";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    let subject = body.subject as string | undefined;
    let mailBody = body.body as string | undefined;

    // If subject/body not provided, use stored template
    if (!subject || !mailBody) {
      const template = await getMailTemplate(id);
      if (!template) {
        return NextResponse.json(
          { error: "No subject/body provided and no stored template found" },
          { status: 400 }
        );
      }
      subject = subject || template.subject;
      mailBody = mailBody || template.body;
    }

    // Save as template for cron use
    await setMailTemplate(id, subject!, mailBody!);

    // Check daily limit
    const todaySent = await getTodaySent(id);
    if (todaySent >= 9000) {
      return NextResponse.json(
        { error: "Daily send limit (9000) reached" },
        { status: 429 }
      );
    }

    // Find next pending batch
    const totalBatches = await getTotalBatches(id);
    let pendingIndex: number | null = null;

    for (let i = 1; i <= totalBatches; i++) {
      const batch = await getBatch(id, i);
      if (batch && batch.status === "pending") {
        pendingIndex = i;
        break;
      }
    }

    if (pendingIndex === null) {
      return NextResponse.json(
        { error: "No pending batches found" },
        { status: 404 }
      );
    }

    const batch = await getBatch(id, pendingIndex);
    if (!batch) {
      return NextResponse.json(
        { error: "Batch data not found" },
        { status: 500 }
      );
    }

    // Send mail
    const start = Date.now();
    const result = await sendMail(id, subject!, mailBody!, batch.emails);
    const duration = Date.now() - start;

    const log = {
      batchId: pendingIndex,
      count: batch.count,
      status: result.success ? "sent" as const : "failed" as const,
      timestamp: new Date().toISOString(),
      error: result.error,
      duration,
    };
    await redis.lpush(`logs:${id}`, log);
    await redis.ltrim(`logs:${id}`, 0, 499);

    if (result.success) {
      await setBatch(id, pendingIndex, {
        ...batch,
        status: "sent",
        sentAt: new Date().toISOString(),
      });
      await incrementTodaySent(id, batch.count);

      return NextResponse.json({
        success: true,
        batchIndex: pendingIndex,
        emailCount: batch.count,
        duration,
      });
    } else {
      await setBatch(id, pendingIndex, {
        ...batch,
        status: "failed",
        error: result.error,
      });

      return NextResponse.json(
        {
          success: false,
          batchIndex: pendingIndex,
          error: result.error,
          duration,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send mail";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
