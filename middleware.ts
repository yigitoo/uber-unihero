import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public — no auth needed
  if (
    path === "/api/auth" ||
    path.startsWith("/api/auth/") ||
    path.includes("/auto-send") ||
    path.includes("/cron")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("unihero_auth")?.value;
  const secret = process.env.AUTH_SECRET;

  if (token !== secret) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*",
  ],
};
