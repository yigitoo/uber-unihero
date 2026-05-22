import { NextRequest, NextResponse } from "next/server";
import { connectDB, Contact } from "@/lib/db";

export async function GET(req: NextRequest) {
  await connectDB();
  const category = req.nextUrl.searchParams.get("category");
  const search = req.nextUrl.searchParams.get("q");
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100");
  const countOnly = req.nextUrl.searchParams.get("count");

  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (countOnly) {
    const count = await Contact.countDocuments(filter);
    return NextResponse.json({ count });
  }

  const [contacts, total] = await Promise.all([
    Contact.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Contact.countDocuments(filter),
  ]);

  return NextResponse.json({ contacts, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  if (!body.name || !body.email || !body.category) {
    return NextResponse.json({ error: "name, email, category gerekli" }, { status: 400 });
  }
  try {
    const contact = await Contact.create(body);
    return NextResponse.json(contact, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "Bu email zaten mevcut" }, { status: 409 });
    }
    throw e;
  }
}
