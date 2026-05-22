import { NextRequest, NextResponse } from "next/server";
import {
  getSchools,
  getAllBatches,
  getBatch,
  setBatch,
  getTotalBatches,
  getTodaySent,
  incrementTodaySent,
  getMailTemplate,
} from "@/lib/redis";
import { sendMail } from "@/lib/outlook";

const MAX_BATCHES_PER_SCHOOL = 30;
const DELAY_MS = 10000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schools = await getSchools();
  const results: Record<string, unknown[]> = {};

  for (const school of schools) {
    const template = await getMailTemplate(school.id);
    if (!template) {
      results[school.id] = [{ skipped: "no template" }];
      continue;
    }

    const schoolResults: unknown[] = [];
    const total = await getTotalBatches(school.id);

    for (let attempt = 0; attempt < MAX_BATCHES_PER_SCHOOL; attempt++) {
      const todaySent = await getTodaySent(school.id);
      if (todaySent >= 9000) {
        schoolResults.push({ limit: true });
        break;
      }

      let nextN: number | null = null;
      for (let i = 1; i <= total; i++) {
        const b = await getBatch(school.id, i);
        if (b && b.status === "pending") {
          nextN = i;
          break;
        }
      }

      if (!nextN) {
        schoolResults.push({ done: true });
        break;
      }

      const batch = await getBatch(school.id, nextN);
      if (!batch) break;

      const result = await sendMail(
        school.id,
        template.subject,
        template.body,
        batch.emails
      );

      if (result.success) {
        await setBatch(school.id, nextN, {
          ...batch,
          status: "sent",
          sentAt: new Date().toISOString(),
        });
        await incrementTodaySent(school.id, batch.count);
        schoolResults.push({ batch: nextN, sent: batch.count });
      } else {
        await setBatch(school.id, nextN, {
          ...batch,
          status: "failed",
          error: result.error,
        });
        schoolResults.push({ batch: nextN, error: result.error });
        break;
      }

      if (attempt < MAX_BATCHES_PER_SCHOOL - 1) await sleep(DELAY_MS);
    }

    results[school.id] = schoolResults;
  }

  return NextResponse.json({ results });
}
