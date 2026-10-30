/** Neutral streaming placeholder: no profile, preference, or access assumptions. */
export function PreparationSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
      data-testid="preparation-skeleton"
      data-preparation-panel=""
      className="grid min-w-0 lg:grid-cols-[17rem_minmax(0,1fr)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none select-none rounded-t-[1.7rem] bg-primary p-6 lg:rounded-tr-none lg:rounded-l-[1.7rem] lg:p-8"
      >
        <div className="motion-safe:animate-pulse motion-reduce:animate-none">
          <div className="hidden lg:block">
            <div className="h-3 w-28 rounded bg-accent/40" />
            <div className="mt-5 h-8 w-4/5 rounded-md bg-primary-foreground/15" />
            <div className="mt-3 h-8 w-3/5 rounded-md bg-primary-foreground/15" />
          </div>
          <div className="grid grid-cols-3 gap-3 lg:mt-10 lg:grid-cols-1 lg:gap-6">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="size-8 shrink-0 rounded-full bg-primary-foreground/15" />
                <div className="h-3 w-full max-w-24 rounded bg-primary-foreground/15" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="min-w-0 px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none select-none motion-safe:animate-pulse motion-reduce:animate-none"
        >
          <div className="h-3 w-28 max-w-full rounded bg-foreground/7" />
          <div className="mt-4 h-9 w-4/5 rounded-md bg-foreground/12" />
          <div className="mt-4 h-3.5 w-full rounded bg-foreground/7" />
          <div className="mt-2 h-3.5 w-3/5 rounded bg-foreground/7" />
          <div className="mt-8 space-y-4">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="space-y-3 rounded-2xl border border-foreground/10 bg-background p-5"
              >
                <div className="h-4 w-2/5 rounded bg-foreground/10" />
                <div className="h-3 w-4/5 rounded bg-foreground/7" />
              </div>
            ))}
          </div>
          <div className="mt-8 flex h-12 items-center justify-center rounded-xl bg-primary/15">
            <div className="h-3 w-28 rounded bg-primary/20" />
          </div>
        </div>
        <p className="mt-6 flex items-center justify-center gap-2.5 text-xs leading-relaxed text-muted-foreground">
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-accent"
          />
          Preparing your Quilla space…
        </p>
      </div>
    </div>
  );
}
