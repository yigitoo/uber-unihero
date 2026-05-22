import { NextRequest, NextResponse } from "next/server";
import { startDeviceCode, pollDeviceCode } from "@/lib/outlook";
import { getGoogleAuthUrl } from "@/lib/google";
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
      if (isGoogle) {
        const authUrl = getGoogleAuthUrl(id);
        return NextResponse.json({ redirect: true, authUrl });
      }
      const result = await startDeviceCode(id);
      return NextResponse.json({
        userCode: result.userCode,
        verificationUri: result.verificationUri,
      });
    }

    if (action === "poll") {
      if (isGoogle) {
        return NextResponse.json({ done: false, error: "Google uses redirect flow" });
      }
      const result = await pollDeviceCode(id);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Auth flow failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
