"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RichTextEditor from "@/components/rich-text-editor";
import type { Template } from "@/lib/types";

const SITE_URL = typeof window !== "undefined" ? window.location.origin : "";
const UBER_TEMPLATE = `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#1a1a2e;color:#fff;padding:0;">
  <div style="text-align:center;padding:20px 0 0;">
    <img src="${SITE_URL}/uber-tr.png" alt="Uber %80 İndirim" style="width:100%;max-width:600px;height:auto;display:block;" />
  </div>
  <div style="height:2px;background:linear-gradient(90deg,#276EF1,#06C167);margin:0;"></div>
  <div style="text-align:center;padding:20px 0 0;">
    <img src="${SITE_URL}/uber-en.png" alt="Uber 80% Off" style="width:100%;max-width:600px;height:auto;display:block;" />
  </div>
  <div style="padding:20px 30px;background:#1a1a2e;text-align:center;">
    <p style="color:#999;font-size:13px;margin:0;line-height:1.6;">Bu mail öğrencilere özel olarak gönderilmiştir.<br/>This email was sent exclusively to university students.</p>
  </div>
</div>`;

interface BatchInfo { index: number; status: string; count: number; sentAt?: string; error?: string; }
interface Settings { batchSize: number; dailyLimit: number; delayBetweenBatches: number; autoSend: boolean; autoSendTime: string; maxBatchesPerRun: number; }
interface SendLog { batchId: number; count: number; status: string; timestamp: string; error?: string; duration?: number; }

type Tab = "send" | "direct" | "batches" | "logs" | "settings" | "scrape";

export default function SchoolDetailPage() {
  const { schoolId } = useParams() as { schoolId: string };
  const [tab, setTab] = useState<Tab>("send");

  const [school, setSchool] = useState<Record<string, unknown> | null>(null);
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [stats, setStats] = useState({ totalBatches: 0, contactCount: 0, totalSent: 0, todaySent: 0, dailyLimit: 9000 });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth
  const [userCode, setUserCode] = useState("");
  const [verificationUri, setVerificationUri] = useState("");
  const [authPolling, setAuthPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Send
  const [subject, setSubject] = useState("Uber %80 İndirim / 80% Off — Kod: UBERUNIHERO8");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Auto-send schedule (server-side via QStash)
  const [scheduleActive, setScheduleActive] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState(120);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);

  // Direct send
  const [directEmails, setDirectEmails] = useState("");
  const [directSubject, setDirectSubject] = useState("");
  const [directBody, setDirectBody] = useState("");
  const [directSending, setDirectSending] = useState(false);

  const fetchAll = useCallback(async () => {
    const [sRes, bRes, stRes, lRes, tRes] = await Promise.all([
      fetch(`/api/schools/${schoolId}`),
      fetch(`/api/schools/${schoolId}/batches`),
      fetch(`/api/schools/${schoolId}/settings`),
      fetch(`/api/schools/${schoolId}/logs`),
      fetch(`/api/schools/${schoolId}/template`),
    ]);
    if (sRes.ok) setSchool(await sRes.json());
    if (bRes.ok) {
      const bd = await bRes.json();
      setBatches(bd.batches || []);
      setStats({ totalBatches: bd.totalBatches, contactCount: bd.contactCount, totalSent: bd.totalSent, todaySent: bd.todaySent, dailyLimit: bd.dailyLimit });
    }
    if (stRes.ok) setSettings(await stRes.json());
    if (lRes.ok) setLogs(await lRes.json());
    if (tRes.ok) {
      const t = await tRes.json();
      if (t.subject) setSubject(t.subject);
      if (t.body) setBody(t.body);
    }
    setLoading(false);
  }, [schoolId]);

  useEffect(() => {
    fetchAll();
    fetchSchedule();
    fetch("/api/templates").then(r => r.ok ? r.json() : []).then(setTemplates).catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAll]);

  async function fetchSchedule() {
    const res = await fetch(`/api/schools/${schoolId}/schedule`);
    if (res.ok) {
      const d = await res.json();
      setScheduleActive(d.active);
      if (d.interval) setScheduleInterval(d.interval);
    }
  }

  async function toggleSchedule() {
    if (scheduleActive) {
      await fetch(`/api/schools/${schoolId}/schedule`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      setScheduleActive(false);
      setMsg({ text: "Otomatik gönderim durduruldu", ok: true });
    } else {
      if (!subject || !body) { setMsg({ text: "Önce template yükle ve kaydet", ok: false }); return; }
      await fetch(`/api/schools/${schoolId}/template`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const res = await fetch(`/api/schools/${schoolId}/schedule`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", intervalMinutes: scheduleInterval }),
      });
      const d = await res.json();
      setScheduleActive(true);
      setMsg({ text: `Otomatik gönderim başlatıldı (her ${scheduleInterval} dk)`, ok: true });
    }
  }

  async function startAuth() {
    const res = await fetch(`/api/schools/${schoolId}/auth`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    const data = await res.json();
    setUserCode(data.userCode);
    setVerificationUri(data.verificationUri);
    setAuthPolling(true);
    pollRef.current = setInterval(async () => {
      const r = await fetch(`/api/schools/${schoolId}/auth`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "poll" }),
      });
      const d = await r.json();
      if (d.done) {
        if (pollRef.current) clearInterval(pollRef.current);
        setUserCode(""); setVerificationUri(""); setAuthPolling(false);
        setMsg({ text: "Oturum açıldı!", ok: true });
        fetchAll();
      }
    }, 5000);
  }

  async function handleSend() {
    if (!subject || !body) { setMsg({ text: "Konu/içerik gerekli", ok: false }); return; }
    setSending(true); setMsg(null);
    await fetch(`/api/schools/${schoolId}/template`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    const res = await fetch(`/api/schools/${schoolId}/send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    const d = await res.json();
    setMsg({ text: d.success ? `Batch ${d.batchIndex} gönderildi (${d.emailCount} mail, ${d.duration}ms)` : d.error, ok: d.success });
    setSending(false);
    fetchAll();
  }

  async function saveSettings(patch: Partial<Settings>) {
    const res = await fetch(`/api/schools/${schoolId}/settings`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) setSettings(await res.json());
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Yükleniyor...</div>;

  const authOk = !!(school as Record<string, unknown>)?.authEmail;
  const nextBatch = batches.find(b => b.status === "pending");
  const progress = stats.totalBatches ? (stats.totalSent / stats.totalBatches) * 100 : 0;
  const failedCount = batches.filter(b => b.status === "failed").length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard" className="text-gray-500 text-sm hover:text-gray-300">← Okullar</Link>
          <h1 className="text-2xl font-bold mt-1">{(school as Record<string, unknown>)?.name as string}</h1>
          <p className="text-gray-500 text-sm">{(school as Record<string, unknown>)?.domain as string}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm ${authOk ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
          {authOk ? (school as Record<string, unknown>)?.authEmail as string : "Auth Gerekli"}
        </div>
      </div>

      {/* Auth flow */}
      {!authOk && !userCode && (
        <div className="bg-gray-900 rounded-xl p-5 mb-6 border border-yellow-800 text-center">
          <p className="text-yellow-400 mb-3">Microsoft hesabıyla oturum aç (1 kere yeter)</p>
          <button onClick={startAuth} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium">Microsoft ile Oturum Aç</button>
        </div>
      )}
      {userCode && (
        <div className="bg-gray-900 rounded-xl p-5 mb-6 border border-blue-800 text-center">
          <p className="text-blue-400 mb-2">Bu sayfayı aç:</p>
          <a href={verificationUri} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline text-lg font-mono">{verificationUri}</a>
          <p className="text-gray-400 mt-3 mb-2">Bu kodu gir:</p>
          <div className="text-4xl font-mono font-bold tracking-widest text-white mb-3">{userCode}</div>
          {authPolling && <p className="text-gray-500 text-sm animate-pulse">Onay bekleniyor...</p>}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Toplam" value={stats.contactCount.toLocaleString()} />
        <StatCard label="Gönderilen" value={`${stats.totalSent}/${stats.totalBatches}`} sub="batch" />
        <StatCard label="Bugün" value={`${stats.todaySent.toLocaleString()}`} sub={`/ ${stats.dailyLimit.toLocaleString()}`} />
        <StatCard label="Başarısız" value={String(failedCount)} color={failedCount > 0 ? "text-red-400" : undefined} />
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>{stats.totalSent} / {stats.totalBatches} batch</span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2.5">
          <div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1">
        {(["send", "direct", "batches", "logs", "settings", "scrape"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"}`}>
            {t === "send" ? "Gönder" : t === "direct" ? "Direkt" : t === "batches" ? "Batch'ler" : t === "logs" ? "Loglar" : t === "settings" ? "Ayarlar" : "Scrape"}
          </button>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div className={`p-3 rounded-lg mb-4 text-sm ${msg.ok ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
          {msg.text}
        </div>
      )}

      {/* Tab: Send */}
      {tab === "send" && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
              <label className="text-sm text-gray-400">Mail Şablonu</label>
              <div className="flex items-center gap-2">
                {templates.length > 0 && (
                  <select onChange={e => { const t = templates.find(t => t._id === e.target.value); if (t) { setSubject(t.subject); setBody(t.body); } }}
                    defaultValue="" className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs">
                    <option value="" disabled>Şablon Seç</option>
                    {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                  </select>
                )}
                <button onClick={() => { setSubject("Uber %80 İndirim / 80% Off — Kod: UBERUNIHERO8"); setBody(UBER_TEMPLATE); }}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-medium">Uber Template</button>
              </div>
            </div>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Konu"
              className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none mb-3" />
            <RichTextEditor value={body} onChange={setBody} />
            {body && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2">Önizleme:</p>
                <div className="bg-white rounded-lg p-2 max-h-60 overflow-y-auto" dangerouslySetInnerHTML={{ __html: body }} />
              </div>
            )}
          </div>
          <button onClick={handleSend} disabled={sending || !authOk || !nextBatch}
            className="w-full p-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-medium text-lg transition-colors">
            {sending ? "Gönderiliyor..." : !nextBatch ? "Tüm Batch'ler Gönderildi" : `Batch ${nextBatch.index} Gönder (${nextBatch.count} mail)`}
          </button>

          {/* Auto-send (server-side, works even when page closed) */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium">Otomatik Gönderim (Arka Plan)</p>
                <p className="text-xs text-gray-500">Sayfa kapalı olsa bile sunucuda çalışır</p>
              </div>
              <button onClick={toggleSchedule} disabled={!authOk || (!scheduleActive && (!subject || !body))}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${scheduleActive ? "bg-red-600 hover:bg-red-500" : "bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500"}`}>
                {scheduleActive ? "Durdur" : "Başlat"}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500">Aralık:</label>
              <select value={scheduleInterval} onChange={e => setScheduleInterval(+e.target.value)} disabled={scheduleActive}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm disabled:opacity-50">
                <option value={30}>30 dk</option>
                <option value={60}>1 saat</option>
                <option value={120}>2 saat</option>
                <option value={180}>3 saat</option>
                <option value={360}>6 saat</option>
              </select>
              {scheduleActive && <span className="text-sm text-green-400 ml-auto animate-pulse">Aktif</span>}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Direct Send */}
      {tab === "direct" && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <h3 className="text-sm font-semibold mb-3">Direkt Mail Gönder</h3>
            <p className="text-xs text-gray-500 mb-3">Template kullanmadan, belirli email adreslerine direkt mail gönderin.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Alıcılar</label>
                <textarea value={directEmails} onChange={e => setDirectEmails(e.target.value)}
                  placeholder="Email adresleri (virgül, noktalı virgül veya yeni satır ile ayırın)"
                  rows={4} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none resize-y" />
                <p className="text-xs text-gray-600 mt-1">
                  {directEmails.split(/[,;\n]+/).filter(e => e.trim().includes("@")).length} email algılandı
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Konu:</label>
                {templates.length > 0 && (
                  <select onChange={e => { const t = templates.find(t => t._id === e.target.value); if (t) { setDirectSubject(t.subject); setDirectBody(t.body); } }}
                    defaultValue="" className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs">
                    <option value="" disabled>Şablondan Yükle</option>
                    {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                  </select>
                )}
              </div>
              <input type="text" value={directSubject} onChange={e => setDirectSubject(e.target.value)} placeholder="Email konusu"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />

              <div>
                <label className="text-xs text-gray-400 mb-1 block">İçerik</label>
                <RichTextEditor value={directBody} onChange={setDirectBody} />
              </div>
            </div>
          </div>

          <button
            onClick={async () => {
              const emails = directEmails.split(/[,;\n]+/).map(e => e.trim().toLowerCase()).filter(e => e.includes("@"));
              if (!emails.length) { setMsg({ text: "En az bir email gerekli", ok: false }); return; }
              if (!directSubject || !directBody) { setMsg({ text: "Konu ve içerik gerekli", ok: false }); return; }
              setDirectSending(true);
              const res = await fetch(`/api/schools/${schoolId}/send-adhoc`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emails, subject: directSubject, body: directBody }),
              });
              const d = await res.json();
              setMsg({ text: d.success ? `${d.totalSent} kişiye gönderildi (${d.duration}ms)` : d.error || "Hata", ok: d.success });
              setDirectSending(false);
            }}
            disabled={directSending || !authOk}
            className="w-full p-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-medium text-lg transition-colors">
            {directSending ? "Gönderiliyor..." : "Direkt Gönder"}
          </button>
        </div>
      )}

      {/* Tab: Batches */}
      {tab === "batches" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto">
            {batches.map(b => (
              <div key={b.index} className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
                <div className="flex items-center gap-3">
                  <span>{b.status === "sent" ? "✅" : b.status === "failed" ? "❌" : "⏳"}</span>
                  <span className="text-sm">Batch {b.index} <span className="text-gray-500 ml-1">{b.count} mail</span></span>
                </div>
                <span className="text-xs text-gray-500">
                  {b.sentAt ? new Date(b.sentAt).toLocaleString("tr-TR") : b.error ? b.error.slice(0, 30) : "bekliyor"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Logs */}
      {tab === "logs" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {logs.length === 0 ? (
            <p className="p-6 text-gray-500 text-center">Henüz log yok</p>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              {logs.map((l, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
                  <div className="flex items-center gap-3">
                    <span>{l.status === "sent" ? "✅" : "❌"}</span>
                    <div>
                      <span className="text-sm">Batch {l.batchId} — {l.count} mail</span>
                      {l.error && <p className="text-xs text-red-400 mt-0.5">{l.error.slice(0, 60)}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500 block">{new Date(l.timestamp).toLocaleString("tr-TR")}</span>
                    {l.duration && <span className="text-xs text-gray-600">{l.duration}ms</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Settings */}
      {tab === "settings" && settings && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-5">
          <SettingRow label="Batch Boyutu" desc="Her batch'teki mail sayısı">
            <select value={settings.batchSize} onChange={e => saveSettings({ batchSize: +e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
              {[50, 100, 200, 300, 400, 500].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </SettingRow>
          <SettingRow label="Günlük Limit" desc="Günde max gönderilecek mail">
            <input type="number" value={settings.dailyLimit} onChange={e => saveSettings({ dailyLimit: +e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-28" />
          </SettingRow>
          <SettingRow label="Batch Arası Bekleme" desc="Saniye cinsinden">
            <input type="number" value={settings.delayBetweenBatches} onChange={e => saveSettings({ delayBetweenBatches: +e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-28" />
          </SettingRow>
          <SettingRow label="Cron Aktif" desc="Günlük otomatik gönderim">
            <button onClick={() => saveSettings({ autoSend: !settings.autoSend })}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${settings.autoSend ? "bg-green-600" : "bg-gray-700"}`}>
              {settings.autoSend ? "Açık" : "Kapalı"}
            </button>
          </SettingRow>
          <SettingRow label="Cron Saati" desc="Otomatik gönderim saati (UTC)">
            <input type="time" value={settings.autoSendTime} onChange={e => saveSettings({ autoSendTime: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
          </SettingRow>
          <SettingRow label="Cron Max Batch" desc="Cron başına max batch sayısı">
            <input type="number" value={settings.maxBatchesPerRun} onChange={e => saveSettings({ maxBatchesPerRun: +e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-28" />
          </SettingRow>
          <div className="pt-3 border-t border-gray-800">
            <Link href={`/dashboard/${schoolId}/scrape`}
              className="text-blue-400 hover:text-blue-300 text-sm">Directory Scrape →</Link>
          </div>
          <div>
            <button onClick={startAuth} className="text-yellow-400 hover:text-yellow-300 text-sm">
              Yeniden Authenticate →
            </button>
          </div>
        </div>
      )}

      {/* Tab: Scrape */}
      {tab === "scrape" && (
        <div className="text-center py-8">
          <Link href={`/dashboard/${schoolId}/scrape`}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium inline-block">
            Directory Scrape Sayfasını Aç
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
      <div className={`text-xl font-bold ${color || ""}`}>{value}</div>
      {sub && <span className="text-xs text-gray-600">{sub}</span>}
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function SettingRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      {children}
    </div>
  );
}
