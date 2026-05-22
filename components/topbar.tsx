"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";

interface TopbarProps {
  onMenuToggle: () => void;
}

const titleMap: Record<string, string> = {
  "/dashboard": "Genel Bakış",
  "/dashboard/schools": "Okul Yönetimi",
  "/dashboard/templates": "Şablonlar",
  "/dashboard/analytics": "Analytics",
  "/dashboard/settings": "Ayarlar",
  "/dashboard/contacts": "Kişiler",
  "/dashboard/groups": "Gruplar",
};

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  function getTitle() {
    if (titleMap[pathname]) return titleMap[pathname];
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length >= 2 && segments[0] === "dashboard") {
      const schoolId = segments[1];
      const sub = segments[2];
      if (sub) {
        const subTitles: Record<string, string> = {
          scrape: "Veri Toplama",
          send: "Mail Gönder",
          batches: "Batch Listesi",
        };
        return `${schoolId} / ${subTitles[sub] || sub}`;
      }
      return schoolId;
    }
    return "Dashboard";
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-14 px-4 bg-gray-900 border-b border-gray-800">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          aria-label="Menü"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-sm font-semibold text-gray-200 truncate">{getTitle()}</h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          aria-label="Tema değiştir"
        >
          {theme === "dark" ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-xs text-gray-400">Online</span>
        <button onClick={handleLogout} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors" title="Çıkış Yap">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
