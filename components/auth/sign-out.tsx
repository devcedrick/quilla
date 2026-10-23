"use client";

import { SignOutButton } from "@clerk/nextjs";

export function SignOut() {
  return (
    <SignOutButton redirectUrl="/">
      <button className="min-h-11 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transition-none">
        Sign out
      </button>
    </SignOutButton>
  );
}
