"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Group {
  _id: string;
  name: string;
  description?: string;
  color?: string;
  members: string[];
}

export default function GroupDetailPage() {
  const { groupId } = useParams() as { groupId: string };
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [sendSchool, setSendSchool] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  const fetchGroup = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    if (res.ok) setGroup(await res.json());
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    fetchGroup();
    fetch("/api/schools").then(r => r.ok ? r.json() : []).then(s => { setSchools(s); if (s.length) setSendSchool(s[0].id); });
  }, [fetchGroup]);

  async function addMembers() {
    const emails = emailInput.split(/[,;\n]+/).map(e => e.trim().toLowerCase()).filter(e => e.includes("@"));
    if (!emails.length) return;
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails }),
    });
    if (res.ok) {
      setMsg({ text: `${emails.length} üye eklendi`, ok: true });
      setEmailInput("");
      fetchGroup();
    }
    setTimeout(() => setMsg(null), 3000);
  }

  async function removeMember(email: string) {
    await fetch(`/api/groups/${groupId}/members`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails: [email] }),
    });
    fetchGroup();
  }

  async function sendToGroup() {
    if (!sendSchool) { setMsg({ text: "Okul seçin", ok: false }); return; }
    setSending(true);
    const res = await fetch(`/api/groups/${groupId}/send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: sendSchool }),
    });
    const d = await res.json();
    setMsg({ text: d.success ? `${d.totalSent} kişiye gönderildi` : d.error || "Hata", ok: d.success });
    setSending(false);
    setTimeout(() => setMsg(null), 3000);
  }

  if (loading) return <div className="flex items-center justify-center py-32 text-gray-500">Yükleniyor...</div>;
  if (!group) return <div className="flex items-center justify-center py-32 text-gray-500">Grup bulunamadı</div>;

  const filtered = search ? group.members.filter(m => m.includes(search.toLowerCase())) : group.members;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/groups" className="text-gray-500 hover:text-gray-300">← Gruplar</Link>
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: group.color || "#3b82f6" }}>
          {group.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold">{group.name}</h1>
          {group.description && <p className="text-sm text-gray-500">{group.description}</p>}
          <p className="text-xs text-gray-500">{group.members.length} üye</p>
        </div>
      </div>

      {msg && <div className={`p-3 rounded-lg mb-4 text-sm ${msg.ok ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>{msg.text}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Members */}
        <div className="lg:col-span-2 space-y-4">
          {/* Add Members */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-2">Üye Ekle</h2>
            <textarea value={emailInput} onChange={e => setEmailInput(e.target.value)}
              placeholder="Email adresleri (virgül, noktalı virgül veya yeni satır ile ayırın)"
              rows={3} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none resize-y mb-2" />
            <button onClick={addMembers} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">Ekle</button>
          </div>

          {/* Member List */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <span className="text-sm font-semibold">Üyeler ({group.members.length})</span>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrele..."
                className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs w-40 focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="p-4 text-center text-gray-500 text-sm">Üye yok</p>
              ) : (
                filtered.map(email => (
                  <div key={email} className="flex items-center justify-between px-4 py-2 border-b border-gray-800/50 hover:bg-gray-800/30">
                    <span className="text-sm text-gray-300">{email}</span>
                    <button onClick={() => removeMember(email)} className="text-gray-600 hover:text-red-400 p-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Send */}
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3">Gruba Gönder</h2>
            <label className="text-xs text-gray-500 block mb-1">Gönderen Okul (Auth)</label>
            <select value={sendSchool} onChange={e => setSendSchool(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm mb-3">
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={sendToGroup} disabled={sending || !group.members.length}
              className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium">
              {sending ? "Gönderiliyor..." : `${group.members.length} Kişiye Gönder`}
            </button>
            <p className="text-xs text-gray-600 mt-2">Okulun aktif template&apos;i kullanılır</p>
          </div>
        </div>
      </div>
    </div>
  );
}
