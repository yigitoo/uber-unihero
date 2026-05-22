"use client";

import { useState, useEffect, useCallback } from "react";
import RichTextEditor from "@/components/rich-text-editor";

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

interface SchoolInfo {
  id: string;
  name: string;
  domain: string;
}

interface TemplateData {
  subject: string;
  body: string;
}

interface SchoolTemplate {
  school: SchoolInfo;
  template: TemplateData | null;
}

export default function TemplatesPage() {
  const [schoolTemplates, setSchoolTemplates] = useState<SchoolTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const schoolsRes = await fetch("/api/schools");
      if (!schoolsRes.ok) throw new Error("Okullar yüklenemedi");
      const schools: SchoolInfo[] = await schoolsRes.json();

      const results = await Promise.all(
        schools.map(async (school) => {
          try {
            const tRes = await fetch(`/api/schools/${school.id}/template`);
            if (tRes.ok) {
              const template: TemplateData = await tRes.json();
              return { school, template };
            }
            return { school, template: null };
          } catch {
            return { school, template: null };
          }
        })
      );

      setSchoolTemplates(results);
    } catch {
      setError("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function startEdit(st: SchoolTemplate) {
    setEditingId(st.school.id);
    setEditSubject(st.template?.subject || "");
    setEditBody(st.template?.body || "");
    setSaveMsg(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditSubject("");
    setEditBody("");
  }

  function loadUberTemplate() {
    setEditSubject("Uber %80 İndirim / 80% Off — Kod: UBERUNIHERO8");
    setEditBody(UBER_TEMPLATE);
  }

  async function handleSave(schoolId: string) {
    if (!editSubject.trim() || !editBody.trim()) {
      setSaveMsg({ id: schoolId, text: "Konu ve içerik gerekli", ok: false });
      return;
    }

    setSaving(true);
    setSaveMsg(null);

    try {
      const res = await fetch(`/api/schools/${schoolId}/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: editSubject, body: editBody }),
      });

      if (!res.ok) throw new Error("Kaydetme başarısız");

      setSaveMsg({ id: schoolId, text: "Kaydedildi", ok: true });

      // Update local state
      setSchoolTemplates((prev) =>
        prev.map((st) =>
          st.school.id === schoolId
            ? { ...st, template: { subject: editSubject, body: editBody } }
            : st
        )
      );

      setTimeout(() => {
        setEditingId(null);
        setSaveMsg(null);
      }, 1500);
    } catch {
      setSaveMsg({ id: schoolId, text: "Kaydetme hatası", ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-500">
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <h1 className="text-2xl font-bold mb-6">Şablonlar</h1>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {schoolTemplates.length === 0 && (
        <div className="text-center text-gray-500 py-20">
          Henüz okul eklenmemiş.
        </div>
      )}

      <div className="space-y-4">
        {schoolTemplates.map((st) => {
          const isEditing = editingId === st.school.id;

          return (
            <div
              key={st.school.id}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                <div>
                  <h2 className="font-semibold">{st.school.name}</h2>
                  <p className="text-xs text-gray-500">{st.school.domain}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(st)}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                    >
                      Düzenle
                    </button>
                  )}
                </div>
              </div>

              {/* View mode */}
              {!isEditing && (
                <div className="px-5 py-4">
                  {st.template ? (
                    <div>
                      <div className="mb-3">
                        <span className="text-xs text-gray-500">Konu: </span>
                        <span className="text-sm text-gray-300">
                          {st.template.subject}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block mb-2">
                          Önizleme:
                        </span>
                        <div
                          className="bg-white rounded-lg p-2 max-h-48 overflow-y-auto"
                          dangerouslySetInnerHTML={{ __html: st.template.body }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Bu okul için henüz şablon yüklenmemiş.
                    </p>
                  )}
                </div>
              )}

              {/* Edit mode */}
              {isEditing && (
                <div className="px-5 py-4 space-y-4">
                  {/* Quick load button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadUberTemplate}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-medium transition-colors"
                    >
                      Uber Template Yükle
                    </button>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Konu
                    </label>
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      placeholder="Email konusu..."
                      className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      İçerik
                    </label>
                    <RichTextEditor value={editBody} onChange={setEditBody} />
                  </div>

                  {/* Preview */}
                  {editBody && (
                    <div>
                      <span className="text-xs text-gray-500 block mb-2">
                        Önizleme:
                      </span>
                      <div
                        className="bg-white rounded-lg p-2 max-h-60 overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: editBody }}
                      />
                    </div>
                  )}

                  {/* Save message */}
                  {saveMsg && saveMsg.id === st.school.id && (
                    <div
                      className={`p-2 rounded-lg text-xs ${
                        saveMsg.ok
                          ? "bg-green-900/50 text-green-400"
                          : "bg-red-900/50 text-red-400"
                      }`}
                    >
                      {saveMsg.text}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSave(st.school.id)}
                      disabled={saving}
                      className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      {saving ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400 transition-colors"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
