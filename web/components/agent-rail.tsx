"use client";

import { Bot, CircleCheck, CircleX, LoaderCircle, Radio } from "lucide-react";
import type { AgentActivity } from "@/lib/webmcp";
import { cn } from "@/lib/utils";

const TOOLS = [
  { name: "get_transcript", hint: "url → transcript" },
  { name: "get_video_info", hint: "url → title, duration, captions" },
  { name: "transcribe_file", hint: "the file you dropped → transcript" },
];

function StatusIcon({ status }: { status: AgentActivity["status"] }) {
  if (status === "running")
    return <LoaderCircle className="size-3.5 animate-spin text-primary" strokeWidth={1.5} />;
  if (status === "done") return <CircleCheck className="size-3.5 text-primary" strokeWidth={1.5} />;
  return <CircleX className="size-3.5 text-destructive" strokeWidth={1.5} />;
}

export function AgentRail({
  webmcpCount,
  activities,
}: {
  webmcpCount: number | null;
  activities: AgentActivity[];
}) {
  const live = (webmcpCount ?? 0) > 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#9fd8f5] bg-accent/40 p-5 animate-fade-up [animation-delay:150ms] dark:border-[#2a4a5c]">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Bot className="size-4" strokeWidth={1.5} />
          Agent surface
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-widest",
            live ? "bg-card text-foreground" : "bg-foreground/5 text-muted-foreground",
          )}
        >
          <span className="relative flex size-1.5">
            {live && (
              <span className="absolute inline-flex size-full rounded-full bg-primary [animation:ping-soft_1.6s_cubic-bezier(0.16,1,0.3,1)_infinite]" />
            )}
            <span
              className={cn(
                "relative inline-flex size-1.5 rounded-full",
                live ? "bg-primary" : "bg-muted-foreground/50",
              )}
            />
          </span>
          {live ? "3 tools live" : "not detected"}
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-foreground/70">
        {live
          ? "This page registers WebMCP tools. A browser agent can call them natively - you watch it happen here."
          : webmcpCount === null
            ? "Checking for WebMCP…"
            : "Your browser has no WebMCP. Open this page in ChatGPT's browser, or enable chrome://flags/#enable-webmcp-testing."}
      </p>

      <ul className="mt-4 space-y-2">
        {TOOLS.map((tool) => (
          <li
            key={tool.name}
            className="rounded-lg border border-border bg-card px-3.5 py-2.5 shadow-[0_1px_2px_rgba(10,12,15,0.04)] dark:shadow-none"
          >
            <code className="font-mono text-xs font-semibold text-foreground">{tool.name}</code>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{tool.hint}</p>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/60">
        <Radio className="size-3" strokeWidth={1.5} /> Activity
      </div>
      <ul className="mt-2 min-h-16 flex-1 space-y-1.5 overflow-y-auto">
        {activities.length === 0 && (
          <li className="rounded-lg border border-dashed border-foreground/15 px-3 py-3 text-center font-mono text-[11px] text-muted-foreground">
            No agent calls yet.
          </li>
        )}
        {activities.map((activity) => (
          <li
            key={activity.id}
            className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 shadow-[0_1px_2px_rgba(10,12,15,0.04)] animate-fade-up dark:shadow-none"
          >
            <StatusIcon status={activity.status} />
            <span className="font-mono text-[11px] font-semibold text-foreground">
              {activity.tool}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
              {activity.detail}
            </span>
            {activity.durationMs !== undefined && (
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/80">
                {(activity.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
