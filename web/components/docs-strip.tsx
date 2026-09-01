"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Shell } from "@/components/shell";
import { SurfaceArt, type SurfaceKind } from "@/components/surface-art";

const SURFACES = [
  {
    name: "CLI",
    art: "cli" as SurfaceKind,
    tagline: "One command, fully local.",
    snippet: "npm i -g transcriptly && transcriptly <url>",
    note: "Whisper runs on your machine. YouTube, TikTok, Facebook, X, local files.",
  },
  {
    name: "MCP",
    art: "mcp" as SurfaceKind,
    tagline: "Give your agent ears.",
    snippet: "claude mcp add transcriptly -- npx -y transcriptly mcp",
    note: "get_transcript + get_video_info in Claude, ChatGPT, anywhere MCP works.",
  },
  {
    name: "REST",
    art: "rest" as SurfaceKind,
    tagline: "This site's demo API.",
    snippet: "curl 'https://transcriptly.dev/api/transcript?url=…'",
    note: "Demo only: 5/hour, 30-minute cap. Self-host it for real workloads.",
  },
  {
    name: "WebMCP",
    art: "webmcp" as SurfaceKind,
    tagline: "Tools on this very page.",
    snippet: "await document.modelContext.registerTool({…})",
    note: "Browser agents call get_transcript natively. Watch it in the rail above.",
  },
];

export function DocsStrip() {
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <section className="border-t border-border py-20 sm:py-28">
      <div className="max-w-2xl">
        <h2 className="mt-4 text-3xl font-bold tracking-tighter sm:text-4xl">Use it wherever your work happens</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          <Link
            href="/docs"
            className="underline decoration-foreground/20 underline-offset-4 transition-colors hover:text-foreground"
          >
            Read the full docs
          </Link>
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {SURFACES.map((surface, index) => (
          <Shell key={surface.name} className="min-w-0 animate-fade-up">
            <div className="flex h-full min-w-0 flex-col p-5 sm:p-6" style={{ animationDelay: `${index * 80}ms` }}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-mono text-sm font-bold text-primary">{surface.name}</h3>
                <p className="text-sm text-muted-foreground">{surface.tagline}</p>
              </div>
              <div className="mt-5">
                <SurfaceArt kind={surface.art} />
              </div>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(surface.snippet);
                  setCopied(surface.name);
                  setTimeout(() => setCopied(null), 1500);
                }}
                className="group mt-4 flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.99] dark:border dark:border-white/10"
                style={{ backgroundColor: "var(--ink)" }}
              >
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-white/90">{surface.snippet}</code>
                {copied === surface.name ? (
                  <Check className="size-3.5 shrink-0 text-[#7ee0a3]" strokeWidth={2} />
                ) : (
                  <Copy
                    className="size-3.5 shrink-0 text-white/50 transition-colors group-hover:text-white"
                    strokeWidth={1.5}
                  />
                )}
              </button>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{surface.note}</p>
            </div>
          </Shell>
        ))}
      </div>
    </section>
  );
}
