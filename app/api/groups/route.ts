import { NextRequest, NextResponse } from "next/server";
import { connectDB, Group } from "@/lib/db";

export async function GET() {
  await connectDB();
  const groups = await Group.find().sort({ updatedAt: -1 }).lean();
  return NextResponse.json(groups.map(g => ({ ...g, memberCount: (g.members || []).length })));
}

export async function POST(req: NextRequest) {
  await connectDB();
  const { name, description, color } = await req.json();
  if (!name) return NextResponse.json({ error: "name gerekli" }, { status: 400 });
  const group = await Group.create({ name, description, color, members: [] });
  return NextResponse.json(group, { status: 201 });
}
