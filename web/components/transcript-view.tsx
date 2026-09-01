"use client";

import { useCallback, useState } from "react";
import { Bot, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { fetchTranscriptAs, type TranscriptFormat, type TranscriptJson } from "@/lib/api";
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
  source,
  agentFetched,
}: {
  transcript: TranscriptJson;
  source: string;
  agentFetched: boolean;
}) {
  const [copied, setCopied] = useState<TranscriptFormat | null>(null);
  const isUrl = /^https?:\/\//.test(source);

  const copyAs = useCallback(
    async (format: TranscriptFormat) => {
      try {
        const text = isUrl
          ? await fetchTranscriptAs(source, format)
          : format === "json"
            ? JSON.stringify(transcript, null, 2)
            : transcript.text;
        await navigator.clipboard.writeText(text);
        setCopied(format);
        setTimeout(() => setCopied(null), 1500);
      } catch {
        toast.error("Copy failed.");
      }
    },
    [isUrl, source, transcript],
  );

  return (
    <Shell className="animate-fade-up">
      <div className={cn("p-5 sm:p-6", agentFetched && "agent-sweep rounded-[inherit]")}>
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
          <div className="flex items-center gap-1.5">
            {COPY_FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => copyAs(format)}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-foreground/30 hover:text-foreground active:scale-[0.97]"
              >
                {copied === format ? (
                  <Check className="size-3 text-primary" strokeWidth={2} />
                ) : (
                  <Copy className="size-3" strokeWidth={1.5} />
                )}
                {format}
              </button>
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
