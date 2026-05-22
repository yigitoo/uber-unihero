import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Yanlış şifre" }, { status: 401 });
  }

  await setAuthCookie();
  return NextResponse.json({ ok: true });
}
