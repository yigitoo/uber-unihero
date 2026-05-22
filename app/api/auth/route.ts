import { NextRequest, NextResponse } from "next/server";
import { connectDB, User, OTP } from "@/lib/db";
import { sendOTP } from "@/lib/mailer";
import { setAuthCookie } from "@/lib/auth";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  await connectDB();
  const { action, email, code } = await req.json();

  if (action === "request-otp") {
    if (!email) return NextResponse.json({ error: "Email gerekli" }, { status: 400 });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return NextResponse.json({ error: "Bu email ile kayıtlı kullanıcı yok" }, { status: 403 });

    const otp = generateCode();
    await OTP.create({
      email: email.toLowerCase(),
      code: otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendOTP(email, otp);
    return NextResponse.json({ sent: true });
  }

  if (action === "verify-otp") {
    if (!email || !code) return NextResponse.json({ error: "Email ve kod gerekli" }, { status: 400 });

    const otpDoc = await OTP.findOne({
      email: email.toLowerCase(),
      code,
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpDoc) return NextResponse.json({ error: "Geçersiz veya süresi dolmuş kod" }, { status: 401 });

    await OTP.updateOne({ _id: otpDoc._id }, { used: true });
    await setAuthCookie();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
