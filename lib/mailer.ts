import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

export async function sendOTP(email: string, code: string) {
  await transporter.sendMail({
    from: `UniHero CRM <${process.env.MAIL_USER}>`,
    to: email,
    subject: `UniHero Giriş Kodu: ${code}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:30px;text-align:center;">
        <h2 style="color:#1a1a2e;margin-bottom:10px;">UniHero CRM</h2>
        <p style="color:#666;margin-bottom:20px;">Giriş kodunuz:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#2563eb;padding:20px;background:#f1f5f9;border-radius:12px;margin-bottom:20px;">${code}</div>
        <p style="color:#999;font-size:13px;">Bu kod 5 dakika geçerlidir.</p>
      </div>
    `,
  });
}
