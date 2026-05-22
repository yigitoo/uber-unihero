"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SchoolStats {
  id: string;
  name: string;
  contactCount: number;
  sentCount: number;
  totalBatches: number;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [schools, setSchools] = useState<SchoolStats[]>([]);
  const [schoolsExpanded, setSchoolsExpanded] = useState(true);
  const [loadingSchools, setLoadingSchools] = useState(true);

  useEffect(() => {
    fetch("/api/schools")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSchools(data))
      .catch(() => setSchools([]))
      .finally(() => setLoadingSchools(false));
  }, []);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  function linkClasses(href: string) {
    const active = isActive(href);
    return [
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
      active
        ? "bg-gray-800 text-white"
        : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50",
    ].join(" ");
  }

  function progressDot(sentCount: number, totalBatches: number) {
    if (totalBatches === 0) return "bg-gray-600";
    const pct = sentCount / totalBatches;
    if (pct > 0.5) return "bg-green-500";
    if (pct > 0.25) return "bg-yellow-500";
    return "bg-red-500";
  }

  function handleLinkClick() {
    onClose();
  }

  const sidebarContent = (
    <div className="flex flex-col h-full w-64 bg-gray-900 border-r border-gray-800">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-800">
        <span className="text-lg font-bold text-white tracking-tight">
          UniHero
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-600 text-white px-1.5 py-0.5 rounded">
          CRM
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {/* Genel */}
        <Link href="/dashboard" className={linkClasses("/dashboard")} onClick={handleLinkClick}>
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"
            />
          </svg>
          Genel
        </Link>

        {/* Okullar section */}
        <div className="pt-3">
          <button
            onClick={() => setSchoolsExpanded(!schoolsExpanded)}
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
          >
            <span>Okullar</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${
                schoolsExpanded ? "rotate-90" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          {schoolsExpanded && (
            <div className="mt-1 space-y-0.5">
              {loadingSchools && (
                <p className="px-3 py-2 text-xs text-gray-600">
                  Yükleniyor...
                </p>
              )}

              {!loadingSchools &&
                schools.map((school) => (
                  <Link
                    key={school.id}
                    href={`/dashboard/${school.id}`}
                    className={linkClasses(`/dashboard/${school.id}`)}
                    onClick={handleLinkClick}
                  >
                    <svg
                      className="w-4 h-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 14l9-5-9-5-9 5 9 5z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 14l6.16-3.422A12.083 12.083 0 0121 12.75c0 3.314-4.03 6-9 6s-9-2.686-9-6c0-.84.28-1.636.78-2.34L12 14z"
                      />
                    </svg>
                    <span className="flex-1 truncate">{school.name}</span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${progressDot(
                          school.sentCount,
                          school.totalBatches
                        )}`}
                      />
                      {school.sentCount}/{school.totalBatches}
                    </span>
                  </Link>
                ))}

              <Link
                href="/dashboard/schools"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-gray-800/50 transition-colors"
                onClick={handleLinkClick}
              >
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Okul Ekle
              </Link>
            </div>
          )}
        </div>

        {/* Şablonlar */}
        <Link
          href="/dashboard/templates"
          className={linkClasses("/dashboard/templates")}
          onClick={handleLinkClick}
        >
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Şablonlar
        </Link>

        {/* Analytics */}
        <Link
          href="/dashboard/analytics"
          className={linkClasses("/dashboard/analytics")}
          onClick={handleLinkClick}
        >
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Analytics
        </Link>

        {/* Ayarlar */}
        <Link
          href="/dashboard/settings"
          className={linkClasses("/dashboard/settings")}
          onClick={handleLinkClick}
        >
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Ayarlar
        </Link>
      </nav>

      {/* Version */}
      <div className="px-5 py-3 border-t border-gray-800">
        <p className="text-[11px] text-gray-600">v1.0.0</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          {/* Sidebar panel */}
          <aside className="relative z-50 h-full animate-slide-in">{sidebarContent}</aside>
        </div>
      )}
    </>
  );
}
