import { NextRequest, NextResponse } from "next/server";
import { startDeviceCode, pollDeviceCode } from "@/lib/outlook";
import { getSchool, redis, setAuthEmail } from "@/lib/redis";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action } = body;
    const school = await getSchool(id);
    const isGoogle = school?.provider === "google";

    // Google: save cookies + SAPISIDHASH for PeopleStack API
    if (action === "save-google-cookies") {
      const { cookies, email } = body;
      if (!cookies) {
        return NextResponse.json({ error: "cookies gerekli" }, { status: 400 });
      }
      await redis.set(`auth:${id}:google_cookies`, cookies);
      if (email) await setAuthEmail(id, email);
      return NextResponse.json({ done: true });
    }

    if (action === "start") {
      if (isGoogle) {
        return NextResponse.json({ googleCookieAuth: true });
      }
      const result = await startDeviceCode(id);
      return NextResponse.json({
        userCode: result.userCode,
        verificationUri: result.verificationUri,
      });
    }

    if (action === "poll") {
      if (isGoogle) {
        const hasCookies = await redis.get<string>(`auth:${id}:google_cookies`);
        return NextResponse.json({ done: !!hasCookies });
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
