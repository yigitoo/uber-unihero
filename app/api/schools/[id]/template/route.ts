import { NextRequest, NextResponse } from "next/server";
import { getMailTemplate, setMailTemplate } from "@/lib/redis";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await getMailTemplate(id);
    if (!template) {
      return NextResponse.json(
        { error: "No template found" },
        { status: 404 }
      );
    }
    return NextResponse.json(template);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { subject, body } = await req.json();

    if (!subject || !body) {
      return NextResponse.json(
        { error: "subject and body are required" },
        { status: 400 }
      );
    }

    await setMailTemplate(id, subject, body);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save template" },
      { status: 500 }
    );
  }
}
