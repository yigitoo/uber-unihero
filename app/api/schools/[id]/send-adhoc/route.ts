import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/outlook";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { emails, subject, body } = await req.json();

  if (!emails?.length) return NextResponse.json({ error: "emails gerekli" }, { status: 400 });
  if (!subject || !body) return NextResponse.json({ error: "subject ve body gerekli" }, { status: 400 });

  const CHUNK_SIZE = 400;
  let totalSent = 0;
  const errors: string[] = [];
  const start = Date.now();

  for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
    const chunk = emails.slice(i, i + CHUNK_SIZE);
    const result = await sendMail(id, subject, body, chunk);
    if (result.success) {
      totalSent += chunk.length;
    } else {
      errors.push(result.error || "Unknown");
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    totalSent,
    duration: Date.now() - start,
    errors: errors.length > 0 ? errors : undefined,
  });
}
