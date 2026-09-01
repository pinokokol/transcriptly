import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Flat card in the logo's language: white, hairline ink border, quiet shadow. */
export function Shell({
  children,
  className,
  innerClassName,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(10,12,15,0.04)] dark:shadow-none",
        className,
      )}
    >
      <div className={cn("rounded-[inherit]", innerClassName)}>{children}</div>
    </div>
  );
}

/** The logo's red play triangle, used as a small brand mark. */
export function PlayMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 12" aria-hidden className={cn("size-2.5 fill-primary", className)}>
      <path d="M0 0L10 6L0 12Z" />
    </svg>
  );
}
