"use client";

import { useCallback, useState } from "react";
import { Bot, Check, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import type { TranscriptFormat, TranscriptJson } from "@/lib/api";
import { downloadTranscript, formatTranscript } from "@/lib/format";
import { cn } from "@/lib/utils";

function timestamp(seconds: number): string {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  const hours = Math.floor(minutes / 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes % 60)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}

function duration(seconds: number | undefined): string | null {
  if (seconds === undefined) return null;
  return `${Math.round(seconds)}s`;
}

const COPY_FORMATS: TranscriptFormat[] = ["md", "txt", "srt", "json"];

export function TranscriptView({
  transcript,
  agentFetched,
}: {
  transcript: TranscriptJson;
  agentFetched: boolean;
}) {
  const [copied, setCopied] = useState<TranscriptFormat | null>(null);

  const copyAs = useCallback(
    async (format: TranscriptFormat) => {
      try {
        await navigator.clipboard.writeText(formatTranscript(transcript, format));
        setCopied(format);
        setTimeout(() => setCopied(null), 1500);
      } catch {
        toast.error("Copy failed.");
      }
    },
    [transcript],
  );

  const downloadAs = useCallback(
    (format: TranscriptFormat) => {
      try {
        downloadTranscript(transcript, format);
      } catch {
        toast.error("Download failed.");
      }
    },
    [transcript],
  );

  return (
    <Shell className={cn("animate-fade-up", agentFetched && "offset-card")}>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {transcript.metadata.title ?? "Transcript"}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
              {transcript.metadata.platform && <span>{transcript.metadata.platform}</span>}
              {duration(transcript.metadata.duration) && (
                <span>{duration(transcript.metadata.duration)}</span>
              )}
              <span>{transcript.segments.length} segments</span>
              {agentFetched && (
                <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 font-medium text-accent-foreground">
                  <Bot className="size-3" strokeWidth={1.5} /> fetched by an agent
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {COPY_FORMATS.map((format) => (
              <span
                key={format}
                className="inline-flex items-stretch overflow-hidden rounded-md border border-border bg-card font-mono text-[11px] text-muted-foreground transition-colors duration-300 hover:border-foreground/30"
              >
                <button
                  type="button"
                  onClick={() => copyAs(format)}
                  aria-label={`Copy as ${format}`}
                  className="inline-flex items-center gap-1 py-1 pr-2 pl-2.5 transition-colors hover:bg-foreground/5 hover:text-foreground active:scale-[0.97]"
                >
                  {copied === format ? (
                    <Check className="size-3 text-primary" strokeWidth={2} />
                  ) : (
                    <Copy className="size-3" strokeWidth={1.5} />
                  )}
                  {format}
                </button>
                <button
                  type="button"
                  onClick={() => downloadAs(format)}
                  aria-label={`Download as ${format}`}
                  title={`Download .${format}`}
                  className="inline-flex items-center border-l border-border px-1.5 transition-colors hover:bg-foreground/5 hover:text-foreground active:scale-[0.97]"
                >
                  <Download className="size-3" strokeWidth={1.5} />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 max-h-[26rem] space-y-3.5 overflow-y-auto border-t border-foreground/[0.07] pt-5 pr-2">
          {transcript.segments.map((segment, index) => (
            <div key={`${segment.start}-${index}`} className="group flex gap-4">
              <span className="mt-0.5 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground transition-colors group-hover:text-primary">
                {timestamp(segment.start)}
              </span>
              <p className="text-sm leading-relaxed text-foreground/90">{segment.text}</p>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
