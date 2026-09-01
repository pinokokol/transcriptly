"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Check, FileAudio, LoaderCircle } from "lucide-react";
import { PlayMark, Shell } from "@/components/shell";
import type { ProgressStage } from "@/lib/api";
import { cn } from "@/lib/utils";

export type DemoProgress = Omit<ProgressStage, "stage"> & {
  stage: ProgressStage["stage"] | "uploading";
  source: "url" | "upload";
  startedAt: number;
};

const URL_STEPS = [
  { stage: "resolving", label: "Looking up source" },
  { stage: "downloading", label: "Downloading audio" },
  { stage: "transcribing", label: "Transcribing" },
] as const;

const UPLOAD_STEPS = [
  { stage: "uploading", label: "Uploading" },
  { stage: "transcribing", label: "Transcribing" },
] as const;

function formatDuration(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function ProgressStepper({ progress }: { progress: DemoProgress }) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (progress.stage !== "transcribing") return;
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [progress.stage, progress.startedAt]);

  if (progress.stage === "cached") {
    return (
      <div
        role="status"
        className="mt-4 flex items-center gap-1.5 text-xs text-foreground animate-fade-up"
      >
        <Check className="size-3.5" strokeWidth={1.5} />
        Cached, instant
      </div>
    );
  }

  const steps = progress.source === "upload" ? UPLOAD_STEPS : URL_STEPS;
  const activeIndex = steps.findIndex((step) => step.stage === progress.stage);
  const elapsedSeconds = Math.max(0, Math.floor((now - progress.startedAt) / 1_000));

  return (
    <div
      role="status"
      className="mt-4 flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-2 text-xs animate-fade-up"
    >
      {steps.map((step, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        const showContext =
          active && (progress.stage === "downloading" || progress.stage === "transcribing");

        return (
          <div
            key={step.stage}
            className={cn(
              "flex min-w-0 max-w-full items-center gap-1.5",
              done || active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {done ? (
              <Check className="size-3 shrink-0" strokeWidth={1.5} />
            ) : active ? (
              <span className="relative flex size-1.5 shrink-0">
                <span className="absolute inline-flex size-full rounded-full bg-primary [animation:ping-soft_1.2s_cubic-bezier(0.16,1,0.3,1)_infinite]" />
                <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
              </span>
            ) : (
              <span className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
            )}
            <span className="shrink-0">{step.label}</span>
            {showContext && (
              <span className="flex min-w-0 max-w-full items-center gap-1.5 text-muted-foreground">
                {progress.title && (
                  <span className="min-w-0 max-w-40 truncate sm:max-w-56">{progress.title}</span>
                )}
                {progress.duration !== undefined && (
                  <span className="shrink-0 font-mono tabular-nums">
                    {formatDuration(progress.duration)}
                  </span>
                )}
                {progress.stage === "transcribing" && (
                  <span className="shrink-0 font-mono tabular-nums text-foreground">
                    {elapsedSeconds}s
                  </span>
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Demo({
  busy,
  progress,
  onTranscribeUrl,
  onFileDropped,
}: {
  busy: boolean;
  progress: DemoProgress | null;
  onTranscribeUrl: (url: string) => void;
  onFileDropped: (file: File) => void;
}) {
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const submit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (url.trim() && !busy) onTranscribeUrl(url.trim());
    },
    [url, busy, onTranscribeUrl],
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files[0];
      if (file && !busy) onFileDropped(file);
    },
    [busy, onFileDropped],
  );

  return (
    <Shell
      className={cn(
        "offset-card transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        dragging && "border-primary/60 bg-red-50 dark:bg-red-950/30",
      )}
    >
      <div
        className="p-5 sm:p-6"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Paste a video URL…"
            disabled={busy}
            className="h-12 w-full min-w-0 sm:flex-1 rounded-lg border border-input bg-card px-4 font-mono text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2.5 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[#d40e0e] active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" strokeWidth={2} />
            ) : (
              <PlayMark className="size-2.5 fill-white" />
            )}
            {busy ? "Working" : "Transcribe"}
          </button>
        </form>

        {progress && <ProgressStepper progress={progress} />}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-foreground/20 px-3 py-1.5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-primary/50 hover:text-foreground disabled:opacity-40"
          >
            <FileAudio className="size-3.5" strokeWidth={1.5} />
            or drop an audio/video file on this card
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="audio/*,video/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFileDropped(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>
    </Shell>
  );
}
