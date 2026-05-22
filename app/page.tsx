"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "email" | "otp";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function requestOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request-otp", email }),
    });

    if (res.ok) {
      setStep("otp");
    } else {
      const d = await res.json();
      setError(d.error || "Hata oluştu");
    }
    setLoading(false);
  }

  async function verifyOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!otp) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify-otp", email, code: otp }),
    });

    if (res.ok) {
      router.push("/dashboard");
    } else {
      const d = await res.json();
      setError(d.error || "Geçersiz kod");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-800">
        <h1 className="text-2xl font-bold mb-1 text-center">UniHero</h1>
        <p className="text-gray-500 text-sm mb-6 text-center">CRM & Mail Platform</p>

        {step === "email" ? (
          <form onSubmit={requestOTP}>
            <input
              type="email"
              placeholder="Email adresiniz"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none mb-4"
              autoFocus
            />
            {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}
            <button type="submit" disabled={loading || !email}
              className="w-full p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-lg font-medium transition-colors">
              {loading ? "Gönderiliyor..." : "Kod Gönder"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOTP}>
            <p className="text-sm text-gray-400 mb-4 text-center">
              <span className="text-blue-400">{email}</span> adresine kod gönderildi
            </p>
            <input
              type="text"
              placeholder="6 haneli kod"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none mb-4 text-center text-2xl tracking-[0.5em] font-mono"
              autoFocus
              maxLength={6}
            />
            {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}
            <button type="submit" disabled={loading || otp.length !== 6}
              className="w-full p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-lg font-medium transition-colors mb-3">
              {loading ? "Doğrulanıyor..." : "Giriş Yap"}
            </button>
            <button type="button" onClick={() => { setStep("email"); setOtp(""); setError(""); }}
              className="w-full p-2 text-sm text-gray-500 hover:text-gray-300 transition-colors">
              Farklı email kullan
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
