"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div
      className={cn("relative min-w-0 max-w-full overflow-hidden rounded-xl dark:border dark:border-white/10", className)}
      style={{ backgroundColor: "var(--ink)" }}
    >
      <pre className="overflow-x-auto px-4 py-3.5 pr-14 font-mono text-[13px] leading-relaxed text-white/90">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        aria-label="Copy code"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute top-2.5 right-2.5 inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white/10 hover:text-white active:scale-[0.98]"
      >
        {copied ? (
          <Check className="size-4 text-[#7ee0a3]" strokeWidth={2} />
        ) : (
          <Copy className="size-4" strokeWidth={1.5} />
        )}
      </button>
    </div>
  );
}
