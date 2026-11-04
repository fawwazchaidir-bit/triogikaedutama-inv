"use client";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_KEY, isTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/cn";

const EVENT = "fms-theme-change";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}
const current = (): Theme => {
  const t = document.documentElement.getAttribute("data-theme");
  return isTheme(t) ? t : "light";
};

/** Tombol tema terang/gelap. `onDark` = tampil di atas latar marun (header) atau di atas latar halaman biasa. */
export function ThemeToggle({ className, onDark = true }: { className?: string; onDark?: boolean }) {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  function toggle() {
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* mode privat: tema tetap berlaku untuk sesi ini */ }
    window.dispatchEvent(new Event(EVENT));
  }
  return (
    <button
      type="button" onClick={toggle} data-testid="theme-toggle"
      aria-label={theme === "dark" ? "Ganti ke tema terang" : "Ganti ke tema gelap"} title={theme === "dark" ? "Tema terang" : "Tema gelap"}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-full transition-colors",
        onDark ? "text-white/90 hover:bg-white/10" : "border border-line bg-surface text-ink-soft hover:bg-hover",
        className,
      )}
    >
      {theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}
