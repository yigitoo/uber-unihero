import { NextRequest, NextResponse } from "next/server";
import { connectDB, Template } from "@/lib/db";

export async function GET() {
  await connectDB();
  const templates = await Template.find().sort({ updatedAt: -1 }).lean();
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  await connectDB();
  const { name, subject, body } = await req.json();
  if (!name || !subject || !body) {
    return NextResponse.json({ error: "name, subject, body gerekli" }, { status: 400 });
  }
  const template = await Template.create({ name, subject, body });
  return NextResponse.json(template, { status: 201 });
}
