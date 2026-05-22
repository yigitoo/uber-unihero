"use client";

import { useState, useEffect } from "react";
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

export default function OverviewDashboard() {
  const [schools, setSchools] = useState<SchoolStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/schools")
      .then((res) => {
        if (!res.ok) throw new Error("Fetch failed");
        return res.json();
      })
      .then((data) => setSchools(data))
      .catch(() => setError("Okullar yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  const totalContacts = schools.reduce((s, sc) => s + sc.contactCount, 0);
  const totalBatches = schools.reduce((s, sc) => s + sc.totalBatches, 0);
  const totalSent = schools.reduce((s, sc) => s + sc.sentCount, 0);
  const totalPending = totalBatches - totalSent;
  const schoolCount = schools.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-500">
        Yükleniyor...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-4 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <h1 className="text-2xl font-bold mb-6">Genel Bakış</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Toplam Kişi"
          value={totalContacts.toLocaleString("tr-TR")}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          color="text-blue-400"
        />
        <StatCard
          label="Gönderilen Batch"
          value={`${totalSent} / ${totalBatches}`}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
            </svg>
          }
          color="text-green-400"
        />
        <StatCard
          label="Bekleyen"
          value={totalPending.toLocaleString("tr-TR")}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="text-yellow-400"
        />
        <StatCard
          label="Okullar"
          value={String(schoolCount)}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422A12.083 12.083 0 0121 12.75c0 3.314-4.03 6-9 6s-9-2.686-9-6c0-.84.28-1.636.78-2.34L12 14z" />
            </svg>
          }
          color="text-purple-400"
        />
      </div>

      {/* Per-school Breakdown */}
      {schools.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          Henüz okul eklenmemiş. Sidebar&apos;dan &quot;Okul Ekle&quot; ile başlayabilirsiniz.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schools.map((school) => {
            const pct =
              school.totalBatches > 0
                ? Math.round((school.sentCount / school.totalBatches) * 100)
                : 0;

            return (
              <div
                key={school.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors"
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-semibold text-lg leading-tight">
                      {school.name}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {school.domain}
                    </p>
                  </div>
                  {school.authEmail ? (
                    <span className="text-xs bg-green-900/50 text-green-400 border border-green-800 px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                      Yetkili
                    </span>
                  ) : (
                    <span className="text-xs bg-yellow-900/50 text-yellow-400 border border-yellow-800 px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                      Auth Yok
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                  <span>{school.contactCount.toLocaleString("tr-TR")} kişi</span>
                  <span>
                    {school.sentCount}/{school.totalBatches} batch
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>İlerleme</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Link */}
                <Link
                  href={`/dashboard/${school.id}`}
                  className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Yönet
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
          {label}
        </span>
        <span className={color}>{icon}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
