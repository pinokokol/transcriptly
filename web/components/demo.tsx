"use client";

import { useCallback, useRef, useState, type DragEvent, type FormEvent } from "react";
import { FileAudio, LoaderCircle } from "lucide-react";
import { PlayMark, Shell } from "@/components/shell";
import { cn } from "@/lib/utils";

export function Demo({
  busy,
  busyLabel,
  onTranscribeUrl,
  onFileDropped,
}: {
  busy: boolean;
  busyLabel: string;
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

        {busy && (
          <p className="mt-4 flex items-center gap-2 font-mono text-xs text-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-primary [animation:ping-soft_1.2s_cubic-bezier(0.16,1,0.3,1)_infinite]" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            {busyLabel}
          </p>
        )}
      </div>
    </Shell>
  );
}
