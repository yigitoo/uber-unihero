import { NextRequest, NextResponse } from "next/server";
import { connectDB, Group } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  const { emails } = await req.json() as { emails: string[] };
  if (!emails?.length) return NextResponse.json({ error: "emails gerekli" }, { status: 400 });

  const group = await Group.findByIdAndUpdate(
    id,
    { $addToSet: { members: { $each: emails.map(e => e.toLowerCase().trim()) } } },
    { new: true }
  ).lean();

  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ memberCount: group.members.length });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  const { emails } = await req.json() as { emails: string[] };

  const group = await Group.findByIdAndUpdate(
    id,
    { $pull: { members: { $in: emails } } },
    { new: true }
  ).lean();

  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ memberCount: group.members.length });
}
