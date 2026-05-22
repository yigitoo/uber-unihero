"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Contact, ContactCategory, ContactFilter } from "@/lib/types";

interface SchoolOption { id: string; name: string; }
interface TemplateOption { _id: string; name: string; subject: string; }

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ContactFilter>("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", category: "individual" as ContactCategory, company: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Send panel
  const [showSend, setShowSend] = useState(false);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [sendSchool, setSendSchool] = useState("");
  const [sendTemplate, setSendTemplate] = useState("");
  const [sending, setSending] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total: 0, individual: 0, corporate: 0 });

  const fetchContacts = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("category", filter);
    if (search) params.set("q", search);
    const res = await fetch(`/api/contacts?${params}`);
    if (res.ok) {
      const data = await res.json();
      setContacts(data);
    }
    setLoading(false);
  }, [filter, search]);

  const fetchStats = useCallback(async () => {
    const [allRes, indRes, corpRes] = await Promise.all([
      fetch("/api/contacts").then(r => r.json()),
      fetch("/api/contacts?category=individual").then(r => r.json()),
      fetch("/api/contacts?category=corporate").then(r => r.json()),
    ]);
    setStats({ total: allRes.length, individual: indRes.length, corporate: corpRes.length });
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);
  useEffect(() => {
    fetchStats();
    fetch("/api/schools").then(r => r.ok ? r.json() : []).then((s: SchoolOption[]) => { setSchools(s); if (s.length) setSendSchool(s[0].id); });
    fetch("/api/templates").then(r => r.ok ? r.json() : []).then(setTemplates);
  }, [fetchStats]);

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
    setSelectAll(next.size === contacts.length);
  }

  function toggleSelectAll() {
    if (selectAll) {
      setSelected(new Set());
      setSelectAll(false);
    } else {
      setSelected(new Set(contacts.map(c => c._id)));
      setSelectAll(true);
    }
  }

  async function handleSave() {
    if (!form.name || !form.email) { setMsg({ text: "Ad ve email gerekli", ok: false }); return; }
    setSaving(true);
    const url = editId ? `/api/contacts/${editId}` : "/api/contacts";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) {
      setMsg({ text: editId ? "Güncellendi" : "Eklendi", ok: true });
      setForm({ name: "", email: "", category: "individual", company: "" });
      setShowAdd(false); setEditId(null);
      fetchContacts(); fetchStats();
    } else {
      const d = await res.json();
      setMsg({ text: d.error || "Hata", ok: false });
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu kişiyi silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    fetchContacts(); fetchStats();
  }

  async function handleBulkDelete() {
    if (!confirm(`${selected.size} kişiyi silmek istediğinize emin misiniz?`)) return;
    await Promise.all(Array.from(selected).map(id => fetch(`/api/contacts/${id}`, { method: "DELETE" })));
    setSelected(new Set()); setSelectAll(false);
    fetchContacts(); fetchStats();
    setMsg({ text: `${selected.size} kişi silindi`, ok: true });
    setTimeout(() => setMsg(null), 3000);
  }

  function startEdit(c: Contact) {
    setForm({ name: c.name, email: c.email, category: c.category, company: c.company || "" });
    setEditId(c._id); setShowAdd(true);
  }

  async function handleCSVImport(file: File) {
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    const header = lines[0].toLowerCase();
    const hasHeader = header.includes("email") || header.includes("mail");
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const importContacts = dataLines.map(line => {
      const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      if (cols.length >= 2) return { name: cols[0], email: cols[1], category: "individual" };
      return { name: cols[0].split("@")[0], email: cols[0], category: "individual" };
    }).filter(c => c.email.includes("@"));
    const res = await fetch("/api/contacts/import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts: importContacts }),
    });
    const d = await res.json();
    setMsg({ text: `${d.imported} eklendi, ${d.skipped} atlandı`, ok: true });
    setShowImport(false); fetchContacts(); fetchStats();
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleBulkSend() {
    if (!sendSchool) { setMsg({ text: "Okul seçin", ok: false }); return; }
    setSending(true);

    const body: Record<string, unknown> = { schoolId: sendSchool };
    if (sendTemplate) body.templateId = sendTemplate;

    if (selected.size > 0 && selected.size < contacts.length) {
      body.contactIds = Array.from(selected);
    } else {
      body.filters = {};
      if (filter !== "all") (body.filters as Record<string, string>).category = filter;
      if (search) (body.filters as Record<string, string>).search = search;
    }

    const res = await fetch("/api/contacts/send", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json();
    setMsg({ text: d.success ? `${d.totalSent} kişiye gönderildi (${d.duration}ms)` : d.error || "Hata", ok: d.success });
    setSending(false); setShowSend(false);
    setTimeout(() => setMsg(null), 5000);
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Kişiler</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {msg && <span className={`text-xs px-3 py-1 rounded-full ${msg.ok ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>{msg.text}</span>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <div className="text-xl font-bold">{stats.total.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Toplam</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-blue-400">{stats.individual.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Bireysel</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-purple-400">{stats.corporate.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Kurumsal</div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex bg-gray-900 rounded-lg p-1 gap-1">
          {([["all", "Tümü"], ["individual", "Bireysel"], ["corporate", "Kurumsal"]] as [ContactFilter, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === key ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"}`}>
              {label}
            </button>
          ))}
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..."
          className="flex-1 min-w-[120px] px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
        <button onClick={() => setShowImport(true)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300">CSV</button>
        <button onClick={() => { setShowAdd(true); setEditId(null); setForm({ name: "", email: "", category: "individual", company: "" }); }}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium">+ Ekle</button>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-blue-900/20 border border-blue-800/50 rounded-lg px-4 py-2">
          <span className="text-sm text-blue-400 font-medium">{selected.size} seçili</span>
          <button onClick={() => { setShowSend(true); }} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-medium">Mail Gönder</button>
          <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-medium">Sil</button>
          <button onClick={() => { setSelected(new Set()); setSelectAll(false); }} className="text-xs text-gray-500 hover:text-gray-300 ml-auto">Seçimi Kaldır</button>
        </div>
      )}

      {/* Send Panel */}
      {showSend && (
        <div className="bg-gray-900 border border-green-800/50 rounded-xl p-5 mb-4 space-y-3">
          <h2 className="text-sm font-semibold text-green-400">{selected.size} Kişiye Mail Gönder</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Gönderen Okul</label>
              <select value={sendSchool} onChange={e => setSendSchool(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Şablon</label>
              <select value={sendTemplate} onChange={e => setSendTemplate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
                <option value="">Şablon seçin...</option>
                {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleBulkSend} disabled={sending || !sendTemplate}
              className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 rounded-lg text-sm font-medium">
              {sending ? "Gönderiliyor..." : "Gönder"}
            </button>
            <button onClick={() => setShowSend(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400">İptal</button>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4 space-y-3">
          <h2 className="text-sm font-semibold">{editId ? "Kişiyi Düzenle" : "Yeni Kişi"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ad Soyad"
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email"
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as ContactCategory })}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
              <option value="individual">Bireysel</option>
              <option value="corporate">Kurumsal</option>
            </select>
            <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Şirket (opsiyonel)"
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? "..." : editId ? "Güncelle" : "Ekle"}
            </button>
            <button onClick={() => { setShowAdd(false); setEditId(null); }} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400">İptal</button>
          </div>
        </div>
      )}

      {/* CSV Import */}
      {showImport && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold mb-3">CSV İçe Aktar</h2>
          <p className="text-xs text-gray-500 mb-3">Format: Ad,Email veya sadece Email</p>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={e => { const f = e.target.files?.[0]; if (f) handleCSVImport(f); }}
            className="text-sm text-gray-400" />
          <button onClick={() => setShowImport(false)} className="ml-3 text-sm text-gray-500 hover:text-gray-300">İptal</button>
        </div>
      )}

      {/* Contact Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-gray-500">Yükleniyor...</p>
        ) : contacts.length === 0 ? (
          <p className="p-6 text-center text-gray-500">Kişi bulunamadı</p>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-900 border-b border-gray-800 z-10">
                <tr className="text-xs text-gray-500 text-left">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={selectAll} onChange={toggleSelectAll}
                      className="rounded border-gray-600 accent-blue-500" />
                  </th>
                  <th className="px-4 py-3 font-medium">Ad</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Tür</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Şirket</th>
                  <th className="px-4 py-3 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c._id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${selected.has(c._id) ? "bg-blue-900/10" : ""}`}>
                    <td className="px-4 py-2.5">
                      <input type="checkbox" checked={selected.has(c._id)} onChange={() => toggleSelect(c._id)}
                        className="rounded border-gray-600 accent-blue-500" />
                    </td>
                    <td className="px-4 py-2.5 text-sm">{c.name}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-400 truncate max-w-[200px]">{c.email}</td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.category === "corporate" ? "bg-purple-900/30 text-purple-400" : "bg-blue-900/30 text-blue-400"}`}>
                        {c.category === "corporate" ? "Kurumsal" : "Bireysel"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 hidden md:table-cell">{c.company || "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(c)} className="p-1 text-gray-500 hover:text-blue-400">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(c._id)} className="p-1 text-gray-500 hover:text-red-400">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-600 mt-2">{contacts.length} kişi gösteriliyor</p>
    </div>
  );
}
