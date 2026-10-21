"use client";

import { AuthPageShell } from "./auth-page-shell";

export function AccountError({ reset }: { reset: () => void }) {
  return (
    <AuthPageShell title="Account access is unavailable">
      <div className="space-y-5">
        <p role="alert">
          We could not verify account access. Please try again or return home.
        </p>
        <button
          onClick={reset}
          className="min-h-11 rounded-full bg-primary px-5 py-3 text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Try again
        </button>
      </div>
    </AuthPageShell>
  );
}
