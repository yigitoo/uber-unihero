"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Contact, ContactCategory, ContactFilter } from "@/lib/types";

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

  const fetchContacts = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("category", filter);
    if (search) params.set("q", search);
    const res = await fetch(`/api/contacts?${params}`);
    if (res.ok) setContacts(await res.json());
    setLoading(false);
  }, [filter, search]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  async function handleSave() {
    if (!form.name || !form.email) { setMsg({ text: "Ad ve email gerekli", ok: false }); return; }
    setSaving(true);
    const url = editId ? `/api/contacts/${editId}` : "/api/contacts";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) {
      setMsg({ text: editId ? "Güncellendi" : "Eklendi", ok: true });
      setForm({ name: "", email: "", category: "individual", company: "" });
      setShowAdd(false);
      setEditId(null);
      fetchContacts();
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
    fetchContacts();
  }

  function startEdit(c: Contact) {
    setForm({ name: c.name, email: c.email, category: c.category, company: c.company || "" });
    setEditId(c._id);
    setShowAdd(true);
  }

  async function handleCSVImport(file: File) {
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    const header = lines[0].toLowerCase();
    const hasHeader = header.includes("email") || header.includes("mail");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const contacts = dataLines.map(line => {
      const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      if (cols.length >= 2) return { name: cols[0], email: cols[1], category: "individual" };
      return { name: cols[0].split("@")[0], email: cols[0], category: "individual" };
    }).filter(c => c.email.includes("@"));

    const res = await fetch("/api/contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts }),
    });
    const d = await res.json();
    setMsg({ text: `${d.imported} eklendi, ${d.skipped} atlandı`, ok: true });
    setShowImport(false);
    fetchContacts();
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Kişiler</h1>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-xs px-3 py-1 rounded-full ${msg.ok ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>{msg.text}</span>}
          <button onClick={() => setShowImport(true)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300">CSV İçe Aktar</button>
          <button onClick={() => { setShowAdd(true); setEditId(null); setForm({ name: "", email: "", category: "individual", company: "" }); }}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">Kişi Ekle</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex bg-gray-900 rounded-lg p-1 gap-1">
          {([["all", "Tümü"], ["individual", "Bireysel"], ["corporate", "Kurumsal"]] as [ContactFilter, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === key ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"}`}>
              {label}
            </button>
          ))}
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..."
          className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
      </div>

      {/* Add/Edit Form */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4 space-y-3">
          <h2 className="text-sm font-semibold mb-2">{editId ? "Kişiyi Düzenle" : "Yeni Kişi"}</h2>
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
              {saving ? "Kaydediliyor..." : editId ? "Güncelle" : "Ekle"}
            </button>
            <button onClick={() => { setShowAdd(false); setEditId(null); }} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400">İptal</button>
          </div>
        </div>
      )}

      {/* CSV Import */}
      {showImport && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold mb-3">CSV İçe Aktar</h2>
          <p className="text-xs text-gray-500 mb-3">CSV formatı: Ad,Email (veya sadece Email). İlk satır başlık olabilir.</p>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={e => { const f = e.target.files?.[0]; if (f) handleCSVImport(f); }}
            className="text-sm text-gray-400" />
          <button onClick={() => setShowImport(false)} className="ml-3 text-sm text-gray-500 hover:text-gray-300">İptal</button>
        </div>
      )}

      {/* Contact List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-gray-500">Yükleniyor...</p>
        ) : contacts.length === 0 ? (
          <p className="p-6 text-center text-gray-500">Henüz kişi yok</p>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
                <tr className="text-xs text-gray-500 text-left">
                  <th className="px-4 py-3 font-medium">Ad</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Tür</th>
                  <th className="px-4 py-3 font-medium">Şirket</th>
                  <th className="px-4 py-3 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c._id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-sm">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{c.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.category === "corporate" ? "bg-purple-900/30 text-purple-400" : "bg-blue-900/30 text-blue-400"}`}>
                        {c.category === "corporate" ? "Kurumsal" : "Bireysel"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.company || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(c)} className="p-1 text-gray-500 hover:text-blue-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(c._id)} className="p-1 text-gray-500 hover:text-red-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
      <p className="text-xs text-gray-600 mt-2">{contacts.length} kişi</p>
    </div>
  );
}
