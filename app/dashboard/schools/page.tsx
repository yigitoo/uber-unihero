"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface SchoolStats {
  id: string;
  name: string;
  domain: string;
  totalBatches: number;
  contactCount: number;
  sentCount: number;
  authEmail: string | null;
}

export default function SchoolManagementPage() {
  const [schools, setSchools] = useState<SchoolStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newProvider, setNewProvider] = useState<"outlook" | "google">("outlook");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function fetchSchools() {
    try {
      const res = await fetch("/api/schools");
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setSchools(data);
    } catch {
      setError("Okullar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSchools();
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newDomain.trim()) return;

    setCreating(true);
    setError("");

    try {
      abortRef.current = new AbortController();
      const res = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), domain: newDomain.trim(), provider: newProvider }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Okul oluşturulamadı");
      }

      setNewName("");
      setNewDomain("");
      setShowForm(false);
      setLoading(true);
      await fetchSchools();
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu okulu silmek istediğinizden emin misiniz?")) return;

    setDeleting(id);
    setError("");

    try {
      const res = await fetch(`/api/schools/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silme başarısız");
      setSchools((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("Okul silinemedi");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Okul Yönetimi</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors text-sm"
        >
          + Yeni Okul
        </button>
      </div>

      {/* Inline Add Form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6"
        >
          <h2 className="text-sm font-semibold mb-4 text-gray-300">
            Yeni Okul Ekle
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs text-gray-400 mb-1">
                Okul Adı
              </label>
              <input
                type="text"
                placeholder="Yıldız Teknik Üniversitesi"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-2.5 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
                autoFocus
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs text-gray-400 mb-1">
                Email Domain
              </label>
              <input
                type="text"
                placeholder="std.yildiz.edu.tr"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="w-full p-2.5 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-xs text-gray-400 mb-1">Sağlayıcı</label>
              <select value={newProvider} onChange={e => setNewProvider(e.target.value as "outlook" | "google")}
                className="w-full p-2.5 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none text-sm">
                <option value="outlook">Outlook (Microsoft)</option>
                <option value="google">Google Workspace</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 rounded-lg font-medium transition-colors text-sm whitespace-nowrap"
              >
                {creating ? "Ekleniyor..." : "Ekle"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400 transition-colors"
              >
                İptal
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center text-gray-500 py-20">Yükleniyor...</div>
      )}

      {/* Desktop Table */}
      {!loading && schools.length > 0 && (
        <div className="hidden md:block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="px-5 py-3 font-medium">Ad</th>
                <th className="px-5 py-3 font-medium">Domain</th>
                <th className="px-5 py-3 font-medium">Kişi</th>
                <th className="px-5 py-3 font-medium">Batch</th>
                <th className="px-5 py-3 font-medium">Auth</th>
                <th className="px-5 py-3 font-medium text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr
                  key={school.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-5 py-3 font-medium">
                    <Link
                      href={`/dashboard/${school.id}`}
                      className="hover:text-blue-400 transition-colors"
                    >
                      {school.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-gray-400">{school.domain}</td>
                  <td className="px-5 py-3 text-gray-400">
                    {school.contactCount.toLocaleString("tr-TR")}
                  </td>
                  <td className="px-5 py-3 text-gray-400">
                    {school.sentCount}/{school.totalBatches}
                  </td>
                  <td className="px-5 py-3">
                    {school.authEmail ? (
                      <span className="text-xs bg-green-900/50 text-green-400 border border-green-800 px-2 py-0.5 rounded-full">
                        Yetkili
                      </span>
                    ) : (
                      <span className="text-xs bg-yellow-900/50 text-yellow-400 border border-yellow-800 px-2 py-0.5 rounded-full">
                        Auth Yok
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/dashboard/${school.id}`}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                      >
                        Yönet
                      </Link>
                      <button
                        onClick={() => handleDelete(school.id)}
                        disabled={deleting === school.id}
                        className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {deleting === school.id ? "..." : "Sil"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Card Layout */}
      {!loading && schools.length > 0 && (
        <div className="md:hidden space-y-3">
          {schools.map((school) => (
            <div
              key={school.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <Link
                    href={`/dashboard/${school.id}`}
                    className="font-semibold hover:text-blue-400 transition-colors"
                  >
                    {school.name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {school.domain}
                  </p>
                </div>
                {school.authEmail ? (
                  <span className="text-xs bg-green-900/50 text-green-400 border border-green-800 px-2 py-0.5 rounded-full">
                    Yetkili
                  </span>
                ) : (
                  <span className="text-xs bg-yellow-900/50 text-yellow-400 border border-yellow-800 px-2 py-0.5 rounded-full">
                    Auth Yok
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                <span>{school.contactCount.toLocaleString("tr-TR")} kişi</span>
                <span>
                  {school.sentCount}/{school.totalBatches} batch
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/${school.id}`}
                  className="flex-1 text-center px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                >
                  Yönet
                </Link>
                <button
                  onClick={() => handleDelete(school.id)}
                  disabled={deleting === school.id}
                  className="px-3 py-2 bg-red-900/50 hover:bg-red-800/50 text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {deleting === school.id ? "..." : "Sil"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && schools.length === 0 && (
        <div className="text-center text-gray-500 py-20">
          Henüz okul eklenmemiş. &quot;+ Yeni Okul&quot; ile başlayabilirsiniz.
        </div>
      )}
    </div>
  );
}
