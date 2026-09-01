"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/use-theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="inline-flex size-[34px] items-center justify-center rounded-lg border border-border text-foreground transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-foreground/25 active:scale-[0.98]"
    >
      <Icon className="size-4" strokeWidth={1.5} />
    </button>
  );
}
