/**
 * Tema terang/gelap. Pilihan disimpan di localStorage; tanpa pilihan, mengikuti preferensi sistem.
 * Skrip awal dijalankan SEBELUM halaman dicat (di <head>) sehingga tidak ada kedipan tema yang salah.
 */
export const THEME_KEY = "fms-theme";
export type Theme = "light" | "dark";

export const THEME_INIT_SCRIPT =
  `(function(){var d=document.documentElement,t;try{t=localStorage.getItem("${THEME_KEY}")}catch(e){}` +
  `if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}` +
  `d.setAttribute("data-theme",t)})();`;

export const isTheme = (v: unknown): v is Theme => v === "light" || v === "dark";
