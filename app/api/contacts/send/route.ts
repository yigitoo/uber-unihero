import { NextRequest, NextResponse } from "next/server";
import { connectDB, Contact, Template } from "@/lib/db";
import { sendMail } from "@/lib/outlook";
import { sendGmail } from "@/lib/google";
import { getSchool } from "@/lib/redis";

export async function POST(req: NextRequest) {
  await connectDB();

  const { schoolId, templateId, subject, body, contactIds, filters } = await req.json();

  if (!schoolId) return NextResponse.json({ error: "schoolId gerekli" }, { status: 400 });

  // Get emails from contactIds or filters
  let emails: string[] = [];

  if (contactIds?.length) {
    const contacts = await Contact.find({ _id: { $in: contactIds } }).select("email").lean();
    emails = contacts.map((c: { email: string }) => c.email);
  } else if (filters) {
    const filter: Record<string, unknown> = {};
    if (filters.category) filter.category = filters.category;
    if (filters.tags?.length) filter.tags = { $in: filters.tags };
    if (filters.search) {
      filter.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { email: { $regex: filters.search, $options: "i" } },
      ];
    }
    const contacts = await Contact.find(filter).select("email").lean();
    emails = contacts.map((c: { email: string }) => c.email);
  }

  if (!emails.length) return NextResponse.json({ error: "Gönderilecek kişi yok" }, { status: 400 });

  // Get mail content
  let mailSubject = subject;
  let mailBody = body;

  if (templateId) {
    const template = await Template.findById(templateId).lean();
    if (template) {
      mailSubject = (template as { subject: string }).subject;
      mailBody = (template as { body: string }).body;
    }
  }

  if (!mailSubject || !mailBody) {
    return NextResponse.json({ error: "subject/body veya templateId gerekli" }, { status: 400 });
  }

  const school = await getSchool(schoolId);
  const isGoogle = school?.provider === "google";
  const send = isGoogle ? sendGmail : sendMail;

  const CHUNK = 400;
  let totalSent = 0;
  const errors: string[] = [];
  const start = Date.now();

  for (let i = 0; i < emails.length; i += CHUNK) {
    const chunk = emails.slice(i, i + CHUNK);
    const result = await send(schoolId, mailSubject, mailBody, chunk);
    if (result.success) {
      totalSent += chunk.length;
    } else {
      errors.push(result.error || "Unknown");
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    totalSent,
    totalContacts: emails.length,
    duration: Date.now() - start,
    errors: errors.length > 0 ? errors : undefined,
  });
}
