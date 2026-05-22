import { NextRequest, NextResponse } from "next/server";
import { connectDB, Contact } from "@/lib/db";

export async function POST(req: NextRequest) {
  await connectDB();
  const { contacts } = await req.json() as { contacts: { name: string; email: string; category: string; company?: string }[] };
  if (!contacts?.length) {
    return NextResponse.json({ error: "contacts array gerekli" }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;

  for (const c of contacts) {
    try {
      await Contact.create({
        name: c.name || c.email.split("@")[0],
        email: c.email.toLowerCase().trim(),
        category: c.category || "individual",
        company: c.company,
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ imported, skipped, total: contacts.length });
}
