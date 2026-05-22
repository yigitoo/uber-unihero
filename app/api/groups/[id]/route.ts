import { NextRequest, NextResponse } from "next/server";
import { connectDB, Group } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  const group = await Group.findById(id).lean();
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(group);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  const updates = await req.json();
  delete updates.members;
  const group = await Group.findByIdAndUpdate(id, updates, { new: true }).lean();
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(group);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  await Group.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
