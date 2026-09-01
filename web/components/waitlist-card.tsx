"use client";

import { useState, type FormEvent } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Eyebrow } from "@/components/shell";
import { ApiError, joinWaitlist } from "@/lib/api";

export function WaitlistCard() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (state !== "idle" || !email.trim()) return;
    setState("busy");
    try {
      await joinWaitlist(email.trim());
      setState("done");
    } catch (error) {
      setState("idle");
      toast.error(error instanceof ApiError ? error.message : "Something went wrong. Try again.");
    }
  };

  return (
    <section className="pb-20 sm:pb-28">
      <div className="offset-card rounded-2xl border border-border bg-card p-7 sm:p-10">
        <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Eyebrow>Demo limits</Eyebrow>
            <h2 className="mt-4 max-w-md text-2xl font-bold tracking-tighter sm:text-3xl">
              5 transcriptions an hour, 30 minutes a video
            </h2>
            <p className="mt-3 max-w-[48ch] text-sm leading-relaxed text-muted-foreground">
              The CLI has no limits and runs entirely on your machine. Want longer videos on hosted
              compute instead? Leave your email and tell me it&apos;s worth building.
            </p>
          </div>
          {state === "done" ? (
            <p className="inline-flex items-center gap-2 justify-self-start rounded-lg bg-accent px-5 py-3 text-sm font-medium text-accent-foreground lg:justify-self-end">
              <Check className="size-4" strokeWidth={2} /> You&apos;re on the list. Thanks!
            </p>
          ) : (
            <form onSubmit={submit} className="flex w-full flex-col gap-3 sm:flex-row lg:justify-end">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                disabled={state === "busy"}
                className="h-12 w-full min-w-0 rounded-lg border border-input bg-card px-4 font-mono text-sm text-foreground outline-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 sm:max-w-64"
              />
              <button
                type="submit"
                disabled={state === "busy"}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[#d40e0e] active:scale-[0.98] disabled:opacity-50"
              >
                {state === "busy" && <LoaderCircle className="size-4 animate-spin" strokeWidth={2} />}
                Join waitlist
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
