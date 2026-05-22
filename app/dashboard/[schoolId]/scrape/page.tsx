"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface ScrapeStatus {
  status: string;
  found: number;
  query?: string;
  progress?: number;
  total?: number;
  done?: boolean;
  totalBatches?: number;
  resultCount?: number;
  newCount?: number;
  phase?: number;
}

interface SchoolInfo {
  name: string;
}

export default function ScrapePage() {
  const params = useParams();
  const router = useRouter();
  const schoolId = params.schoolId as string;

  const [schoolName, setSchoolName] = useState("");
  const [scrapeState, setScrapeState] = useState<ScrapeStatus>({
    status: "idle",
    found: 0,
  });
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");
  const [currentQuery, setCurrentQuery] = useState("");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(1);
  const stopRef = useRef<boolean>(false);

  const fetchInitialState = useCallback(async () => {
    try {
      const [schoolRes, scrapeRes] = await Promise.all([
        fetch(`/api/schools/${schoolId}`),
        fetch(`/api/schools/${schoolId}/scrape`),
      ]);

      if (schoolRes.ok) {
        const data: SchoolInfo = await schoolRes.json();
        setSchoolName(data.name);
      }

      if (scrapeRes.ok) {
        const data = await scrapeRes.json();
        setScrapeState(data);
        if (data.status === "done") {
          setDoneMessage(`${data.found} kişi bulundu`);
        }
      }
    } catch {
      setError("Durum yüklenemedi");
    }
  }, [schoolId]);

  useEffect(() => {
    fetchInitialState();
    return () => {
      stopRef.current = true;
    };
  }, [fetchInitialState]);

  async function startScrape() {
    setScraping(true);
    setError("");
    setDoneMessage("");
    setCurrentQuery("");
    setProgress(0);
    setPhase(1);
    stopRef.current = false;

    try {
      // Start
      const startRes = await fetch(`/api/schools/${schoolId}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });

      if (!startRes.ok) {
        throw new Error("Scrape başlatma hatası");
      }

      const startData = await startRes.json();
      setScrapeState(startData);

      // Step loop
      while (!stopRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 200));

        if (stopRef.current) break;

        const stepRes = await fetch(`/api/schools/${schoolId}/scrape`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "step" }),
        });

        if (!stepRes.ok) {
          throw new Error("Step hatası");
        }

        const stepData: ScrapeStatus = await stepRes.json();

        setScrapeState(stepData);

        if (stepData.query) {
          setCurrentQuery(stepData.query);
        }
        if (typeof stepData.progress === "number") {
          setProgress(stepData.progress);
        }
        if (typeof stepData.phase === "number") {
          setPhase(stepData.phase);
        }

        if (stepData.done) {
          setDoneMessage(
            `${stepData.found} kişi bulundu, ${stepData.totalBatches ?? 0} batch oluşturuldu`
          );
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape hatası");
    } finally {
      setScraping(false);
    }
  }

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      {/* Top */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push(`/dashboard/${schoolId}`)}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          &larr; Geri
        </button>
        <h1 className="text-2xl font-bold">
          {schoolName || "..."} &mdash; Directory Scrape
        </h1>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Scrape Controls */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <button
          onClick={startScrape}
          disabled={scraping}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-colors"
        >
          {scraping ? "Scrape devam ediyor..." : "Directory Scrape Başlat"}
        </button>
      </div>

      {/* Live Status */}
      {(scraping || scrapeState.status === "running") && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 space-y-4">
          {/* Phase */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Phase {phase}</span>
            <span className="text-sm text-gray-400">{progress}%</span>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Current Query */}
          {currentQuery && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Aranıyor:</span>
              <span className="text-sm font-mono bg-gray-800 px-2 py-0.5 rounded">
                {currentQuery}
              </span>
            </div>
          )}

          {/* Found Count */}
          <div className="text-center">
            <span className="text-3xl font-bold text-blue-400">
              {scrapeState.found?.toLocaleString() ?? 0}
            </span>
            <span className="text-sm text-gray-500 ml-2">kişi bulundu</span>
          </div>
        </div>
      )}

      {/* Done Message */}
      {doneMessage && !scraping && (
        <div className="bg-green-900/30 border border-green-800 text-green-300 rounded-xl p-5 text-center">
          <div className="text-lg font-semibold mb-1">Tamamlandı</div>
          <div className="text-sm">{doneMessage}</div>
        </div>
      )}

      {/* Idle state info */}
      {!scraping && scrapeState.status === "idle" && !doneMessage && (
        <div className="text-center text-gray-600 py-10 text-sm">
          Scrape başlatmak için yukarıdaki butona tıklayın.
          <br />
          Microsoft People Directory API üzerinden öğrenci emailleri taranacaktır.
        </div>
      )}
    </div>
  );
}
