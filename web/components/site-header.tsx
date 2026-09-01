"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const GITHUB_URL = "https://github.com/pinokokol/transcriptly";
const PILL_CLASS_NAME =
  "group inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-medium text-foreground transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-foreground/25 active:scale-[0.98]";

export function SiteHeader({ current }: { current?: "home" | "docs" }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 py-6 animate-fade-up">
      <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5">
        <img src="/logo.svg" alt="" className="size-7" />
        <span className="text-[15px] font-semibold tracking-tight">transcriptly</span>
      </Link>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        <Link
          href="/docs"
          className={cn(PILL_CLASS_NAME, current === "docs" && "border-foreground/25 text-foreground")}
        >
          Docs
        </Link>
        <a href={GITHUB_URL} className={PILL_CLASS_NAME}>
          <svg
            data-component="Octicon"
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="currentColor"
            display="inline-block"
            overflow="visible"
          >
            <path d="M10.226 17.284c-2.965-.36-5.054-2.493-5.054-5.256 0-1.123.404-2.336 1.078-3.144-.292-.741-.247-2.314.09-2.965.898-.112 2.111.36 2.83 1.01.853-.269 1.752-.404 2.853-.404 1.1 0 1.999.135 2.807.382.696-.629 1.932-1.1 2.83-.988.315.606.36 2.179.067 2.942.72.854 1.101 2 1.101 3.167 0 2.763-2.089 4.852-5.098 5.234.763.494 1.28 1.572 1.28 2.807v2.336c0 .674.561 1.056 1.235.786 4.066-1.55 7.255-5.615 7.255-10.646C23.5 6.188 18.334 1 11.978 1 5.62 1 .5 6.188.5 12.545c0 4.986 3.167 9.12 7.435 10.669.606.225 1.19-.18 1.19-.786V20.63a2.9 2.9 0 0 1-1.078.224c-1.483 0-2.359-.808-2.987-2.313-.247-.607-.517-.966-1.034-1.033-.27-.023-.359-.135-.359-.27 0-.27.45-.471.898-.471.652 0 1.213.404 1.797 1.235.45.651.921.943 1.483.943.561 0 .92-.202 1.437-.719.382-.381.674-.718.944-.943"></path>
          </svg>
          <p>GitHub</p>
        </a>
        <ThemeToggle />
      </span>
    </header>
  );
}
