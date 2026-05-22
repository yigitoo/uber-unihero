import { NextRequest, NextResponse } from "next/server";
import { connectDB, Contact } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  const updates = await req.json();
  const contact = await Contact.findByIdAndUpdate(id, updates, { new: true }).lean();
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(contact);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  await Contact.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
