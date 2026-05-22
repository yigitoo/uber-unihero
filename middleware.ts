import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // QStash auto-send endpoint — authenticated by QStash signatures, not cookies
  if (request.nextUrl.pathname.includes("/auto-send") || request.nextUrl.pathname.includes("/auth/google/callback")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("unihero_auth")?.value;
  const secret = process.env.AUTH_SECRET;

  if (token !== secret) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/schools/:path*", "/api/settings/:path*", "/api/templates/:path*", "/api/contacts/:path*", "/api/groups/:path*", "/api/reset", "/api/upload"],
};
