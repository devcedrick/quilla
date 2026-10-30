"use client";

import { SignOutButton } from "@clerk/nextjs";

export function SignOut({
  variant = "button",
}: {
  variant?: "button" | "text";
}) {
  return (
    <SignOutButton redirectUrl="/">
      <button
        type="button"
        className={
          variant === "text"
            ? "inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            : "min-h-11 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transition-none"
        }
      >
        Sign out
      </button>
    </SignOutButton>
  );
}
