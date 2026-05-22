"use client";

import { useState, useEffect, useCallback } from "react";
import RichTextEditor from "@/components/rich-text-editor";
import type { Template } from "@/lib/types";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", body: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const fetchAll = useCallback(async () => {
    const res = await fetch("/api/templates");
    if (res.ok) setTemplates(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function startNew() {
    setIsNew(true);
    setEditingId("new");
    setForm({ name: "", subject: "", body: "" });
  }

  function startEdit(t: Template) {
    setIsNew(false);
    setEditingId(t._id);
    setForm({ name: t.name, subject: t.subject, body: t.body });
  }

  function cancelEdit() {
    setEditingId(null);
    setIsNew(false);
  }

  async function handleSave() {
    if (!form.name || !form.subject || !form.body) {
      setMsg({ text: "Ad, konu ve içerik gerekli", ok: false });
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    setSaving(true);
    const url = isNew ? "/api/templates" : `/api/templates/${editingId}`;
    const method = isNew ? "POST" : "PUT";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) {
      setMsg({ text: isNew ? "Şablon oluşturuldu" : "Güncellendi", ok: true });
      setEditingId(null);
      setIsNew(false);
      fetchAll();
    } else {
      setMsg({ text: "Kaydetme hatası", ok: false });
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu şablonu silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    fetchAll();
  }

  if (loading) return <div className="flex items-center justify-center py-32 text-gray-500">Yükleniyor...</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Şablonlar</h1>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-xs px-3 py-1 rounded-full ${msg.ok ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>{msg.text}</span>}
          <button onClick={startNew} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">Yeni Şablon</button>
        </div>
      </div>

      {/* Edit/Create Form */}
      {editingId && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4 space-y-4">
          <h2 className="text-sm font-semibold">{isNew ? "Yeni Şablon" : "Şablonu Düzenle"}</h2>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Şablon Adı (ör: Uber Kampanya)"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
          <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Email Konusu"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
          <RichTextEditor value={form.body} onChange={body => setForm({ ...form, body })} />
          {form.body && (
            <div>
              <span className="text-xs text-gray-500 block mb-2">Önizleme:</span>
              <div className="bg-white rounded-lg p-2 max-h-60 overflow-y-auto" dangerouslySetInnerHTML={{ __html: form.body }} />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 rounded-lg text-sm font-medium">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <button onClick={cancelEdit} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400">İptal</button>
          </div>
        </div>
      )}

      {/* Template List */}
      {templates.length === 0 && !editingId ? (
        <div className="text-center text-gray-500 py-20">
          <p>Henüz şablon yok</p>
          <p className="text-xs mt-1">Email göndermek için şablon oluşturun</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t._id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm">{t.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{t.subject}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-xs text-gray-600">{new Date(t.updatedAt).toLocaleDateString("tr-TR")}</span>
                  <button onClick={() => startEdit(t)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300">Düzenle</button>
                  <button onClick={() => handleDelete(t._id)} className="p-1.5 text-gray-600 hover:text-red-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="px-5 pb-4">
                <div className="bg-white rounded-lg p-2 max-h-32 overflow-y-auto" dangerouslySetInnerHTML={{ __html: t.body }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
