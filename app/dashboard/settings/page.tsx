"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";
import type { GlobalSettings } from "@/lib/types";

const DEFAULTS: GlobalSettings = {
  defaultBatchSize: 100,
  defaultDailyLimit: 9000,
  defaultDelay: 10,
  defaultMaxBatchesPerRun: 30,
};

export default function SettingsPage() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [redisOk, setRedisOk] = useState<boolean | null>(null);
  const [qstashOk, setQstashOk] = useState<boolean | null>(null);
  const [redisKeys, setRedisKeys] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : DEFAULTS).then(setSettings).catch(() => {});
    fetch("/api/health").then(r => r.json()).then(d => { setRedisOk(d.redis); setQstashOk(d.qstash); setRedisKeys(d.redisKeys); }).catch(() => {});
  }, []);

  function save(patch: Partial<GlobalSettings>) {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    setError("");

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
        if (!res.ok) throw new Error();
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {
        setError("Kaydetme başarısız");
        setTimeout(() => setError(""), 3000);
      } finally {
        setSaving(false);
      }
    }, 500);
  }

  async function handleResetSettings() {
    setSaving(true);
    try {
      await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(DEFAULTS) });
      setSettings(DEFAULTS);
      setConfirmReset(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Sıfırlama başarısız");
    } finally {
      setSaving(false);
    }
  }

  async function handleWipeAll() {
    setWiping(true);
    try {
      const res = await fetch("/api/reset", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setConfirmWipe(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setSettings(DEFAULTS);
    } catch {
      setError("Silme işlemi başarısız");
    } finally {
      setWiping(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Ayarlar</h1>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-blue-400 animate-pulse">Kaydediliyor...</span>}
          {saved && <span className="text-xs text-green-400 bg-green-900/30 px-3 py-1 rounded-full">Kaydedildi</span>}
          {error && <span className="text-xs text-red-400 bg-red-900/30 px-3 py-1 rounded-full">{error}</span>}
        </div>
      </div>

      <div className="space-y-4">
        {/* Gönderim Ayarları */}
        <Section title="Gönderim Ayarları" icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" color="text-blue-400">
          <Row label="Varsayılan Batch Boyutu" desc="Her batch'teki mail sayısı">
            <select value={settings.defaultBatchSize} onChange={e => save({ defaultBatchSize: +e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              {[25, 50, 100, 150, 200, 300, 400, 500].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Row>
          <Row label="Günlük Gönderim Limiti" desc="Okul başına günlük max mail">
            <input type="number" value={settings.defaultDailyLimit} onChange={e => save({ defaultDailyLimit: +e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-24 focus:border-blue-500 focus:outline-none" />
          </Row>
          <Row label="Batch Arası Bekleme" desc="Saniye cinsinden (throttling)">
            <div className="flex items-center gap-2">
              <input type="range" min={1} max={60} value={settings.defaultDelay} onChange={e => save({ defaultDelay: +e.target.value })}
                className="w-24 accent-blue-500" />
              <span className="text-sm text-gray-400 w-10 text-right">{settings.defaultDelay}s</span>
            </div>
          </Row>
          <Row label="Cron Max Batch" desc="Otomatik gönderimde tek seferde max batch">
            <input type="number" value={settings.defaultMaxBatchesPerRun} onChange={e => save({ defaultMaxBatchesPerRun: +e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-20 focus:border-blue-500 focus:outline-none" />
          </Row>
        </Section>

        {/* Sistem Durumu */}
        <Section title="Sistem Durumu" icon="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" color="text-green-400">
          <StatusRow label="Vercel" desc="Next.js uygulama sunucusu" status={true} />
          <StatusRow label="Upstash Redis" desc={`Veri depolama${redisKeys !== null ? ` — ${redisKeys.toLocaleString()} key` : ""}`} status={redisOk} />
          <StatusRow label="Upstash QStash" desc="Zamanlanmış görev yönetimi" status={qstashOk} />
          <StatusRow label="Outlook API" desc="Mail gönderim servisi" status={true} />
        </Section>

        {/* Görünüm */}
        <Section title="Görünüm" icon="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" color="text-purple-400">
          <Row label="Tema" desc="Koyu ve açık tema arasında geçiş yap">
            <button onClick={toggleTheme}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${theme === "dark" ? "bg-gray-700 text-white" : "bg-yellow-100 text-yellow-800"}`}>
              {theme === "dark" ? "Koyu" : "Açık"}
            </button>
          </Row>
          <Row label="Dil" desc="Arayüz dili (yakında)">
            <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm opacity-50 cursor-not-allowed" defaultValue="tr" disabled>
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </select>
          </Row>
        </Section>

        {/* Tehlikeli Bölge */}
        <section className="bg-gray-900 border border-red-900/50 rounded-xl p-4 sm:p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2 text-red-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Tehlikeli Bölge
          </h2>
          <div className="space-y-4">
            {/* Ayarları Sıfırla */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-yellow-300">Ayarları Sıfırla</p>
                <p className="text-xs text-gray-500">Tüm ayarları varsayılana döndürür. Okul verileri korunur.</p>
              </div>
              {!confirmReset ? (
                <button onClick={() => setConfirmReset(true)}
                  className="px-4 py-2 bg-yellow-900/30 text-yellow-400 border border-yellow-800 rounded-lg text-sm font-medium hover:bg-yellow-900/50 transition-colors shrink-0">
                  Sıfırla
                </button>
              ) : (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setConfirmReset(false)} className="px-3 py-2 bg-gray-800 rounded-lg text-sm">İptal</button>
                  <button onClick={handleResetSettings} className="px-3 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium">Eminim, Sıfırla</button>
                </div>
              )}
            </div>

            <div className="border-t border-gray-800" />

            {/* Tüm Verileri Sil */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-red-300">Tüm Verileri Sil</p>
                <p className="text-xs text-gray-500">Bu işlem geri alınamaz. Tüm okullar, kişiler, batch&apos;ler ve loglar silinir.</p>
              </div>
              {!confirmWipe ? (
                <button onClick={() => setConfirmWipe(true)}
                  className="px-4 py-2 bg-red-900/30 text-red-400 border border-red-800 rounded-lg text-sm font-medium hover:bg-red-900/50 transition-colors shrink-0">
                  Tümünü Sil
                </button>
              ) : (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setConfirmWipe(false)} className="px-3 py-2 bg-gray-800 rounded-lg text-sm">İptal</button>
                  <button onClick={handleWipeAll} disabled={wiping}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {wiping ? "Siliniyor..." : "Eminim, Tümünü Sil"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Section({ title, icon, color, children }: { title: string; icon: string; color: string; children: React.ReactNode }) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
      <h2 className="font-semibold mb-4 flex items-center gap-2">
        <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function StatusRow({ label, desc, status }: { label: string; desc: string; status: boolean | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`w-2.5 h-2.5 rounded-full ${status === null ? "bg-gray-600" : status ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
        <span className={`text-xs ${status === null ? "text-gray-500" : status ? "text-green-400" : "text-red-400"}`}>
          {status === null ? "Kontrol ediliyor..." : status ? "Bağlı" : "Bağlantı yok"}
        </span>
      </div>
    </div>
  );
}
