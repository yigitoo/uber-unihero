import { NextRequest, NextResponse } from "next/server";
import { startDeviceCode, pollDeviceCode } from "@/lib/outlook";
import { startGoogleDeviceCode, pollGoogleDeviceCode } from "@/lib/google";
import { getSchool } from "@/lib/redis";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { action } = await req.json();
    const school = await getSchool(id);
    const isGoogle = school?.provider === "google";

    if (action === "start") {
      const result = isGoogle
        ? await startGoogleDeviceCode(id)
        : await startDeviceCode(id);
      return NextResponse.json({
        userCode: result.userCode,
        verificationUri: result.verificationUri,
      });
    }

    if (action === "poll") {
      const result = isGoogle
        ? await pollGoogleDeviceCode(id)
        : await pollDeviceCode(id);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Auth flow failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
