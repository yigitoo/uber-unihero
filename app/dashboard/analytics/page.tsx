"use client";

import { useState, useEffect, useCallback } from "react";

interface SchoolInfo {
  id: string;
  name: string;
  domain: string;
}

interface BatchStats {
  totalBatches: number;
  contactCount: number;
  totalSent: number;
  todaySent: number;
  dailyLimit: number;
}

interface SchoolAnalytics {
  school: SchoolInfo;
  stats: BatchStats;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<SchoolAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const schoolsRes = await fetch("/api/schools");
      if (!schoolsRes.ok) throw new Error("Fetch failed");
      const schools: SchoolInfo[] = await schoolsRes.json();

      const results = await Promise.all(
        schools.map(async (school) => {
          try {
            const bRes = await fetch(`/api/schools/${school.id}/batches`);
            if (bRes.ok) {
              const stats: BatchStats = await bRes.json();
              return { school, stats };
            }
            return {
              school,
              stats: {
                totalBatches: 0,
                contactCount: 0,
                totalSent: 0,
                todaySent: 0,
                dailyLimit: 9000,
              },
            };
          } catch {
            return {
              school,
              stats: {
                totalBatches: 0,
                contactCount: 0,
                totalSent: 0,
                todaySent: 0,
                dailyLimit: 9000,
              },
            };
          }
        })
      );

      setData(results);
    } catch {
      setError("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Overall totals
  const overallContacts = data.reduce((s, d) => s + d.stats.contactCount, 0);
  const overallBatches = data.reduce((s, d) => s + d.stats.totalBatches, 0);
  const overallSent = data.reduce((s, d) => s + d.stats.totalSent, 0);
  const overallTodaySent = data.reduce((s, d) => s + d.stats.todaySent, 0);
  const overallPct = overallBatches > 0 ? (overallSent / overallBatches) * 100 : 0;
  const overallRemaining = overallBatches - overallSent;
  const overallEstHours = overallRemaining * 2;

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
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {data.length === 0 && (
        <div className="text-center text-gray-500 py-20">
          Henüz okul eklenmemiş.
        </div>
      )}

      {/* Per-school Stats */}
      {data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {data.map(({ school, stats }) => {
            const pct =
              stats.totalBatches > 0
                ? (stats.totalSent / stats.totalBatches) * 100
                : 0;
            const remaining = stats.totalBatches - stats.totalSent;
            const estHours = remaining * 2;

            return (
              <div
                key={school.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col items-center"
              >
                {/* Circular Progress Ring */}
                <div className="relative w-28 h-28 mb-4">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                    {/* Background circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="#1f2937"
                      strokeWidth="8"
                    />
                    {/* Progress circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke={pct >= 75 ? "#22c55e" : pct >= 40 ? "#eab308" : "#3b82f6"}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold">{Math.round(pct)}%</span>
                  </div>
                </div>

                <h3 className="font-semibold text-center mb-1">{school.name}</h3>
                <p className="text-xs text-gray-500 mb-3">{school.domain}</p>

                <div className="w-full space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Toplam Kişi</span>
                    <span>{stats.contactCount.toLocaleString("tr-TR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Gönderilen</span>
                    <span>
                      {stats.totalSent}/{stats.totalBatches} batch
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Bugün</span>
                    <span>{stats.todaySent.toLocaleString("tr-TR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tahmini Süre</span>
                    <span className="text-gray-300">
                      {remaining > 0 ? `~${estHours} saat` : "Tamamlandı"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Overall Totals */}
      {data.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
          <h2 className="font-semibold mb-4">Genel Toplam</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-xs text-gray-500 block">Toplam Kişi</span>
              <span className="text-lg font-bold">
                {overallContacts.toLocaleString("tr-TR")}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">
                Gönderilen Batch
              </span>
              <span className="text-lg font-bold">
                {overallSent}/{overallBatches}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Bugün</span>
              <span className="text-lg font-bold">
                {overallTodaySent.toLocaleString("tr-TR")}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">İlerleme</span>
              <span className="text-lg font-bold">
                {overallPct.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Tahmini Süre</span>
              <span className="text-lg font-bold">
                {overallRemaining > 0
                  ? `~${overallEstHours} saat`
                  : "Tamamlandı"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bar Chart */}
      {data.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4">Okul Bazlı Karşılaştırma</h2>
          <div className="space-y-4">
            {data.map(({ school, stats }) => {
              const pct =
                stats.totalBatches > 0
                  ? (stats.totalSent / stats.totalBatches) * 100
                  : 0;
              const barColor =
                pct >= 75
                  ? "bg-green-500"
                  : pct >= 40
                  ? "bg-yellow-500"
                  : "bg-blue-500";

              return (
                <div key={school.id}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-gray-300 truncate mr-3">
                      {school.name}
                    </span>
                    <span className="text-gray-500 text-xs whitespace-nowrap">
                      {stats.totalSent}/{stats.totalBatches} ({Math.round(pct)}
                      %)
                    </span>
                  </div>
                  <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
