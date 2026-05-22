import { NextRequest, NextResponse } from "next/server";
import { connectDB, Group, Template } from "@/lib/db";
import { sendMail } from "@/lib/outlook";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  const { schoolId, templateId, subject, body } = await req.json();

  if (!schoolId) return NextResponse.json({ error: "schoolId gerekli" }, { status: 400 });

  const group = await Group.findById(id).lean();
  if (!group) return NextResponse.json({ error: "Grup bulunamadı" }, { status: 404 });
  if (!group.members.length) return NextResponse.json({ error: "Grupta üye yok" }, { status: 400 });

  let mailSubject = subject;
  let mailBody = body;

  if (templateId) {
    const template = await Template.findById(templateId).lean();
    if (template) {
      mailSubject = template.subject;
      mailBody = template.body;
    }
  }

  if (!mailSubject || !mailBody) {
    return NextResponse.json({ error: "subject ve body gerekli (veya templateId)" }, { status: 400 });
  }

  const CHUNK_SIZE = 400;
  let totalSent = 0;
  const errors: string[] = [];

  for (let i = 0; i < group.members.length; i += CHUNK_SIZE) {
    const chunk = group.members.slice(i, i + CHUNK_SIZE);
    const result = await sendMail(schoolId, mailSubject, mailBody, chunk);
    if (result.success) {
      totalSent += chunk.length;
    } else {
      errors.push(result.error || "Unknown error");
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    totalSent,
    totalMembers: group.members.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
