import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/google";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const schoolId = req.nextUrl.searchParams.get("state");

  if (!code || !schoolId) {
    return NextResponse.redirect(new URL("/dashboard?error=google_auth_failed", req.url));
  }

  const result = await exchangeGoogleCode(code, schoolId);

  if (result.done) {
    return NextResponse.redirect(new URL(`/dashboard/${schoolId}?google_auth=success`, req.url));
  }

  return NextResponse.redirect(new URL(`/dashboard/${schoolId}?google_auth=failed`, req.url));
}
