"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Copy, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { AgentRail } from "@/components/agent-rail";
import { Demo } from "@/components/demo";
import { DocsStrip } from "@/components/docs-strip";
import { PlayMark } from "@/components/shell";
import { TranscriptView } from "@/components/transcript-view";
import { WaitlistCard } from "@/components/waitlist-card";
import { ApiError, fetchTranscript, uploadTranscript, type TranscriptJson } from "@/lib/api";
import { useTheme } from "@/lib/use-theme";
import { registerTranscriptlyTools, type AgentActivity } from "@/lib/webmcp";

const GITHUB_URL = "https://github.com/pinokokol/transcriptly";
const INSTALL = "npm i -g transcriptly";

function InstallChip() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(INSTALL);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="group inline-flex items-center gap-3 rounded-lg bg-[--ink] py-2.5 pr-3 pl-4 font-mono text-sm text-white transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-black active:scale-[0.98] dark:border dark:border-white/10"
      style={{ backgroundColor: "var(--ink)" }}
    >
      {INSTALL}
      {copied ? (
        <Check className="size-4 text-[#7ee0a3]" strokeWidth={1.5} />
      ) : (
        <Copy className="size-4 opacity-60 transition-opacity group-hover:opacity-100" strokeWidth={1.5} />
      )}
    </button>
  );
}

function ThemeToggle() {
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

export default function Page() {
  const [transcript, setTranscript] = useState<TranscriptJson | null>(null);
  const [transcriptSource, setTranscriptSource] = useState("");
  const [agentFetched, setAgentFetched] = useState(false);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [webmcpCount, setWebmcpCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const droppedFile = useRef<File | null>(null);

  const showTranscript = useCallback((result: TranscriptJson, source: string, byAgent: boolean) => {
    setTranscript(result);
    setTranscriptSource(source);
    setAgentFetched(byAgent);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    registerTranscriptlyTools(
      {
        onActivityStart: (activity) => setActivities((current) => [activity, ...current]),
        onActivityEnd: (id, status, durationMs) =>
          setActivities((current) =>
            current.map((entry) => (entry.id === id ? { ...entry, status, durationMs } : entry)),
          ),
        getDroppedFile: () => droppedFile.current,
        showTranscript: (result, source) => showTranscript(result, source, true),
      },
      controller.signal,
    )
      .then(setWebmcpCount)
      .catch(() => setWebmcpCount(0));
    return () => controller.abort();
  }, [showTranscript]);

  const transcribeUrl = useCallback(
    async (url: string) => {
      setBusy(true);
      setBusyLabel("Fetching audio and transcribing - a first run takes a few seconds…");
      try {
        showTranscript(await fetchTranscript(url), url, false);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "Transcription failed. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [showTranscript],
  );

  const transcribeFile = useCallback(
    async (file: File) => {
      droppedFile.current = file;
      setBusy(true);
      setBusyLabel(`Uploading ${file.name} and transcribing…`);
      try {
        showTranscript(await uploadTranscript(file), file.name, false);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "Transcription failed. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [showTranscript],
  );

  return (
    <>
      <div className="flex items-center justify-center gap-2 bg-accent px-4 py-2 text-center text-xs font-medium text-accent-foreground">
        <PlayMark className="size-2" />
        OpenAI WebMCP Challenge entry - the agent tools on this page are real. Watch the rail.
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <header className="flex items-center justify-between py-6 animate-fade-up">
          <span className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" className="size-7" />
            <span className="text-[15px] font-semibold tracking-tight">transcriptly</span>
          </span>
          <span className="flex items-center gap-2">
            <a
              href={GITHUB_URL}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-medium text-foreground transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-foreground/25 active:scale-[0.98]"
            >
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

        <section className="pt-12 pb-16 sm:pt-16">
          <div className="max-w-3xl animate-fade-up">
            <h1 className="text-4xl font-bold tracking-tighter text-balance sm:text-6xl sm:leading-[1.05]">
              Any video URL,
              <br />
              one clean transcript
            </h1>
            <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
              Paste a link or drop a file. Open source, four ways in: a CLI, an MCP server, a REST API, and WebMCP tools
              that browser agents call right on this page.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <InstallChip />
              <span className="font-mono text-xs text-muted-foreground">or just try it below - no install</span>
            </div>
          </div>

          <div className="mt-14 grid items-start gap-5 lg:grid-cols-[1fr_21rem]">
            <div className="flex min-w-0 flex-col gap-5">
              <div className="animate-fade-up [animation-delay:80ms]">
                <Demo
                  busy={busy}
                  busyLabel={busyLabel}
                  onTranscribeUrl={transcribeUrl}
                  onFileDropped={transcribeFile}
                />
              </div>
              {transcript && (
                <TranscriptView
                  key={transcriptSource + String(agentFetched)}
                  transcript={transcript}
                  source={transcriptSource}
                  agentFetched={agentFetched}
                />
              )}
            </div>
            <AgentRail webmcpCount={webmcpCount} activities={activities} />
          </div>
        </section>

        <DocsStrip />
        <WaitlistCard />

        <footer className="flex flex-col items-start gap-2 border-t border-border py-10 text-xs leading-relaxed text-muted-foreground">
          <p>
            MIT licensed · maintained casually ·{" "}
            <a
              href={GITHUB_URL}
              className="underline decoration-foreground/20 underline-offset-4 transition-colors hover:text-foreground"
            >
              source on GitHub
            </a>
          </p>
          <p className="max-w-lg">
            The hosted api transcribes with Groq (whisper-large-v3-turbo); the CLI runs Whisper fully locally.
          </p>
        </footer>
      </main>
    </>
  );
}
