"use client";

import { useCallback, useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { THEME_DARK_QUERY, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

/* A module-level store: two components (the header toggle and the Toaster)
   read the same theme without a provider or a state library. */
let current: Theme = "light";
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Theme {
  return current;
}

function getServerSnapshot(): Theme {
  return "light";
}

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia(THEME_DARK_QUERY).matches ? "dark" : "light";
}

function apply(theme: Theme): void {
  current = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  for (const listener of listeners) listener();
}

let watching = false;

/** Follow the OS while no explicit choice is stored. Installed once. */
function watchSystem(): void {
  if (watching) return;
  watching = true;
  window.matchMedia(THEME_DARK_QUERY).addEventListener("change", (event) => {
    if (storedTheme() === null) apply(event.matches ? "dark" : "light");
  });
}

// useLayoutEffect warns when a client component is prerendered on the server.
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useBeforePaint(() => {
    // Also re-applies the class after React's dev-mode remount resets <html>.
    apply(storedTheme() ?? systemTheme());
    watchSystem();
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = current === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode: the choice just doesn't persist */
    }
    apply(next);
  }, []);

  return { theme, toggleTheme };
}
