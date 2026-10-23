function FieldSkeleton() {
  return (
    <div className="space-y-2.5" data-skeleton-field="">
      <div className="h-3 w-20 max-w-full rounded bg-foreground/10" />
      <div className="flex h-12 items-center rounded-[0.625rem] border border-foreground/10 bg-background px-3.5">
        <div className="h-2.5 w-2/5 rounded bg-foreground/8" />
      </div>
    </div>
  );
}

/** Shared across server streaming, provider boot, and Clerk UI mounting. */
export function AuthFormSkeleton({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="auth-form-skeleton"
      data-mode={mode}
      className="w-full min-w-0 py-1"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none select-none motion-safe:animate-pulse motion-reduce:animate-none"
      >
        <div className="h-8 w-3/4 rounded-md bg-foreground/12" />
        <div className="mt-3 h-3.5 w-full rounded bg-foreground/7" />
        <div className="mt-2 h-3.5 w-3/5 rounded bg-foreground/7" />
        <div className="mt-8 space-y-5">
          {mode === "sign-up" && (
            <div className="grid grid-cols-2 gap-4">
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
          )}
          <FieldSkeleton />
          {mode === "sign-up" && <FieldSkeleton />}
        </div>
        <div className="mt-6 flex h-12 items-center justify-center rounded-[0.625rem] bg-primary/15">
          <div className="h-3 w-24 rounded bg-primary/20" />
        </div>
        <div className="mx-auto mt-7 h-3 w-3/5 rounded bg-foreground/7" />
        <div className="mx-auto mt-7 h-px w-full bg-border/40" />
      </div>
      <p className="mt-5 flex items-center justify-center gap-2.5 text-xs leading-relaxed text-muted-foreground">
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-accent"
        />
        {mode === "sign-in"
          ? "Preparing secure sign-in…"
          : "Preparing your account form…"}
      </p>
    </div>
  );
}
