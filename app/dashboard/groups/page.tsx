"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { GroupSummary } from "@/lib/types";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", color: "#3b82f6" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const fetchGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
    if (res.ok) setGroups(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  async function handleCreate() {
    if (!form.name) { setMsg({ text: "Grup adı gerekli", ok: false }); return; }
    setSaving(true);
    const res = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) {
      setMsg({ text: "Grup oluşturuldu", ok: true });
      setForm({ name: "", description: "", color: "#3b82f6" });
      setShowAdd(false);
      fetchGroups();
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu grubu silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/groups/${id}`, { method: "DELETE" });
    fetchGroups();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Gruplar</h1>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-xs px-3 py-1 rounded-full ${msg.ok ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>{msg.text}</span>}
          <button onClick={() => setShowAdd(true)} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">Grup Oluştur</button>
        </div>
      </div>

      {/* Create Form */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4 space-y-3">
          <h2 className="text-sm font-semibold">Yeni Grup</h2>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Grup Adı"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Açıklama (opsiyonel)"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Renk:</span>
            {COLORS.map(c => (
              <button key={c} onClick={() => setForm({ ...form, color: c })}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${form.color === c ? "border-white scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? "Oluşturuluyor..." : "Oluştur"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400">İptal</button>
          </div>
        </div>
      )}

      {/* Group List */}
      {loading ? (
        <p className="text-center text-gray-500 py-20">Yükleniyor...</p>
      ) : groups.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p>Henüz grup yok</p>
          <p className="text-xs mt-1">Grup oluşturarak email listelerinizi organize edin</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map(g => (
            <div key={g._id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between">
                <Link href={`/dashboard/groups/${g._id}`} className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: g.color || "#3b82f6" }}>
                    {g.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{g.name}</h3>
                    {g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
                    <p className="text-xs text-gray-500 mt-1">{g.memberCount} üye</p>
                  </div>
                </Link>
                <button onClick={() => handleDelete(g._id)} className="p-1 text-gray-600 hover:text-red-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
