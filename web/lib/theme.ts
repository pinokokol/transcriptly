/* Server-safe half of the theme: shared constants and the pre-paint script.
   The hook lives in ./use-theme (a client module) - the root layout is a
   Server Component and cannot import client-only React APIs. */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const THEME_DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs synchronously in <head>, before the first paint, so the page never
 * flashes the wrong theme. Kept tiny and ES5; it mirrors the hook's logic.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("${THEME_DARK_QUERY}").matches?"dark":"light";document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}})()`;
